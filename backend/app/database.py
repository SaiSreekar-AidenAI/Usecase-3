import json
import time
import uuid
from pathlib import Path

from .config import get_settings

_pool = None  # asyncpg.Pool (production)
_sqlite_conn = None  # aiosqlite connection (local)
_is_local = False

_CREATE_CONVERSATIONS = """
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        query TEXT NOT NULL,
        response TEXT NOT NULL,
        reasoning TEXT,
        sources_json TEXT,
        custom_prompt TEXT,
        timestamp BIGINT NOT NULL
    )
"""

_CREATE_USERS = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
    )
"""

_CREATE_SESSIONS = """
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
    )
"""

_CREATE_AUDIT_EVENTS = """
    CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        user_id TEXT,
        user_email TEXT,
        user_role TEXT,
        ip_address TEXT,
        user_agent TEXT,
        resource_id TEXT,
        resource_type TEXT,
        metadata_json TEXT,
        timestamp BIGINT NOT NULL
    )
"""

_CREATE_LOGIN_ATTEMPTS = """
    CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT NOT NULL,
        success INTEGER NOT NULL,
        ip_address TEXT,
        country TEXT,
        city TEXT,
        browser TEXT,
        os TEXT,
        device_type TEXT,
        screen_resolution TEXT,
        timezone TEXT,
        session_id TEXT,
        failure_reason TEXT,
        timestamp BIGINT NOT NULL
    )
"""

_CREATE_SESSION_ACTIVITY = """
    CREATE TABLE IF NOT EXISTS session_activity (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        started_at BIGINT NOT NULL,
        ended_at BIGINT,
        last_activity_at BIGINT NOT NULL,
        active_duration_ms BIGINT NOT NULL DEFAULT 0,
        idle_duration_ms BIGINT NOT NULL DEFAULT 0,
        page_views INTEGER NOT NULL DEFAULT 0,
        actions_count INTEGER NOT NULL DEFAULT 0
    )
"""

_CREATE_TOKEN_USAGE = """
    CREATE TABLE IF NOT EXISTS token_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT,
        conversation_id TEXT,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        thinking_tokens INTEGER NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        timestamp BIGINT NOT NULL
    )
"""

_CREATE_QUERY_CACHE = """
    CREATE TABLE IF NOT EXISTS query_cache (
        id TEXT PRIMARY KEY,
        query_hash TEXT NOT NULL,
        query_text TEXT NOT NULL,
        response TEXT NOT NULL,
        reasoning TEXT,
        sources_json TEXT,
        hit_count INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        last_accessed_at BIGINT NOT NULL
    )
"""

_CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type)",
    "CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(user_email)",
    "CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address)",
    "CREATE INDEX IF NOT EXISTS idx_login_attempts_ts ON login_attempts(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_session_activity_user ON session_activity(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_session_activity_session ON session_activity(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_token_usage_ts ON token_usage(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON query_cache(query_hash)",
    "CREATE INDEX IF NOT EXISTS idx_query_cache_active ON query_cache(is_active)",
]


async def init_db() -> None:
    global _pool, _sqlite_conn, _is_local
    settings = get_settings()
    _is_local = settings.is_local

    if _is_local:
        import aiosqlite
        Path(settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        _sqlite_conn = await aiosqlite.connect(settings.sqlite_path)
        _sqlite_conn.row_factory = aiosqlite.Row
        for ddl in [_CREATE_CONVERSATIONS, _CREATE_USERS, _CREATE_SESSIONS,
                     _CREATE_AUDIT_EVENTS, _CREATE_LOGIN_ATTEMPTS,
                     _CREATE_SESSION_ACTIVITY, _CREATE_TOKEN_USAGE,
                     _CREATE_QUERY_CACHE]:
            await _sqlite_conn.execute(ddl)
        # Migration: add user_id to conversations if missing (SQLite has no IF NOT EXISTS for columns)
        try:
            await _sqlite_conn.execute("ALTER TABLE conversations ADD COLUMN user_id TEXT")
        except Exception:
            pass
        for idx in _CREATE_INDEXES:
            await _sqlite_conn.execute(idx)
        await _sqlite_conn.commit()
    else:
        import asyncpg
        _pool = await asyncpg.create_pool(dsn=settings.database_url)
        async with _pool.acquire() as conn:
            for ddl in [_CREATE_CONVERSATIONS, _CREATE_USERS, _CREATE_SESSIONS,
                         _CREATE_AUDIT_EVENTS, _CREATE_LOGIN_ATTEMPTS,
                         _CREATE_SESSION_ACTIVITY, _CREATE_TOKEN_USAGE,
                         _CREATE_QUERY_CACHE]:
                await conn.execute(ddl)
            # Migration: add user_id to conversations if missing
            await conn.execute(
                "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id TEXT"
            )
            for idx in _CREATE_INDEXES:
                await conn.execute(idx)


async def close_db() -> None:
    global _pool, _sqlite_conn
    if _is_local:
        if _sqlite_conn:
            await _sqlite_conn.close()
            _sqlite_conn = None
    else:
        if _pool:
            await _pool.close()
            _pool = None


async def save_conversation(
    query: str,
    response: str,
    reasoning: str | None,
    sources: list[dict],
    custom_prompt: str | None,
    user_id: str,
) -> dict:
    conv_id = f"conv-{uuid.uuid4().hex[:8]}"
    ts = int(time.time() * 1000)
    sources_json = json.dumps(sources)

    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO conversations (id, user_id, query, response, reasoning, sources_json, custom_prompt, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (conv_id, user_id, query, response, reasoning, sources_json, custom_prompt, ts),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO conversations (id, user_id, query, response, reasoning, sources_json, custom_prompt, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
                conv_id, user_id, query, response, reasoning, sources_json, custom_prompt, ts,
            )

    return {
        "id": conv_id,
        "query": query,
        "response": response,
        "reasoning": reasoning,
        "sources": sources,
        "customPrompt": custom_prompt,
        "timestamp": ts,
    }


async def get_all_conversations(user_id: str) -> list[dict]:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp DESC",
            (user_id,),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM conversations WHERE user_id = $1 ORDER BY timestamp DESC",
                user_id,
            )

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "query": row["query"],
            "response": row["response"],
            "reasoning": row["reasoning"],
            "sources": json.loads(row["sources_json"]) if row["sources_json"] else [],
            "customPrompt": row["custom_prompt"],
            "timestamp": row["timestamp"],
        })
    return results


async def update_conversation_response(conv_id: str, response: str, user_id: str) -> bool:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "UPDATE conversations SET response = ? WHERE id = ? AND user_id = ?",
            (response, conv_id, user_id),
        )
        await _sqlite_conn.commit()
        return cursor.rowcount > 0
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "UPDATE conversations SET response = $1 WHERE id = $2 AND user_id = $3",
                response, conv_id, user_id,
            )
            return int(status.split()[-1]) > 0


async def delete_conversation(conv_id: str, user_id: str) -> bool:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM conversations WHERE id = ? AND user_id = ?", (conv_id, user_id)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount > 0
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM conversations WHERE id = $1 AND user_id = $2", conv_id, user_id
            )
            return int(status.split()[-1]) > 0


async def delete_all_conversations(user_id: str) -> int:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM conversations WHERE user_id = ?", (user_id,)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM conversations WHERE user_id = $1", user_id
            )
            return int(status.split()[-1])


# ── User CRUD ────────────────────────────────────────────────

def _row_to_user(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "password_hash": row["password_hash"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


async def create_user(
    user_id: str, email: str, name: str, role: str, password_hash: str | None
) -> dict:
    now = int(time.time() * 1000)
    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO users (id, email, name, role, password_hash, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, ?, ?)""",
            (user_id, email, name, role, password_hash, now, now),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO users (id, email, name, role, password_hash, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 1, $6, $7)""",
                user_id, email, name, role, password_hash, now, now,
            )
    return {
        "id": user_id, "email": email, "name": name, "role": role,
        "password_hash": password_hash, "is_active": True,
        "created_at": now, "updated_at": now,
    }


async def get_user_by_email(email: str) -> dict | None:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        )
        row = await cursor.fetchone()
    else:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE email = $1", email
            )
    return _row_to_user(row) if row else None


async def get_user_by_id(user_id: str) -> dict | None:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        )
        row = await cursor.fetchone()
    else:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE id = $1", user_id
            )
    return _row_to_user(row) if row else None


async def get_all_users() -> list[dict]:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM users ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM users ORDER BY created_at DESC"
            )
    return [_row_to_user(r) for r in rows]


async def update_user(
    user_id: str,
    name: str | None = None,
    role: str | None = None,
    password_hash: str | None = None,
    is_active: bool | None = None,
) -> bool:
    user = await get_user_by_id(user_id)
    if not user:
        return False

    new_name = name if name is not None else user["name"]
    new_role = role if role is not None else user["role"]
    new_hash = password_hash if password_hash is not None else user["password_hash"]
    new_active = (1 if is_active else 0) if is_active is not None else (1 if user["is_active"] else 0)
    now = int(time.time() * 1000)

    if _is_local:
        await _sqlite_conn.execute(
            """UPDATE users SET name=?, role=?, password_hash=?, is_active=?, updated_at=?
               WHERE id=?""",
            (new_name, new_role, new_hash, new_active, now, user_id),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """UPDATE users SET name=$1, role=$2, password_hash=$3, is_active=$4, updated_at=$5
                   WHERE id=$6""",
                new_name, new_role, new_hash, new_active, now, user_id,
            )
    return True


async def delete_user(user_id: str) -> bool:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM users WHERE id = ?", (user_id,)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount > 0
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM users WHERE id = $1", user_id
            )
            return int(status.split()[-1]) > 0


# ── Session CRUD ─────────────────────────────────────────────

async def create_session(
    session_id: str, user_id: str, token: str, created_at: int, expires_at: int
) -> dict:
    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO sessions (id, user_id, token, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, user_id, token, created_at, expires_at),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO sessions (id, user_id, token, created_at, expires_at)
                   VALUES ($1, $2, $3, $4, $5)""",
                session_id, user_id, token, created_at, expires_at,
            )
    return {
        "id": session_id, "user_id": user_id, "token": token,
        "created_at": created_at, "expires_at": expires_at,
    }


async def get_session_by_token(token: str) -> dict | None:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM sessions WHERE token = ?", (token,)
        )
        row = await cursor.fetchone()
    else:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM sessions WHERE token = $1", token
            )
    if not row:
        return None
    return {
        "id": row["id"], "user_id": row["user_id"], "token": row["token"],
        "created_at": row["created_at"], "expires_at": row["expires_at"],
    }


async def delete_session(token: str) -> bool:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM sessions WHERE token = ?", (token,)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount > 0
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM sessions WHERE token = $1", token
            )
            return int(status.split()[-1]) > 0


async def delete_user_sessions(user_id: str) -> int:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM sessions WHERE user_id = ?", (user_id,)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM sessions WHERE user_id = $1", user_id
            )
            return int(status.split()[-1])


async def delete_expired_sessions() -> int:
    now = int(time.time() * 1000)
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM sessions WHERE expires_at < ?", (now,)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM sessions WHERE expires_at < $1", now
            )
            return int(status.split()[-1])


async def seed_admin_user(email: str, password: str, name: str) -> None:
    existing = await get_user_by_email(email)
    if existing:
        return
    import bcrypt
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    await create_user(user_id, email, name, "admin", password_hash)


# ── Audit Events ────────────────────────────────────────────

async def save_audit_events_batch(events: list[dict]) -> None:
    if not events:
        return
    if _is_local:
        await _sqlite_conn.executemany(
            """INSERT INTO audit_events
               (id, event_type, user_id, user_email, user_role, ip_address, user_agent,
                resource_id, resource_type, metadata_json, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (e["id"], e["event_type"], e.get("user_id"), e.get("user_email"),
                 e.get("user_role"), e.get("ip_address"), e.get("user_agent"),
                 e.get("resource_id"), e.get("resource_type"), e.get("metadata_json"),
                 e["timestamp"])
                for e in events
            ],
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.executemany(
                """INSERT INTO audit_events
                   (id, event_type, user_id, user_email, user_role, ip_address, user_agent,
                    resource_id, resource_type, metadata_json, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
                [
                    (e["id"], e["event_type"], e.get("user_id"), e.get("user_email"),
                     e.get("user_role"), e.get("ip_address"), e.get("user_agent"),
                     e.get("resource_id"), e.get("resource_type"), e.get("metadata_json"),
                     e["timestamp"])
                    for e in events
                ],
            )


async def get_audit_events(
    event_type: str | None = None,
    user_id: str | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
    page: int = 1,
    limit: int = 25,
) -> tuple[list[dict], int]:
    """Return paginated audit events + total count."""
    conditions = []
    params: list = []

    if _is_local:
        ph = lambda: "?"
    else:
        _n = [0]
        def ph():
            _n[0] += 1
            return f"${_n[0]}"

    if event_type:
        conditions.append(f"event_type = {ph()}")
        params.append(event_type)
    if user_id:
        conditions.append(f"user_id = {ph()}")
        params.append(user_id)
    if from_ts is not None:
        conditions.append(f"timestamp >= {ph()}")
        params.append(from_ts)
    if to_ts is not None:
        conditions.append(f"timestamp <= {ph()}")
        params.append(to_ts)

    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    count_sql = f"SELECT COUNT(*) as cnt FROM audit_events{where}"
    offset = (page - 1) * limit

    if _is_local:
        data_sql = f"SELECT * FROM audit_events{where} ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        cursor = await _sqlite_conn.execute(count_sql, tuple(params))
        total_row = await cursor.fetchone()
        total = total_row["cnt"]
        cursor = await _sqlite_conn.execute(data_sql, tuple(params) + (limit, offset))
        rows = await cursor.fetchall()
    else:
        data_sql = f"SELECT * FROM audit_events{where} ORDER BY timestamp DESC LIMIT {ph()} OFFSET {ph()}"
        params.extend([limit, offset])
        async with _pool.acquire() as conn:
            total = await conn.fetchval(count_sql, *params[:-2])
            rows = await conn.fetch(data_sql, *params)

    items = []
    for r in rows:
        items.append({
            "id": r["id"], "event_type": r["event_type"],
            "user_id": r["user_id"], "user_email": r["user_email"],
            "user_role": r["user_role"], "ip_address": r["ip_address"],
            "user_agent": r["user_agent"], "resource_id": r["resource_id"],
            "resource_type": r["resource_type"],
            "metadata_json": r["metadata_json"], "timestamp": r["timestamp"],
        })
    return items, total


# ── Login Attempts ──────────────────────────────────────────

async def save_login_attempt(attempt: dict) -> None:
    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO login_attempts
               (id, user_id, user_email, success, ip_address, country, city,
                browser, os, device_type, screen_resolution, timezone, session_id, failure_reason, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (attempt["id"], attempt.get("user_id"), attempt["user_email"],
             1 if attempt["success"] else 0, attempt.get("ip_address"),
             attempt.get("country"), attempt.get("city"),
             attempt.get("browser"), attempt.get("os"), attempt.get("device_type"),
             attempt.get("screen_resolution"), attempt.get("timezone"),
             attempt.get("session_id"), attempt.get("failure_reason"), attempt["timestamp"]),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO login_attempts
                   (id, user_id, user_email, success, ip_address, country, city,
                    browser, os, device_type, screen_resolution, timezone, session_id, failure_reason, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)""",
                attempt["id"], attempt.get("user_id"), attempt["user_email"],
                1 if attempt["success"] else 0, attempt.get("ip_address"),
                attempt.get("country"), attempt.get("city"),
                attempt.get("browser"), attempt.get("os"), attempt.get("device_type"),
                attempt.get("screen_resolution"), attempt.get("timezone"),
                attempt.get("session_id"), attempt.get("failure_reason"), attempt["timestamp"],
            )


async def get_login_attempts(
    success: bool | None = None,
    from_ts: int | None = None,
    to_ts: int | None = None,
    page: int = 1,
    limit: int = 25,
) -> tuple[list[dict], int]:
    conditions = []
    params: list = []

    if _is_local:
        ph = lambda: "?"
    else:
        _n = [0]
        def ph():
            _n[0] += 1
            return f"${_n[0]}"

    if success is not None:
        conditions.append(f"success = {ph()}")
        params.append(1 if success else 0)
    if from_ts is not None:
        conditions.append(f"timestamp >= {ph()}")
        params.append(from_ts)
    if to_ts is not None:
        conditions.append(f"timestamp <= {ph()}")
        params.append(to_ts)

    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    count_sql = f"SELECT COUNT(*) as cnt FROM login_attempts{where}"
    offset = (page - 1) * limit

    if _is_local:
        data_sql = f"SELECT * FROM login_attempts{where} ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        cursor = await _sqlite_conn.execute(count_sql, tuple(params))
        total_row = await cursor.fetchone()
        total = total_row["cnt"]
        cursor = await _sqlite_conn.execute(data_sql, tuple(params) + (limit, offset))
        rows = await cursor.fetchall()
    else:
        data_sql = f"SELECT * FROM login_attempts{where} ORDER BY timestamp DESC LIMIT {ph()} OFFSET {ph()}"
        params.extend([limit, offset])
        async with _pool.acquire() as conn:
            total = await conn.fetchval(count_sql, *params[:-2])
            rows = await conn.fetch(data_sql, *params)

    items = []
    for r in rows:
        items.append({
            "id": r["id"], "user_id": r["user_id"], "user_email": r["user_email"],
            "success": bool(r["success"]), "ip_address": r["ip_address"],
            "country": r["country"], "city": r["city"],
            "browser": r["browser"], "os": r["os"], "device_type": r["device_type"],
            "screen_resolution": r["screen_resolution"], "timezone": r["timezone"],
            "session_id": r["session_id"], "failure_reason": r["failure_reason"],
            "timestamp": r["timestamp"],
        })
    return items, total


# ── Session Activity ────────────────────────────────────────

async def create_session_activity(session_id: str, user_id: str) -> None:
    now = int(time.time() * 1000)
    sa_id = f"sa-{uuid.uuid4().hex[:10]}"
    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO session_activity (id, session_id, user_id, started_at, last_activity_at)
               VALUES (?, ?, ?, ?, ?)""",
            (sa_id, session_id, user_id, now, now),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO session_activity (id, session_id, user_id, started_at, last_activity_at)
                   VALUES ($1, $2, $3, $4, $5)""",
                sa_id, session_id, user_id, now, now,
            )


async def update_session_heartbeat(session_id: str, active: bool) -> None:
    """Update session activity from heartbeat (called every 30s)."""
    now = int(time.time() * 1000)
    interval_ms = 30000
    if _is_local:
        if active:
            await _sqlite_conn.execute(
                """UPDATE session_activity
                   SET last_activity_at = ?, active_duration_ms = active_duration_ms + ?, actions_count = actions_count + 1
                   WHERE session_id = ? AND ended_at IS NULL""",
                (now, interval_ms, session_id),
            )
        else:
            await _sqlite_conn.execute(
                """UPDATE session_activity
                   SET last_activity_at = ?, idle_duration_ms = idle_duration_ms + ?
                   WHERE session_id = ? AND ended_at IS NULL""",
                (now, interval_ms, session_id),
            )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            if active:
                await conn.execute(
                    """UPDATE session_activity
                       SET last_activity_at = $1, active_duration_ms = active_duration_ms + $2, actions_count = actions_count + 1
                       WHERE session_id = $3 AND ended_at IS NULL""",
                    now, interval_ms, session_id,
                )
            else:
                await conn.execute(
                    """UPDATE session_activity
                       SET last_activity_at = $1, idle_duration_ms = idle_duration_ms + $2
                       WHERE session_id = $3 AND ended_at IS NULL""",
                    now, interval_ms, session_id,
                )


async def end_session_activity(session_id: str) -> None:
    now = int(time.time() * 1000)
    if _is_local:
        await _sqlite_conn.execute(
            "UPDATE session_activity SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL",
            (now, session_id),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                "UPDATE session_activity SET ended_at = $1 WHERE session_id = $2 AND ended_at IS NULL",
                now, session_id,
            )


async def get_session_activities() -> list[dict]:
    """Get recent session activities (last 7 days)."""
    cutoff = int(time.time() * 1000) - 7 * 86400 * 1000
    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT sa.*, u.email as user_email FROM session_activity sa
               LEFT JOIN users u ON sa.user_id = u.id
               WHERE sa.started_at >= ?
               ORDER BY sa.started_at DESC""",
            (cutoff,),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT sa.*, u.email as user_email FROM session_activity sa
                   LEFT JOIN users u ON sa.user_id = u.id
                   WHERE sa.started_at >= $1
                   ORDER BY sa.started_at DESC""",
                cutoff,
            )
    items = []
    for r in rows:
        items.append({
            "session_id": r["session_id"], "user_id": r["user_id"],
            "user_email": r["user_email"] if "user_email" in r.keys() else None,
            "started_at": r["started_at"], "ended_at": r["ended_at"],
            "last_activity_at": r["last_activity_at"],
            "active_duration_ms": r["active_duration_ms"],
            "idle_duration_ms": r["idle_duration_ms"],
            "actions_count": r["actions_count"],
            "is_active": r["ended_at"] is None,
        })
    return items


# ── Token Usage ─────────────────────────────────────────────

async def save_token_usage(usage: dict) -> None:
    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO token_usage
               (id, user_id, user_email, conversation_id, model,
                prompt_tokens, completion_tokens, total_tokens, thinking_tokens, latency_ms, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (usage["id"], usage["user_id"], usage.get("user_email"),
             usage.get("conversation_id"), usage["model"],
             usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
             usage.get("total_tokens", 0), usage.get("thinking_tokens", 0),
             usage.get("latency_ms", 0), usage["timestamp"]),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO token_usage
                   (id, user_id, user_email, conversation_id, model,
                    prompt_tokens, completion_tokens, total_tokens, thinking_tokens, latency_ms, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
                usage["id"], usage["user_id"], usage.get("user_email"),
                usage.get("conversation_id"), usage["model"],
                usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
                usage.get("total_tokens", 0), usage.get("thinking_tokens", 0),
                usage.get("latency_ms", 0), usage["timestamp"],
            )


# ── Query Cache ─────────────────────────────────────────────

async def get_cache_by_hash(query_hash: str) -> dict | None:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM query_cache WHERE query_hash = ? AND is_active = 1",
            (query_hash,),
        )
        row = await cursor.fetchone()
    else:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM query_cache WHERE query_hash = $1 AND is_active = 1",
                query_hash,
            )
    if not row:
        return None
    return {
        "id": row["id"],
        "query_hash": row["query_hash"],
        "query_text": row["query_text"],
        "response": row["response"],
        "reasoning": row["reasoning"],
        "sources_json": row["sources_json"],
        "hit_count": row["hit_count"],
        "created_at": row["created_at"],
        "last_accessed_at": row["last_accessed_at"],
    }


async def get_all_active_cache_entries() -> list[dict]:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM query_cache WHERE is_active = 1"
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM query_cache WHERE is_active = 1"
            )
    return [
        {
            "id": row["id"],
            "query_text": row["query_text"],
            "response": row["response"],
            "reasoning": row["reasoning"],
            "sources_json": row["sources_json"],
        }
        for row in rows
    ]


async def update_cache_hit(cache_id: str) -> None:
    now = int(time.time() * 1000)
    if _is_local:
        await _sqlite_conn.execute(
            "UPDATE query_cache SET hit_count = hit_count + 1, last_accessed_at = ? WHERE id = ?",
            (now, cache_id),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                "UPDATE query_cache SET hit_count = hit_count + 1, last_accessed_at = $1 WHERE id = $2",
                now, cache_id,
            )


async def save_cache_entry(
    query_hash: str,
    query_text: str,
    response: str,
    reasoning: str | None,
    sources_json: str,
) -> dict:
    cache_id = f"qc-{uuid.uuid4().hex[:8]}"
    now = int(time.time() * 1000)
    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO query_cache
               (id, query_hash, query_text, response, reasoning, sources_json,
                hit_count, is_active, created_at, last_accessed_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)""",
            (cache_id, query_hash, query_text, response, reasoning, sources_json, now, now),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO query_cache
                   (id, query_hash, query_text, response, reasoning, sources_json,
                    hit_count, is_active, created_at, last_accessed_at)
                   VALUES ($1, $2, $3, $4, $5, $6, 0, 1, $7, $8)""",
                cache_id, query_hash, query_text, response, reasoning, sources_json, now, now,
            )
    return {"id": cache_id, "query_hash": query_hash, "query_text": query_text}


# ── Analytics Queries ───────────────────────────────────────

async def get_overview_stats() -> dict:
    now = int(time.time() * 1000)
    day_ago = now - 86400 * 1000
    today_start = now - (now % (86400 * 1000))

    if _is_local:
        c = await _sqlite_conn.execute("SELECT COUNT(*) as cnt FROM users WHERE is_active = 1")
        total_users = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute(
            "SELECT COUNT(DISTINCT user_id) as cnt FROM audit_events WHERE timestamp >= ?", (day_ago,))
        active_24h = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute(
            "SELECT COUNT(*) as cnt FROM session_activity WHERE ended_at IS NULL")
        active_sessions = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute(
            "SELECT COUNT(*) as cnt FROM audit_events WHERE event_type = 'generate'")
        total_queries = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute("SELECT COALESCE(SUM(total_tokens), 0) as s FROM token_usage")
        total_tokens = (await c.fetchone())["s"]

        c = await _sqlite_conn.execute(
            "SELECT COUNT(*) as cnt FROM audit_events WHERE event_type = 'generate' AND timestamp >= ?",
            (today_start,))
        queries_today = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute(
            "SELECT COALESCE(SUM(total_tokens), 0) as s FROM token_usage WHERE timestamp >= ?",
            (today_start,))
        tokens_today = (await c.fetchone())["s"]
    else:
        async with _pool.acquire() as conn:
            total_users = await conn.fetchval("SELECT COUNT(*) FROM users WHERE is_active = 1")
            active_24h = await conn.fetchval(
                "SELECT COUNT(DISTINCT user_id) FROM audit_events WHERE timestamp >= $1", day_ago)
            active_sessions = await conn.fetchval(
                "SELECT COUNT(*) FROM session_activity WHERE ended_at IS NULL")
            total_queries = await conn.fetchval(
                "SELECT COUNT(*) FROM audit_events WHERE event_type = 'generate'")
            total_tokens = await conn.fetchval(
                "SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage")
            queries_today = await conn.fetchval(
                "SELECT COUNT(*) FROM audit_events WHERE event_type = 'generate' AND timestamp >= $1",
                today_start)
            tokens_today = await conn.fetchval(
                "SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage WHERE timestamp >= $1",
                today_start)

    return {
        "total_users": total_users,
        "active_users_24h": active_24h,
        "active_sessions": active_sessions,
        "total_queries": total_queries,
        "total_tokens": total_tokens,
        "queries_today": queries_today,
        "tokens_today": tokens_today,
    }


async def get_daily_activity(days: int = 30) -> list[dict]:
    cutoff = int(time.time() * 1000) - days * 86400 * 1000

    if _is_local:
        # SQLite: use strftime on timestamp/1000
        cursor = await _sqlite_conn.execute(
            """SELECT
                 date(timestamp / 1000, 'unixepoch') as date,
                 SUM(CASE WHEN event_type = 'login' THEN 1 ELSE 0 END) as logins,
                 SUM(CASE WHEN event_type = 'generate' THEN 1 ELSE 0 END) as queries
               FROM audit_events
               WHERE timestamp >= ?
               GROUP BY date
               ORDER BY date""",
            (cutoff,),
        )
        event_rows = await cursor.fetchall()

        cursor = await _sqlite_conn.execute(
            """SELECT date(timestamp / 1000, 'unixepoch') as date,
                      COALESCE(SUM(total_tokens), 0) as tokens
               FROM token_usage
               WHERE timestamp >= ?
               GROUP BY date
               ORDER BY date""",
            (cutoff,),
        )
        token_rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            event_rows = await conn.fetch(
                """SELECT
                     to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD') as date,
                     SUM(CASE WHEN event_type = 'login' THEN 1 ELSE 0 END) as logins,
                     SUM(CASE WHEN event_type = 'generate' THEN 1 ELSE 0 END) as queries
                   FROM audit_events
                   WHERE timestamp >= $1
                   GROUP BY date
                   ORDER BY date""",
                cutoff,
            )
            token_rows = await conn.fetch(
                """SELECT to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD') as date,
                          COALESCE(SUM(total_tokens), 0) as tokens
                   FROM token_usage
                   WHERE timestamp >= $1
                   GROUP BY date
                   ORDER BY date""",
                cutoff,
            )

    # Merge event_rows and token_rows by date
    token_map = {r["date"]: int(r["tokens"]) for r in token_rows}
    results = []
    for r in event_rows:
        d = r["date"]
        results.append({
            "date": d,
            "logins": int(r["logins"]),
            "queries": int(r["queries"]),
            "tokens": token_map.get(d, 0),
        })
    return results


async def get_token_usage_over_time(
    from_ts: int | None = None,
    to_ts: int | None = None,
    group_by: str = "day",
) -> list[dict]:
    if from_ts is None:
        from_ts = int(time.time() * 1000) - 30 * 86400 * 1000
    if to_ts is None:
        to_ts = int(time.time() * 1000)

    if _is_local:
        date_expr = "date(timestamp / 1000, 'unixepoch')" if group_by == "day" else "strftime('%Y-%m-%d %H:00', timestamp / 1000, 'unixepoch')"
        cursor = await _sqlite_conn.execute(
            f"""SELECT {date_expr} as date,
                       COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
                       COALESCE(SUM(completion_tokens), 0) as completion_tokens,
                       COALESCE(SUM(total_tokens), 0) as total_tokens,
                       COUNT(*) as request_count
                FROM token_usage
                WHERE timestamp >= ? AND timestamp <= ?
                GROUP BY date ORDER BY date""",
            (from_ts, to_ts),
        )
        rows = await cursor.fetchall()
    else:
        fmt = 'YYYY-MM-DD' if group_by == "day" else 'YYYY-MM-DD HH24:00'
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                f"""SELECT to_char(to_timestamp(timestamp / 1000), '{fmt}') as date,
                           COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
                           COALESCE(SUM(completion_tokens), 0) as completion_tokens,
                           COALESCE(SUM(total_tokens), 0) as total_tokens,
                           COUNT(*) as request_count
                    FROM token_usage
                    WHERE timestamp >= $1 AND timestamp <= $2
                    GROUP BY date ORDER BY date""",
                from_ts, to_ts,
            )

    return [
        {
            "date": r["date"],
            "prompt_tokens": int(r["prompt_tokens"]),
            "completion_tokens": int(r["completion_tokens"]),
            "total_tokens": int(r["total_tokens"]),
            "request_count": int(r["request_count"]),
        }
        for r in rows
    ]


async def get_token_usage_by_user() -> list[dict]:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT user_id, user_email,
                      COALESCE(SUM(total_tokens), 0) as total_tokens,
                      COUNT(*) as request_count,
                      CASE WHEN COUNT(*) > 0 THEN CAST(SUM(total_tokens) AS REAL) / COUNT(*) ELSE 0 END as avg_tokens
               FROM token_usage
               GROUP BY user_id
               ORDER BY total_tokens DESC""",
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_id, user_email,
                          COALESCE(SUM(total_tokens), 0) as total_tokens,
                          COUNT(*) as request_count,
                          CASE WHEN COUNT(*) > 0 THEN SUM(total_tokens)::float / COUNT(*) ELSE 0 END as avg_tokens
                   FROM token_usage
                   GROUP BY user_id, user_email
                   ORDER BY total_tokens DESC""",
            )

    return [
        {
            "user_id": r["user_id"], "user_email": r["user_email"],
            "total_tokens": int(r["total_tokens"]),
            "request_count": int(r["request_count"]),
            "avg_tokens_per_request": round(float(r["avg_tokens"]), 1),
        }
        for r in rows
    ]


async def get_usage_heatmap() -> list[dict]:
    """Get hourly usage distribution for the last 30 days."""
    cutoff = int(time.time() * 1000) - 30 * 86400 * 1000

    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT
                 CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as day_of_week,
                 CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
                 COUNT(*) as count
               FROM audit_events
               WHERE timestamp >= ?
               GROUP BY day_of_week, hour""",
            (cutoff,),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT
                     EXTRACT(DOW FROM to_timestamp(timestamp / 1000))::int as day_of_week,
                     EXTRACT(HOUR FROM to_timestamp(timestamp / 1000))::int as hour,
                     COUNT(*) as count
                   FROM audit_events
                   WHERE timestamp >= $1
                   GROUP BY day_of_week, hour""",
                cutoff,
            )

    return [
        {"day_of_week": int(r["day_of_week"]), "hour": int(r["hour"]), "count": int(r["count"])}
        for r in rows
    ]


async def get_user_activity(user_id: str) -> dict:
    """Get activity stats for a specific user."""
    now = int(time.time() * 1000)

    if _is_local:
        c = await _sqlite_conn.execute(
            "SELECT COUNT(*) as cnt FROM audit_events WHERE user_id = ? AND event_type = 'generate'",
            (user_id,))
        total_queries = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute(
            "SELECT COALESCE(SUM(total_tokens), 0) as s FROM token_usage WHERE user_id = ?",
            (user_id,))
        total_tokens = (await c.fetchone())["s"]

        c = await _sqlite_conn.execute(
            "SELECT COALESCE(SUM(active_duration_ms), 0) as s FROM session_activity WHERE user_id = ?",
            (user_id,))
        total_active_ms = (await c.fetchone())["s"]

        c = await _sqlite_conn.execute(
            "SELECT COUNT(*) as cnt FROM login_attempts WHERE user_id = ? AND success = 1",
            (user_id,))
        total_logins = (await c.fetchone())["cnt"]

        c = await _sqlite_conn.execute(
            "SELECT timestamp FROM audit_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1",
            (user_id,))
        last_row = await c.fetchone()
        last_active = last_row["timestamp"] if last_row else None
    else:
        async with _pool.acquire() as conn:
            total_queries = await conn.fetchval(
                "SELECT COUNT(*) FROM audit_events WHERE user_id = $1 AND event_type = 'generate'", user_id)
            total_tokens = await conn.fetchval(
                "SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage WHERE user_id = $1", user_id)
            total_active_ms = await conn.fetchval(
                "SELECT COALESCE(SUM(active_duration_ms), 0) FROM session_activity WHERE user_id = $1", user_id)
            total_logins = await conn.fetchval(
                "SELECT COUNT(*) FROM login_attempts WHERE user_id = $1 AND success = 1", user_id)
            last_active = await conn.fetchval(
                "SELECT timestamp FROM audit_events WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1", user_id)

    return {
        "user_id": user_id,
        "total_queries": total_queries,
        "total_tokens": total_tokens,
        "total_active_ms": total_active_ms,
        "total_logins": total_logins,
        "last_active_at": last_active,
    }


# ── Security Queries ────────────────────────────────────────

async def query_multi_ip_logins(hours: int = 1) -> list[dict]:
    cutoff = int(time.time() * 1000) - hours * 3600 * 1000
    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT user_email, COUNT(DISTINCT ip_address) as ip_count,
                      GROUP_CONCAT(DISTINCT ip_address) as ips
               FROM login_attempts
               WHERE success = 1 AND timestamp >= ?
               GROUP BY user_email
               HAVING ip_count > 1""",
            (cutoff,),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_email, COUNT(DISTINCT ip_address) as ip_count,
                          STRING_AGG(DISTINCT ip_address, ',') as ips
                   FROM login_attempts
                   WHERE success = 1 AND timestamp >= $1
                   GROUP BY user_email
                   HAVING COUNT(DISTINCT ip_address) > 1""",
                cutoff,
            )
    return [{"user_email": r["user_email"], "ip_count": int(r["ip_count"]), "ips": r["ips"]} for r in rows]


async def query_rapid_requests(minutes: int = 5, threshold: int = 50) -> list[dict]:
    cutoff = int(time.time() * 1000) - minutes * 60 * 1000
    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT user_email, COUNT(*) as request_count
               FROM audit_events
               WHERE timestamp >= ?
               GROUP BY user_email
               HAVING request_count > ?""",
            (cutoff, threshold),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_email, COUNT(*) as request_count
                   FROM audit_events
                   WHERE timestamp >= $1
                   GROUP BY user_email
                   HAVING COUNT(*) > $2""",
                cutoff, threshold,
            )
    return [{"user_email": r["user_email"], "request_count": int(r["request_count"])} for r in rows]


async def query_off_hours_access(start_hour: int = 9, end_hour: int = 18) -> list[dict]:
    cutoff = int(time.time() * 1000) - 24 * 3600 * 1000
    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT user_email,
                      CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
                      COUNT(*) as cnt
               FROM audit_events
               WHERE timestamp >= ?
               GROUP BY user_email, hour
               HAVING hour < ? OR hour >= ?""",
            (cutoff, start_hour, end_hour),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_email,
                          EXTRACT(HOUR FROM to_timestamp(timestamp / 1000))::int as hour,
                          COUNT(*) as cnt
                   FROM audit_events
                   WHERE timestamp >= $1
                   GROUP BY user_email, hour
                   HAVING EXTRACT(HOUR FROM to_timestamp(timestamp / 1000)) < $2
                       OR EXTRACT(HOUR FROM to_timestamp(timestamp / 1000)) >= $3""",
                cutoff, start_hour, end_hour,
            )
    return [{"user_email": r["user_email"], "hour": int(r["hour"]), "count": int(r["cnt"])} for r in rows]


async def query_repeated_failures(hours: int = 1, threshold: int = 5) -> list[dict]:
    cutoff = int(time.time() * 1000) - hours * 3600 * 1000
    if _is_local:
        cursor = await _sqlite_conn.execute(
            """SELECT user_email, COUNT(*) as failure_count
               FROM login_attempts
               WHERE success = 0 AND timestamp >= ?
               GROUP BY user_email
               HAVING failure_count >= ?""",
            (cutoff, threshold),
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT user_email, COUNT(*) as failure_count
                   FROM login_attempts
                   WHERE success = 0 AND timestamp >= $1
                   GROUP BY user_email
                   HAVING COUNT(*) >= $2""",
                cutoff, threshold,
            )
    return [{"user_email": r["user_email"], "failure_count": int(r["failure_count"])} for r in rows]
