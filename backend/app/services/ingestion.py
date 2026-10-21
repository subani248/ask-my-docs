"""Main ingestion pipeline: parse → clean → chunk → embed → index."""

import logging
from datetime import UTC, datetime

from app.core.config import get_settings
from app.core.storage import delete_document_files
from app.db.database import CHUNKS, DOCUMENTS, JOBS, MESSAGES, get_db
from app.models.chunk import ChunkModel
from app.models.document import DocumentStatus
from app.models.job import JobStatus
from app.services.bm25_index import BM25Indexer
from app.services.chunker import create_chunks
from app.services.cleaning import clean_text
from app.services.embeddings import get_embedding_provider
from app.services.parsers import get_parser
from app.services.vector_store import VectorPoint, get_vector_store

logger = logging.getLogger(__name__)
settings = get_settings()


async def run_ingestion(job_id: str) -> None:
    """Execute the full ingestion pipeline for a document."""
    db = get_db()

    # Load the job
    job_doc = await db[JOBS].find_one({"id": job_id})
    if job_doc is None:
        logger.error("Ingestion job %s not found", job_id)
        return

    doc_doc = await db[DOCUMENTS].find_one({"id": job_doc["document_id"]})
    if doc_doc is None:
        logger.error("Document %s not found for job %s", job_doc["document_id"], job_id)
        return

    # Update job status
    await db[JOBS].update_one(
        {"id": job_id},
        {"$set": {
            "status": JobStatus.PROCESSING.value,
            "attempts": job_doc.get("attempts", 0) + 1,
            "started_at": datetime.now(UTC).isoformat(),
        }},
    )
    await db[DOCUMENTS].update_one(
        {"id": doc_doc["id"]},
        {"$set": {"status": DocumentStatus.PROCESSING.value}},
    )

    try:
        # 1. PARSE
        logger.info("[%s] Parsing document", doc_doc["id"])
        parser = get_parser(doc_doc["original_filename"])
        parsed = parser.parse(doc_doc["storage_path"])

        # 2. CLEAN
        logger.info("[%s] Cleaning text", doc_doc["id"])
        cleaned_text = clean_text(parsed.text)
        if not cleaned_text.strip():
            raise ValueError("Document contains no extractable text after cleaning")

        # 3. STRUCTURE + CHUNK
        logger.info("[%s] Chunking document", doc_doc["id"])
        chunks = create_chunks(doc_doc["id"], doc_doc["owner_id"], parsed)
        if not chunks:
            raise ValueError("No chunks generated from document")

        # 4. EMBED
        logger.info("[%s] Embedding %d chunks", doc_doc["id"], len(chunks))
        embedder = get_embedding_provider()
        texts = [c.content for c in chunks]
        embeddings = embedder.embed_documents(texts)

        # 5. STORE CHUNKS IN MONGODB
        logger.info("[%s] Storing chunks in MongoDB", doc_doc["id"])
        chunk_docs = []
        for chunk in chunks:
            chunk_model = ChunkModel(
                id=chunk.chunk_id,
                document_id=chunk.document_id,
                tenant_id=chunk.tenant_id,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                page_number=chunk.page_number,
                section=chunk.section,
                metadata=chunk.metadata,
                content_hash=chunk.content_hash,
                embedding_model=settings.EMBEDDING_MODEL,
                embedding_version="v1",
            )
            chunk_docs.append(chunk_model.model_dump())

        if chunk_docs:
            await db[CHUNKS].insert_many(chunk_docs)

        # 6. QDRANT INDEX
        logger.info("[%s] Indexing in Qdrant", doc_doc["id"])
        vector_store = get_vector_store()
        vector_store.ensure_collection(embedder.dimension)

        points = [
            VectorPoint(
                id=chunk.chunk_id,
                vector=embedding,
                payload={
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "tenant_id": chunk.tenant_id,
                    "page_number": chunk.page_number,
                    "section": chunk.section,
                    "filename": doc_doc["original_filename"],
                },
            )
            for chunk, embedding in zip(chunks, embeddings)
        ]
        vector_store.upsert(points)

        # 7. BM25 INDEX
        logger.info("[%s] Indexing in BM25", doc_doc["id"])
        bm25 = BM25Indexer()
        bm25_entries = [
            {
                "chunk_id": chunk.chunk_id,
                "document_id": chunk.document_id,
                "tenant_id": chunk.tenant_id,
                "text": chunk.content,
                "metadata": {
                    "filename": doc_doc["original_filename"],
                    "page_number": chunk.page_number,
                    "section": chunk.section,
                },
            }
            for chunk in chunks
        ]
        bm25.index_batch(bm25_entries)

        # 8. MARK READY
        await db[DOCUMENTS].update_one(
            {"id": doc_doc["id"]},
            {"$set": {
                "status": DocumentStatus.READY.value,
                "chunk_count": len(chunks),
            }},
        )
        await db[JOBS].update_one(
            {"id": job_id},
            {"$set": {
                "status": JobStatus.COMPLETED.value,
                "completed_at": datetime.now(UTC).isoformat(),
            }},
        )

        logger.info(
            "[%s] Ingestion complete: %d chunks",
            doc_doc["id"],
            len(chunks),
        )

    except Exception as e:
        logger.exception("[%s] Ingestion failed", doc_doc["id"])
        await db[DOCUMENTS].update_one(
            {"id": doc_doc["id"]},
            {"$set": {
                "status": DocumentStatus.FAILED.value,
                "error_message": str(e)[:1000],
            }},
        )
        await db[JOBS].update_one(
            {"id": job_id},
            {"$set": {
                "status": JobStatus.FAILED.value,
                "error_message": str(e)[:1000],
                "completed_at": datetime.now(UTC).isoformat(),
            }},
        )


async def delete_document_cascade(document_id: str) -> bool:
    """Delete a document and all associated data."""
    db = get_db()

    # Delete chunks
    await db[CHUNKS].delete_many({"document_id": document_id})

    # Delete jobs
    await db[JOBS].delete_many({"document_id": document_id})

    # Delete conversation messages that reference this document
    await db[MESSAGES].delete_many({"citations.document_id": document_id})

    # Delete from Qdrant
    try:
        vector_store = get_vector_store()
        vector_store.delete_by_document(document_id)
    except Exception as e:
        logger.warning("Qdrant delete failed for %s: %s", document_id, e)

    # Delete from BM25
    try:
        bm25 = BM25Indexer()
        bm25.delete_by_document(document_id)
    except Exception as e:
        logger.warning("BM25 delete failed for %s: %s", document_id, e)

    # Delete stored file
    delete_document_files(document_id)

    # Delete document record
    await db[DOCUMENTS].delete_one({"id": document_id})

    logger.info("Deleted document cascade: %s", document_id)
    return True
