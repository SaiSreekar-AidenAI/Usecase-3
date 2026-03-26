import json
import logging

from user_agents import parse as parse_ua

logger = logging.getLogger(__name__)


def parse_device_info(user_agent: str | None, device_info_header: str | None = None) -> dict:
    """Parse User-Agent string and optional X-Device-Info header."""
    result = {
        "browser": "Unknown",
        "os": "Unknown",
        "device_type": "unknown",
        "screen_resolution": None,
        "timezone": None,
    }

    if user_agent:
        try:
            ua = parse_ua(user_agent)
            browser = ua.browser.family
            if ua.browser.version_string:
                browser += f" {ua.browser.version_string}"
            result["browser"] = browser
            result["os"] = f"{ua.os.family} {ua.os.version_string}".strip()
            if ua.is_mobile:
                result["device_type"] = "mobile"
            elif ua.is_tablet:
                result["device_type"] = "tablet"
            else:
                result["device_type"] = "desktop"
        except Exception:
            logger.debug("Failed to parse User-Agent", exc_info=True)

    if device_info_header:
        try:
            info = json.loads(device_info_header)
            if "screen" in info:
                result["screen_resolution"] = info["screen"]
            if "timezone" in info:
                result["timezone"] = info["timezone"]
        except (json.JSONDecodeError, TypeError):
            pass

    return result
