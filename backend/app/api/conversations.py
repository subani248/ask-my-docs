"""Conversation history API endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.db.database import CONVERSATIONS, MESSAGES, get_db
from app.models.user import UserModel
from app.schemas.conversation import (
    ConversationDetailResponse,
    ConversationListItem,
    ConversationListResponse,
    ConversationRenameRequest,
    ConversationSearchResponse,
    MessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])


# ── Helpers ──


def _serialize_conversation(doc: dict) -> dict:
    """Convert MongoDB doc to API-safe dict."""
    doc["id"] = doc.get("id", str(doc.get("_id", "")))
    return doc


# ── List conversations ──


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: UserModel = Depends(get_current_user),
):
    """List the authenticated user's conversations, newest first."""
    db = get_db()

    skip = (page - 1) * limit
    total = await db[CONVERSATIONS].count_documents({"user_id": user.id})

    cursor = (
        db[CONVERSATIONS]
        .find({"user_id": user.id})
        .sort("updated_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    items = []
    for doc in docs:
        items.append(
            ConversationListItem(
                id=doc.get("id", str(doc.get("_id", ""))),
                title=doc.get("title", "Untitled"),
                document_ids=doc.get("document_ids", []),
                last_message=doc.get("last_message", ""),
                updated_at=doc["updated_at"],
                message_count=doc.get("message_count", 0),
            )
        )

    return ConversationListResponse(items=items, page=page, limit=limit, total=total)


# ── Search conversations ──


@router.get("/search", response_model=ConversationSearchResponse)
async def search_conversations(
    q: str = Query(..., min_length=1, max_length=100),
    user: UserModel = Depends(get_current_user),
):
    """Search conversations by title."""
    db = get_db()

    import re

    # Escape special regex characters in query
    escaped = re.escape(q)
    regex = {"$regex": escaped, "$options": "i"}

    cursor = (
        db[CONVERSATIONS]
        .find({"user_id": user.id, "title": regex})
        .sort("updated_at", -1)
        .limit(50)
    )
    docs = await cursor.to_list(length=50)

    items = []
    for doc in docs:
        items.append(
            ConversationListItem(
                id=doc.get("id", str(doc.get("_id", ""))),
                title=doc.get("title", "Untitled"),
                document_ids=doc.get("document_ids", []),
                last_message=doc.get("last_message", ""),
                updated_at=doc["updated_at"],
                message_count=doc.get("message_count", 0),
            )
        )

    return ConversationSearchResponse(items=items, query=q, total=len(items))


# ── Get conversation detail ──


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    user: UserModel = Depends(get_current_user),
):
    """Get a conversation with all its messages."""
    db = get_db()

    conv = await db[CONVERSATIONS].find_one(
        {"id": conversation_id, "user_id": user.id}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Load messages
    cursor = (
        db[MESSAGES]
        .find({"conversation_id": conversation_id})
        .sort("created_at", 1)
    )
    msg_docs = await cursor.to_list(length=1000)

    messages = []
    for m in msg_docs:
        messages.append(
            MessageResponse(
                id=m.get("id", str(m.get("_id", ""))),
                role=m["role"],
                content=m["content"],
                citations=m.get("citations", []),
                rag_mode=m.get("rag_mode"),
                intent=m.get("intent"),
                document_ids=m.get("document_ids", []),
                created_at=m["created_at"],
            )
        )

    return ConversationDetailResponse(
        id=conv.get("id", str(conv.get("_id", ""))),
        title=conv.get("title", "Untitled"),
        document_ids=conv.get("document_ids", []),
        created_at=conv["created_at"],
        updated_at=conv["updated_at"],
        message_count=conv.get("message_count", 0),
        messages=messages,
    )


# ── Rename conversation ──


@router.patch("/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    body: ConversationRenameRequest,
    user: UserModel = Depends(get_current_user),
):
    """Rename a conversation."""
    db = get_db()

    result = await db[CONVERSATIONS].update_one(
        {"id": conversation_id, "user_id": user.id},
        {"$set": {"title": body.title.strip()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"message": "Conversation renamed"}


# ── Delete conversation ──


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: UserModel = Depends(get_current_user),
):
    """Delete a conversation and its messages."""
    db = get_db()

    # Verify ownership
    conv = await db[CONVERSATIONS].find_one(
        {"id": conversation_id, "user_id": user.id}
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete messages first
    await db[MESSAGES].delete_many({"conversation_id": conversation_id})

    # Delete conversation
    await db[CONVERSATIONS].delete_one({"id": conversation_id})

    return {"message": "Conversation deleted"}
