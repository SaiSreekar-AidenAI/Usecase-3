import time

import jwt

from ..config import get_settings


def create_access_token(user: dict, session_id: str) -> str:
    """Create a short-lived JWT access token with user claims."""
    settings = get_settings()
    now = int(time.time())
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "session_id": session_id,
        "iat": now,
        "exp": now + settings.jwt_access_token_expire_minutes * 60,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> tuple[dict | None, str]:
    """Decode a JWT access token.

    Returns (payload, status) where status is "valid", "expired", or "invalid".
    """
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        return payload, "valid"
    except jwt.ExpiredSignatureError:
        return None, "expired"
    except jwt.InvalidTokenError:
        return None, "invalid"
