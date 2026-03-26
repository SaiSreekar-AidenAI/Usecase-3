from pydantic import BaseModel


class GenerateRequest(BaseModel):
    query: str
    customPrompt: str | None = None


class RetrievedSource(BaseModel):
    category: str
    description: str
    response: str
    relevance_score: float


class ConversationResponse(BaseModel):
    id: str
    query: str
    response: str
    reasoning: str | None = None
    sources: list[RetrievedSource] | None = None
    customPrompt: str | None = None
    timestamp: int


class UpdateConversationRequest(BaseModel):
    response: str


class GenerateResponse(BaseModel):
    response: str
    reasoning: str | None = None
    sources: list[RetrievedSource]
    conversation: ConversationResponse


# ── Auth models ──────────────────────────────────────────────

class LoginCheckEmailRequest(BaseModel):
    email: str


class LoginCheckEmailResponse(BaseModel):
    email: str
    requires_password: bool
    user_name: str


class LoginRequest(BaseModel):
    email: str
    password: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool = True


class LoginResponse(BaseModel):
    user: UserResponse
    token: str


class CreateUserRequest(BaseModel):
    email: str
    name: str
    role: str
    password: str | None = None


class UpdateUserRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    password: str | None = None
    is_active: bool | None = None


# ── Analytics models ────────────────────────────────────────

class OverviewStats(BaseModel):
    total_users: int
    active_users_24h: int
    active_sessions: int
    total_queries: int
    total_tokens: int
    queries_today: int
    tokens_today: int


class DailyActivityPoint(BaseModel):
    date: str
    logins: int
    queries: int
    tokens: int


class AuditEventResponse(BaseModel):
    id: str
    event_type: str
    user_email: str | None = None
    user_role: str | None = None
    ip_address: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    metadata_json: str | None = None
    timestamp: int


class LoginAttemptResponse(BaseModel):
    id: str
    user_email: str
    success: bool
    ip_address: str | None = None
    country: str | None = None
    city: str | None = None
    browser: str | None = None
    os: str | None = None
    device_type: str | None = None
    failure_reason: str | None = None
    timestamp: int


class SessionActivityResponse(BaseModel):
    session_id: str
    user_id: str
    user_email: str | None = None
    started_at: int
    last_activity_at: int
    active_duration_ms: int
    idle_duration_ms: int
    actions_count: int
    is_active: bool


class TokenUsagePoint(BaseModel):
    date: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    request_count: int


class TokenByUser(BaseModel):
    user_id: str
    user_email: str | None = None
    total_tokens: int
    request_count: int
    avg_tokens_per_request: float


class SecurityAlert(BaseModel):
    alert_type: str
    severity: str
    user_email: str | None = None
    description: str
    details: dict
    timestamp: int


class HeatmapCell(BaseModel):
    day_of_week: int
    hour: int
    count: int
