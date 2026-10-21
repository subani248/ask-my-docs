"""Document model for MongoDB."""

import enum
import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field


class DocumentStatus(enum.StrEnum):
    """Document processing status."""

    UPLOADED = "uploaded"
    PROCESSING = "processing"
    INDEXING = "indexing"
    READY = "ready"
    FAILED = "failed"
    DELETING = "deleting"


class DocumentModel(BaseModel):
    """Uploaded document metadata stored in MongoDB."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    storage_path: str
    content_hash: str
    status: DocumentStatus = DocumentStatus.UPLOADED
    error_message: str | None = None
    chunk_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"from_attributes": True}
