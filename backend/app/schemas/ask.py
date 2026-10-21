"""Ask API request/response schemas."""

from enum import Enum

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """Request schema for RAG question answering."""

    question: str = Field(
        ..., min_length=1, max_length=2000, description="Natural language question"
    )
    document_ids: list[str] | None = Field(
        default=None, description="Optional filter to specific document IDs"
    )
    conversation_id: str | None = Field(
        default=None, description="Optional conversation ID to continue"
    )


class CitationSource(BaseModel):
    """A verified citation source."""

    citation_id: str
    document_id: str
    filename: str
    page_number: int | None = None
    section: str | None = None
    excerpt: str


class AskStatus(str, Enum):
    """Status of the ask operation."""

    SUCCESS = "SUCCESS"
    NO_RELEVANT_CONTEXT = "NO_RELEVANT_CONTEXT"
    NO_DOCUMENTS = "NO_DOCUMENTS"
    INVALID_QUERY = "INVALID_QUERY"
    GENERATION_FAILED = "GENERATION_FAILED"
    UNGROUNDED = "UNGROUNDED"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


class RAGMode(str, Enum):
    """RAG retrieval mode."""

    TARGETED = "TARGETED"
    DOCUMENT_LEVEL = "DOCUMENT_LEVEL"


class SearchStats(BaseModel):
    """Statistics about the retrieval search."""

    documents_searched: int = 0
    chunks_searched: int = 0
    candidates_found: int = 0
    retrieval_latency_ms: float = 0


class AskResponse(BaseModel):
    """Response schema for RAG question answering."""

    question: str
    answer: str
    citations: list[CitationSource]
    grounded: bool
    status: AskStatus
    allowed: bool = True
    intent: str = "TARGETED_QUESTION"
    suggested_questions: list[str] = []
    model: str = ""
    retrieval_status: str = ""
    rag_mode: str | None = None
    search_stats: SearchStats | None = None
    conversation_id: str | None = None
