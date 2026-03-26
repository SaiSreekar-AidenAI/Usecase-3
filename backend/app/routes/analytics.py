from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..audit.security import get_all_alerts
from ..database import (
    get_audit_events,
    get_daily_activity,
    get_login_attempts,
    get_overview_stats,
    get_session_activities,
    get_token_usage_by_user,
    get_token_usage_over_time,
    get_usage_heatmap,
    get_user_activity,
    update_session_heartbeat,
)

router = APIRouter()


class HeartbeatRequest(BaseModel):
    active: bool


@router.get("/api/analytics/overview")
async def overview():
    return await get_overview_stats()


@router.get("/api/analytics/daily-activity")
async def daily_activity(days: int = 30):
    return await get_daily_activity(days)


@router.get("/api/analytics/audit-log")
async def audit_log(
    page: int = 1,
    limit: int = 25,
    event_type: str | None = None,
    user_id: str | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
):
    items, total = await get_audit_events(
        event_type=event_type, user_id=user_id,
        from_ts=from_ts, to_ts=to_ts, page=page, limit=limit,
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/api/analytics/login-attempts")
async def login_attempts(
    page: int = 1,
    limit: int = 25,
    success: bool | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
):
    items, total = await get_login_attempts(
        success=success, from_ts=from_ts, to_ts=to_ts, page=page, limit=limit,
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/api/analytics/sessions")
async def sessions():
    return await get_session_activities()


@router.get("/api/analytics/user-activity")
async def user_activity(user_id: str):
    return await get_user_activity(user_id)


@router.get("/api/analytics/token-usage")
async def token_usage(
    from_ts: int | None = None,
    to_ts: int | None = None,
    group_by: str = "day",
):
    return await get_token_usage_over_time(from_ts=from_ts, to_ts=to_ts, group_by=group_by)


@router.get("/api/analytics/token-by-user")
async def token_by_user():
    return await get_token_usage_by_user()


@router.get("/api/analytics/security-alerts")
async def security_alerts():
    return await get_all_alerts()


@router.get("/api/analytics/usage-heatmap")
async def usage_heatmap():
    return await get_usage_heatmap()


@router.post("/api/analytics/heartbeat")
async def heartbeat(req: HeartbeatRequest, request: Request):
    session = getattr(request.state, "session", None)
    if session:
        await update_session_heartbeat(session["id"], req.active)
    return {"ok": True}
