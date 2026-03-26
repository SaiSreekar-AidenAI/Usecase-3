import time


async def detect_multi_ip_logins(hours: int = 1) -> list[dict]:
    """Find users who logged in from multiple IPs within the time window."""
    from ..database import query_multi_ip_logins
    return await query_multi_ip_logins(hours)


async def detect_rapid_requests(minutes: int = 5, threshold: int = 50) -> list[dict]:
    """Find users with more than threshold requests in the time window."""
    from ..database import query_rapid_requests
    return await query_rapid_requests(minutes, threshold)


async def detect_off_hours_access(start_hour: int = 9, end_hour: int = 18) -> list[dict]:
    """Find recent accesses outside working hours (UTC-based)."""
    from ..database import query_off_hours_access
    return await query_off_hours_access(start_hour, end_hour)


async def detect_repeated_failures(hours: int = 1, threshold: int = 5) -> list[dict]:
    """Find emails with repeated auth failures in the time window."""
    from ..database import query_repeated_failures
    return await query_repeated_failures(hours, threshold)


async def get_all_alerts() -> list[dict]:
    """Run all security detectors and return combined alerts."""
    alerts: list[dict] = []
    now = int(time.time() * 1000)

    for item in await detect_multi_ip_logins():
        alerts.append({
            "alert_type": "multi_ip_login",
            "severity": "high",
            "user_email": item.get("user_email"),
            "description": f"Login from {item.get('ip_count', 0)} different IPs in the last hour",
            "details": item,
            "timestamp": now,
        })

    for item in await detect_rapid_requests():
        alerts.append({
            "alert_type": "rapid_requests",
            "severity": "medium",
            "user_email": item.get("user_email"),
            "description": f"{item.get('request_count', 0)} requests in the last 5 minutes",
            "details": item,
            "timestamp": now,
        })

    for item in await detect_off_hours_access():
        alerts.append({
            "alert_type": "off_hours_access",
            "severity": "low",
            "user_email": item.get("user_email"),
            "description": f"Access at {item.get('hour', '?')}:00 UTC (outside 9-18)",
            "details": item,
            "timestamp": now,
        })

    for item in await detect_repeated_failures():
        alerts.append({
            "alert_type": "repeated_auth_failure",
            "severity": "high",
            "user_email": item.get("user_email"),
            "description": f"{item.get('failure_count', 0)} failed login attempts in the last hour",
            "details": item,
            "timestamp": now,
        })

    alerts.sort(key=lambda a: ({"high": 0, "medium": 1, "low": 2}.get(a["severity"], 3), -a["timestamp"]))
    return alerts
