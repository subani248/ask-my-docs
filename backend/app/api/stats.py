"""Stats API endpoint: returns real dashboard statistics for the authenticated user."""

import logging

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db.database import CHUNKS, DOCUMENTS, MESSAGES, get_db
from app.models.user import UserModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("")
async def get_stats(user: UserModel = Depends(get_current_user)) -> dict:
    """Get dashboard statistics for the authenticated user."""
    db = get_db()

    # Count documents (ready only)
    doc_count = await db[DOCUMENTS].count_documents(
        {"owner_id": user.id, "status": "ready"}
    )

    # Count questions asked (messages collection)
    question_count = await db[MESSAGES].count_documents(
        {"user_id": user.id}
    )

    # Count unique conversations (by unique questions)
    conversations = question_count  # Each question = 1 conversation for now

    # Total chunks (for context)
    chunk_count = await db[CHUNKS].count_documents(
        {"tenant_id": user.id}
    )

    return {
        "documents": doc_count,
        "questions": question_count,
        "conversations": conversations,
        "chunks": chunk_count,
    }
