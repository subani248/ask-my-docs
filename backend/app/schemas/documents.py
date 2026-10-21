"""Document request/response schemas."""

from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """Schema for document in API responses."""

    id: str
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    status: str
    error_message: str | None = None
    chunk_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    """Paginated document list."""

    documents: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class IngestionJobResponse(BaseModel):
    """Schema for ingestion job status."""

    id: str
    document_id: str
    status: str
    attempts: int
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
