"""RAG context builder: assigns citation IDs and formats context for LLM generation."""

import logging
from dataclasses import dataclass, field

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class CitationChunk:
    """A chunk with its assigned citation ID."""

    citation_id: str
    chunk_id: str
    document_id: str
    filename: str
    page_number: int | None
    section: str | None
    content: str
    score: float
    rank: int


@dataclass
class BuiltRAGContext:
    """The built context ready for LLM consumption."""

    chunks: list[CitationChunk] = field(default_factory=list)
    context_text: str = ""
    citation_map: dict[str, CitationChunk] = field(default_factory=dict)
    total_tokens_estimate: int = 0


class RAGContextBuilder:
    """Builds LLM-ready context from retrieved chunks with citation IDs.

    Assigns C1, C2, C3... citation IDs and builds a formatted context
    string for the LLM with <retrieved_context> boundaries.
    """

    def __init__(self):
        self._max_chunks = settings.MAX_CONTEXT_CHUNKS
        self._max_tokens = settings.MAX_CONTEXT_TOKENS

    def build(self, retrieved_results: list) -> BuiltRAGContext:
        """Build context from retrieved results.

        Args:
            retrieved_results: List of RetrievalResult or similar from Phase 3.

        Returns:
            BuiltRAGContext with formatted context text and citation map.
        """
        # Deduplicate by chunk_id, keeping highest score
        seen = {}
        for r in retrieved_results:
            chunk_id = r.chunk_id if hasattr(r, "chunk_id") else r.get("chunk_id", "")
            score = r.score if hasattr(r, "score") else r.get("score", 0)
            if chunk_id not in seen or score > seen[chunk_id][1]:
                seen[chunk_id] = (r, score)

        # Sort by score descending
        deduped = sorted(seen.values(), key=lambda x: x[1], reverse=True)

        chunks: list[CitationChunk] = []
        token_count = 0

        for i, (result, _score) in enumerate(deduped):
            if len(chunks) >= self._max_chunks:
                break

            content = result.content if hasattr(result, "content") else result.get("content", "")
            est_tokens = max(1, len(content) // 4)

            if token_count + est_tokens > self._max_tokens:
                remaining = self._max_tokens - token_count
                if remaining > 50:
                    content = content[: remaining * 4]
                    est_tokens = remaining
                else:
                    break

            citation_id = f"C{i + 1}"

            chunk = CitationChunk(
                citation_id=citation_id,
                chunk_id=result.chunk_id if hasattr(result, "chunk_id") else result.get("chunk_id", ""),
                document_id=result.document_id if hasattr(result, "document_id") else result.get("document_id", ""),
                filename=result.metadata.filename if hasattr(result, "metadata") else result.get("metadata", {}).get("filename", "unknown"),
                page_number=result.metadata.page_number if hasattr(result, "metadata") else result.get("metadata", {}).get("page_number"),
                section=result.metadata.section if hasattr(result, "metadata") else result.get("metadata", {}).get("section"),
                content=content,
                score=result.score if hasattr(result, "score") else result.get("score", 0),
                rank=result.rank if hasattr(result, "rank") else result.get("rank", i + 1),
            )

            chunks.append(chunk)
            token_count += est_tokens

        # Build formatted context text
        context_parts = []
        for chunk in chunks:
            meta_lines = [f"Document: {chunk.filename}"]
            if chunk.page_number:
                meta_lines.append(f"Page: {chunk.page_number}")
            if chunk.section:
                meta_lines.append(f"Section: {chunk.section}")
            meta_lines.append(f"Citation ID: {chunk.citation_id}")
            meta_lines.append("")
            meta_lines.append(chunk.content)

            context_parts.append("\n".join(meta_lines))

        context_text = "\n\n---\n\n".join(context_parts)

        # Wrap in retrieved_context tags for injection defense
        full_context = f"<retrieved_context>\n{context_text}\n</retrieved_context>"

        citation_map = {c.citation_id: c for c in chunks}

        logger.info(
            "RAG context built: %d chunks, ~%d tokens, %d citations",
            len(chunks),
            token_count,
            len(chunks),
        )

        return BuiltRAGContext(
            chunks=chunks,
            context_text=full_context,
            citation_map=citation_map,
            total_tokens_estimate=token_count,
        )
