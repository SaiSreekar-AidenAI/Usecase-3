import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..database import get_session_by_token, get_user_by_id
from .enforcer import get_enforcer
from .jwt import create_access_token, decode_access_token

PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/check-email",
    "/api/auth/login",
    "/api/auth/refresh",
}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Skip non-API paths (frontend static files) and CORS preflight
        if not path.startswith("/api") or path in PUBLIC_PATHS or method == "OPTIONS":
            return await call_next(request)

        # Extract token from Authorization header or cookie
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        if not token:
            token = request.cookies.get("session_token")

        if not token:
            await self._emit_unauthorized(request, path, "no_token")
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
            )

        # ── Try JWT decode first (stateless, no DB call) ───────
        payload, jwt_status = decode_access_token(token)

        if jwt_status == "valid":
            # JWT is valid — build user from claims, no DB needed
            user = {
                "id": payload["sub"],
                "email": payload["email"],
                "name": payload["name"],
                "role": payload["role"],
                "is_active": True,
            }
            session = {"id": payload["session_id"]}

            if not self._check_rbac(user["role"], path, method):
                await self._emit_unauthorized(request, path, "insufficient_permissions")
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Insufficient permissions"},
                )

            request.state.user = user
            request.state.session = session
            return await call_next(request)

        # ── JWT expired or invalid — try refresh / legacy flow ─
        new_jwt = None

        if jwt_status == "expired":
            # Try refresh_token cookie
            refresh_token = request.cookies.get("refresh_token")
            if not refresh_token:
                await self._emit_unauthorized(request, path, "jwt_expired_no_refresh")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Token expired"},
                )
            user, session = await self._validate_refresh_token(refresh_token)
        else:
            # jwt_status == "invalid" — could be a legacy opaque token
            user, session = await self._validate_refresh_token(token)

        if not user:
            await self._emit_unauthorized(request, path, "invalid_session")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid session"},
            )

        if not self._check_rbac(user["role"], path, method):
            await self._emit_unauthorized(request, path, "insufficient_permissions")
            return JSONResponse(
                status_code=403,
                content={"detail": "Insufficient permissions"},
            )

        # Issue a fresh JWT so the client can use it for subsequent requests
        new_jwt = create_access_token(user, session["id"])

        request.state.user = user
        request.state.session = session
        response = await call_next(request)

        if new_jwt:
            response.headers["X-Access-Token"] = new_jwt
            response.set_cookie(
                key="session_token",
                value=new_jwt,
                httponly=True,
                secure=True,
                samesite="lax",
                max_age=1800,
            )

        return response

    async def _validate_refresh_token(
        self, token: str
    ) -> tuple[dict | None, dict | None]:
        """Validate an opaque refresh/session token via DB lookup."""
        session = await get_session_by_token(token)
        if not session:
            return None, None

        now = int(time.time() * 1000)
        if session["expires_at"] < now:
            return None, None

        user = await get_user_by_id(session["user_id"])
        if not user or not user["is_active"]:
            return None, None

        return user, session

    @staticmethod
    def _check_rbac(role: str, path: str, method: str) -> bool:
        enforcer = get_enforcer()
        return enforcer.enforce(role, path, method)

    # Routine session-presence pings — clients hit these on a timer, so a
    # stale tab whose session has expired would otherwise spam the audit log
    # with "unauthorized_access" forever. They are not meaningful security
    # events on their own.
    _AUDIT_EXEMPT_PATHS = frozenset({
        "/api/auth/me",
        "/api/analytics/heartbeat",
    })

    @staticmethod
    async def _emit_unauthorized(request: Request, path: str, reason: str) -> None:
        if path in AuthMiddleware._AUDIT_EXEMPT_PATHS:
            return
        try:
            from ..audit.emitter import emit_unauthorized_access
            await emit_unauthorized_access(request, path, reason)
        except Exception:
            pass  # Never let audit failures block auth
