import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..database import get_session_by_token, get_user_by_id
from .enforcer import get_enforcer

PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/check-email",
    "/api/auth/login",
}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Skip public paths and CORS preflight
        if path in PUBLIC_PATHS or method == "OPTIONS":
            return await call_next(request)

        # Extract token from cookie or Authorization header
        token = request.cookies.get("session_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]

        if not token:
            await self._emit_unauthorized(request, path, "no_token")
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
            )

        # Validate session
        session = await get_session_by_token(token)
        if not session:
            await self._emit_unauthorized(request, path, "invalid_session")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid session"},
            )

        now = int(time.time() * 1000)
        if session["expires_at"] < now:
            await self._emit_unauthorized(request, path, "session_expired")
            return JSONResponse(
                status_code=401,
                content={"detail": "Session expired"},
            )

        # Load user
        user = await get_user_by_id(session["user_id"])
        if not user or not user["is_active"]:
            await self._emit_unauthorized(request, path, "account_disabled")
            return JSONResponse(
                status_code=401,
                content={"detail": "Account disabled"},
            )

        # Casbin RBAC enforcement
        enforcer = get_enforcer()
        if not enforcer.enforce(user["role"], path, method):
            await self._emit_unauthorized(request, path, "insufficient_permissions")
            return JSONResponse(
                status_code=403,
                content={"detail": "Insufficient permissions"},
            )

        # Attach user and session to request state
        request.state.user = user
        request.state.session = session
        return await call_next(request)

    @staticmethod
    async def _emit_unauthorized(request: Request, path: str, reason: str) -> None:
        try:
            from ..audit.emitter import emit_unauthorized_access
            await emit_unauthorized_access(request, path, reason)
        except Exception:
            pass  # Never let audit failures block auth
