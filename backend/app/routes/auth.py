import secrets
import time
import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Request, Response

from ..audit.device import parse_device_info
from ..audit.emitter import emit_login_failure, emit_login_success, emit_logout
from ..audit.geo import lookup_ip
from ..auth.jwt import create_access_token
from ..config import get_settings
from ..database import (
    create_session,
    create_session_activity,
    delete_session,
    end_session_activity,
    get_session_by_token,
    get_user_by_email,
    get_user_by_id,
    save_login_attempt,
)
from ..models import (
    LoginCheckEmailRequest,
    LoginCheckEmailResponse,
    LoginRequest,
    LoginResponse,
    UserResponse,
)

router = APIRouter()


@router.post("/api/auth/check-email", response_model=LoginCheckEmailResponse)
async def check_email(req: LoginCheckEmailRequest):
    user = await get_user_by_email(req.email.lower().strip())
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return LoginCheckEmailResponse(
        email=user["email"],
        requires_password=user["role"] == "admin",
        user_name=user["name"],
    )


async def _record_login_attempt(
    request: Request, user: dict | None, success: bool,
    session_id: str | None = None, failure_reason: str | None = None,
) -> None:
    """Record login attempt with device/geo info (fire-and-forget)."""
    ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not ip and request.client:
        ip = request.client.host

    ua = request.headers.get("User-Agent")
    device_header = request.headers.get("X-Device-Info")
    device = parse_device_info(ua, device_header)
    geo = await lookup_ip(ip)

    attempt = {
        "id": f"la-{uuid.uuid4().hex[:10]}",
        "user_id": user["id"] if user else None,
        "user_email": user["email"] if user else "unknown",
        "success": success,
        "ip_address": ip,
        "country": geo.get("country"),
        "city": geo.get("city"),
        "browser": device.get("browser"),
        "os": device.get("os"),
        "device_type": device.get("device_type"),
        "screen_resolution": device.get("screen_resolution"),
        "timezone": device.get("timezone"),
        "session_id": session_id,
        "failure_reason": failure_reason,
        "timestamp": int(time.time() * 1000),
    }
    await save_login_attempt(attempt)


@router.post("/api/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, response: Response):
    user = await get_user_by_email(req.email.lower().strip())
    if not user or not user["is_active"]:
        await _record_login_attempt(request, user, success=False, failure_reason="invalid_credentials")
        await emit_login_failure(req.email, request, "invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Admin users require password verification
    if user["role"] == "admin":
        if not req.password:
            await _record_login_attempt(request, user, success=False, failure_reason="password_required")
            await emit_login_failure(req.email, request, "password_required")
            raise HTTPException(status_code=400, detail="Password required for admin accounts")
        if not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
            await _record_login_attempt(request, user, success=False, failure_reason="wrong_password")
            await emit_login_failure(req.email, request, "wrong_password")
            raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create refresh token (opaque, stored in DB)
    settings = get_settings()
    refresh_token = secrets.token_urlsafe(32)
    now = int(time.time() * 1000)
    ttl_ms = settings.session_ttl_hours * 3600 * 1000
    session_id = f"sess-{uuid.uuid4().hex[:12]}"

    await create_session(session_id, user["id"], refresh_token, now, now + ttl_ms)
    await create_session_activity(session_id, user["id"])
    await _record_login_attempt(request, user, success=True, session_id=session_id)
    await emit_login_success(user, request, session_id)

    # Create JWT access token (short-lived, stateless)
    access_token = create_access_token(user, session_id)

    # Set refresh token as httponly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.session_ttl_hours * 3600,
    )

    # Set JWT as cookie too (avoids Authorization header issues with Cloud Shell proxy)
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.jwt_access_token_expire_minutes * 60,
    )

    return LoginResponse(
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=user["role"],
            is_active=user["is_active"],
        ),
        token=access_token,
    )


@router.post("/api/auth/refresh")
async def refresh(request: Request, response: Response):
    """Exchange a valid refresh token for a new JWT access token."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    session = await get_session_by_token(refresh_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    now = int(time.time() * 1000)
    if session["expires_at"] < now:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = await get_user_by_id(session["user_id"])
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account disabled")

    access_token = create_access_token(user, session["id"])
    return {"token": access_token}


@router.get("/api/auth/me", response_model=UserResponse)
async def get_current_user(request: Request):
    user = request.state.user
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        is_active=user["is_active"],
    )


@router.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    user = request.state.user

    # Try to find and delete the refresh token session
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        session = await get_session_by_token(refresh_token)
        if session:
            await end_session_activity(session["id"])
        await delete_session(refresh_token)

    # Also clean up legacy session_token cookie if present
    legacy_token = request.cookies.get("session_token")
    if legacy_token:
        session = await get_session_by_token(legacy_token)
        if session:
            await end_session_activity(session["id"])
        await delete_session(legacy_token)

    await emit_logout(user, request)
    response.delete_cookie("refresh_token")
    response.delete_cookie("session_token")
    return {"logged_out": True}
