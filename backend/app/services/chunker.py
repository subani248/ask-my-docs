"""Structure-aware document chunker with configurable parameters."""

import hashlib
import logging
import re
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.services.parsers import ParsedDocument

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class Chunk:
    """A single chunk of text ready for embedding."""

    chunk_id: str
    document_id: str
    tenant_id: str
    chunk_index: int
    content: str
    page_number: int | None = None
    section: str | None = None
    metadata: dict = field(default_factory=dict)
    content_hash: str = ""


def _make_deterministic_chunk_id(document_id: str, chunk_index: int, content: str) -> str:
    """Create a deterministic UUID-based chunk ID."""
    import uuid

    raw = f"{document_id}:{chunk_index}:{content[:100]}"
    h = hashlib.sha256(raw.encode()).hexdigest()
    # Convert hex digest to a deterministic UUID
    return str(uuid.UUID(h[:32]))


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
    min_chunk_size: int | None = None,
) -> list[str]:
    """Split text into chunks respecting approximate token limits.

    Uses recursive splitting: paragraphs → sentences → words.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
    min_chunk_size = min_chunk_size or settings.MIN_CHUNK_SIZE

    if not text or not text.strip():
        return []

    # Estimate tokens in characters for splitting logic
    # chunk_size is in tokens (~4 chars each)
    chunk_size * 4
    chunk_overlap * 4
    min_chars = min_chunk_size * 4

    paragraphs = re.split(r"\n{2,}", text)
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if _estimate_tokens(current + "\n\n" + para) <= chunk_size:
            current = (current + "\n\n" + para).strip() if current else para
        else:
            if current and len(current) >= min_chars:
                chunks.append(current)
            # If single paragraph exceeds limit, split by sentences
            if _estimate_tokens(para) > chunk_size:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                current = ""
                for sentence in sentences:
                    if _estimate_tokens(current + " " + sentence) <= chunk_size:
                        current = (current + " " + sentence).strip() if current else sentence
                    else:
                        if current and len(current) >= min_chars:
                            chunks.append(current)
                        current = sentence
            else:
                current = para

    if current and len(current) >= min_chars:
        chunks.append(current)
    elif current and chunks:
        # Merge small tail into last chunk
        chunks[-1] = chunks[-1] + "\n\n" + current

    return chunks


def create_chunks(
    doc_id: str,
    tenant_id: str,
    parsed: ParsedDocument,
) -> list[Chunk]:
    """Create chunks from a parsed document with metadata."""
    chunks_text = chunk_text(parsed.text)
    result: list[Chunk] = []

    for i, text in enumerate(chunks_text):
        # Try to find which page/section this chunk belongs to
        page_num = _find_page_number(text, parsed)
        section = _find_section(text, parsed)

        chunk = Chunk(
            chunk_id=_make_deterministic_chunk_id(doc_id, i, text),
            document_id=doc_id,
            tenant_id=tenant_id,
            chunk_index=i,
            content=text,
            page_number=page_num,
            section=section,
            metadata={
                "format": parsed.format,
                "filename": parsed.metadata.get("title", ""),
            },
            content_hash=hashlib.sha256(text.encode()).hexdigest(),
        )
        result.append(chunk)

    logger.info("Created %d chunks for document %s", len(result), doc_id)
    return result


def _find_page_number(text: str, parsed: ParsedDocument) -> int | None:
    """Find which page a chunk's text primarily belongs to."""
    if not parsed.pages:
        return None

    best_page = 1
    best_overlap = 0

    # Check first 100 chars for overlap
    snippet = text[:100]
    for page in parsed.pages:
        if snippet in page.text:
            return page.page_number
        # Partial overlap
        overlap = sum(1 for c in snippet if c in page.text)
        if overlap > best_overlap:
            best_overlap = overlap
            best_page = page.page_number

    return best_page


def _find_section(text: str, parsed: ParsedDocument) -> str | None:
    """Find which section a chunk belongs to."""
    if not parsed.pages:
        return None

    snippet = text[:200]
    for page in parsed.pages:
        for section in page.sections:
            if section in snippet:
                return section

    return None
