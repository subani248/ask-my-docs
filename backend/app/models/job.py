"""IngestionJob model for MongoDB."""

import enum
import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field


class JobStatus(enum.StrEnum):
    """Ingestion job status."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobModel(BaseModel):
    """Ingestion job stored in MongoDB."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str
    status: JobStatus = JobStatus.QUEUED
    attempts: int = 0
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = {"from_attributes": True}
