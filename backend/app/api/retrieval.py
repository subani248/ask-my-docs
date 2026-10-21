"""Retrieval API endpoints: hybrid search across documents."""

import logging

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.retrieval import SearchRequest, SearchResponse
from app.services.retrieval import RetrievalService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/retrieval", tags=["retrieval"])


@router.post("/search", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    user: UserModel = Depends(get_current_user),
) -> SearchResponse:
    """Search across your documents using hybrid retrieval.

    Combines vector search (semantic) and BM25 (keyword) with
    cross-encoder reranking for optimal results.

    Requires authentication — you can only search your own documents.
    """
    service = RetrievalService()
    return await service.search(
        query=body.query,
        owner_id=user.id,
        top_k=body.top_k,
        document_ids=body.document_ids,
    )


@router.get("/search", response_model=SearchResponse)
async def search_get(
    q: str = Query(..., min_length=1, max_length=1000, description="Search query"),
    top_k: int = Query(default=8, ge=1, le=20, description="Number of results"),
    debug: bool = Query(default=False, description="Include retrieval trace"),
    user: UserModel = Depends(get_current_user),
) -> SearchResponse:
    """GET variant of search for convenience/testing."""
    service = RetrievalService()
    return await service.search(
        query=q,
        owner_id=user.id,
        top_k=top_k,
        include_trace=debug,
    )
