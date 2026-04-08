# Database Schema

Resolve AI Support Console uses a relational database with 8 tables. Local development uses SQLite (`backend/data/local.db`); production uses Cloud SQL via asyncpg.

All primary keys are application-generated text IDs (e.g. `usr-a1b2c3d4`, `sess-e5f6a7b8c9d0`). Timestamps are stored as Unix epoch milliseconds (BIGINT).

---

## Tables

### 1. `users`

Stores all user accounts. Supports two roles: `admin` (password-protected) and `associate` (password-less login).

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `usr-{8 hex chars}` |
| `email` | TEXT | No | — | Unique email address, used for login |
| `name` | TEXT | No | — | Display name |
| `role` | TEXT | No | — | Authorization role: `admin` or `associate` |
| `password_hash` | TEXT | Yes | NULL | Bcrypt hash. Required for `admin`, NULL for `associate` |
| `is_active` | INTEGER | No | 1 | Account enabled flag. `0` = disabled, `1` = active |
| `created_at` | BIGINT | No | — | Account creation timestamp (epoch ms) |
| `updated_at` | BIGINT | No | — | Last modification timestamp (epoch ms) |

**Indexes:** None (unique constraint on `email` acts as index)

---

### 2. `sessions`

Stores opaque refresh tokens for the hybrid JWT authentication system. Each row represents an active login session. The token stored here is the long-lived refresh token; short-lived JWT access tokens are derived from it but not persisted.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `sess-{12 hex chars}` |
| `user_id` | TEXT | No | — | References `users.id` |
| `token` | TEXT | No | — | Unique opaque refresh token (`secrets.token_urlsafe(32)`) |
| `created_at` | BIGINT | No | — | Session creation timestamp (epoch ms) |
| `expires_at` | BIGINT | No | — | Session expiry timestamp (epoch ms). Default TTL: 24 hours |

**Indexes:** Unique constraint on `token`

---

### 3. `conversations`

Stores every AI-generated response along with its input query, reasoning trace, and retrieved sources.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `conv-{8 hex chars}` |
| `user_id` | TEXT | Yes | NULL | References `users.id`. The user who initiated the query |
| `query` | TEXT | No | — | The user's input question |
| `response` | TEXT | No | — | The AI-generated response text |
| `reasoning` | TEXT | Yes | NULL | The model's chain-of-thought / reasoning trace |
| `sources_json` | TEXT | Yes | NULL | JSON array of retrieved canned response sources |
| `custom_prompt` | TEXT | Yes | NULL | Custom system prompt override, if provided |
| `timestamp` | BIGINT | No | — | Creation timestamp (epoch ms) |

**Indexes:**
- `idx_conversations_user` on `user_id`

---

### 4. `audit_events`

Immutable audit log capturing all security-relevant and business-relevant actions (logins, logouts, generates, CRUD operations, unauthorized access attempts).

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `evt-{10 hex chars}` |
| `event_type` | TEXT | No | — | Event category (e.g. `login_success`, `generate`, `user_create`, `unauthorized_access`) |
| `user_id` | TEXT | Yes | NULL | References `users.id`. NULL for unauthenticated events |
| `user_email` | TEXT | Yes | NULL | Denormalized email for quick display |
| `user_role` | TEXT | Yes | NULL | Role at time of event (`admin` / `associate`) |
| `ip_address` | TEXT | Yes | NULL | Client IP address |
| `user_agent` | TEXT | Yes | NULL | Raw User-Agent header |
| `resource_id` | TEXT | Yes | NULL | ID of the affected resource (conversation, user, etc.) |
| `resource_type` | TEXT | Yes | NULL | Type of the affected resource (`conversation`, `user`, etc.) |
| `metadata_json` | TEXT | Yes | NULL | JSON blob with event-specific details |
| `timestamp` | BIGINT | No | — | Event timestamp (epoch ms) |

**Indexes:**
- `idx_audit_events_user` on `user_id`
- `idx_audit_events_type` on `event_type`
- `idx_audit_events_ts` on `timestamp`

---

### 5. `login_attempts`

Records every login attempt (successful or failed) with device fingerprinting and geolocation data for security analytics.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `la-{10 hex chars}` |
| `user_id` | TEXT | Yes | NULL | References `users.id`. NULL if email not found |
| `user_email` | TEXT | No | — | Email used in the login attempt |
| `success` | INTEGER | No | — | `1` = successful login, `0` = failed |
| `ip_address` | TEXT | Yes | NULL | Client IP address |
| `country` | TEXT | Yes | NULL | Geo-resolved country from IP |
| `city` | TEXT | Yes | NULL | Geo-resolved city from IP |
| `browser` | TEXT | Yes | NULL | Parsed browser name (e.g. `Chrome 120`) |
| `os` | TEXT | Yes | NULL | Parsed OS name (e.g. `Windows 11`) |
| `device_type` | TEXT | Yes | NULL | Device category: `desktop`, `mobile`, `tablet` |
| `screen_resolution` | TEXT | Yes | NULL | Screen dimensions (e.g. `1920x1080`) |
| `timezone` | TEXT | Yes | NULL | Client timezone (e.g. `America/New_York`) |
| `session_id` | TEXT | Yes | NULL | References `sessions.id`. Set on successful login |
| `failure_reason` | TEXT | Yes | NULL | Reason code on failure: `invalid_credentials`, `wrong_password`, `password_required` |
| `timestamp` | BIGINT | No | — | Attempt timestamp (epoch ms) |

**Indexes:**
- `idx_login_attempts_email` on `user_email`
- `idx_login_attempts_ip` on `ip_address`
- `idx_login_attempts_ts` on `timestamp`

---

### 6. `session_activity`

Tracks real-time session engagement metrics via heartbeat pings from the frontend. Used for active session monitoring and usage analytics.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `sa-{UUID hex}` |
| `session_id` | TEXT | No | — | References `sessions.id` |
| `user_id` | TEXT | No | — | References `users.id` |
| `started_at` | BIGINT | No | — | Session activity start timestamp (epoch ms) |
| `ended_at` | BIGINT | Yes | NULL | Session end timestamp. NULL = still active |
| `last_activity_at` | BIGINT | No | — | Last heartbeat timestamp (epoch ms) |
| `active_duration_ms` | BIGINT | No | 0 | Cumulative time user was actively engaged (ms) |
| `idle_duration_ms` | BIGINT | No | 0 | Cumulative idle time (ms) |
| `page_views` | INTEGER | No | 0 | Number of page views in the session |
| `actions_count` | INTEGER | No | 0 | Number of user actions (clicks, submissions) |

**Indexes:**
- `idx_session_activity_user` on `user_id`
- `idx_session_activity_session` on `session_id`

---

### 7. `token_usage`

Records LLM token consumption per request for cost tracking and usage analytics.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `tu-{10 hex chars}` |
| `user_id` | TEXT | No | — | References `users.id` |
| `user_email` | TEXT | Yes | NULL | Denormalized email for quick display |
| `conversation_id` | TEXT | Yes | NULL | References `conversations.id` |
| `model` | TEXT | No | — | LLM model name (e.g. `gemini-2.5-flash`) |
| `prompt_tokens` | INTEGER | No | 0 | Input tokens consumed |
| `completion_tokens` | INTEGER | No | 0 | Output tokens generated |
| `total_tokens` | INTEGER | No | 0 | Total tokens (prompt + completion) |
| `thinking_tokens` | INTEGER | No | 0 | Reasoning/thinking tokens consumed |
| `latency_ms` | INTEGER | No | 0 | Request round-trip latency in milliseconds |
| `timestamp` | BIGINT | No | — | Request timestamp (epoch ms) |

**Indexes:**
- `idx_token_usage_user` on `user_id`
- `idx_token_usage_ts` on `timestamp`

---

### 8. `query_cache`

Caches AI responses by query hash for deduplication. Exact hash matches are checked first, then fuzzy similarity matching (threshold: 0.9) against all active entries.

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | TEXT | No | — | Primary key. Format: `qc-{UUID hex}` |
| `query_hash` | TEXT | No | — | SHA-256 hash of the normalized (lowercased, trimmed) query |
| `query_text` | TEXT | No | — | The normalized query text (for fuzzy matching) |
| `response` | TEXT | No | — | Cached AI response |
| `reasoning` | TEXT | Yes | NULL | Cached reasoning trace |
| `sources_json` | TEXT | Yes | NULL | Cached JSON sources array |
| `hit_count` | INTEGER | No | 0 | Number of times this cache entry has been served |
| `is_active` | INTEGER | No | 1 | Soft-delete flag. `0` = disabled, `1` = active |
| `created_at` | BIGINT | No | — | Cache entry creation timestamp (epoch ms) |
| `last_accessed_at` | BIGINT | No | — | Last cache hit timestamp (epoch ms) |

**Indexes:**
- `idx_query_cache_hash` on `query_hash`
- `idx_query_cache_active` on `is_active`

---

## Entity Relationships

```
┌──────────────┐
│    users     │
│──────────────│
│ PK: id       │
│ email (UQ)   │
│ role         │
└──────┬───────┘
       │
       │ 1
       │
       ├────────────────────────────────────────────────────────┐
       │                          │                             │
       ▼ N                       ▼ N                           ▼ N
┌──────────────┐      ┌───────────────────┐          ┌─────────────────┐
│   sessions   │      │  conversations    │          │   token_usage   │
│──────────────│      │───────────────────│          │─────────────────│
│ PK: id       │      │ PK: id            │          │ PK: id          │
│ FK: user_id ─┼──┐   │ FK: user_id       │     ┌───┤ FK: user_id     │
│ token (UQ)   │  │   │                   │     │   │ FK: conv_id ────┼──► conversations.id
└──────┬───────┘  │   └───────────────────┘     │   └─────────────────┘
       │          │                              │
       │ 1        │                              │
       │          │                              │
       ├──────────┼──────────────────────────────┘
       │          │
       ▼ N        │
┌──────────────────┐     ┌───────────────────┐
│ session_activity  │     │  login_attempts   │
│──────────────────│     │───────────────────│
│ PK: id           │     │ PK: id            │
│ FK: session_id ──┼──┐  │ FK: user_id ──────┼──► users.id
│ FK: user_id ─────┼──┤  │ FK: session_id ───┼──► sessions.id
└──────────────────┘  │  └───────────────────┘
                      │
                      │
                      ▼
                ┌──────────────────┐
                │   audit_events   │
                │──────────────────│
                │ PK: id           │
                │ FK: user_id ─────┼──► users.id
                └──────────────────┘

┌──────────────────┐
│   query_cache    │  (standalone, no FK relationships)
│──────────────────│
│ PK: id           │
│ query_hash       │
└──────────────────┘
```

### Relationship Summary

| Relationship | Type | Description |
|-------------|------|-------------|
| `users` → `sessions` | One-to-Many | A user can have multiple active login sessions |
| `users` → `conversations` | One-to-Many | A user can have many AI conversations |
| `users` → `token_usage` | One-to-Many | Each LLM request is attributed to a user |
| `users` → `audit_events` | One-to-Many | All user actions are logged |
| `users` → `login_attempts` | One-to-Many | All login attempts are tracked per user |
| `sessions` → `session_activity` | One-to-Many | Each session has activity tracking records |
| `sessions` → `login_attempts` | One-to-Many | Successful logins reference the created session |
| `conversations` → `token_usage` | One-to-Many | Each conversation can have token usage records |
| `query_cache` | Standalone | Decoupled cache layer, no foreign key dependencies |

### Authentication Flow

```
Login Request
    │
    ▼
┌─────────┐   refresh token   ┌────────────┐   activity   ┌────────────────────┐
│  users  │ ◄──── user_id ─── │  sessions  │ ──────────► │  session_activity   │
└─────────┘                    └────────────┘              └────────────────────┘
    │                               │
    │                               │ JWT access token
    │                               │ (derived, not stored)
    │                               │
    ▼                               ▼
┌─────────────────┐         ┌─────────────────┐
│ login_attempts  │         │  audit_events   │
│ (success/fail)  │         │ (all actions)   │
└─────────────────┘         └─────────────────┘
```

1. User logs in → a `sessions` row is created with an opaque refresh token
2. A short-lived JWT access token (30 min) is derived and returned to the client
3. JWT is validated statelessly on each request (no DB call)
4. When JWT expires, the refresh token (in httponly cookie) is validated against the `sessions` table
5. A new JWT is issued transparently via the `X-Access-Token` response header

### Notes

- **No enforced foreign keys**: The schema uses logical references (application-level) rather than SQL `FOREIGN KEY` constraints. This is intentional for compatibility across SQLite (local) and PostgreSQL (production) without migration complexity.
- **Denormalized fields**: `user_email` and `user_role` are duplicated in `audit_events`, `login_attempts`, and `token_usage` for query performance in analytics dashboards, avoiding JOINs on high-volume tables.
- **Soft deletes**: Only `query_cache` uses soft deletes (`is_active` flag). Users and sessions use hard deletes.
- **Dual-database support**: All queries are written twice (SQLite `?` placeholders and asyncpg `$1` placeholders) within the `database.py` module, selected at runtime based on the `env` setting.
