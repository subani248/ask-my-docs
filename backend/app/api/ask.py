"""Ask API endpoint: RAG question answering with citation enforcement."""

import logging

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.ask import AskRequest, AskResponse
from app.services.rag.generation import RAGService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ask", tags=["ask"])


@router.post("", response_model=AskResponse)
async def ask_question(
    body: AskRequest,
    user: UserModel = Depends(get_current_user),
) -> AskResponse:
    """Ask a question about your documents.

    Uses hybrid retrieval (vector + BM25), cross-encoder reranking,
    and LLM generation with citation enforcement.

    The answer is grounded ONLY in your authorized documents.
    Requires authentication.
    """
    service = RAGService()
    return await service.ask(
        question=body.question,
        user_id=user.id,
        document_ids=body.document_ids,
        conversation_id=body.conversation_id,
    )
