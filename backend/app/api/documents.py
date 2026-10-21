"""Document management API endpoints."""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.storage import compute_file_hash, generate_storage_id, save_uploaded_file
from app.db.database import DOCUMENTS, JOBS, get_db
from app.models.document import DocumentModel, DocumentStatus
from app.models.job import JobModel, JobStatus
from app.models.user import UserModel
from app.schemas.documents import DocumentListResponse, DocumentResponse, IngestionJobResponse

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _validate_file(filename: str, file_size: int) -> None:
    """Validate upload before processing."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '{ext}'. Allowed: {allowed}",
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File is empty",
        )
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB}MB",
        )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    user: UserModel = Depends(get_current_user),
):
    """Upload a document for processing."""
    content = await file.read()
    file_size = len(content)

    _validate_file(file.filename or "unknown", file_size)

    content_hash = compute_file_hash(content)
    db = get_db()

    # Check for duplicate
    existing = await db[DOCUMENTS].find_one(
        {
            "owner_id": user.id,
            "content_hash": content_hash,
        }
    )
    if existing:
        logger.info("Duplicate document detected: %s", existing["id"])
        return DocumentResponse(**existing)

    # Create document record
    doc_id = generate_storage_id()
    safe_filename = f"{doc_id}_original"

    storage_path = save_uploaded_file(doc_id, content)

    doc = DocumentModel(
        id=doc_id,
        owner_id=user.id,
        filename=safe_filename,
        original_filename=file.filename or "unknown",
        content_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        storage_path=storage_path,
        content_hash=content_hash,
        status=DocumentStatus.UPLOADED,
    )

    await db[DOCUMENTS].insert_one(doc.model_dump())

    # Create ingestion job
    job = JobModel(document_id=doc_id, status=JobStatus.QUEUED)
    await db[JOBS].insert_one(job.model_dump())

    # Run ingestion inline (no Celery/Redis needed)
    import asyncio

    async def _run_inline():
        try:
            from app.services.ingestion import run_ingestion

            await run_ingestion(job.id)
        except Exception as exc:
            logger.error("Inline ingestion failed for job %s: %s", job.id, exc)
            await db[JOBS].update_one(
                {"id": job.id},
                {
                    "$set": {
                        "status": JobStatus.FAILED.value,
                        "error_message": str(exc)[:1000],
                    }
                },
            )
            await db[DOCUMENTS].update_one(
                {"id": doc_id},
                {
                    "$set": {
                        "status": DocumentStatus.FAILED.value,
                        "error_message": str(exc)[:1000],
                    }
                },
            )

    asyncio.get_event_loop().create_task(_run_inline())
    logger.info("Started inline ingestion for document %s", doc_id)

    return DocumentResponse.model_validate(doc)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = 1,
    page_size: int = 20,
    user: UserModel = Depends(get_current_user),
):
    """List documents for the authenticated user."""
    page_size = min(page_size, 100)
    skip = (page - 1) * page_size
    db = get_db()

    total = await db[DOCUMENTS].count_documents({"owner_id": user.id})

    cursor = (
        db[DOCUMENTS].find({"owner_id": user.id}).sort("created_at", -1).skip(skip).limit(page_size)
    )
    documents = []
    async for doc in cursor:
        documents.append(DocumentResponse(**doc))

    return DocumentListResponse(
        documents=documents,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user: UserModel = Depends(get_current_user),
):
    """Get document details."""
    db = get_db()
    doc = await db[DOCUMENTS].find_one({"id": document_id, "owner_id": user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentResponse(**doc)


@router.get("/{document_id}/status", response_model=IngestionJobResponse)
async def get_document_status(
    document_id: str,
    user: UserModel = Depends(get_current_user),
):
    """Get the ingestion job status for a document."""
    db = get_db()
    doc = await db[DOCUMENTS].find_one({"id": document_id, "owner_id": user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    job = await db[JOBS].find_one(
        {"document_id": document_id},
        sort=[("created_at", -1)],
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ingestion job found")
    return IngestionJobResponse(**job)


@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document(
    document_id: str,
    user: UserModel = Depends(get_current_user),
):
    """Retry ingestion for a failed document."""
    db = get_db()
    doc = await db[DOCUMENTS].find_one({"id": document_id, "owner_id": user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc["status"] not in (DocumentStatus.FAILED.value, DocumentStatus.UPLOADED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry document with status '{doc['status']}'",
        )

    # Create a new ingestion job
    job = JobModel(document_id=doc_id, status=JobStatus.QUEUED)
    await db[JOBS].insert_one(job.model_dump())

    # Reset document status
    await db[DOCUMENTS].update_one(
        {"id": document_id},
        {"$set": {"status": DocumentStatus.PROCESSING.value, "error_message": None}},
    )

    # Run retry ingestion inline
    import asyncio

    async def _run_inline():
        try:
            from app.services.ingestion import run_ingestion
            await run_ingestion(job.id)
        except Exception as exc:
            logger.error("Inline retry ingestion failed for job %s: %s", job.id, exc)
            await db[JOBS].update_one(
                {"id": job.id},
                {"$set": {"status": JobStatus.FAILED.value, "error_message": str(exc)[:1000]}},
            )
            await db[DOCUMENTS].update_one(
                {"id": document_id},
                {"$set": {"status": DocumentStatus.FAILED.value, "error_message": str(exc)[:1000]}},
            )

    asyncio.get_event_loop().create_task(_run_inline())
    logger.info("Started inline retry ingestion for document %s", document_id)

    updated = await db[DOCUMENTS].find_one({"id": document_id})
    return DocumentResponse(**updated)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    user: UserModel = Depends(get_current_user),
):
    """Delete a document and all associated data."""
    db = get_db()
    doc = await db[DOCUMENTS].find_one({"id": document_id, "owner_id": user.id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    from app.services.ingestion import delete_document_cascade

    await delete_document_cascade(document_id)
    logger.info("User %s deleted document %s", user.id, document_id)
