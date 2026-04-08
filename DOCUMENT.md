# Email Composer Automation | Project Information Document

---

## 1. Project Summary

**Project Name:** Email Composer Automation

**Purpose:** Email Composer Automation is a single-screen web application designed for customer support agents (associates) to generate AI-powered responses to customer queries. The application leverages Retrieval-Augmented Generation (RAG) to provide contextually relevant, professional responses by referencing a curated knowledge base of canned responses.

**Target Users:**
- **Associates (Support Agents):** Paste a customer query, optionally provide custom prompt instructions, generate an AI response, edit it, and copy to clipboard.
- **Admins:** Manage users, monitor system usage, review audit logs, track token consumption, and detect security anomalies.

**Core Value Proposition:** Reduces response time for customer support agents by generating high-quality, context-aware draft responses grounded in an existing knowledge base, while providing administrators with full visibility into system usage, security, and performance.

---

## 2. Tech Stack

### 2.1 Backend

| Layer | Technology | Version / Details |
|---|---|---|
| Framework | FastAPI | >= 0.135.1 |
| Server | Uvicorn | >= 0.42.0 (with standard extras) |
| Language | Python | 3.12+ |
| Package Manager | uv | Lock file: uv.lock |
| Database (Local) | SQLite | via aiosqlite >= 0.20.0 |
| Database (Production) | Cloud SQL (PostgreSQL) | via asyncpg >= 0.30.0 |
| Vector Store (Local) | ChromaDB | >= 0.5.0 (persistent client) |
| Vector Store (Production) | BigQuery Vector Search | google-cloud-bigquery >= 3.25.0 |
| Embeddings (Production) | Vertex AI Text Embeddings | text-embedding-005 via google-cloud-aiplatform >= 1.60.0 |
| LLM | Google Gemini | gemini-2.5-flash via google-genai >= 1.0.0 |
| Authorization | Casbin | >= 1.36.0 (file-based RBAC) |
| Password Hashing | bcrypt | >= 4.0.0 |
| HTTP Client | httpx | >= 0.28.0 (async, for geolocation lookups) |
| Excel Parsing | openpyxl | >= 3.1.0 |
| User Agent Parsing | user-agents | >= 2.2.0 |
| Env Management | python-dotenv | >= 1.0.0 |

### 2.2 Frontend

| Layer | Technology | Version / Details |
|---|---|---|
| Framework | React | 19.2.4 |
| Language | TypeScript | 4.9.5 |
| Build Tool | Create React App | react-scripts 5.0.1 |
| State Management | useReducer + Context API | No external state libraries |
| Styling | Plain CSS | CSS custom properties (design tokens) |
| Animations | Framer Motion | >= 12.38.0 |
| Charts | Recharts | >= 3.8.1 |
| HTTP Client | Fetch API | Native browser API |
| Testing | @testing-library/react | 16.3.2 |
| Font | Inconsolata | Monospace (Google Fonts) |

### 2.3 Infrastructure & Deployment

| Layer | Technology | Details |
|---|---|---|
| Container Platform | Google Cloud Run | Managed serverless containers |
| Container Registry | Artifact Registry | us-central1-docker.pkg.dev/resolve-490813/resolve-repo |
| Build System | Google Cloud Build | cloudbuild.yaml for frontend |
| Backend Container | Python 3.12 slim | Dockerfile with asyncpg system deps |
| Frontend Container | Node 20 (build) + Nginx Alpine (serve) | Multi-stage Dockerfile |
| Web Server | Nginx | SPA routing, static asset caching (1yr), health endpoint |
| Region | us-central1 | GCP region for all services |
| GCP Project | resolve-490813 | - |
| Deploy Script | Bash (deploy.sh) | Supports selective backend/frontend/both deployment |

---

## 3. Flow Architecture

### 3.1 Response Generation Flow (Core Feature)

```
User (Associate)
    |
    v
[Frontend: GenerateView]
    | POST /api/generate { query, customPrompt? }
    v
[Auth Middleware]
    | 1. Extract session token (cookie or Bearer header)
    | 2. Validate session exists and not expired
    | 3. Check user is active
    | 4. Casbin RBAC: enforce(role, path, method)
    v
[Generate Route Handler]
    |
    |--- Step 1: Semantic Search -----> [Vector Store]
    |    Local:  ChromaDB.query(query_text, n_results=3)
    |    Prod:   BigQuery VECTOR_SEARCH(embedding, top_k=3, COSINE)
    |            + Vertex AI text-embedding-005 for query embedding
    |    Returns: [{category, description, response, relevance_score}]
    |
    |--- Step 2: Build RAG Context ---> [rag.py]
    |    Formats sources as numbered references with relevance scores
    |
    |--- Step 3: Build System Prompt -> [prompts.py]
    |    Base system prompt + optional custom prompt appendix
    |
    |--- Step 4: LLM Call ------------> [Google Gemini 2.5 Flash]
    |    Input: system_prompt, context, query
    |    Config: extended thinking (2048 token budget)
    |    Output: delimiter-parsed response (---RESPONSE--- / ---REASONING---)
    |    Returns: (response_text, reasoning_text, token_usage)
    |
    |--- Step 5: Persist Data
    |    |-> Save conversation to DB (conversations table)
    |    |-> Save token usage to DB (token_usage table)
    |
    |--- Step 6: Audit (non-blocking)
    |    |-> Queue "generate" audit event (async event queue)
    |
    v
[Response to Frontend]
    GenerateResponse { response, reasoning, sources[], conversation }
```

### 3.2 Authentication Flow

```
User
    |
    v
[LoginPage: Step 1 - Email]
    | POST /api/auth/check-email { email }
    v
[Auth Route]
    | Verify user exists, is active
    | Return: { email, requires_password, user_name }
    v
[LoginPage: Step 2 - Password (if required)]
    | POST /api/auth/login { email, password? }
    v
[Auth Route]
    | 1. Lookup user by email
    | 2. If admin: verify bcrypt password
    | 3. If associate: passwordless (no password required)
    | 4. Create session (token = secrets.token_urlsafe(32), TTL = 24h)
    | 5. Create session_activity record
    | 6. Parse device info (User-Agent, X-Device-Info header)
    | 7. Lookup IP geolocation (ip-api.com, cached 24h)
    | 8. Record login_attempt (with geo + device data)
    | 9. Emit "login" audit event
    | 10. Set session_token HTTP-only cookie
    v
[Authenticated Session]
    | Every request: AuthMiddleware validates token + RBAC
    | Heartbeat: POST /api/analytics/heartbeat every 30s (tracks active/idle)
    |
    | POST /api/auth/logout
    |   -> Delete session, end session_activity, emit "logout" event
```

### 3.3 Audit & Analytics Pipeline

```
[Any Protected Endpoint]
    |
    | emit_*() function called (non-blocking)
    v
[Async Event Queue]
    | asyncio.Queue
    | Batches up to 50 events or flushes every 2 seconds
    v
[Database: audit_events table]
    | Stores: event_type, user, IP, resource, metadata, timestamp
    v
[Analytics Endpoints (Admin)]
    |
    |-- GET /api/analytics/overview         -> OverviewStats
    |-- GET /api/analytics/daily-activity   -> DailyActivityPoint[]
    |-- GET /api/analytics/audit-log        -> Paginated AuditEventResponse[]
    |-- GET /api/analytics/login-attempts   -> Paginated LoginAttemptResponse[]
    |-- GET /api/analytics/sessions         -> SessionActivityResponse[]
    |-- GET /api/analytics/token-usage      -> TokenUsagePoint[]
    |-- GET /api/analytics/token-by-user    -> TokenByUser[]
    |-- GET /api/analytics/security-alerts  -> SecurityAlert[]
    |-- GET /api/analytics/usage-heatmap    -> HeatmapCell[]
    v
[Frontend: AnalyticsDashboard]
    Tabs: Overview | Audit Log | Sessions & Security | Token Usage
```

### 3.4 RBAC Enforcement Flow

```
[Incoming Request]
    |
    v
[AuthMiddleware]
    | 1. Skip public paths: /api/health, /api/auth/check-email, /api/auth/login
    | 2. Extract token from cookie or Authorization header
    | 3. Lookup session in DB
    | 4. Check session not expired
    | 5. Load user, check is_active
    | 6. Casbin enforce(user.role, request.path, request.method)
    |
    |--- PASS --> Attach user + session to request.state, continue
    |--- FAIL --> 401 (auth) or 403 (permission), emit unauthorized_access event
```

---

## 4. Data Requirements

### 4.1 Database Schema (SQLite / PostgreSQL)

#### Table: `conversations`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: conv-{uuid4} |
| query | TEXT | NOT NULL | Customer query text |
| response | TEXT | NOT NULL | AI-generated response |
| reasoning | TEXT | - | AI reasoning / thought process |
| sources_json | TEXT | - | JSON array of retrieved sources |
| custom_prompt | TEXT | - | Optional custom prompt used |
| timestamp | BIGINT | NOT NULL | Epoch milliseconds |

#### Table: `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: usr-{uuid4} |
| email | TEXT | UNIQUE NOT NULL | User email address |
| name | TEXT | - | Display name |
| role | TEXT | NOT NULL | "admin" or "associate" |
| password_hash | TEXT | - | bcrypt hash (admins only) |
| is_active | INTEGER | DEFAULT 1 | Account active flag |
| created_at | BIGINT | - | Epoch milliseconds |
| updated_at | BIGINT | - | Epoch milliseconds |

#### Table: `sessions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: sess-{uuid4} |
| user_id | TEXT | NOT NULL | FK to users |
| token | TEXT | UNIQUE | Session token (urlsafe, 32 bytes) |
| created_at | BIGINT | - | Epoch milliseconds |
| expires_at | BIGINT | - | TTL: 24 hours default |

#### Table: `audit_events`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: evt-{uuid4} |
| event_type | TEXT | NOT NULL | login, generate, logout, history_view, history_edit, history_delete, history_clear, user_create, user_update, user_delete, auth_failure, unauthorized_access |
| user_id | TEXT | - | Acting user ID |
| user_email | TEXT | - | Acting user email |
| user_role | TEXT | - | admin / associate |
| ip_address | TEXT | - | Client IP |
| user_agent | TEXT | - | Browser User-Agent |
| resource_type | TEXT | - | session, conversation, user |
| resource_id | TEXT | - | Affected resource ID |
| metadata_json | TEXT | - | Context-specific JSON data |
| timestamp | BIGINT | NOT NULL | Epoch milliseconds |
| **Indexes** | | | user_id, event_type, timestamp |

#### Table: `login_attempts`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: la-{uuid4} |
| user_id | TEXT | - | Null if user not found |
| user_email | TEXT | NOT NULL | Attempted email |
| success | INTEGER | - | Boolean: 0/1 |
| ip_address | TEXT | - | Client IP |
| country | TEXT | - | Geo lookup result |
| city | TEXT | - | Geo lookup result |
| browser | TEXT | - | Parsed from UA |
| os | TEXT | - | Parsed from UA |
| device_type | TEXT | - | desktop / mobile / tablet |
| screen_resolution | TEXT | - | From X-Device-Info header |
| timezone | TEXT | - | From X-Device-Info header |
| session_id | TEXT | - | If login successful |
| failure_reason | TEXT | - | If login failed |
| timestamp | BIGINT | - | Epoch milliseconds |
| **Indexes** | | | email, ip_address, timestamp |

#### Table: `session_activity`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: sa-{uuid4} |
| session_id | TEXT | NOT NULL | FK to sessions |
| user_id | TEXT | NOT NULL | FK to users |
| started_at | BIGINT | - | Session start time |
| ended_at | BIGINT | - | Session end time (null if active) |
| last_activity_at | BIGINT | - | Last heartbeat |
| active_duration_ms | BIGINT | - | Accumulated active time |
| idle_duration_ms | BIGINT | - | Accumulated idle time |
| page_views | INTEGER | - | Page view count |
| actions_count | INTEGER | - | Action count (heartbeats) |
| **Indexes** | | | user_id, session_id |

#### Table: `token_usage`
| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Format: tu-{uuid4} |
| user_id | TEXT | NOT NULL | FK to users |
| user_email | TEXT | - | For convenience |
| conversation_id | TEXT | - | FK to conversations |
| model | TEXT | - | e.g., gemini-2.5-flash |
| prompt_tokens | INTEGER | - | Input tokens |
| completion_tokens | INTEGER | - | Output tokens |
| total_tokens | INTEGER | - | Sum total |
| thinking_tokens | INTEGER | - | Extended thinking tokens |
| latency_ms | INTEGER | - | Request latency |
| timestamp | BIGINT | - | Epoch milliseconds |
| **Indexes** | | | user_id, timestamp |

### 4.2 Vector Store Schema

#### BigQuery Table: `resolve_vectors.canned_responses` (Production)
| Column | Type | Description |
|---|---|---|
| id | STRING | Format: canned-{index} |
| category | STRING | Response category |
| description | STRING | Issue description |
| response | STRING | Canned response text |
| document | STRING | Concatenated: "Category: ...\nDescription: ...\nResponse: ..." |
| embedding | ARRAY\<FLOAT64\> | Vertex AI text-embedding-005 vector |

#### ChromaDB Collection: `canned_responses` (Local)
- Documents: Concatenated category + description + response text
- Metadata: { category, description, response }
- Embeddings: ChromaDB default embeddings

### 4.3 Source Data

**File:** `Canned_Responses_Templatefull.xlsx`
- **Columns:** Category, Description, Response
- **Purpose:** Knowledge base for RAG retrieval
- **Ingestion:** On application startup, parsed via openpyxl, loaded into vector store

### 4.4 API Request/Response Models

#### Generation
- **GenerateRequest:** { query: string, customPrompt?: string }
- **GenerateResponse:** { response: string, reasoning?: string, sources: RetrievedSource[], conversation: ConversationResponse }
- **RetrievedSource:** { category: string, description: string, response: string, relevance_score: float }
- **ConversationResponse:** { id, query, response, reasoning?, sources?, customPrompt?, timestamp }

#### Authentication
- **LoginCheckEmailRequest:** { email: string }
- **LoginCheckEmailResponse:** { email, requires_password: bool, user_name: string }
- **LoginRequest:** { email: string, password?: string }
- **LoginResponse:** { user: UserResponse, token: string }
- **UserResponse:** { id, email, name, role, is_active }

#### User Management
- **CreateUserRequest:** { email, name, role, password? }
- **UpdateUserRequest:** { name?, role?, password?, is_active? }

#### Analytics
- **OverviewStats:** { total_users, active_users_24h, active_sessions, total_queries, total_tokens, queries_today, tokens_today }
- **DailyActivityPoint:** { date, logins, queries, tokens }
- **AuditEventResponse:** { id, event_type, user_email?, user_role?, ip_address?, resource_type?, resource_id?, metadata_json?, timestamp }
- **LoginAttemptResponse:** { id, user_email, success, ip_address?, country?, city?, browser?, os?, device_type?, failure_reason?, timestamp }
- **SessionActivityResponse:** { session_id, user_id, user_email?, started_at, last_activity_at, active_duration_ms, idle_duration_ms, actions_count, is_active }
- **TokenUsagePoint:** { date, prompt_tokens, completion_tokens, total_tokens, request_count }
- **TokenByUser:** { user_id, user_email?, total_tokens, request_count, avg_tokens_per_request }
- **SecurityAlert:** { alert_type, severity, user_email?, description, details: dict, timestamp }
- **HeatmapCell:** { day_of_week, hour, count }
- **HeartbeatRequest:** { active: bool }

---

## 5. Solution Approach

### 5.1 RAG (Retrieval-Augmented Generation) Pipeline

The core intelligence of Email Composer Automation relies on a RAG pipeline:

1. **Knowledge Base Ingestion:** On startup, the application reads `Canned_Responses_Templatefull.xlsx`, generates embeddings, and stores them in the vector store (ChromaDB locally, BigQuery + Vertex AI in production).

2. **Semantic Search:** When a user submits a query, it is embedded and compared against the knowledge base using cosine similarity. The top 3 most relevant canned responses are retrieved.

3. **Context Assembly:** Retrieved sources are formatted into a structured context block with relevance scores, categories, descriptions, and full response text.

4. **Prompt Construction:** A system prompt instructs the LLM to act as an expert customer support assistant. If the user provides a custom prompt, it is appended as "Additional instructions from the agent."

5. **LLM Generation:** Google Gemini 2.5 Flash generates the response with extended thinking enabled (2048-token thinking budget). Output uses delimiter-based parsing (`---RESPONSE---` / `---REASONING---`) to separate the customer-facing response from internal reasoning.

6. **Persistence:** The conversation (query, response, reasoning, sources) and token usage metrics are saved to the database.

### 5.2 Dual-Environment Architecture

The application is designed to run in two modes controlled by the `ENV` setting:

| Aspect | Local (ENV=local) | Production (ENV=production) |
|---|---|---|
| Database | SQLite (aiosqlite) | Cloud SQL PostgreSQL (asyncpg) |
| Vector Store | ChromaDB (local persistent) | BigQuery Vector Search |
| Embeddings | ChromaDB default | Vertex AI text-embedding-005 |
| Deployment | Uvicorn direct | Google Cloud Run containers |

Both environments share identical application code, models, routes, and middleware. The `config.py` settings object switches between backends based on the `ENV` variable.

### 5.3 RBAC (Role-Based Access Control)

Authorization uses Casbin with a file-based policy model:

- **Model:** Request-based (subject, object, action) with role grouping and keyMatch2 path matching
- **Roles:**
  - `associate` — Generate responses, manage own history, heartbeat
  - `admin` — All associate permissions + user management + full analytics access
- **Enforcement:** Middleware checks on every protected request before reaching the route handler
- **Policy Source:** `casbin_policy.csv` file loaded at startup

### 5.4 Audit & Security System

**Audit Trail:**
- Every significant action emits an audit event (login, generate, edit, delete, user management, unauthorized access)
- Events are queued asynchronously (asyncio.Queue) and batch-written to the database (batch size: 50, flush interval: 2s)
- Each event captures: user identity, IP address, user agent, resource type/ID, and context-specific metadata

**Security Detection (Real-time):**
- Multi-IP login detection within 1-hour window (HIGH severity)
- Rapid request detection: >50 requests in 5 minutes (MEDIUM severity)
- Off-hours access: Outside 9:00-18:00 UTC (LOW severity)
- Repeated auth failures: >5 failures in 1 hour (HIGH severity)

**Device & Geo Tracking:**
- User-Agent parsing: browser, OS, device type
- X-Device-Info header: screen resolution, timezone
- IP geolocation via ip-api.com with 24-hour in-memory cache

### 5.5 Session Management

- Token-based sessions using `secrets.token_urlsafe(32)`
- HTTP-only cookie (`session_token`) with configurable TTL (default: 24 hours)
- Expired sessions cleaned up on application startup
- Session activity tracking: active duration, idle duration, action counts, page views
- Frontend heartbeat every 30 seconds with 60-second idle threshold

---

## 6. Functional Requirements

### 6.1 Core Workflow (Associate)

| ID | Requirement | Description |
|---|---|---|
| FR-01 | Query Input | Auto-growing textarea for pasting customer queries |
| FR-02 | Response Generation | Submit query to generate AI-powered response via RAG + Gemini |
| FR-03 | Custom Prompt Mode | Toggleable additional instructions for the AI (prompt engineering) |
| FR-04 | Response Display | Tabbed panel showing Response, Reasoning, and Sources |
| FR-05 | Response Editing | In-place editing of generated responses |
| FR-06 | Copy to Clipboard | One-click copy of the generated/edited response |
| FR-07 | Regenerate | Re-generate response for the same query |
| FR-08 | Clear | Reset query and response fields |

### 6.2 Conversation History (Associate)

| ID | Requirement | Description |
|---|---|---|
| FR-09 | History Sidebar | Chronological list of past query/response pairs |
| FR-10 | Conversation Detail | Click to view full conversation with all tabs |
| FR-11 | Edit History | Modify saved responses |
| FR-12 | Delete Single | Remove individual conversation from history |
| FR-13 | Clear All History | Bulk delete all conversations |
| FR-14 | Relative Timestamps | Display "just now", "5m ago", "2h ago", etc. |
| FR-15 | Custom Prompt Badge | Visual indicator when a custom prompt was used |

### 6.3 Authentication

| ID | Requirement | Description |
|---|---|---|
| FR-16 | Email Check | Two-step login: verify email exists before requesting password |
| FR-17 | Password Login | Admin accounts require password (bcrypt verified) |
| FR-18 | Passwordless Login | Associate accounts authenticate with email only |
| FR-19 | Session Persistence | Session token stored as HTTP-only cookie, auto-restored on refresh |
| FR-20 | Logout | Terminate session, clear cookie, record audit event |
| FR-21 | Inactive Account Block | Disabled accounts cannot log in |

### 6.4 User Management (Admin Only)

| ID | Requirement | Description |
|---|---|---|
| FR-22 | List Users | View all users with name, email, role, active status |
| FR-23 | Create User | Add new user with email, name, role; password required for admins |
| FR-24 | Edit User | Update name, role, password, active status |
| FR-25 | Delete User | Remove user account |
| FR-26 | Duplicate Check | Prevent creation of users with existing email |

### 6.5 Analytics Dashboard (Admin Only)

| ID | Requirement | Description |
|---|---|---|
| FR-27 | Overview Stats | Total users, active users (24h), active sessions, total queries, total tokens, today's queries/tokens |
| FR-28 | Daily Activity Chart | 30-day trend of logins, queries, and tokens |
| FR-29 | Audit Log | Paginated, filterable log of all system events |
| FR-30 | Login Attempts | History of login attempts with success/failure, geo, device info |
| FR-31 | Active Sessions | List of current sessions with activity metrics |
| FR-32 | Token Usage | Time-series of token consumption (prompt, completion, total) |
| FR-33 | Token by User | Per-user token usage breakdown |
| FR-34 | Security Alerts | Real-time threat detection alerts with severity levels |
| FR-35 | Usage Heatmap | Hourly usage patterns by day of week |
| FR-36 | User Activity | Per-user activity summary (queries, tokens, active time, logins) |

### 6.6 Theming & UX

| ID | Requirement | Description |
|---|---|---|
| FR-37 | Theme Switching | Toggle between Obsidian (dark) and Paper (light) themes |
| FR-38 | Persistent Theme | Theme selection saved to localStorage |
| FR-39 | Smooth Transitions | 400ms crossfade on theme change |
| FR-40 | Responsive Layout | Sidebar collapses to drawer on mobile (<768px) |
| FR-41 | Staggered Animations | Entrance animations on page load (respects prefers-reduced-motion) |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement | Details |
|---|---|---|
| NFR-01 | Non-blocking Audit | Audit events queued asynchronously; do not impact request latency |
| NFR-02 | Batch Processing | Audit events batch-written (up to 50) every 2 seconds |
| NFR-03 | Connection Pooling | asyncpg pool for production database connections |
| NFR-04 | Geo Cache | IP geolocation responses cached in-memory for 24 hours |
| NFR-05 | Static Asset Caching | Nginx serves static files with 1-year immutable cache headers |
| NFR-06 | LLM Latency Tracking | Every generation request records latency_ms for monitoring |
| NFR-07 | Thinking Budget | Extended thinking capped at 2048 tokens to bound LLM response time |

### 7.2 Security

| ID | Requirement | Details |
|---|---|---|
| NFR-08 | Password Hashing | bcrypt with default work factor |
| NFR-09 | HTTP-only Cookies | Session tokens not accessible to JavaScript |
| NFR-10 | Session Expiration | Automatic 24-hour TTL with cleanup on startup |
| NFR-11 | RBAC Enforcement | Casbin middleware on every protected route |
| NFR-12 | Audit Trail | Complete record of all user actions with IP, UA, and resource tracking |
| NFR-13 | Brute Force Detection | Alert after 5+ failed logins in 1 hour |
| NFR-14 | Anomaly Detection | Multi-IP login, rapid request, and off-hours access detection |
| NFR-15 | Device Fingerprinting | Browser, OS, device type, screen resolution, timezone captured per login |
| NFR-16 | Geolocation Tracking | IP-based country/city tracking for login attempts |

### 7.3 Scalability

| ID | Requirement | Details |
|---|---|---|
| NFR-17 | Stateless Backend | No server-side state beyond database; horizontally scalable on Cloud Run |
| NFR-18 | Managed Infrastructure | Cloud Run auto-scales containers based on traffic |
| NFR-19 | Production Vector Search | BigQuery handles large-scale vector similarity search |
| NFR-20 | Dual-Environment Support | Same codebase runs locally (SQLite/ChromaDB) and in production (PostgreSQL/BigQuery) |

### 7.4 Observability

| ID | Requirement | Details |
|---|---|---|
| NFR-21 | Health Endpoint | GET /api/health returns {"status": "ok"} for container health checks |
| NFR-22 | Token Usage Metrics | Per-request recording of prompt, completion, thinking, and total tokens |
| NFR-23 | Session Activity | Active/idle duration tracking via heartbeat mechanism |
| NFR-24 | Security Dashboards | Admin-accessible security alerts and login attempt analytics |
| NFR-25 | Usage Heatmaps | Temporal usage patterns for capacity planning |

### 7.5 Reliability

| ID | Requirement | Details |
|---|---|---|
| NFR-26 | Graceful Shutdown | Audit event queue flushes remaining events before process exit |
| NFR-27 | Error Isolation | Audit emission failures do not cascade to request handling |
| NFR-28 | Auto-Seed Admin | Default admin user created on first startup if not exists |
| NFR-29 | Session Cleanup | Expired sessions automatically purged on application start |

---

## 8. Constraints and Assumptions

### 8.1 Constraints

| ID | Constraint | Details |
|---|---|---|
| C-01 | LLM Provider | Locked to Google Gemini (gemini-2.5-flash). No provider abstraction layer. |
| C-02 | Embedding Model | Production uses Vertex AI text-embedding-005 only. |
| C-03 | GCP Dependency | Production deployment requires GCP (Cloud Run, BigQuery, Vertex AI, Artifact Registry, Cloud SQL). |
| C-04 | Single Region | All services deployed to us-central1. No multi-region support. |
| C-05 | CORS Wildcard | Currently allows all origins (`*`). Must be restricted for production security. |
| C-06 | File-based RBAC | Casbin policies defined in CSV files. Policy changes require redeployment. |
| C-07 | No Multi-Tenancy | Single tenant design. All users share the same knowledge base and conversation store. |
| C-08 | No Real-time Updates | No WebSocket/SSE. Frontend polls via heartbeat; no push notifications. |
| C-09 | Session-based Auth | No OAuth/OIDC/SSO integration. Custom session token mechanism. |
| C-10 | SQLite for Local Only | SQLite not suitable for concurrent multi-user local testing. |
| C-11 | Passwordless Associates | Associate accounts have no password protection. Email-only login. |

### 8.2 Assumptions

| ID | Assumption | Details |
|---|---|---|
| A-01 | Knowledge Base Size | The canned responses Excel file is small enough to ingest fully on each startup. |
| A-02 | Single Admin Seed | A default admin (admin@resolve.ai / admin123) is seeded on first run. Assumed to be changed in production. |
| A-03 | Trusted Network | Associates are assumed to be internal users on a trusted network (justifies passwordless login). |
| A-04 | UTC Working Hours | Security off-hours detection assumes 9:00-18:00 UTC as working hours. |
| A-05 | IP-API Availability | Geolocation depends on ip-api.com (free tier); assumed available. Falls back gracefully to "Unknown". |
| A-06 | Low Concurrency | Local development assumes single-user. Production handles concurrency via Cloud Run + PostgreSQL. |
| A-07 | Browser Compatibility | Frontend targets modern browsers with CSS custom properties, Fetch API, and ES2020+ support. |
| A-08 | Stable LLM Output | Gemini output follows the delimiter format (---RESPONSE--- / ---REASONING---) consistently. Graceful fallback if not. |
| A-09 | Token Tracking Accuracy | Token counts from Gemini API response metadata are assumed accurate. |
| A-10 | No Data Retention Policy | No automatic data expiration or archival for conversations, audit logs, or token usage records. |

---

## 9. API Endpoint Summary

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | /api/health | Public | - | Health check |
| POST | /api/auth/check-email | Public | - | Verify email exists |
| POST | /api/auth/login | Public | - | Authenticate user |
| GET | /api/auth/me | Protected | Any | Get current user |
| POST | /api/auth/logout | Protected | Any | End session |
| POST | /api/generate | Protected | Any | Generate AI response |
| GET | /api/history | Protected | Any | List conversations |
| PATCH | /api/history/:id | Protected | Any | Edit conversation |
| DELETE | /api/history/:id | Protected | Any | Delete conversation |
| DELETE | /api/history | Protected | Any | Clear all conversations |
| GET | /api/users | Protected | Admin | List users |
| POST | /api/users | Protected | Admin | Create user |
| GET | /api/users/:id | Protected | Admin | Get user details |
| PATCH | /api/users/:id | Protected | Admin | Update user |
| DELETE | /api/users/:id | Protected | Admin | Delete user |
| GET | /api/analytics/overview | Protected | Admin | System stats |
| GET | /api/analytics/daily-activity | Protected | Admin | 30-day trend |
| GET | /api/analytics/audit-log | Protected | Admin | Paginated audit log |
| GET | /api/analytics/login-attempts | Protected | Admin | Login history |
| GET | /api/analytics/sessions | Protected | Admin | Active sessions |
| GET | /api/analytics/user-activity | Protected | Admin | Per-user activity |
| GET | /api/analytics/token-usage | Protected | Admin | Token time-series |
| GET | /api/analytics/token-by-user | Protected | Admin | Per-user tokens |
| GET | /api/analytics/security-alerts | Protected | Admin | Security threats |
| GET | /api/analytics/usage-heatmap | Protected | Admin | Usage patterns |
| POST | /api/analytics/heartbeat | Protected | Any | Activity heartbeat |

---

## 10. Project File Structure

```
usecase-3-poc/
├── CONTEXT.md                              # Original project description
├── DOCUMENT.md                             # This file
├── deploy.sh                               # GCP deployment script
├── Canned_Responses_Templatefull.xlsx       # Knowledge base (Excel)
├── pts canned respones full.pdf            # Reference PDF
├── .gitignore
│
├── backend/
│   ├── main.py                             # FastAPI entry point + lifespan
│   ├── pyproject.toml                      # Python deps (uv)
│   ├── uv.lock                             # Lock file
│   ├── Dockerfile                          # Python 3.12 slim container
│   ├── .env                                # Environment variables
│   ├── Canned_Responses_Templatefull.xlsx   # Knowledge base (copy)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                       # Settings (Pydantic BaseSettings)
│   │   ├── database.py                     # DB connection, schema, CRUD, analytics queries
│   │   ├── models.py                       # Pydantic request/response models
│   │   ├── llm.py                          # Gemini client + generation
│   │   ├── rag.py                          # RAG context builder
│   │   ├── prompts.py                      # System prompt template
│   │   ├── chroma.py                       # ChromaDB vector store (local)
│   │   ├── vector_store.py                 # BigQuery vector store (production)
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── middleware.py               # Auth + RBAC middleware
│   │   │   ├── enforcer.py                 # Casbin RBAC enforcer
│   │   │   ├── casbin_model.conf           # RBAC model definition
│   │   │   └── casbin_policy.csv           # RBAC policy rules
│   │   ├── audit/
│   │   │   ├── __init__.py
│   │   │   ├── emitter.py                  # Audit event emit functions
│   │   │   ├── event_queue.py              # Async batch event processor
│   │   │   ├── security.py                 # Security anomaly detection
│   │   │   ├── device.py                   # Device info parser
│   │   │   └── geo.py                      # IP geolocation (ip-api.com)
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py                   # GET /api/health
│   │       ├── auth.py                     # Auth endpoints
│   │       ├── generate.py                 # POST /api/generate
│   │       ├── history.py                  # Conversation CRUD
│   │       ├── users.py                    # User management (admin)
│   │       └── analytics.py               # Analytics endpoints (admin)
│   └── data/                               # Local SQLite + ChromaDB data
│
└── frontend/
    ├── package.json                        # Node deps
    ├── tsconfig.json                       # TypeScript config
    ├── Dockerfile                          # Multi-stage: Node build + Nginx
    ├── nginx.conf                          # SPA routing + caching
    ├── cloudbuild.yaml                     # Cloud Build config
    ├── .dockerignore
    ├── public/
    │   ├── index.html                      # Root HTML + theme restore script
    │   └── manifest.json                   # PWA manifest
    └── src/
        ├── index.tsx                       # React 19 entry point
        ├── App.tsx                         # Root component + routing
        ├── App.css
        ├── App.test.tsx                    # Basic test placeholder
        ├── setupTests.ts                   # Jest config
        ├── types/
        │   └── index.ts                    # TypeScript interfaces
        ├── services/
        │   └── api.ts                      # REST API client
        ├── context/
        │   ├── AppContext.tsx              # App state (useReducer)
        │   ├── AuthContext.tsx             # Auth state + session
        │   ├── ThemeContext.tsx            # Theme management
        │   └── IntroContext.tsx            # Entrance animations
        ├── hooks/
        │   └── useHeartbeat.ts            # Activity tracking hook
        ├── styles/
        │   ├── tokens.css                 # Design tokens (CSS variables)
        │   └── global.css                 # Global styles + reset
        └── components/
            ├── LoginPage/                  # Authentication UI
            ├── Layout/                     # Shell with sidebar + topbar
            ├── GenerateView/               # Query input + generation
            ├── ConversationDetail/          # Full conversation viewer
            ├── HistorySidebar/             # Conversation list
            ├── HistoryView/                # Expandable history
            ├── HistoryItem/                # Single history entry
            ├── ResponsePanel/              # Tabbed response display
            ├── QueryInput/                 # Auto-growing query textarea
            ├── PromptInput/                # Custom prompt textarea
            ├── ActionBar/                  # Generate/Clear buttons
            ├── ThemeSwitcher/              # Theme toggle
            ├── UserManagement/             # Admin user CRUD
            ├── AnalyticsDashboard/         # Admin analytics
            │   ├── AnalyticsDashboard.tsx
            │   ├── OverviewTab.tsx
            │   ├── AuditLogTab.tsx
            │   ├── SessionsSecurityTab.tsx
            │   ├── TokenUsageTab.tsx
            │   ├── chartTheme.ts
            │   └── components/
            │       └── StatCard.tsx
            └── common/
                ├── Button.tsx
                ├── Card.tsx
                ├── Toggle.tsx
                └── LoadingSpinner.tsx
```
