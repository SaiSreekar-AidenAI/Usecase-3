# Email Composer Automation | Technical Details Document

---

## Table of Contents

1. [Overview](#1-overview)
2. [Background](#2-background)
3. [Problem Statements](#3-problem-statements)
4. [High-Level Working Design](#4-high-level-working-design)
5. [Design Choices](#5-design-choices)
6. [Agent (User) Workflow in Email Composer Automation](#6-agent-user-workflow-in-the-ai-response-composer)
7. [Time Breakdown Definition (Diagram)](#7-time-breakdown-definition-in-ai-response-composer)
8. [Architecture Diagram](#8-architecture-diagram)
9. [User Flow Diagram](#9-user-flow-diagram)
10. [Sequence Diagrams](#10-sequence-diagrams)
11. [Cloud SQL Instances](#11-cloud-sql-instances)
12. [GCP Config Setup](#12-gcp-config-setup)
13. [Database Schema](#13-database-schema)
14. [Project Information](#14-project-information)
15. [Scalability](#15-scalability)
16. [Logging / Monitoring](#16-logging--monitoring)
17. [Build vs Reuse](#17-build-vs-reuse)
18. [Detailed Technical Design](#18-detailed-technical-design)

---

## 1. Overview

**Email Composer Automation** is an AI-powered customer support response console that enables support agents (associates) to generate contextually relevant, professional responses to customer queries using Retrieval-Augmented Generation (RAG). The system retrieves relevant canned responses from a curated knowledge base, feeds them as context to Google Gemini 2.5 Flash, and produces editable draft responses with reasoning and source attribution.

**Key Capabilities:**
- AI response generation grounded in a curated knowledge base (Excel-based canned responses)
- Custom prompt engineering mode for agents to fine-tune AI behavior per query
- Conversation history with full CRUD (create, read, update, delete)
- Role-Based Access Control (RBAC) with two roles: Admin and Associate
- Comprehensive audit trail capturing every user action with IP, device, and geolocation metadata
- Admin analytics dashboard with security anomaly detection, token usage tracking, and session monitoring
- Dual-environment architecture: local development (SQLite + ChromaDB) and production (Cloud SQL + BigQuery Vector Search)
- Containerized deployment on Google Cloud Run with automated deployment scripting

**Target Users:**
| Role | Description | Access |
|---|---|---|
| Associate | Customer support agent who generates AI-powered responses | Generate, History, Heartbeat |
| Admin | System administrator who manages users and monitors platform | All Associate permissions + User Management + Analytics |

---

## 2. Background

Customer support teams handle high volumes of repetitive queries daily. Agents spend significant time crafting responses that often follow patterns from existing canned response templates. Manual copy-paste from template libraries is slow, error-prone, and produces inconsistent quality.

The Email Composer Automation platform was built to:
- **Automate response drafting** by using AI to synthesize the most relevant canned responses for each unique customer query
- **Preserve agent autonomy** by making generated responses fully editable before use
- **Enable prompt engineering** so agents can provide additional context or tone instructions without developer intervention
- **Provide organizational visibility** through comprehensive audit logging, session tracking, and token usage analytics
- **Enforce access control** with Casbin RBAC to separate agent capabilities from admin capabilities
- **Track security anomalies** with automated detection of multi-IP logins, brute force attempts, rapid requests, and off-hours access

The knowledge base is sourced from `Canned_Responses_Templatefull.xlsx`, an Excel file containing categorized response templates with three columns: Category, Description, and Response.

---

## 3. Problem Statements

### PS-1: Slow Response Drafting
Support agents manually search through large canned response libraries to find relevant templates. This process is time-consuming and inconsistent, with agents often missing the most relevant responses or producing mismatched tone.

### PS-2: Lack of Contextual Intelligence
Existing template systems use keyword-based search which fails to understand semantic meaning. A query about "billing dispute" may not surface a response categorized under "payment concerns" despite being contextually relevant.

### PS-3: No Agent Customization
Agents cannot dynamically adjust the AI's behavior per query. Different customer situations require different tones (empathetic for complaints, technical for bugs, concise for simple requests) but systems offer no per-query prompt engineering capability.

### PS-4: No Audit Trail or Usage Visibility
Organizations have no visibility into how support tools are being used — who is generating what, how many tokens are consumed, what security anomalies occur, and what the overall adoption patterns look like.

### PS-5: Access Control Gaps
Support tools often lack granular access control, giving all users equal access to administrative functions, user management, and system analytics.

### PS-6: No Response Reasoning
When AI generates a response, agents have no insight into why the AI chose a particular approach, which references influenced the answer, or what assumptions were made.

---

## 4. High-Level Working Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                          │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────────┐  │
│  │LoginPage │ │ GenerateView │ │HistorySide-│ │AnalyticsDash-   │  │
│  │          │ │              │ │bar         │ │board            │  │
│  └──────────┘ └──────────────┘ └────────────┘ └─────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Context Layer: AuthContext | AppContext | ThemeContext        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ API Layer: services/api.ts (Fetch + Credentials + Headers)  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (REST JSON)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + Uvicorn)                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Middleware: CORS → AuthMiddleware (Session + Casbin RBAC)     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────────────┐ │
│  │ /auth   │ │/generate │ │/history  │ │/users │ │ /analytics   │ │
│  │ routes  │ │ route    │ │ routes   │ │routes │ │ routes       │ │
│  └─────────┘ └──────────┘ └──────────┘ └───────┘ └──────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Services: LLM (Gemini) | RAG | Prompts | Vector Store        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Audit: EventQueue → BatchProcessor → DB | Security Detectors  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Data: SQLite/PostgreSQL | ChromaDB/BigQuery | Excel Ingest    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Layer Breakdown:**

| Layer | Responsibility | Key Components |
|---|---|---|
| Presentation | User interface, routing, state management | React 19, Context API, Framer Motion, Recharts |
| API Client | HTTP communication, auth headers, device info | `services/api.ts` with Fetch API |
| Middleware | Authentication, authorization, CORS | `AuthMiddleware`, Casbin enforcer |
| Route Handlers | Request validation, orchestration, response | FastAPI routers (auth, generate, history, users, analytics) |
| Service Layer | AI generation, RAG, prompt building | `llm.py`, `rag.py`, `prompts.py`, `chroma.py`, `vector_store.py` |
| Audit Layer | Event emission, queueing, security detection | `emitter.py`, `event_queue.py`, `security.py`, `device.py`, `geo.py` |
| Data Layer | Persistence, CRUD, analytics queries | `database.py` (SQLite/PostgreSQL), ChromaDB/BigQuery |

---

## 5. Design Choices

### 5.1 LLM Provider: Google Gemini 2.5 Flash

| Decision | Rationale |
|---|---|
| **Gemini over GPT/Claude** | Native GCP integration simplifies deployment on Cloud Run; Vertex AI embeddings and BigQuery vector search are first-class GCP services |
| **gemini-2.5-flash** | Optimized for speed and cost; sufficient quality for customer support response generation |
| **Extended Thinking (2048 tokens)** | Enables the model to reason through complex queries internally before producing the customer-facing response |
| **Delimiter-based output parsing** | Uses `---RESPONSE---` and `---REASONING---` delimiters to reliably separate the customer-facing response from internal reasoning, avoiding JSON parsing fragility |

### 5.2 Vector Store: ChromaDB (Local) / BigQuery Vector Search (Production)

| Decision | Rationale |
|---|---|
| **Dual vector store** | Developers can run locally with zero GCP dependencies using ChromaDB; production uses BigQuery for scale and cost-efficiency |
| **Cosine similarity** | Standard metric for text embedding similarity; performs well for semantic search |
| **Top-3 retrieval** | Balances context relevance with prompt length; 3 sources provide sufficient grounding without overwhelming the LLM |
| **text-embedding-005** | Google's latest text embedding model; native Vertex AI integration |

### 5.3 Authentication: Session Tokens over JWT

| Decision | Rationale |
|---|---|
| **Session-based auth** | Server-side session validation enables immediate revocation (logout, admin deactivation); JWTs cannot be revoked before expiry |
| **HTTP-only cookies** | Prevents XSS-based token theft; cookies auto-attach on same-origin requests |
| **Passwordless for associates** | Associates are internal users on a trusted network; reduces friction for the primary user group |
| **bcrypt for admin passwords** | Industry-standard adaptive hashing; only admin accounts require password protection |

### 5.4 Authorization: Casbin RBAC

| Decision | Rationale |
|---|---|
| **Casbin over custom auth** | Proven, extensible RBAC framework with path-matching support (keyMatch2) |
| **File-based policies** | Simple, auditable, version-controlled; suitable for a system with 2 roles and <30 endpoints |
| **Middleware enforcement** | Every request passes through RBAC check before reaching the route handler; no endpoint can be accidentally unprotected |

### 5.5 Database: SQLite (Local) / PostgreSQL (Production)

| Decision | Rationale |
|---|---|
| **Dual database** | SQLite enables zero-config local development; PostgreSQL provides production-grade concurrency and reliability |
| **asyncpg / aiosqlite** | Async drivers prevent database I/O from blocking the event loop; critical for FastAPI's async architecture |
| **No ORM** | Raw SQL provides full control over queries, especially for complex analytics aggregations; avoids ORM overhead |

### 5.6 Audit: Async Event Queue

| Decision | Rationale |
|---|---|
| **Non-blocking emission** | Audit logging never impacts request latency; events are fire-and-forget |
| **Batch writes** | Up to 50 events are batched and written together, reducing database write operations |
| **Graceful shutdown** | Remaining queued events are flushed before process termination |

### 5.7 Frontend: React 19 + Context API

| Decision | Rationale |
|---|---|
| **No Redux/Zustand** | useReducer + Context is sufficient for this application's state complexity; avoids unnecessary dependency |
| **No CSS framework** | Custom design tokens provide full control over theming (Obsidian/Paper); CSS custom properties enable runtime theme switching |
| **Framer Motion** | Spring physics and AnimatePresence provide polished micro-interactions without manual animation management |
| **Recharts** | Lightweight charting library for analytics dashboard; declarative React API |

### 5.8 Deployment: Google Cloud Run

| Decision | Rationale |
|---|---|
| **Cloud Run over GKE** | Simpler operational model; auto-scales to zero; pay-per-request pricing; suitable for variable traffic |
| **Separate services** | Backend and frontend deployed as independent Cloud Run services; can be scaled and updated independently |
| **Nginx for frontend** | Serves static React build with SPA routing, asset caching, and health check endpoint |

---

## 6. Agent (User) Workflow in the AI Response Composer

### 6.1 Associate Workflow

```
┌────────────────────────────────────────────────────────────────┐
│                    ASSOCIATE WORKFLOW                           │
│                                                                │
│  ┌─────────┐   ┌──────────┐   ┌──────────────┐               │
│  │  LOGIN  │──▶│  PASTE   │──▶│  (OPTIONAL)  │               │
│  │  Email  │   │  QUERY   │   │  TOGGLE      │               │
│  │  Only   │   │  into    │   │  PROMPT MODE │               │
│  └─────────┘   │  textarea│   │  + write     │               │
│                └──────────┘   │  custom      │               │
│                               │  instructions│               │
│                               └──────────────┘               │
│                                      │                        │
│                                      ▼                        │
│                          ┌──────────────────┐                │
│                          │  CLICK GENERATE  │                │
│                          │                  │                │
│                          │  ┌────────────┐  │                │
│                          │  │ Loading... │  │                │
│                          │  │ (Gemini    │  │                │
│                          │  │  thinking) │  │                │
│                          │  └────────────┘  │                │
│                          └──────────────────┘                │
│                                      │                        │
│                                      ▼                        │
│              ┌────────────────────────────────────────┐       │
│              │         REVIEW RESPONSE                │       │
│              │                                        │       │
│              │  ┌──────────┐ ┌──────────┐ ┌────────┐ │       │
│              │  │ Response │ │Reasoning │ │Sources │ │       │
│              │  │   Tab    │ │  Tab     │ │  Tab   │ │       │
│              │  └──────────┘ └──────────┘ └────────┘ │       │
│              └────────────────────────────────────────┘       │
│                          │         │          │               │
│                          ▼         ▼          ▼               │
│                    ┌──────────┐ ┌──────┐ ┌──────────┐        │
│                    │  EDIT    │ │ COPY │ │REGENERATE│        │
│                    │ response │ │  to  │ │ with new │        │
│                    │ inline   │ │clipboard│ │ params │        │
│                    └──────────┘ └──────┘ └──────────┘        │
│                          │                                    │
│                          ▼                                    │
│                    ┌──────────┐                               │
│                    │  SAVE    │──▶ History Sidebar            │
│                    │ edited   │                               │
│                    │ response │                               │
│                    └──────────┘                               │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 Admin Workflow

```
┌────────────────────────────────────────────────────────────────┐
│                    ADMIN WORKFLOW                               │
│                                                                │
│  ┌──────────────┐                                             │
│  │ LOGIN        │                                             │
│  │ Email +      │                                             │
│  │ Password     │                                             │
│  └──────┬───────┘                                             │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ MAIN LAYOUT (same as Associate + admin panels)       │     │
│  │                                                      │     │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │     │
│  │  │  Generate    │ │  User Mgmt   │ │  Analytics   │ │     │
│  │  │  (same as    │ │  Panel       │ │  Dashboard   │ │     │
│  │  │  associate)  │ │              │ │              │ │     │
│  │  └──────────────┘ └──────┬───────┘ └──────┬───────┘ │     │
│  └──────────────────────────┼────────────────┼──────────┘     │
│                             │                │                 │
│         ┌───────────────────┘                │                 │
│         ▼                                    ▼                 │
│  ┌──────────────┐               ┌──────────────────────┐      │
│  │ Create User  │               │ Overview Tab         │      │
│  │ Edit User    │               │ Audit Log Tab        │      │
│  │ Delete User  │               │ Sessions & Security  │      │
│  │ Toggle Active│               │ Token Usage Tab      │      │
│  └──────────────┘               └──────────────────────┘      │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 Step-by-Step Associate Flow

| Step | User Action | System Response |
|---|---|---|
| 1 | Navigate to app URL | Frontend loads, checks localStorage for existing session token |
| 2 | Enter email address | `POST /api/auth/check-email` — verifies user exists and returns `requires_password` flag |
| 3 | (If associate) Auto-login | `POST /api/auth/login` — creates session, records login attempt with device/geo, emits audit event |
| 4 | Paste customer query | Local state update via `SET_QUERY` dispatch |
| 5 | (Optional) Toggle Prompt Mode | Reveals custom prompt textarea |
| 6 | (Optional) Write custom instructions | Local state update via `SET_CUSTOM_PROMPT` dispatch |
| 7 | Click "Generate Response" | `GENERATE_START` dispatch → `POST /api/generate` with query + customPrompt |
| 8 | Wait for response | Loading spinner shows; backend performs: vector search → RAG context → Gemini call → save → audit |
| 9 | Review Response tab | AI-generated customer-facing response displayed in editable textarea |
| 10 | Review Reasoning tab | AI's internal reasoning about approach, references used, assumptions |
| 11 | Review Sources tab | Retrieved canned responses with relevance scores, categories, descriptions |
| 12 | Edit response if needed | Direct textarea editing; "Save" button appears when content differs from original |
| 13 | Copy to clipboard | Click copy button; copied feedback shown |
| 14 | Save edited response | `PATCH /api/history/{id}` — updates response in database, emits audit event |
| 15 | View history | Sidebar shows all past conversations; click to view details |
| 16 | Delete conversation | `DELETE /api/history/{id}` — removes from database, emits audit event |
| 17 | Logout | `POST /api/auth/logout` — deletes session, clears cookie, emits audit event |

---

## 7. Time Breakdown Definition in AI Response Composer

```
┌────────────────────────────────────────────────────────────────────────┐
│            REQUEST LIFECYCLE TIME BREAKDOWN                             │
│                                                                        │
│  T0: User clicks "Generate"                                           │
│  │                                                                     │
│  ├──► T1: Frontend dispatch + API call setup         (~5ms)           │
│  │    └─ GENERATE_START dispatch, build request body                   │
│  │                                                                     │
│  ├──► T2: Network latency (request)                  (~20-100ms)      │
│  │    └─ HTTPS POST to backend                                         │
│  │                                                                     │
│  ├──► T3: Auth Middleware                             (~5-15ms)        │
│  │    ├─ Token extraction from cookie                                  │
│  │    ├─ Session lookup in database                                    │
│  │    ├─ Expiration check                                              │
│  │    ├─ User lookup                                                   │
│  │    └─ Casbin RBAC enforcement                                       │
│  │                                                                     │
│  ├──► T4: Vector Search                              (~50-500ms)      │
│  │    ├─ [Local] ChromaDB query (in-process)          (~50ms)         │
│  │    └─ [Prod] Vertex AI embed + BigQuery VECTOR_SEARCH (~200-500ms)│
│  │                                                                     │
│  ├──► T5: RAG Context Building                       (~1-5ms)         │
│  │    └─ Format top-3 sources into context string                      │
│  │                                                                     │
│  ├──► T6: Prompt Construction                        (~1ms)           │
│  │    └─ System prompt + optional custom prompt                        │
│  │                                                                     │
│  ├──► T7: LLM Generation (Gemini)                    (~2000-8000ms)   │
│  │    ├─ Extended thinking (up to 2048 tokens)                         │
│  │    ├─ Response generation                                           │
│  │    └─ Delimiter parsing (---RESPONSE--- / ---REASONING---)          │
│  │                                                                     │
│  ├──► T8: Database Persistence                       (~5-20ms)        │
│  │    ├─ Save conversation record                                      │
│  │    └─ Save token usage record                                       │
│  │                                                                     │
│  ├──► T9: Audit Event Emission (non-blocking)        (~0ms impact)    │
│  │    └─ Queue event (async, does not block response)                  │
│  │                                                                     │
│  ├──► T10: Network latency (response)                (~20-100ms)      │
│  │    └─ JSON response to frontend                                     │
│  │                                                                     │
│  └──► T11: Frontend render                           (~10-50ms)       │
│       ├─ GENERATE_SUCCESS dispatch                                     │
│       ├─ Response panel render with tabs                               │
│       └─ History sidebar update                                        │
│                                                                        │
│  TOTAL: ~2100-8800ms (dominated by T7: LLM Generation)               │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ BACKGROUND (Async, after response returned):                    │   │
│  │                                                                 │   │
│  │  ├─ Audit EventQueue batches events (every 2s or 50 events)    │   │
│  │  ├─ Heartbeat ping every 30s (active/idle tracking)            │   │
│  │  └─ Geo IP cache refresh (24h TTL)                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GOOGLE CLOUD PLATFORM                               │
│                              Project: gtm-cloud-helpdesk                              │
│                              Region: us-central1                                 │
│                                                                                  │
│  ┌─────────────────────────┐       ┌─────────────────────────────────────────┐  │
│  │   CLOUD RUN             │       │   CLOUD RUN                             │  │
│  │   email-composer-frontend      │       │   email-composer-backend                       │  │
│  │                         │       │                                         │  │
│  │  ┌───────────────────┐  │       │  ┌─────────────────────────────────┐   │  │
│  │  │  Nginx Alpine     │  │       │  │  Python 3.12 + Uvicorn         │   │  │
│  │  │  (Port 8080)      │  │       │  │  (Port 8080)                   │   │  │
│  │  │                   │  │       │  │                                 │   │  │
│  │  │  React 19 SPA     │──┼──REST─┼──▶  FastAPI Application           │   │  │
│  │  │  Static Assets    │  │ JSON  │  │                                 │   │  │
│  │  │  /health check    │  │       │  │  ┌───────────┐ ┌────────────┐  │   │  │
│  │  └───────────────────┘  │       │  │  │ Auth      │ │ Audit      │  │   │  │
│  └─────────────────────────┘       │  │  │ Middleware │ │ EventQueue │  │   │  │
│                                    │  │  └───────────┘ └────────────┘  │   │  │
│                                    │  └──────────┬──────────┬──────────┘   │  │
│                                    └─────────────┼──────────┼──────────────┘  │
│                                                  │          │                 │
│                            ┌─────────────────────┘          └──────────┐      │
│                            ▼                                           ▼      │
│  ┌─────────────────────────────────────┐    ┌──────────────────────────────┐  │
│  │         CLOUD SQL                    │    │       BIGQUERY               │  │
│  │         (PostgreSQL)                 │    │                              │  │
│  │                                     │    │  Dataset: email_composer_vectors    │  │
│  │  Tables:                            │    │  Table: canned_responses     │  │
│  │  ├─ conversations                   │    │                              │  │
│  │  ├─ users                           │    │  ┌────────────────────────┐  │  │
│  │  ├─ sessions                        │    │  │ VECTOR_SEARCH          │  │  │
│  │  ├─ audit_events                    │    │  │ (Cosine Distance)      │  │  │
│  │  ├─ login_attempts                  │    │  └────────────────────────┘  │  │
│  │  ├─ session_activity                │    └──────────────────────────────┘  │
│  │  └─ token_usage                     │                                      │
│  └─────────────────────────────────────┘    ┌──────────────────────────────┐  │
│                                              │       VERTEX AI             │  │
│  ┌─────────────────────────────────────┐    │                              │  │
│  │    ARTIFACT REGISTRY                │    │  Model: text-embedding-005  │  │
│  │    email-composer-repo/                    │    │  Location: us-central1      │  │
│  │    ├─ email-composer-backend:v1            │    └──────────────────────────────┘  │
│  │    └─ email-composer-frontend:v1           │                                      │
│  └─────────────────────────────────────┘    ┌──────────────────────────────┐  │
│                                              │    GOOGLE GENERATIVE AI     │  │
│  ┌─────────────────────────────────────┐    │    (Gemini API)             │  │
│  │    CLOUD BUILD                      │    │                              │  │
│  │    Builds Docker images from        │    │  Model: gemini-2.5-flash    │  │
│  │    cloudbuild.yaml                  │    │  Thinking: 2048 tokens      │  │
│  └─────────────────────────────────────┘    └──────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────┐                                      │
│  │    EXTERNAL: ip-api.com             │                                      │
│  │    IP Geolocation (free tier)       │                                      │
│  │    Cached 24h in-memory             │                                      │
│  └─────────────────────────────────────┘                                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Local Development Architecture

```
┌─────────────────────────────────────────────────┐
│              LOCAL DEVELOPMENT                    │
│                                                  │
│  Frontend: npm start (port 3000)                 │
│       │                                          │
│       │ REST API (proxy or direct)               │
│       ▼                                          │
│  Backend: uvicorn (port 8000, reload=True)       │
│       │                                          │
│       ├──▶ SQLite (backend/data/local.db)        │
│       ├──▶ ChromaDB (backend/data/chroma_data/)  │
│       └──▶ Google Gemini API (via API key)       │
│                                                  │
│  No GCP services required except Gemini API key  │
└──────────────────────────────────────────────────┘
```

---

## 9. User Flow Diagram

### 9.1 First-Time User Flow

```
                    ┌─────────────┐
                    │  Open App   │
                    │   URL       │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Check for   │
                    │ session in  │──── Token found ──▶ GET /api/auth/me
                    │ localStorage│                         │
                    └──────┬──────┘                    ┌────▼────┐
                           │                           │ Valid?  │
                      No token                         └────┬────┘
                           │                        Yes │    │ No
                    ┌──────▼──────┐                     │    │
                    │  Show       │◀────────────────────┘    │
                    │  LoginPage  │◀──────────────────────────┘
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Enter      │
                    │  Email      │
                    └──────┬──────┘
                           │
                    POST /api/auth/check-email
                           │
                    ┌──────▼──────┐
                    │  Account    │
                    │  exists?    │
                    └──────┬──────┘
                     Yes   │   No
                ┌──────────┤   └──▶ Error: "No account found"
                │          │
         ┌──────▼──────┐   │
         │ Admin role? │   │
         └──────┬──────┘   │
          Yes   │   No     │
         ┌──────┘   └──────┤
         │                 │
  ┌──────▼──────┐  ┌──────▼──────┐
  │ Enter       │  │ Auto-login  │
  │ Password    │  │ (no pass    │
  └──────┬──────┘  │  required)  │
         │         └──────┬──────┘
         │                │
         └────────┬───────┘
                  │
           POST /api/auth/login
                  │
           ┌──────▼──────┐
           │ Session      │
           │ created      │
           │ Cookie set   │
           └──────┬──────┘
                  │
           ┌──────▼──────┐
           │ Main App    │
           │ Layout      │
           │ + Sidebar   │
           │ + Generate  │
           └─────────────┘
```

### 9.2 Navigation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         MAIN LAYOUT                              │
│                                                                  │
│  ┌──────────────────┐   ┌────────────────────────────────────┐  │
│  │   SIDEBAR         │   │        MAIN CONTENT AREA           │  │
│  │                   │   │                                    │  │
│  │  [+ New Query]    │   │  view='generate'                  │  │
│  │                   │   │  ┌──────────────────────────────┐  │  │
│  │  History Items:   │   │  │      GenerateView            │  │  │
│  │  ├─ Conv 1 ──────┼───┼──│  OR                          │  │  │
│  │  ├─ Conv 2 ──────┼───┼──│      ConversationDetail      │  │  │
│  │  └─ Conv 3 ──────┼───┼──│  (when conversation selected)│  │  │
│  │                   │   │  └──────────────────────────────┘  │  │
│  │  [Clear All]      │   │                                    │  │
│  │                   │   │  view='analytics' (admin only)    │  │
│  │  ─────────────    │   │  ┌──────────────────────────────┐  │  │
│  │  [Analytics] ─────┼───┼──│  AnalyticsDashboard          │  │  │
│  │  (admin only)     │   │  └──────────────────────────────┘  │  │
│  │  [Users] ─────────┼───┼──│                                 │  │
│  │  (admin only)     │   │  view='user-management' (admin)   │  │
│  │                   │   │  ┌──────────────────────────────┐  │  │
│  │  ─────────────    │   │  │  UserManagement              │  │  │
│  │  User Info        │   │  └──────────────────────────────┘  │  │
│  │  [Logout]         │   │                                    │  │
│  └──────────────────┘   └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. Sequence Diagrams

### 10.1 Response Generation Sequence

```
User           Frontend            Backend              VectorStore        Gemini LLM        Database
 │                │                   │                      │                 │                │
 │  Click         │                   │                      │                 │                │
 │  Generate      │                   │                      │                 │                │
 │───────────────▶│                   │                      │                 │                │
 │                │ GENERATE_START    │                      │                 │                │
 │                │ (set loading)     │                      │                 │                │
 │                │                   │                      │                 │                │
 │                │ POST /api/generate│                      │                 │                │
 │                │──────────────────▶│                      │                 │                │
 │                │                   │                      │                 │                │
 │                │                   │ validate session     │                 │                │
 │                │                   │ + RBAC check         │                 │                │
 │                │                   │                      │                 │                │
 │                │                   │ search_canned_       │                 │                │
 │                │                   │ responses(query, 3)  │                 │                │
 │                │                   │─────────────────────▶│                 │                │
 │                │                   │                      │                 │                │
 │                │                   │  [{category,         │                 │                │
 │                │                   │    description,      │                 │                │
 │                │                   │    response,         │                 │                │
 │                │                   │    relevance_score}] │                 │                │
 │                │                   │◀─────────────────────│                 │                │
 │                │                   │                      │                 │                │
 │                │                   │ build_rag_context()  │                 │                │
 │                │                   │ build_prompt()       │                 │                │
 │                │                   │                      │                 │                │
 │                │                   │ generate(system_prompt, context, query)│                │
 │                │                   │───────────────────────────────────────▶│                │
 │                │                   │                      │                 │                │
 │                │                   │          (thinking: up to 2048 tokens) │                │
 │                │                   │                      │                 │                │
 │                │                   │   (response, reasoning, token_usage)   │                │
 │                │                   │◀──────────────────────────────────────│                │
 │                │                   │                      │                 │                │
 │                │                   │ save_conversation()  │                 │                │
 │                │                   │───────────────────────────────────────────────────────▶│
 │                │                   │                      │                 │                │
 │                │                   │ save_token_usage()   │                 │                │
 │                │                   │───────────────────────────────────────────────────────▶│
 │                │                   │                      │                 │                │
 │                │                   │ emit_generate()      │                 │                │
 │                │                   │ (async, non-blocking)│                 │                │
 │                │                   │                      │                 │                │
 │                │  GenerateResponse │                      │                 │                │
 │                │  {response,       │                      │                 │                │
 │                │   reasoning,      │                      │                 │                │
 │                │   sources[],      │                      │                 │                │
 │                │   conversation}   │                      │                 │                │
 │                │◀──────────────────│                      │                 │                │
 │                │                   │                      │                 │                │
 │                │ GENERATE_SUCCESS  │                      │                 │                │
 │                │ (update state)    │                      │                 │                │
 │                │                   │                      │                 │                │
 │  Display       │                   │                      │                 │                │
 │  Response      │                   │                      │                 │                │
 │◀───────────────│                   │                      │                 │                │
```

### 10.2 Authentication Sequence

```
User           Frontend            Backend              Database          GeoService
 │                │                   │                    │                  │
 │  Enter Email   │                   │                    │                  │
 │───────────────▶│                   │                    │                  │
 │                │ POST /auth/       │                    │                  │
 │                │ check-email       │                    │                  │
 │                │──────────────────▶│                    │                  │
 │                │                   │ get_user_by_email()│                  │
 │                │                   │───────────────────▶│                  │
 │                │                   │◀───────────────────│                  │
 │                │  {requires_       │                    │                  │
 │                │   password,       │                    │                  │
 │                │   user_name}      │                    │                  │
 │                │◀──────────────────│                    │                  │
 │                │                   │                    │                  │
 │  Enter Pass    │                   │                    │                  │
 │  (if admin)    │                   │                    │                  │
 │───────────────▶│                   │                    │                  │
 │                │ POST /auth/login  │                    │                  │
 │                │──────────────────▶│                    │                  │
 │                │                   │ verify user +      │                  │
 │                │                   │ bcrypt check       │                  │
 │                │                   │───────────────────▶│                  │
 │                │                   │◀───────────────────│                  │
 │                │                   │                    │                  │
 │                │                   │ create_session()   │                  │
 │                │                   │───────────────────▶│                  │
 │                │                   │                    │                  │
 │                │                   │ create_session_    │                  │
 │                │                   │ activity()         │                  │
 │                │                   │───────────────────▶│                  │
 │                │                   │                    │                  │
 │                │                   │ parse_device_info()│                  │
 │                │                   │ lookup_ip()        │                  │
 │                │                   │────────────────────────────────────▶│
 │                │                   │◀───────────────────────────────────│
 │                │                   │                    │                  │
 │                │                   │ save_login_attempt()                  │
 │                │                   │───────────────────▶│                  │
 │                │                   │                    │                  │
 │                │                   │ emit_login_success()                  │
 │                │                   │ (async queue)      │                  │
 │                │                   │                    │                  │
 │                │  {user, token}    │                    │                  │
 │                │  + Set-Cookie     │                    │                  │
 │                │◀──────────────────│                    │                  │
 │                │                   │                    │                  │
 │                │ Store token in    │                    │                  │
 │                │ localStorage      │                    │                  │
 │                │ Show main app     │                    │                  │
 │◀───────────────│                   │                    │                  │
```

### 10.3 Audit Event Processing Sequence

```
RouteHandler       AuditEmitter        EventQueue          Processor         Database
    │                   │                  │                    │                │
    │ emit_generate()   │                  │                    │                │
    │──────────────────▶│                  │                    │                │
    │                   │ _base_event()    │                    │                │
    │                   │ build event dict │                    │                │
    │                   │                  │                    │                │
    │                   │ emit_event()     │                    │                │
    │                   │─────────────────▶│                    │                │
    │                   │   put_nowait()   │                    │                │
    │                   │                  │                    │                │
    │ (returns immediately, non-blocking)  │                    │                │
    │◀──────────────────│                  │                    │                │
    │                   │                  │                    │                │
    │                   │                  │  (background loop) │                │
    │                   │                  │  _processor_loop() │                │
    │                   │                  │───────────────────▶│                │
    │                   │                  │                    │                │
    │                   │                  │  Wait for event    │                │
    │                   │                  │  (timeout 2s)      │                │
    │                   │                  │                    │                │
    │                   │                  │  Drain up to 50    │                │
    │                   │                  │  more events       │                │
    │                   │                  │                    │                │
    │                   │                  │                    │ save_audit_    │
    │                   │                  │                    │ events_batch() │
    │                   │                  │                    │───────────────▶│
    │                   │                  │                    │                │
    │                   │                  │                    │  INSERT batch  │
    │                   │                  │                    │◀───────────────│
```

---

## 11. Cloud SQL Instances

### Production Database Configuration

| Property | Value |
|---|---|
| **Provider** | Google Cloud SQL |
| **Engine** | PostgreSQL |
| **GCP Project** | gtm-cloud-helpdesk |
| **Region** | us-central1 |
| **Connection** | Via `DATABASE_URL` environment variable (asyncpg DSN format) |
| **Driver** | asyncpg >= 0.30.0 (async PostgreSQL driver) |
| **Connection Pooling** | asyncpg connection pool (`asyncpg.create_pool()`) |

### Local Development Database

| Property | Value |
|---|---|
| **Engine** | SQLite |
| **Path** | `backend/data/local.db` |
| **Driver** | aiosqlite >= 0.20.0 (async SQLite driver) |
| **Connection** | Single persistent connection (`aiosqlite.connect()`) |
| **Row Factory** | `aiosqlite.Row` (dict-like access) |

### Database Initialization Sequence

1. Check `ENV` setting ("local" or "production")
2. **Local:** Create SQLite connection at `sqlite_path`
3. **Production:** Create asyncpg connection pool from `database_url`
4. Execute all `CREATE TABLE IF NOT EXISTS` statements (7 tables)
5. Execute all `CREATE INDEX IF NOT EXISTS` statements
6. Set row factory (SQLite only)

### Tables Created (both environments)

| Table | Purpose | Row Estimates |
|---|---|---|
| conversations | Store query/response pairs | Grows with usage |
| users | User accounts | Small (tens) |
| sessions | Active sessions | Small, cleaned on startup |
| audit_events | Complete audit trail | Grows continuously |
| login_attempts | Login history with geo/device | Grows with logins |
| session_activity | Session duration tracking | One per session |
| token_usage | Per-request LLM token tracking | One per generation |

---

## 12. GCP Config Setup

### 12.1 GCP Project Configuration

| Setting | Value |
|---|---|
| Project ID | `gtm-cloud-helpdesk` |
| Region | `us-central1` |
| Artifact Registry Repository | `email-composer-repo` |
| Artifact Registry Location | `us-central1-docker.pkg.dev/gtm-cloud-helpdesk/email-composer-repo` |

### 12.2 Cloud Run Services

| Service | Image | Port | Auth |
|---|---|---|---|
| `email-composer-backend` | `email-composer-backend:v1` | 8080 | `--allow-unauthenticated` |
| `email-composer-frontend` | `email-composer-frontend:v1` | 8080 | `--allow-unauthenticated` |

### 12.3 BigQuery Configuration

| Setting | Value |
|---|---|
| Dataset | `email_composer_vectors` |
| Table | `canned_responses` |
| Vector Column | `embedding` (ARRAY\<FLOAT64\>) |
| Distance Type | COSINE |

### 12.4 Vertex AI Configuration

| Setting | Value |
|---|---|
| Embedding Model | `text-embedding-005` |
| Location | `us-central1` |
| Max Batch Size | 250 texts per embedding call |

### 12.5 Google Generative AI (Gemini)

| Setting | Value |
|---|---|
| Model | `gemini-2.5-flash` |
| API Key | Set via `GEMINI_API_KEY` env variable |
| Thinking Budget | 2048 tokens |

### 12.6 Cloud Build Configuration

**Frontend Build (`cloudbuild.yaml`):**
```
Builder: gcr.io/cloud-builders/docker
Substitutions: _BACKEND_URL (default: https://email-composer-backend-147155498924.us-central1.run.app)
Output: us-central1-docker.pkg.dev/gtm-cloud-helpdesk/email-composer-repo/email-composer-frontend:v1
```

**Backend Build (inline via `deploy.sh`):**
```
Command: gcloud builds submit --tag <image> --project gtm-cloud-helpdesk ./backend
Output: us-central1-docker.pkg.dev/gtm-cloud-helpdesk/email-composer-repo/email-composer-backend:v1
```

### 12.7 Environment Variables

**Backend (Production):**

| Variable | Source | Description |
|---|---|---|
| `ENV` | Dockerfile | Set to "production" |
| `PORT` | Dockerfile | Set to 8080 |
| `EXCEL_DATA_PATH` | Dockerfile | `/data/Canned_Responses_Templatefull.xlsx` |
| `GEMINI_API_KEY` | .env / runtime | Google Generative AI API key |
| `DATABASE_URL` | runtime | Cloud SQL asyncpg connection string |
| `GCP_PROJECT_ID` | config default | `gtm-cloud-helpdesk` |
| `BQ_DATASET` | config default | `email_composer_vectors` |
| `BQ_TABLE` | config default | `canned_responses` |

**Frontend (Build-time):**

| Variable | Source | Description |
|---|---|---|
| `REACT_APP_API_BASE` | cloudbuild.yaml | Backend URL injected at build time |

### 12.8 Deployment Script (`deploy.sh`) Commands

| Phase | Command |
|---|---|
| Auth check | `gcloud auth print-identity-token` |
| Backend build | `gcloud builds submit --tag <image> --project gtm-cloud-helpdesk ./backend` |
| Backend deploy | `gcloud run deploy email-composer-backend --image <image> --region us-central1 --allow-unauthenticated` |
| Frontend build | `gcloud builds submit --config cloudbuild.yaml --substitutions=_BACKEND_URL=<url> ./frontend` |
| Frontend deploy | `gcloud run deploy email-composer-frontend --image <image> --region us-central1 --allow-unauthenticated` |
| URL retrieval | `gcloud run services describe <service> --format='value(status.url)'` |

---

## 13. Database Schema

### 13.1 Table: `conversations`

Stores all AI-generated query/response pairs.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique conversation identifier. Format: `conv-{uuid4}`. Generated in `save_conversation()` via `f"conv-{uuid.uuid4()}"`. |
| `query` | TEXT | NOT NULL | The customer's original query text, pasted by the associate into the QueryInput textarea. |
| `response` | TEXT | NOT NULL | The AI-generated customer-facing response from Gemini. May be subsequently edited by the associate via `update_conversation_response()`. |
| `reasoning` | TEXT | NULLABLE | The AI's internal reasoning about its approach, extracted from the `---REASONING---` delimiter section of Gemini's output. Null if Gemini did not produce a reasoning section. |
| `sources_json` | TEXT | NULLABLE | JSON-serialized array of `RetrievedSource` objects from the vector search. Each source contains: `category`, `description`, `response`, `relevance_score`. Serialized via `json.dumps()`. |
| `custom_prompt` | TEXT | NULLABLE | Optional custom instructions provided by the associate when Prompt Mode is enabled. Appended to the system prompt as "Additional instructions from the agent". Null when Prompt Mode is off. |
| `timestamp` | BIGINT | NOT NULL | Creation time in epoch milliseconds. Generated via `int(time.time() * 1000)`. Used for ordering conversations in the history sidebar (DESC). |

### 13.2 Table: `users`

Stores all user accounts for authentication and RBAC.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique user identifier. Format: `usr-{uuid4}`. Generated in `create_user()` or `seed_admin_user()`. |
| `email` | TEXT | UNIQUE, NOT NULL | User's email address. Used as the login identifier. Uniqueness enforced at DB level; application also checks via `get_user_by_email()` before creation. |
| `name` | TEXT | NULLABLE | User's display name. Shown in the sidebar user section and user management table. |
| `role` | TEXT | NOT NULL | RBAC role: either `"admin"` or `"associate"`. Determines Casbin policy group. Admin requires password; associate is passwordless. |
| `password_hash` | TEXT | NULLABLE | bcrypt-hashed password. Only set for admin role accounts. Generated via `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`. Null for associate accounts. |
| `is_active` | INTEGER | DEFAULT 1 | Boolean flag (0=inactive, 1=active). Inactive accounts are rejected at login and at middleware level. Can be toggled by admin via `update_user()`. |
| `created_at` | BIGINT | NULLABLE | Account creation time in epoch milliseconds. Set once during `create_user()`. |
| `updated_at` | BIGINT | NULLABLE | Last modification time in epoch milliseconds. Updated on every `update_user()` call. |

### 13.3 Table: `sessions`

Stores active authentication sessions.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique session identifier. Format: `sess-{uuid4}`. Generated in login route. |
| `user_id` | TEXT | NOT NULL | Foreign key to `users.id`. Links session to the authenticated user. |
| `token` | TEXT | UNIQUE | Cryptographically random session token. Generated via `secrets.token_urlsafe(32)`. Used in HTTP-only cookie and Authorization header. |
| `created_at` | BIGINT | NULLABLE | Session creation time in epoch milliseconds. |
| `expires_at` | BIGINT | NULLABLE | Session expiration time in epoch milliseconds. Calculated as `created_at + (session_ttl_hours * 3600 * 1000)`. Default TTL: 24 hours. Checked by `AuthMiddleware` on every request. |

### 13.4 Table: `audit_events`

Complete audit trail of all system actions.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique event identifier. Format: `evt-{uuid4}`. Generated in `_base_event()`. |
| `event_type` | TEXT | NOT NULL | Event category. Values: `login`, `auth_failure`, `logout`, `generate`, `history_view`, `history_edit`, `history_delete`, `history_clear`, `user_create`, `user_update`, `user_delete`, `unauthorized_access`. |
| `user_id` | TEXT | NULLABLE | ID of the user who performed the action. Null for unauthenticated events (auth_failure, unauthorized_access with no session). |
| `user_email` | TEXT | NULLABLE | Email of the acting user. Null for unauthenticated events. |
| `user_role` | TEXT | NULLABLE | Role of the acting user at the time of the event. Values: `admin` or `associate`. |
| `ip_address` | TEXT | NULLABLE | Client IP address. Extracted from `X-Forwarded-For` header (first value) for Cloud Run, or `request.client.host` for direct connections. |
| `user_agent` | TEXT | NULLABLE | Full User-Agent string from the request headers. |
| `resource_type` | TEXT | NULLABLE | Type of resource affected. Values: `session` (login/logout), `conversation` (generate/history), `user` (user management). |
| `resource_id` | TEXT | NULLABLE | ID of the affected resource (session ID, conversation ID, or user ID). |
| `metadata_json` | TEXT | NULLABLE | JSON-serialized context-specific metadata. Examples: `{"tokens": {...}}` for generate events, `{"reason": "invalid_password"}` for auth failures, `{"deleted_count": 5}` for history clear. |
| `timestamp` | BIGINT | NOT NULL | Event time in epoch milliseconds. |

**Indexes:** `idx_audit_user_id`, `idx_audit_event_type`, `idx_audit_timestamp`

### 13.5 Table: `login_attempts`

Detailed record of every login attempt with device and geographic information.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique attempt identifier. Format: `la-{uuid4}`. Generated in `_record_login_attempt()`. |
| `user_id` | TEXT | NULLABLE | ID of the user attempted. Null if user not found by email. |
| `user_email` | TEXT | NOT NULL | Email address used in the login attempt. Always present. |
| `success` | INTEGER | NULLABLE | Boolean (0=failed, 1=success). Indicates whether login was successful. |
| `ip_address` | TEXT | NULLABLE | Client IP address, extracted from X-Forwarded-For or request.client. |
| `country` | TEXT | NULLABLE | Country from IP geolocation lookup via ip-api.com. "Local" for private IPs. "Unknown" on lookup failure. |
| `city` | TEXT | NULLABLE | City from IP geolocation lookup. "Local" for private IPs. "Unknown" on lookup failure. |
| `browser` | TEXT | NULLABLE | Browser name and version parsed from User-Agent via `user_agents` library. e.g., "Chrome 129". |
| `os` | TEXT | NULLABLE | Operating system parsed from User-Agent. e.g., "Windows 11", "macOS 14". |
| `device_type` | TEXT | NULLABLE | Device category parsed from User-Agent. Values: `desktop`, `mobile`, `tablet`. |
| `screen_resolution` | TEXT | NULLABLE | Screen dimensions from `X-Device-Info` JSON header. e.g., "1920x1080". |
| `timezone` | TEXT | NULLABLE | Timezone from `X-Device-Info` JSON header. e.g., "America/Chicago". |
| `session_id` | TEXT | NULLABLE | Session ID if login was successful. Null for failed attempts. |
| `failure_reason` | TEXT | NULLABLE | Reason for failure if unsuccessful. Values: `user_not_found`, `account_disabled`, `password_required`, `invalid_password`. |
| `timestamp` | BIGINT | NULLABLE | Attempt time in epoch milliseconds. |

**Indexes:** `idx_la_email`, `idx_la_ip`, `idx_la_timestamp`

### 13.6 Table: `session_activity`

Tracks active/idle time and engagement metrics for each session.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique activity record identifier. Format: `sa-{uuid4}`. Generated in `create_session_activity()`. |
| `session_id` | TEXT | NOT NULL | Foreign key to `sessions.id`. One activity record per session. |
| `user_id` | TEXT | NOT NULL | Foreign key to `users.id`. Redundant with session for query convenience. |
| `started_at` | BIGINT | NULLABLE | Session start time in epoch milliseconds. Set at creation. |
| `ended_at` | BIGINT | NULLABLE | Session end time in epoch milliseconds. Set by `end_session_activity()` on logout. Null while session is active. |
| `last_activity_at` | BIGINT | NULLABLE | Timestamp of the most recent heartbeat. Updated every 30 seconds by `update_session_heartbeat()`. |
| `active_duration_ms` | BIGINT | NULLABLE | Accumulated active time in milliseconds. Incremented by 30,000ms (heartbeat interval) when heartbeat reports `active=true`. |
| `idle_duration_ms` | BIGINT | NULLABLE | Accumulated idle time in milliseconds. Incremented by 30,000ms when heartbeat reports `active=false` (user idle >60s). |
| `page_views` | INTEGER | NULLABLE | Page view count. Incremented by heartbeat. |
| `actions_count` | INTEGER | NULLABLE | User action count. Incremented by 1 on every heartbeat where `active=true`. |

**Indexes:** `idx_sa_user_id`, `idx_sa_session_id`

### 13.7 Table: `token_usage`

Tracks LLM token consumption per generation request.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Unique record identifier. Format: `tu-{uuid4}`. Generated in generate route. |
| `user_id` | TEXT | NOT NULL | Foreign key to `users.id`. The user who triggered the generation. |
| `user_email` | TEXT | NULLABLE | User email for convenience in analytics queries (avoids JOIN). |
| `conversation_id` | TEXT | NULLABLE | Foreign key to `conversations.id`. Links token usage to the specific conversation. |
| `model` | TEXT | NULLABLE | LLM model used. Value: `gemini-2.5-flash` (from config). |
| `prompt_tokens` | INTEGER | NULLABLE | Number of input tokens sent to the model (system prompt + RAG context + query). |
| `completion_tokens` | INTEGER | NULLABLE | Number of output tokens generated by the model (response + reasoning). |
| `total_tokens` | INTEGER | NULLABLE | Total tokens (prompt + completion). |
| `thinking_tokens` | INTEGER | NULLABLE | Tokens used by Gemini's extended thinking feature (up to 2048 budget). |
| `latency_ms` | INTEGER | NULLABLE | End-to-end LLM call latency in milliseconds. Measured via `time.time()` before and after the `generate()` call. |
| `timestamp` | BIGINT | NULLABLE | Record creation time in epoch milliseconds. |

**Indexes:** `idx_tu_user_id`, `idx_tu_timestamp`

---

## 14. Project Information

### 14.1 Repository Structure

| Directory | Purpose | Key Files |
|---|---|---|
| `/` (root) | Project root | `CONTEXT.md`, `DOCUMENT.md`, `deploy.sh`, `.gitignore`, Excel/PDF data files |
| `/backend` | Python FastAPI application | `main.py`, `pyproject.toml`, `Dockerfile`, `.env`, `uv.lock` |
| `/backend/app` | Application modules | `config.py`, `database.py`, `models.py`, `llm.py`, `rag.py`, `prompts.py`, `chroma.py`, `vector_store.py` |
| `/backend/app/auth` | Authentication & authorization | `middleware.py`, `enforcer.py`, `casbin_model.conf`, `casbin_policy.csv` |
| `/backend/app/audit` | Audit logging & security | `emitter.py`, `event_queue.py`, `security.py`, `device.py`, `geo.py` |
| `/backend/app/routes` | API route handlers | `health.py`, `auth.py`, `generate.py`, `history.py`, `users.py`, `analytics.py` |
| `/backend/data` | Local runtime data | `local.db` (SQLite), `chroma_data/` (ChromaDB) |
| `/frontend` | React TypeScript application | `package.json`, `Dockerfile`, `nginx.conf`, `cloudbuild.yaml`, `tsconfig.json` |
| `/frontend/src` | Source code | `App.tsx`, `index.tsx` |
| `/frontend/src/types` | TypeScript interfaces | `index.ts` |
| `/frontend/src/services` | API client layer | `api.ts` |
| `/frontend/src/context` | State management | `AppContext.tsx`, `AuthContext.tsx`, `ThemeContext.tsx`, `IntroContext.tsx` |
| `/frontend/src/hooks` | Custom React hooks | `useHeartbeat.ts` |
| `/frontend/src/styles` | Design tokens & global styles | `tokens.css`, `global.css` |
| `/frontend/src/components` | UI components | 15+ component directories with `.tsx` + `.css` pairs |

### 14.2 Dependencies

**Backend (19 packages):**

| Package | Version | Purpose |
|---|---|---|
| fastapi | >= 0.135.1 | Web framework |
| uvicorn[standard] | >= 0.42.0 | ASGI server |
| google-genai | >= 1.0.0 | Gemini LLM client |
| google-cloud-bigquery | >= 3.25.0 | BigQuery client |
| google-cloud-aiplatform | >= 1.60.0 | Vertex AI embeddings |
| chromadb | >= 0.5.0 | Local vector database |
| openpyxl | >= 3.1.0 | Excel file parsing |
| pydantic-settings | >= 2.0.0 | Configuration management |
| python-dotenv | >= 1.0.0 | .env file loading |
| asyncpg | >= 0.30.0 | Async PostgreSQL driver |
| aiosqlite | >= 0.20.0 | Async SQLite driver |
| casbin | >= 1.36.0 | RBAC authorization |
| bcrypt | >= 4.0.0 | Password hashing |
| httpx | >= 0.28.0 | Async HTTP client |
| user-agents | >= 2.2.0 | User-Agent parsing |

**Frontend (6 packages):**

| Package | Version | Purpose |
|---|---|---|
| react | 19.2.4 | UI framework |
| react-dom | 19.2.4 | DOM rendering |
| framer-motion | 12.38.0 | Animation library |
| recharts | 3.8.1 | Chart components |
| typescript | 4.9.5 | Type safety |
| yaml | 2.8.2 | YAML parsing utility |

### 14.3 Versioning

| Artifact | Version | Tag |
|---|---|---|
| Backend | 0.1.0 | v1 (Docker) |
| Frontend | 0.1.0 | v1 (Docker) |
| Python | 3.12 | - |
| Node | 20 | Alpine (Docker) |

---

## 15. Scalability

### 15.1 Horizontal Scaling

| Component | Scaling Strategy |
|---|---|
| **Frontend** | Cloud Run auto-scales Nginx containers based on request volume; stateless serving |
| **Backend** | Cloud Run auto-scales FastAPI containers; stateless design (no in-process state beyond config) |
| **Database** | Cloud SQL supports connection pooling via asyncpg; read replicas can be added |
| **Vector Search** | BigQuery is fully managed and auto-scales; no shard management |
| **LLM** | Gemini API handles scaling transparently; rate limits apply per API key |

### 15.2 Scale-to-Zero

Cloud Run supports scale-to-zero, meaning both frontend and backend services can reduce to 0 instances when there's no traffic, reducing costs during off-hours.

### 15.3 Bottleneck Analysis

| Component | Bottleneck | Mitigation |
|---|---|---|
| LLM Generation | 2-8 second latency per request | Extended thinking capped at 2048 tokens; model chosen for speed (Flash) |
| Vector Search (Prod) | Embedding + BigQuery query latency | Batch embedding (up to 250 texts); BigQuery optimized for vector operations |
| Audit Writes | Frequent database writes | Async event queue with batch processing (50 events or 2s interval) |
| Geo Lookup | External API dependency | 24-hour in-memory cache; private IP short-circuit |
| Session Validation | Per-request DB lookup | asyncpg connection pool; consider Redis caching for high-volume |

### 15.4 Data Growth Considerations

| Table | Growth Rate | Retention |
|---|---|---|
| conversations | Per generation request | No automatic cleanup |
| audit_events | Per user action | No automatic cleanup |
| login_attempts | Per login attempt | No automatic cleanup |
| token_usage | Per generation request | No automatic cleanup |
| session_activity | Per session | No automatic cleanup |

**Note:** No data retention or archival policies are currently implemented. For production scale, consider implementing TTL-based cleanup or data archival to cold storage.

---

## 16. Logging / Monitoring

### 16.1 Application Logging

| Component | Logger | Level | Details |
|---|---|---|---|
| `main.py` | Root logger | INFO | Application startup/shutdown events |
| `database.py` | `__name__` | INFO | Database initialization, table creation |
| `llm.py` | `__name__` | INFO | Gemini client initialization, generation calls |
| `chroma.py` | `__name__` | INFO | ChromaDB initialization, data ingestion counts |
| `vector_store.py` | `__name__` | INFO | BigQuery initialization, row counts |
| `event_queue.py` | `__name__` | INFO/WARNING | Processor start/stop, batch processing, queue full warnings |
| `geo.py` | `__name__` | WARNING | Geolocation lookup failures |
| `device.py` | `__name__` | WARNING | Device info parsing failures |

### 16.2 Audit Trail (Application-Level Monitoring)

The audit system captures all significant user actions:

| Event Type | Trigger | Metadata Captured |
|---|---|---|
| `login` | Successful authentication | Session ID |
| `auth_failure` | Failed login attempt | Failure reason (user_not_found, invalid_password, etc.) |
| `logout` | User logs out | - |
| `generate` | AI response generated | Token usage (prompt, completion, thinking tokens) |
| `history_view` | User views conversation history | - |
| `history_edit` | User edits a response | Conversation ID |
| `history_delete` | User deletes a conversation | Conversation ID |
| `history_clear` | User clears all history | Deleted count |
| `user_create` | Admin creates a user | Target user ID |
| `user_update` | Admin updates a user | Target user ID |
| `user_delete` | Admin deletes a user | Target user ID |
| `unauthorized_access` | Permission denied | Path, method, reason |

### 16.3 Security Monitoring (Automated Detection)

| Alert Type | Severity | Detection Logic | Threshold |
|---|---|---|---|
| `multi_ip_login` | HIGH | Same user logging in from multiple IPs within time window | 2+ IPs in 1 hour |
| `repeated_auth_failure` | HIGH | Multiple failed login attempts for same email | 5+ failures in 1 hour |
| `rapid_requests` | MEDIUM | Excessive request volume from a single user | 50+ requests in 5 minutes |
| `off_hours_access` | LOW | Access outside configured working hours (UTC) | Outside 9:00-18:00 UTC |

### 16.4 Session Monitoring

| Metric | Source | Update Frequency |
|---|---|---|
| Active duration | Heartbeat (active=true) | Every 30 seconds |
| Idle duration | Heartbeat (active=false) | Every 30 seconds |
| Actions count | Heartbeat increment | Every 30 seconds |
| Last activity | Heartbeat timestamp | Every 30 seconds |
| Session start/end | Login/logout events | On auth events |

### 16.5 Token Usage Monitoring

| Metric | Granularity | Aggregation |
|---|---|---|
| Prompt tokens | Per request | By day, by hour, by user |
| Completion tokens | Per request | By day, by hour, by user |
| Thinking tokens | Per request | By day, by hour, by user |
| Total tokens | Per request | By day, by hour, by user |
| Latency (ms) | Per request | Stored per record |
| Request count | Per request | By day, by hour, by user |

### 16.6 Infrastructure Monitoring

| Layer | Monitoring Source |
|---|---|
| Cloud Run | GCP Cloud Run metrics (request count, latency, memory, CPU) |
| Cloud SQL | GCP Cloud SQL metrics (connections, queries, storage) |
| BigQuery | GCP BigQuery metrics (query count, bytes processed) |
| Nginx | Access logs (via Cloud Run container logs) |
| Health Checks | `GET /api/health` (backend), `GET /health` (frontend nginx) |

---

## 17. Build vs Reuse

| Component | Decision | Rationale |
|---|---|---|
| **Web Framework** | Reuse (FastAPI) | Industry-standard async Python framework; built-in OpenAPI, Pydantic validation |
| **LLM Client** | Reuse (google-genai SDK) | Official Google SDK for Gemini; handles auth, retries, token counting |
| **Vector Store** | Reuse (ChromaDB / BigQuery) | Proven vector search implementations; ChromaDB for zero-config local dev |
| **Embeddings** | Reuse (Vertex AI) | Managed embedding service; native GCP integration |
| **RBAC** | Reuse (Casbin) | Extensible RBAC framework; file-based policies; path matching |
| **Password Hashing** | Reuse (bcrypt) | Industry standard; adaptive work factor |
| **Animations** | Reuse (Framer Motion) | Declarative animation library; spring physics; AnimatePresence |
| **Charts** | Reuse (Recharts) | React-native charting; responsive; declarative |
| **Auth Middleware** | Build (custom) | Custom session-based auth with cookie + header support; integrated with Casbin |
| **Audit System** | Build (custom) | Custom async event queue with batch processing; domain-specific event types |
| **Security Detection** | Build (custom) | Custom SQL-based anomaly queries; domain-specific alert types and thresholds |
| **Device Fingerprinting** | Build + Reuse | Custom header parsing; reuses `user-agents` library for UA parsing |
| **Geo Lookup** | Build (custom) | Custom caching layer over ip-api.com; private IP handling |
| **RAG Pipeline** | Build (custom) | Custom context formatting; delimiter-based output parsing |
| **State Management** | Build (custom) | useReducer + Context; no external state library needed |
| **Design System** | Build (custom) | Custom CSS tokens for full theme control; no CSS framework |
| **Deployment Script** | Build (custom) | Custom deploy.sh with progress UI, preflight checks, selective deployment |
| **Database Layer** | Build (custom) | Raw SQL with dual-database abstraction; custom analytics queries |
| **API Client** | Build (custom) | Custom Fetch wrapper with auth headers, device info, heartbeat |

---

## 18. Detailed Technical Design

### 18.1 Application Initialization

#### `lifespan(app: FastAPI)` — `backend/main.py`
The application startup/shutdown lifecycle manager.

**Startup Sequence:**
1. `init_db()` — Create database connection and all 7 tables with indexes
2. `init_enforcer()` — Load Casbin RBAC model and policy files
3. `seed_admin_user(email, password, name)` — Create default admin if not exists
4. `delete_expired_sessions()` — Clean up stale sessions
5. `init_chroma()` or `init_vector_store()` — Initialize vector store based on ENV
6. `init_client()` — Initialize Gemini LLM client
7. `start_event_processor()` — Start async audit event processor

**Shutdown Sequence:**
1. `stop_event_processor()` — Flush remaining events, cancel background task
2. `close_client()` — Close httpx geo client
3. `close_db()` — Close database connection/pool

#### `Settings` class — `backend/app/config.py`

| Property | Type | Default | Description |
|---|---|---|---|
| `env` | str | `"local"` | Environment mode |
| `gemini_api_key` | str | `""` | Gemini API key |
| `gemini_model` | str | `"gemini-2.5-flash"` | LLM model name |
| `excel_data_path` | str | (computed) | Path to Excel knowledge base |
| `database_url` | str | `""` | Production DB connection string |
| `sqlite_path` | str | (computed) | Local SQLite file path |
| `chroma_persist_dir` | str | (computed) | ChromaDB persistence directory |
| `gcp_project_id` | str | `"gtm-cloud-helpdesk"` | GCP project ID |
| `bq_dataset` | str | `"email_composer_vectors"` | BigQuery dataset |
| `bq_table` | str | `"canned_responses"` | BigQuery table |
| `embedding_model` | str | `"text-embedding-005"` | Vertex AI model |
| `embedding_location` | str | `"us-central1"` | Vertex AI region |
| `allowed_origins` | str | `"*"` | CORS origins |
| `session_ttl_hours` | int | `24` | Session lifetime |
| `seed_admin_email` | str | `"admin@resolve.ai"` | Default admin email |
| `seed_admin_password` | str | `"admin123"` | Default admin password |
| `seed_admin_name` | str | `"System Admin"` | Default admin name |
| `event_queue_batch_size` | int | `50` | Audit batch size |
| `event_queue_flush_interval_s` | float | `2.0` | Audit flush interval |
| `security_working_hours_start` | int | `9` | Off-hours start |
| `security_working_hours_end` | int | `18` | Off-hours end |
| `security_rapid_request_threshold` | int | `50` | Rapid request alert threshold |
| `security_failed_login_threshold` | int | `5` | Failed login alert threshold |

**Method:** `is_local` (property) — Returns `True` if `env == "local"`
**Function:** `get_settings()` — LRU-cached singleton

---

### 18.2 Authentication System

#### Session Token Generation — `backend/app/routes/auth.py`

**`POST /api/auth/check-email`**
- **Function:** Validates email exists in database
- **Input:** `LoginCheckEmailRequest { email }`
- **Steps:**
  1. `get_user_by_email(email)` — DB lookup
  2. Check user exists → 404 if not
  3. Check `is_active` → 403 if disabled
  4. Return `{ email, requires_password: role=="admin", user_name }`

**`POST /api/auth/login`**
- **Function:** Authenticates user and creates session
- **Input:** `LoginRequest { email, password? }`
- **Steps:**
  1. `get_user_by_email(email)` → 401 if not found
  2. Check `is_active` → 401 if disabled (emit `auth_failure`)
  3. If admin: check password provided → 400 if missing
  4. If admin: `bcrypt.checkpw()` → 401 if mismatch (emit `auth_failure`)
  5. Generate `session_id = f"sess-{uuid.uuid4()}"`
  6. Generate `token = secrets.token_urlsafe(32)`
  7. Calculate `expires_at = now + session_ttl_hours * 3600 * 1000`
  8. `create_session(session_id, user_id, token, created_at, expires_at)`
  9. `create_session_activity(session_id, user_id)`
  10. `_record_login_attempt(request, user, success=True, session_id)`
  11. `emit_login_success(user, request, session_id)`
  12. Set `session_token` cookie (httponly, secure, samesite=lax, max_age=ttl)
  13. Return `{ user: UserResponse, token }`

**`GET /api/auth/me`**
- **Function:** Returns authenticated user info
- **Returns:** `UserResponse` from `request.state.user`

**`POST /api/auth/logout`**
- **Function:** Ends session
- **Steps:**
  1. `end_session_activity(session_id)`
  2. `delete_session(token)`
  3. `emit_logout(user, request)`
  4. Delete `session_token` cookie
  5. Return `{ logged_out: True }`

#### `_record_login_attempt()` — `backend/app/routes/auth.py`
- **Function:** Records login attempt with full device and geo context
- **Steps:**
  1. Extract IP from `X-Forwarded-For` or `request.client.host`
  2. Extract User-Agent from headers
  3. `parse_device_info(user_agent, device_info_header)` → browser, OS, device_type, screen, timezone
  4. `lookup_ip(ip)` → country, city (cached, async)
  5. Build attempt dict with all fields
  6. `save_login_attempt(attempt)`

#### Auth Middleware — `backend/app/auth/middleware.py`

**Class:** `AuthMiddleware(BaseHTTPMiddleware)`

**`dispatch(request, call_next)`**
- **Function:** Validates auth and RBAC on every request
- **Steps:**
  1. Check if path is in `PUBLIC_PATHS` set → pass through
  2. Check if method is OPTIONS → pass through (CORS preflight)
  3. Extract token from `session_token` cookie OR `Authorization: Bearer <token>` header
  4. No token → 401 `{ "detail": "Not authenticated" }`
  5. `get_session_by_token(token)` → 401 if not found
  6. Check `expires_at > now` → 401 if expired
  7. `get_user_by_id(session.user_id)` → 401 if not found
  8. Check `user.is_active` → 401 if disabled
  9. `get_enforcer().enforce(user.role, path, method)` → 403 if denied
  10. Set `request.state.user = user`
  11. Set `request.state.session = session`
  12. Call `call_next(request)`

**`_emit_unauthorized(request, path, reason)`** (static)
- Fire-and-forget audit event; catches all exceptions

**PUBLIC_PATHS:** `{"/api/health", "/api/auth/check-email", "/api/auth/login"}`

#### Casbin RBAC Enforcer — `backend/app/auth/enforcer.py`

**`init_enforcer()`** — Loads `casbin_model.conf` and `casbin_policy.csv`
**`get_enforcer()`** — Returns cached enforcer or initializes

**Model** (`casbin_model.conf`):
- Request: `sub` (role), `obj` (path), `act` (HTTP method)
- Matcher: `g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && r.act == p.act`
- Effect: Allow if any matching policy

**Policies** (`casbin_policy.csv`):
- 9 associate permissions (generate, history, auth, heartbeat)
- 17 admin permissions (all associate + users + analytics)

---

### 18.3 AI Response Generation

#### Vector Search (Local) — `backend/app/chroma.py`

**`init_chroma()`**
- Creates `PersistentClient(path=chroma_persist_dir)`
- Gets/creates collection `"canned_responses"` with cosine distance
- If empty: calls `_ingest_excel()`

**`_ingest_excel(excel_path)`**
- `load_workbook(excel_path, read_only=True)`
- Iterate rows starting at row 2
- Extract columns: category (0), description (1), response (2)
- Create document: `"Category: {cat}\nDescription: {desc}\nResponse: {resp}"`
- `collection.add(documents, metadatas, ids=["canned-{i}"])`

**`search_canned_responses(query, n_results=3)`**
- `collection.query(query_texts=[query], n_results=n_results)`
- Convert distances to relevance: `1.0 - distance`
- Return `[{ category, description, response, relevance_score }]`

#### Vector Search (Production) — `backend/app/vector_store.py`

**`init_vector_store()`**
- Initialize `bigquery.Client(project=gcp_project_id)`
- Initialize `TextEmbeddingModel.from_pretrained(embedding_model)`
- Initialize `vertexai.init(project, location)`
- Check table row count; ingest Excel if empty

**`_get_embeddings(texts)`**
- Batch texts in groups of 250
- Call `_embed_model.get_embeddings(batch)`
- Return flattened list of embedding vectors

**`_ingest_excel(excel_path)`**
- Same Excel parsing as ChromaDB version
- Generate embeddings for all documents
- Insert rows into BigQuery with embedding column

**`search_canned_responses(query, n_results=3)`**
- Embed query: `_get_embeddings([query])[0]`
- Execute BigQuery `VECTOR_SEARCH` SQL with cosine distance
- Calculate relevance: `1.0 - distance`
- Return matching sources

#### RAG Context Building — `backend/app/rag.py`

**`build_rag_context(sources)`**
- If no sources: return `"No reference responses found."`
- Format each source as numbered reference block:
  ```
  --- Reference {i} (Relevance: {score:.2f}) ---
  Category: {category}
  Description: {description}
  Response: {response}
  ```

#### Prompt Construction — `backend/app/prompts.py`

**`SYSTEM_PROMPT`** (constant) — Instructs model to be warm, professional, empathetic customer support assistant. Specifies delimiter output format.

**`build_prompt(custom_prompt=None)`**
- Returns `SYSTEM_PROMPT` + optional `"\n\nAdditional instructions from the agent:\n{custom_prompt}"`

#### LLM Generation — `backend/app/llm.py`

**`init_client()`** — Creates `genai.Client(api_key=key)`

**`_parse_delimited(text)`**
- Splits on `---RESPONSE---` and `---REASONING---`
- Returns `(response_part, reasoning_part)`

**`_generate_sync(system_prompt, context, query)`**
- Builds user message: `"{context}\n\nCustomer Query:\n{query}"`
- Config: `GenerateContentConfig(thinking_config=ThinkingConfig(thinking_budget=2048))`
- Call `_client.models.generate_content(model, contents, config)`
- Separate thinking parts from response parts
- Parse delimiters on concatenated response parts
- Extract token usage: `prompt_tokens`, `completion_tokens`, `total_tokens`, `thinking_tokens`
- Return `(response, reasoning, usage_dict)`

**`generate(system_prompt, context, query)`** (async)
- Runs `_generate_sync` in thread executor via `asyncio.get_event_loop().run_in_executor()`

#### Generate Route — `backend/app/routes/generate.py`

**`_search(query, n_results=3)`**
- Dynamically imports `search_canned_responses` from `chroma` or `vector_store` based on `settings.is_local`

**`POST /api/generate`**
- **Steps:**
  1. `_search(query, 3)` — Retrieve relevant canned responses
  2. `build_rag_context(sources)` — Format sources into context
  3. `build_prompt(customPrompt)` — Build system prompt
  4. Record `start_time`
  5. `await generate(prompt, context, query)` — Call Gemini
  6. Calculate `latency_ms`
  7. `save_conversation(query, response, reasoning, sources, customPrompt)` — Persist
  8. `save_token_usage(usage_record)` — Record token consumption
  9. `emit_generate(user, request, conv_id, token_data)` — Audit (async)
  10. Return `GenerateResponse`

---

### 18.4 Conversation History Management

#### History Routes — `backend/app/routes/history.py`

**`GET /api/history`**
- `get_all_conversations()` — Fetch all, ordered by timestamp DESC
- `emit_history_view(user, request)` — Audit
- Return list of `ConversationResponse`

**`PATCH /api/history/{conv_id}`**
- `update_conversation_response(conv_id, response)` — Update text
- 404 if not found
- `emit_history_edit(user, request, conv_id)` — Audit

**`DELETE /api/history/{conv_id}`**
- `delete_conversation(conv_id)` — Remove single
- 404 if not found
- `emit_history_delete(user, request, conv_id)` — Audit

**`DELETE /api/history`**
- `delete_all_conversations()` — Remove all
- `emit_history_clear(user, request, count)` — Audit with deleted count

---

### 18.5 User Management

#### User Routes — `backend/app/routes/users.py`

**`GET /api/users`** — List all users via `get_all_users()`

**`POST /api/users`** (status 201)
- Validate email not already registered → 409
- Validate password for admin role → 400
- Hash password: `bcrypt.hashpw(password.encode(), bcrypt.gensalt())`
- Generate ID: `f"usr-{uuid.uuid4()}"`
- `create_user(id, email, name, role, password_hash)`
- `emit_user_create(admin, request, target_user_id)`

**`GET /api/users/{user_id}`** — Fetch by ID → 404 if not found

**`PATCH /api/users/{user_id}`**
- Selective update (name, role, password, is_active)
- If password provided: `bcrypt.hashpw()`
- `update_user(user_id, **fields)`
- `emit_user_update(admin, request, target_user_id)`

**`DELETE /api/users/{user_id}`**
- `delete_user_sessions(user_id)` — Remove all sessions first
- `delete_user(user_id)` — Remove user
- `emit_user_delete(admin, request, target_user_id)`

---

### 18.6 Analytics System

#### Analytics Routes — `backend/app/routes/analytics.py`

**`GET /api/analytics/overview`** — `get_overview_stats()` → total_users, active_users_24h, active_sessions, total_queries, total_tokens, queries_today, tokens_today

**`GET /api/analytics/daily-activity?days=30`** — `get_daily_activity(days)` → date, logins, queries, tokens per day

**`GET /api/analytics/audit-log?page=1&limit=25&event_type=&user_id=&from_ts=&to_ts=`** — `get_audit_events(...)` → paginated audit log

**`GET /api/analytics/login-attempts?page=1&limit=25&success=&from_ts=&to_ts=`** — `get_login_attempts(...)` → paginated login history

**`GET /api/analytics/sessions`** — `get_session_activities()` → last 7 days of session activity with user email

**`GET /api/analytics/user-activity?user_id=`** — `get_user_activity(user_id)` → total_queries, total_tokens, total_active_ms, total_logins, last_active_at

**`GET /api/analytics/token-usage?from_ts=&to_ts=&group_by=day`** — `get_token_usage_over_time(...)` → prompt/completion/total tokens by time period

**`GET /api/analytics/token-by-user`** — `get_token_usage_by_user()` → per-user token stats with averages

**`GET /api/analytics/security-alerts`** — `get_all_alerts()` → all security alerts sorted by severity

**`GET /api/analytics/usage-heatmap`** — `get_usage_heatmap()` → hourly usage pattern (day_of_week × hour)

**`POST /api/analytics/heartbeat`** — `update_session_heartbeat(session_id, active)` → updates active/idle duration

---

### 18.7 Audit Event System

#### Event Emission — `backend/app/audit/emitter.py`

**Helper Functions:**
- `_extract_ip(request)` — Gets IP from X-Forwarded-For or request.client
- `_base_event(event_type, request, user)` — Builds common event dict (id, type, user, IP, UA, timestamp)

**Emit Functions (12 total):**

| Function | Event Type | Resource Type | Metadata |
|---|---|---|---|
| `emit_login_success(user, request, session_id)` | `login` | `session` | - |
| `emit_login_failure(email, request, reason)` | `auth_failure` | - | `{ reason }` |
| `emit_logout(user, request)` | `logout` | - | - |
| `emit_generate(user, request, conv_id, token_data)` | `generate` | `conversation` | `{ tokens: {...} }` |
| `emit_history_view(user, request)` | `history_view` | - | - |
| `emit_history_edit(user, request, conv_id)` | `history_edit` | `conversation` | - |
| `emit_history_delete(user, request, conv_id)` | `history_delete` | `conversation` | - |
| `emit_history_clear(user, request, count)` | `history_clear` | - | `{ deleted_count }` |
| `emit_user_create(admin, request, target_id)` | `user_create` | `user` | - |
| `emit_user_update(admin, request, target_id)` | `user_update` | `user` | - |
| `emit_user_delete(admin, request, target_id)` | `user_delete` | `user` | - |
| `emit_unauthorized_access(request, path, reason)` | `unauthorized_access` | - | `{ path, method, reason }` |

#### Async Event Queue — `backend/app/audit/event_queue.py`

**Constants:** `BATCH_SIZE = 50`, `FLUSH_INTERVAL_S = 2.0`

**Functions:**
- `_get_queue()` — Lazy-initializes `asyncio.Queue`
- `emit_event(event)` — Non-blocking `put_nowait()` onto queue
- `_process_batch(events)` — Calls `save_audit_events_batch(events)` with exception handling
- `_processor_loop()` — Background loop: wait for event (timeout 2s) → drain up to 50 → process batch → repeat
- `start_event_processor()` — Creates background `asyncio.Task`
- `stop_event_processor()` — Sets `_running = False`, cancels task, awaits completion

#### Security Detection — `backend/app/audit/security.py`

**Detection Functions (4 total):**

| Function | Alert Type | Severity | Query |
|---|---|---|---|
| `detect_multi_ip_logins(hours=1)` | `multi_ip_login` | HIGH | Users with 2+ distinct IPs in login_attempts within window |
| `detect_rapid_requests(minutes=5, threshold=50)` | `rapid_requests` | MEDIUM | Users with >threshold audit events within window |
| `detect_off_hours_access(start=9, end=18)` | `off_hours_access` | LOW | Audit events with hour outside working hours range |
| `detect_repeated_failures(hours=1, threshold=5)` | `repeated_auth_failure` | HIGH | Emails with >threshold failed login_attempts within window |

**`get_all_alerts()`** — Runs all 4 detectors, builds alert dicts, sorts by severity (HIGH → MEDIUM → LOW)

#### Device Parsing — `backend/app/audit/device.py`

**`parse_device_info(user_agent, device_info_header=None)`**
- Parse UA with `user_agents.parse()` → browser, OS, device_type
- Parse optional JSON header → screen_resolution, timezone
- Returns dict with 5 fields

#### IP Geolocation — `backend/app/audit/geo.py`

**`lookup_ip(ip)`** (async)
- Private IP check → return `{ country: "Local", city: "Local" }`
- Cache check (TTL: 24h) → return cached if valid
- Call `ip-api.com/json/{ip}` → parse response
- Cache result → return `{ country, city }`

**`_is_private_ip(ip)`** — Checks 127.*, 10.*, 192.168.*, 172.16.*, ::1, localhost
**`close_client()`** — Closes httpx.AsyncClient

---

### 18.8 Database Operations

#### Database Abstraction — `backend/app/database.py`

All functions support both SQLite and PostgreSQL via conditional logic on `_is_local` flag. PostgreSQL uses `$1, $2` placeholders; SQLite uses `?, ?`.

**Initialization:**
- `init_db()` — Creates connection/pool, executes all CREATE TABLE and CREATE INDEX statements
- `close_db()` — Closes connection/pool
- `seed_admin_user(email, password, name)` — Creates default admin with bcrypt hash

**Conversation CRUD (5 functions):**
- `save_conversation(query, response, reasoning, sources, custom_prompt)` → dict
- `get_all_conversations()` → list[dict]
- `update_conversation_response(conv_id, response)` → bool
- `delete_conversation(conv_id)` → bool
- `delete_all_conversations()` → int

**User CRUD (6 functions):**
- `create_user(user_id, email, name, role, password_hash)` → dict
- `get_user_by_email(email)` → dict | None
- `get_user_by_id(user_id)` → dict | None
- `get_all_users()` → list[dict]
- `update_user(user_id, name?, role?, password_hash?, is_active?)` → bool
- `delete_user(user_id)` → bool

**Session CRUD (5 functions):**
- `create_session(session_id, user_id, token, created_at, expires_at)` → dict
- `get_session_by_token(token)` → dict | None
- `delete_session(token)` → bool
- `delete_user_sessions(user_id)` → int
- `delete_expired_sessions()` → int

**Audit (2 functions):**
- `save_audit_events_batch(events)` → None
- `get_audit_events(event_type?, user_id?, from_ts?, to_ts?, page, limit)` → (list, total)

**Login Attempts (2 functions):**
- `save_login_attempt(attempt)` → None
- `get_login_attempts(success?, from_ts?, to_ts?, page, limit)` → (list, total)

**Session Activity (4 functions):**
- `create_session_activity(session_id, user_id)` → None
- `update_session_heartbeat(session_id, active)` → None
- `end_session_activity(session_id)` → None
- `get_session_activities()` → list[dict]

**Token Usage (1 function):**
- `save_token_usage(usage)` → None

**Analytics Queries (6 functions):**
- `get_overview_stats()` → dict (7 metrics)
- `get_daily_activity(days=30)` → list[dict]
- `get_token_usage_over_time(from_ts?, to_ts?, group_by)` → list[dict]
- `get_token_usage_by_user()` → list[dict]
- `get_usage_heatmap()` → list[dict]
- `get_user_activity(user_id)` → dict

**Security Queries (4 functions):**
- `query_multi_ip_logins(hours=1)` → list[dict]
- `query_rapid_requests(minutes=5, threshold=50)` → list[dict]
- `query_off_hours_access(start=9, end=18)` → list[dict]
- `query_repeated_failures(hours=1, threshold=5)` → list[dict]

**Helper:**
- `_row_to_user(row)` → dict (converts DB row to user dict)

---

### 18.9 Frontend State Management

#### App State — `frontend/src/context/AppContext.tsx`

**State Shape (`AppState`):**

| Field | Type | Default | Description |
|---|---|---|---|
| `query` | string | `""` | Current query input text |
| `response` | string | `""` | Current AI-generated response |
| `editedResponse` | string | `""` | User-modified response text |
| `customPrompt` | string | `""` | Custom prompt instructions |
| `promptModeEnabled` | boolean | `false` | Whether prompt mode is active |
| `isLoading` | boolean | `false` | Whether generation is in progress |
| `reasoning` | string \| null | `null` | AI reasoning text |
| `sources` | RetrievedSource[] | `[]` | Retrieved knowledge base sources |
| `history` | Conversation[] | `[]` | Conversation history list |
| `selectedConversationId` | string \| null | `null` | Currently selected conversation |
| `view` | string | `"generate"` | Active view (generate, analytics, user-management) |

**Actions (13 types):**

| Action | Payload | Effect |
|---|---|---|
| `SET_QUERY` | `{ query }` | Updates query field |
| `SET_CUSTOM_PROMPT` | `{ customPrompt }` | Updates custom prompt field |
| `TOGGLE_PROMPT_MODE` | - | Toggles promptModeEnabled |
| `GENERATE_START` | - | Sets isLoading=true, clears response/reasoning/sources |
| `GENERATE_SUCCESS` | `{ response, reasoning, sources, conversation }` | Sets response, adds conversation to history |
| `GENERATE_FAILURE` | - | Sets isLoading=false |
| `SET_HISTORY` | `{ history }` | Replaces entire history list |
| `SELECT_CONVERSATION` | `{ id }` | Sets selectedConversationId, switches to generate view |
| `CLEAR_SELECTION` | - | Clears selectedConversationId, resets query/response |
| `DELETE_HISTORY_ITEM` | `{ id }` | Removes item from history, clears selection if matches |
| `CLEAR_ALL_HISTORY` | - | Empties history, clears selection |
| `NAVIGATE_ANALYTICS` | - | Sets view to "analytics" |
| `NAVIGATE_USER_MANAGEMENT` | - | Sets view to "user-management" |

**Persistence:** `selectedConversationId` and `view` saved to `localStorage` key `"resolve_app_state"`.

#### Auth State — `frontend/src/context/AuthContext.tsx`

**State:**
- `user: User | null` — Authenticated user object
- `status: AuthStatus` — `"loading"` | `"authenticated"` | `"unauthenticated"`

**Methods:**
- `checkEmail(email)` — Calls `POST /api/auth/check-email`
- `login(email, password?)` — Calls `POST /api/auth/login`, stores token in localStorage
- `logout()` — Calls `POST /api/auth/logout`, removes token from localStorage
- `isAdmin` — Computed: `user?.role === "admin"`

**Session Restoration:** On mount, checks localStorage for `resolve_session_token` → calls `GET /api/auth/me` → if valid, sets authenticated status.

#### Theme State — `frontend/src/context/ThemeContext.tsx`

**Themes:** `"obsidian"` (dark) | `"paper"` (light)
**Storage:** `localStorage` key `"resolve-theme"`
**Effect:** Sets `data-theme` attribute on `document.documentElement`
**Transition:** Adds `"theme-transitioning"` class for 400ms

#### Intro State — `frontend/src/context/IntroContext.tsx`

**Phases:** `waiting` → `sidebar` (0ms) → `atmosphere` (500ms) → `topbar` (700ms) → `content` (1000ms) → `done` (2000ms)
**Respects:** `prefers-reduced-motion` media query (skips to `done` immediately)
**Provides:** `phase`, `sidebarReady`, `atmosphereReady`, `topbarReady`, `contentReady`

---

### 18.10 Frontend API Client

#### API Service — `frontend/src/services/api.ts`

**Base URL:** `process.env.REACT_APP_API_BASE || "http://localhost:8000"`

**Auth Headers (`authHeaders()`):**
- `Authorization: Bearer <token>` from localStorage
- `Content-Type: application/json`
- `X-Device-Info: { screen: "WxH", timezone: "...", platform: "..." }` (JSON)

**Functions (20 total):**

| Function | Method | Endpoint | Request | Response |
|---|---|---|---|---|
| `checkEmail(email)` | POST | `/api/auth/check-email` | `{ email }` | `{ email, requires_password, user_name }` |
| `loginUser(email, password?)` | POST | `/api/auth/login` | `{ email, password? }` | `{ user, token }` |
| `fetchCurrentUser()` | GET | `/api/auth/me` | - | `User` |
| `logoutUser()` | POST | `/api/auth/logout` | - | `{ logged_out }` |
| `generateResponse(query, customPrompt?)` | POST | `/api/generate` | `{ query, customPrompt? }` | `GenerateResponse` |
| `fetchHistory()` | GET | `/api/history` | - | `Conversation[]` |
| `updateHistoryItem(id, response)` | PATCH | `/api/history/{id}` | `{ response }` | `{ ok }` |
| `deleteHistoryItem(id)` | DELETE | `/api/history/{id}` | - | `{ deleted }` |
| `clearAllHistory()` | DELETE | `/api/history` | - | `{ deleted }` |
| `fetchUsers()` | GET | `/api/users` | - | `User[]` |
| `createUserApi(data)` | POST | `/api/users` | `CreateUserRequest` | `User` |
| `updateUserApi(userId, data)` | PATCH | `/api/users/{id}` | `UpdateUserRequest` | `User` |
| `deleteUserApi(userId)` | DELETE | `/api/users/{id}` | - | `{ deleted }` |
| `fetchOverviewStats()` | GET | `/api/analytics/overview` | - | `OverviewStats` |
| `fetchDailyActivity(days)` | GET | `/api/analytics/daily-activity` | query: `days` | `DailyActivityPoint[]` |
| `fetchAuditLog(params)` | GET | `/api/analytics/audit-log` | query: `page, limit, ...` | `{ items, total, page, limit }` |
| `fetchLoginAttempts(params)` | GET | `/api/analytics/login-attempts` | query: `page, limit, ...` | `{ items, total, page, limit }` |
| `fetchSessions()` | GET | `/api/analytics/sessions` | - | `SessionActivity[]` |
| `fetchTokenUsage(params)` | GET | `/api/analytics/token-usage` | query: `from_ts, to_ts, group_by` | `TokenUsagePoint[]` |
| `fetchTokenByUser()` | GET | `/api/analytics/token-by-user` | - | `TokenByUser[]` |
| `fetchSecurityAlerts()` | GET | `/api/analytics/security-alerts` | - | `SecurityAlert[]` |
| `fetchUsageHeatmap()` | GET | `/api/analytics/usage-heatmap` | - | `HeatmapCell[]` |
| `sendHeartbeat(active)` | POST | `/api/analytics/heartbeat` | `{ active }` | `{ ok }` |

**Special Behaviors:**
- `fetchHistory()` uses in-flight deduplication to prevent duplicate requests
- `sendHeartbeat()` silently catches all errors (never fails)
- All requests include `credentials: "include"` for cookie support

---

### 18.11 Frontend Components

#### Key Component Functions

**Layout** (`Layout.tsx`):
- Cursor tracking: `handleMouseMove(e)` → updates `--glow-x`, `--glow-y` CSS variables
- Mobile toggle: `toggleSidebar()` → sets `sidebarOpen` state
- Intro animations gated by `useIntro()` phase booleans

**GenerateView** (`GenerateView.tsx`):
- Hero section with static copy
- Renders `QueryInput`, `PromptInput` (conditional), `ActionBar`
- Renders `LoadingSpinner` or `ResponsePanel` based on state

**ConversationDetail** (`ConversationDetail.tsx`):
- `handleCopy()` — `navigator.clipboard.writeText()` with feedback timer
- `handleSave()` — `updateHistoryItem(conv.id, editedText)` → refreshes history
- `handleDelete()` — `deleteHistoryItem(conv.id)` → dispatch `DELETE_HISTORY_ITEM`
- `handleNewQuery()` — dispatch `CLEAR_SELECTION`
- `resizeTextarea()` — Auto-height: `ref.style.height = ref.scrollHeight + "px"`
- Tab switching: Response, Reasoning, Sources

**ActionBar** (`ActionBar.tsx`):
- `handleGenerate()` — Validates query not empty → dispatch `GENERATE_START` → `generateResponse()` → dispatch `GENERATE_SUCCESS` or `GENERATE_FAILURE`
- `handleToggle()` — dispatch `TOGGLE_PROMPT_MODE`

**ResponsePanel** (`ResponsePanel.tsx`):
- `handleChange(e)` — Updates edited response state + resizes textarea
- `handleCopy()` — Clipboard write with 2-second "Copied" feedback
- `handleSave()` — `updateHistoryItem()` → sets `saved=true` for 2 seconds

**HistorySidebar** (`HistorySidebar.tsx`):
- `timeAgo(ts)` — Formats relative time: "Just now", "Xm ago", "Xh ago", "Xd ago"
- `handleClearAll()` — `clearAllHistory()` → dispatch `CLEAR_ALL_HISTORY`
- `handleSelect(id)` — dispatch `SELECT_CONVERSATION` + `fetchHistory()`

**LoginPage** (`LoginPage.tsx`):
- `handleEmailSubmit()` — `checkEmail(email)` → if requires_password: show step 2, else: `login(email)`
- `handlePasswordSubmit()` — `login(email, password)`
- `goBack()` — Reset to email step

**UserManagement** (`UserManagement.tsx`):
- `loadUsers()` — `fetchUsers()` → set users state
- `openAdd()` — Reset form, open modal in "add" mode
- `openEdit(user)` — Populate form, open modal in "edit" mode
- `handleSave()` — Validate → `createUserApi()` or `updateUserApi()` → reload
- `handleDelete(user)` — Confirm → `deleteUserApi()` → reload

**AnalyticsDashboard** (`AnalyticsDashboard.tsx`):
- Tab switching with AnimatePresence transitions
- Renders: `OverviewTab`, `AuditLogTab`, `SessionsSecurityTab`, `TokenUsageTab`

**OverviewTab** (`OverviewTab.tsx`):
- Fetches `fetchOverviewStats()` + `fetchDailyActivity(30)` on mount
- Renders stat cards + Recharts AreaChart

**AuditLogTab** (`AuditLogTab.tsx`):
- `load()` — `fetchAuditLog({ page, limit: 25, event_type: filter })` on filter/page change
- `formatTime(ts)` — `new Date(ts).toLocaleString()`
- Expandable rows for metadata JSON
- Event type color mapping

**SessionsSecurityTab** (`SessionsSecurityTab.tsx`):
- Fetches `fetchSessions()`, `fetchSecurityAlerts()`, `fetchLoginAttempts({ limit: 20 })`
- `formatDuration(ms)` — Converts ms to human readable (Xs, Xm, Xh)
- Renders security alerts, active sessions, recent logins tables

**TokenUsageTab** (`TokenUsageTab.tsx`):
- Fetches `fetchTokenUsage({})` + `fetchTokenByUser()`
- Stat cards: total tokens, total requests, avg tokens/request
- ComposedChart: bars (requests) + line (tokens)
- PieChart: prompt vs completion breakdown
- Top users table with percentage bars

#### Hooks

**`useHeartbeat()`** (`useHeartbeat.ts`):
- Registers event listeners: `mousemove`, `keydown`, `click`, `scroll`
- Updates `lastActivity` ref on any interaction
- Interval: every 30,000ms
- If `Date.now() - lastActivity > 60,000`: `sendHeartbeat(false)` (idle)
- Else: `sendHeartbeat(true)` (active)
- Cleanup: removes listeners and clears interval on unmount

**`useChartTheme()`** (`chartTheme.ts`):
- Reads current theme from `useTheme()`
- Returns theme-appropriate chart colors (primary, secondary, grid, text, tooltip, etc.)
- Returns `isDark` boolean

---

### 18.12 Deployment Infrastructure

#### Deploy Script — `deploy.sh`

**Functions (17 total):**

| Function | Purpose |
|---|---|
| `get_term_size()` | Gets terminal dimensions (rows × cols) |
| `setup_ui()` | Initializes deployment progress UI |
| `teardown_ui()` | Cleans up terminal UI |
| `draw_status_bar()` | Renders animated status bar with spinner and elapsed time |
| `log_info()` | Prints cyan info message |
| `log_step()` | Prints yellow step message |
| `log_success()` | Prints green success message |
| `log_error()` | Prints red error message |
| `log_dim()` | Prints dimmed output |
| `build_phase_list()` | Counts total deployment steps |
| `begin_phase()` | Marks start of a deployment phase |
| `stream_with_status()` | Streams command output with status bar updates |
| `run_cmd()` | Executes command with logging |
| `run_phase()` | Wrapper: begin_phase + run_cmd + error handling |
| `cleanup()` | EXIT trap: shows errors, removes temp dir |
| `display_urls()` | Queries and displays deployed service URLs |
| `preflight()` | Validates gcloud CLI, auth, directory structure |
| `show_help()` | Displays usage information |

**Variables:**

| Variable | Value |
|---|---|
| `PROJECT_ID` | `"gtm-cloud-helpdesk"` |
| `REGION` | `"us-central1"` |
| `REPO` | `"us-central1-docker.pkg.dev/${PROJECT_ID}/email-composer-repo"` |
| `BACKEND_IMAGE` | `"${REPO}/email-composer-backend:v1"` |
| `FRONTEND_IMAGE` | `"${REPO}/email-composer-frontend:v1"` |
| `BACKEND_SERVICE` | `"email-composer-backend"` |
| `FRONTEND_SERVICE` | `"email-composer-frontend"` |
| `BACKEND_URL` | `"https://email-composer-backend-147155498924.us-central1.run.app"` |

#### Docker Configuration

**Backend Dockerfile:**
- Base: `python:3.12-slim`
- System deps: `gcc`, `libpq-dev` (for asyncpg)
- Install: `pip install .` from `pyproject.toml`
- Copy: `main.py`, `app/`, `Canned_Responses_Templatefull.xlsx`
- ENV: `PORT=8080`, `ENV=production`, `EXCEL_DATA_PATH=/data/...`
- CMD: `uvicorn main:app --host 0.0.0.0 --port 8080`

**Frontend Dockerfile (Multi-stage):**
- Stage 1 (build): `node:20-alpine`, `npm ci`, `npm run build` with `REACT_APP_API_BASE` build arg
- Stage 2 (serve): `nginx:alpine`, copy `nginx.conf` + build output
- Expose: 8080
- CMD: `nginx -g "daemon off;"`

#### Nginx Configuration (`nginx.conf`):
- Listen: 8080
- SPA routing: `try_files $uri $uri/ /index.html`
- Static caching: 1 year, immutable (js, css, images, fonts)
- Health check: `/health` → `{"status":"ok"}`

#### Cloud Build (`cloudbuild.yaml`):
- Builder: `gcr.io/cloud-builders/docker`
- Build arg: `REACT_APP_API_BASE=${_BACKEND_URL}`
- Substitution default: `_BACKEND_URL: https://email-composer-backend-147155498924.us-central1.run.app`
- Output image: `us-central1-docker.pkg.dev/gtm-cloud-helpdesk/email-composer-repo/email-composer-frontend:v1`
