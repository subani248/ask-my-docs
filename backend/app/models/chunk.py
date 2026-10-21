"""DocumentChunk model for MongoDB."""

import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field


class ChunkModel(BaseModel):
    """A chunk of text from a document, stored in MongoDB."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    tenant_id: str
    chunk_index: int
    content: str
    page_number: int | None = None
    section: str | None = None
    metadata: dict | None = None
    content_hash: str
    embedding_model: str | None = None
    embedding_version: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"from_attributes": True}
