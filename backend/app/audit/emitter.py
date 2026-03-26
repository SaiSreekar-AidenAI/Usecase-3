import json
import time
import uuid

from starlette.requests import Request

from .event_queue import emit_event


def _extract_ip(request: Request) -> str:
    """Extract client IP, checking X-Forwarded-For for Cloud Run."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _base_event(event_type: str, request: Request, user: dict | None = None) -> dict:
    """Build base event dict with common fields."""
    ev = {
        "id": f"evt-{uuid.uuid4().hex[:12]}",
        "event_type": event_type,
        "user_id": user["id"] if user else None,
        "user_email": user["email"] if user else None,
        "user_role": user["role"] if user else None,
        "ip_address": _extract_ip(request),
        "user_agent": request.headers.get("User-Agent"),
        "resource_id": None,
        "resource_type": None,
        "metadata_json": None,
        "timestamp": int(time.time() * 1000),
    }
    return ev


async def emit_login_success(user: dict, request: Request, session_id: str) -> None:
    ev = _base_event("login", request, user)
    ev["resource_id"] = session_id
    ev["resource_type"] = "session"
    ev["metadata_json"] = json.dumps({"device_info_header": request.headers.get("X-Device-Info")})
    await emit_event(ev)


async def emit_login_failure(email: str, request: Request, reason: str) -> None:
    ev = _base_event("auth_failure", request)
    ev["user_email"] = email
    ev["metadata_json"] = json.dumps({"reason": reason, "device_info_header": request.headers.get("X-Device-Info")})
    await emit_event(ev)


async def emit_logout(user: dict, request: Request) -> None:
    ev = _base_event("logout", request, user)
    await emit_event(ev)


async def emit_generate(user: dict, request: Request, conversation_id: str, token_data: dict | None = None) -> None:
    ev = _base_event("generate", request, user)
    ev["resource_id"] = conversation_id
    ev["resource_type"] = "conversation"
    if token_data:
        ev["metadata_json"] = json.dumps(token_data)
    await emit_event(ev)


async def emit_history_view(user: dict, request: Request) -> None:
    ev = _base_event("history_view", request, user)
    ev["resource_type"] = "conversation"
    await emit_event(ev)


async def emit_history_edit(user: dict, request: Request, conv_id: str) -> None:
    ev = _base_event("history_edit", request, user)
    ev["resource_id"] = conv_id
    ev["resource_type"] = "conversation"
    await emit_event(ev)


async def emit_history_delete(user: dict, request: Request, conv_id: str) -> None:
    ev = _base_event("history_delete", request, user)
    ev["resource_id"] = conv_id
    ev["resource_type"] = "conversation"
    await emit_event(ev)


async def emit_history_clear(user: dict, request: Request, count: int) -> None:
    ev = _base_event("history_clear", request, user)
    ev["resource_type"] = "conversation"
    ev["metadata_json"] = json.dumps({"deleted_count": count})
    await emit_event(ev)


async def emit_user_create(admin: dict, request: Request, target_user_id: str) -> None:
    ev = _base_event("user_create", request, admin)
    ev["resource_id"] = target_user_id
    ev["resource_type"] = "user"
    await emit_event(ev)


async def emit_user_update(admin: dict, request: Request, target_user_id: str) -> None:
    ev = _base_event("user_update", request, admin)
    ev["resource_id"] = target_user_id
    ev["resource_type"] = "user"
    await emit_event(ev)


async def emit_user_delete(admin: dict, request: Request, target_user_id: str) -> None:
    ev = _base_event("user_delete", request, admin)
    ev["resource_id"] = target_user_id
    ev["resource_type"] = "user"
    await emit_event(ev)


async def emit_unauthorized_access(request: Request, path: str, reason: str) -> None:
    ev = _base_event("unauthorized_access", request)
    ev["metadata_json"] = json.dumps({"path": path, "method": request.method, "reason": reason})
    await emit_event(ev)
