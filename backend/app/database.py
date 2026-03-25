import json
import time
import uuid
from pathlib import Path

from .config import get_settings

_pool = None  # asyncpg.Pool (production)
_sqlite_conn = None  # aiosqlite connection (local)
_is_local = False

_CREATE_TABLE = """
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        response TEXT NOT NULL,
        reasoning TEXT,
        sources_json TEXT,
        custom_prompt TEXT,
        timestamp BIGINT NOT NULL
    )
"""


async def init_db() -> None:
    global _pool, _sqlite_conn, _is_local
    settings = get_settings()
    _is_local = settings.is_local

    if _is_local:
        import aiosqlite
        Path(settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        _sqlite_conn = await aiosqlite.connect(settings.sqlite_path)
        _sqlite_conn.row_factory = aiosqlite.Row
        await _sqlite_conn.execute(_CREATE_TABLE)
        await _sqlite_conn.commit()
    else:
        import asyncpg
        _pool = await asyncpg.create_pool(dsn=settings.database_url)
        async with _pool.acquire() as conn:
            await conn.execute(_CREATE_TABLE)


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
) -> dict:
    conv_id = f"conv-{uuid.uuid4().hex[:8]}"
    ts = int(time.time() * 1000)
    sources_json = json.dumps(sources)

    if _is_local:
        await _sqlite_conn.execute(
            """INSERT INTO conversations (id, query, response, reasoning, sources_json, custom_prompt, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (conv_id, query, response, reasoning, sources_json, custom_prompt, ts),
        )
        await _sqlite_conn.commit()
    else:
        async with _pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO conversations (id, query, response, reasoning, sources_json, custom_prompt, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                conv_id, query, response, reasoning, sources_json, custom_prompt, ts,
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


async def get_all_conversations() -> list[dict]:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "SELECT * FROM conversations ORDER BY timestamp DESC"
        )
        rows = await cursor.fetchall()
    else:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM conversations ORDER BY timestamp DESC"
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


async def update_conversation_response(conv_id: str, response: str) -> bool:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "UPDATE conversations SET response = ? WHERE id = ?",
            (response, conv_id),
        )
        await _sqlite_conn.commit()
        return cursor.rowcount > 0
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "UPDATE conversations SET response = $1 WHERE id = $2",
                response, conv_id,
            )
            return int(status.split()[-1]) > 0


async def delete_conversation(conv_id: str) -> bool:
    if _is_local:
        cursor = await _sqlite_conn.execute(
            "DELETE FROM conversations WHERE id = ?", (conv_id,)
        )
        await _sqlite_conn.commit()
        return cursor.rowcount > 0
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute(
                "DELETE FROM conversations WHERE id = $1", conv_id
            )
            return int(status.split()[-1]) > 0


async def delete_all_conversations() -> int:
    if _is_local:
        cursor = await _sqlite_conn.execute("DELETE FROM conversations")
        await _sqlite_conn.commit()
        return cursor.rowcount
    else:
        async with _pool.acquire() as conn:
            status = await conn.execute("DELETE FROM conversations")
            return int(status.split()[-1])
