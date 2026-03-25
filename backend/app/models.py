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
