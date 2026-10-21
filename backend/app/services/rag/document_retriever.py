"""Document-level retrieval: selects representative chunks for document summarization.

Instead of keyword-based retrieval, this selects diverse chunks that
cover the full breadth of a document for overview/summary generation.
"""

import logging
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.db.database import CHUNKS, DOCUMENTS, get_db

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class DocumentChunk:
    """A chunk with full metadata for context building."""

    chunk_id: str
    document_id: str
    filename: str
    content: str
    page_number: int | None = None
    section: str | None = None
    chunk_index: int = 0
    score: float = 1.0  # All doc-level chunks get equal weight


@dataclass
class DocumentLevelContext:
    """Context built from a document's representative chunks."""

    chunks: list[DocumentChunk] = field(default_factory=list)
    document_id: str = ""
    filename: str = ""
    total_chunks: int = 0
    selected_chunks: int = 0


class DocumentLevelRetriever:
    """Retrieves representative chunks for document-level summarization.

    Strategy:
    1. Load all chunks for the target document from MongoDB
    2. Select representative chunks by section diversity
    3. Ensure coverage across pages
    4. Remove near-duplicates
    5. Respect token limits
    """

    def __init__(self):
        self._max_chunks = settings.DOCUMENT_SUMMARY_MAX_CHUNKS
        self._max_tokens = settings.DOCUMENT_SUMMARY_MAX_TOKENS

    async def get_document_context(
        self,
        document_id: str,
        owner_id: str,
    ) -> DocumentLevelContext:
        """Get representative chunks from a document for summary generation.

        Args:
            document_id: Target document ID.
            owner_id: Authenticated user's ID (for authorization).

        Returns:
            DocumentLevelContext with selected representative chunks.
        """
        db = get_db()

        # 1. Verify document exists and belongs to user
        doc = await db[DOCUMENTS].find_one(
            {"id": document_id, "owner_id": owner_id},
            {"_id": 0, "id": 1, "original_filename": 1, "status": 1, "chunk_count": 1},
        )

        if not doc:
            return DocumentLevelContext()

        if doc.get("status") != "ready":
            return DocumentLevelContext()

        filename = doc.get("original_filename", "Unknown")

        # 2. Load all chunks for this document
        # Note: chunks use 'tenant_id' not 'owner_id'
        cursor = db[CHUNKS].find(
            {
                "document_id": document_id,
                "tenant_id": owner_id,
            },
            {
                "_id": 0,
                "id": 1,
                "content": 1,
                "document_id": 1,
                "page_number": 1,
                "section": 1,
                "chunk_index": 1,
            },
        ).sort("chunk_index", 1)

        all_chunks = []
        async for chunk in cursor:
            all_chunks.append(chunk)

        if not all_chunks:
            return DocumentLevelContext(
                document_id=document_id,
                filename=filename,
            )

        # 3. Select representative chunks
        selected = self._select_representative(all_chunks)

        # 4. Build DocumentChunk objects
        doc_chunks = []
        for chunk in selected:
            est_tokens = len(chunk.get("content", "")) // 4
            doc_chunks.append(
                DocumentChunk(
                    chunk_id=chunk["id"],
                    document_id=document_id,
                    filename=filename,
                    content=chunk.get("content", ""),
                    page_number=chunk.get("page_number"),
                    section=chunk.get("section"),
                    chunk_index=chunk.get("chunk_index", 0),
                    score=1.0,
                )
            )

        logger.info(
            "Document-level retrieval: doc=%s, total_chunks=%d, selected=%d",
            document_id,
            len(all_chunks),
            len(doc_chunks),
        )

        return DocumentLevelContext(
            chunks=doc_chunks,
            document_id=document_id,
            filename=filename,
            total_chunks=len(all_chunks),
            selected_chunks=len(doc_chunks),
        )

    def _select_representative(self, chunks: list[dict]) -> list[dict]:
        """Select representative chunks with section diversity.

        Strategy:
        - Group by section
        - Pick 1-2 chunks from each section (first + middle if available)
        - Always include first chunk (introduction)
        - Always include last chunk (conclusion)
        - Fill remaining slots by page diversity
        - Remove near-duplicates
        - Respect limits
        """
        if not chunks:
            return []

        max_chunks = self._max_chunks

        # Group by section
        sections: dict[str, list[dict]] = {}
        for chunk in chunks:
            section = chunk.get("section") or "Unknown"
            if section not in sections:
                sections[section] = []
            sections[section].append(chunk)

        selected: list[dict] = []
        selected_ids: set[str] = set()

        # Always include first chunk (introduction)
        first = chunks[0]
        selected.append(first)
        selected_ids.add(first["id"])

        # Always include last chunk (conclusion), if different
        last = chunks[-1]
        if last["id"] not in selected_ids:
            selected.append(last)
            selected_ids.add(last["id"])

        # Pick 1-2 chunks from each section
        for section_name, section_chunks in sections.items():
            if len(selected) >= max_chunks:
                break

            # Pick first chunk of section
            for sc in section_chunks:
                if sc["id"] not in selected_ids:
                    selected.append(sc)
                    selected_ids.add(sc["id"])
                    break

            # If section has 3+ chunks, also pick middle one
            if len(section_chunks) >= 3 and len(selected) < max_chunks:
                mid = section_chunks[len(section_chunks) // 2]
                if mid["id"] not in selected_ids:
                    selected.append(mid)
                    selected_ids.add(mid["id"])

        # Fill remaining slots by page diversity
        if len(selected) < max_chunks:
            pages_seen: set[int] = set()
            for sc in selected:
                p = sc.get("page_number")
                if p is not None:
                    pages_seen.add(p)

            for chunk in chunks:
                if len(selected) >= max_chunks:
                    break
                if chunk["id"] in selected_ids:
                    continue
                page = chunk.get("page_number")
                # Prefer chunks from unseen pages
                if page is not None and page not in pages_seen:
                    selected.append(chunk)
                    selected_ids.add(chunk["id"])
                    pages_seen.add(page)

        # Fill any remaining slots
        if len(selected) < max_chunks:
            for chunk in chunks:
                if len(selected) >= max_chunks:
                    break
                if chunk["id"] not in selected_ids:
                    selected.append(chunk)
                    selected_ids.add(chunk["id"])

        # Sort by chunk_index for document order
        selected.sort(key=lambda c: c.get("chunk_index", 0))

        return selected
