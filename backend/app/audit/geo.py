import logging
import time

import httpx

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 86400  # 24 hours
_API_URL = "http://ip-api.com/json"

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=5.0)
    return _client


async def close_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None


def _is_private_ip(ip: str) -> bool:
    """Check if IP is private/loopback."""
    return (
        ip.startswith("127.")
        or ip.startswith("10.")
        or ip.startswith("192.168.")
        or ip.startswith("172.16.")
        or ip == "::1"
        or ip == "localhost"
    )


async def lookup_ip(ip: str) -> dict:
    """Lookup country/city for an IP address. Returns cached results when available."""
    default = {"country": "Unknown", "city": "Unknown"}

    if not ip or _is_private_ip(ip):
        return {"country": "Local", "city": "Local"}

    # Check cache
    now = time.time()
    if ip in _cache:
        data, cached_at = _cache[ip]
        if now - cached_at < _CACHE_TTL:
            return data

    try:
        client = _get_client()
        resp = await client.get(f"{_API_URL}/{ip}")
        if resp.status_code == 200:
            body = resp.json()
            if body.get("status") == "success":
                result = {
                    "country": body.get("country", "Unknown"),
                    "city": body.get("city", "Unknown"),
                }
                _cache[ip] = (result, now)
                return result
    except Exception:
        logger.debug(f"Geo lookup failed for {ip}", exc_info=True)

    return default
