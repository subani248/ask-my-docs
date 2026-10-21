"""Retrieval API request/response schemas."""

from enum import Enum

from pydantic import BaseModel, Field


class RetrievalStatus(str, Enum):
    """Status of a retrieval operation."""

    SUCCESS = "SUCCESS"
    NO_RELEVANT_CONTEXT = "NO_RELEVANT_CONTEXT"
    NO_DOCUMENTS = "NO_DOCUMENTS"
    INVALID_QUERY = "INVALID_QUERY"
    DEGRADED = "DEGRADED"


class SearchRequest(BaseModel):
    """Request schema for hybrid retrieval search."""

    query: str = Field(..., min_length=1, max_length=1000, description="Natural language query")
    top_k: int = Field(default=8, ge=1, le=20, description="Number of results to return")
    document_ids: list[str] | None = Field(
        default=None, description="Optional filter to specific document IDs"
    )


class RetrievalResultMetadata(BaseModel):
    """Metadata for a single retrieval result."""

    filename: str
    page_number: int | None = None
    section: str | None = None


class RetrievalResult(BaseModel):
    """A single retrieval result with score and metadata."""

    chunk_id: str
    document_id: str
    score: float
    rank: int
    content: str
    metadata: RetrievalResultMetadata


class RetrievalTrace(BaseModel):
    """Internal retrieval trace for debugging/observability."""

    vector_candidates: int = 0
    bm25_candidates: int = 0
    hybrid_candidates: int = 0
    reranked_candidates: int = 0
    latency_ms: dict = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Response schema for hybrid retrieval search."""

    query: str
    results: list[RetrievalResult]
    retrieval_status: RetrievalStatus
    total_results: int
    trace: RetrievalTrace | None = None
