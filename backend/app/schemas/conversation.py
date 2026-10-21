"""Conversation and message schemas for history management."""

from datetime import datetime

from pydantic import BaseModel, Field


class ConversationListItem(BaseModel):
    """Lightweight conversation for the list view."""

    id: str
    title: str
    document_ids: list[str] = []
    last_message: str = ""
    updated_at: datetime
    message_count: int = 0


class ConversationListResponse(BaseModel):
    """Paginated conversation list."""

    items: list[ConversationListItem]
    page: int
    limit: int
    total: int


class MessageResponse(BaseModel):
    """A single message in a conversation."""

    id: str
    role: str  # "user" | "assistant"
    content: str
    citations: list[dict] = []
    rag_mode: str | None = None
    intent: str | None = None
    document_ids: list[str] = []
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    """Full conversation with messages."""

    id: str
    title: str
    document_ids: list[str] = []
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    messages: list[MessageResponse] = []


class ConversationRenameRequest(BaseModel):
    """Request to rename a conversation."""

    title: str = Field(..., min_length=1, max_length=80)


class ConversationSearchResponse(BaseModel):
    """Search results."""

    items: list[ConversationListItem]
    query: str
    total: int
