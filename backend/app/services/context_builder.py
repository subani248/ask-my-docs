"""Context builder: assembles final retrieval results for the response."""

import logging
from dataclasses import dataclass, field

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ContextChunk:
    """A single chunk in the final context."""

    chunk_id: str
    document_id: str
    score: float
    rank: int
    content: str
    filename: str
    page_number: int | None
    section: str | None
    vector_rank: int | None = None
    bm25_rank: int | None = None
    rerank_score: float = 0.0


@dataclass
class BuiltContext:
    """The assembled context from retrieval."""

    chunks: list[ContextChunk] = field(default_factory=list)
    total_chunks: int = 0
    total_tokens_estimate: int = 0


class ContextBuilder:
    """Assembles reranked results into a structured context.

    Respects MAX_CONTEXT_CHUNKS and MAX_CONTEXT_TOKENS limits.
    Prepares context for future LLM generation (Phase 4).
    """

    def __init__(self):
        self._max_chunks = settings.MAX_CONTEXT_CHUNKS
        self._max_tokens = settings.MAX_CONTEXT_TOKENS

    def build(
        self,
        reranked_results: list,
        include_debug: bool = False,
    ) -> BuiltContext:
        """Build context from reranked results.

        Args:
            reranked_results: List of RerankedResult from the reranker.
            include_debug: If True, include debug fields (vector_rank, bm25_rank).

        Returns:
            BuiltContext with selected chunks within limits.
        """
        selected: list[ContextChunk] = []
        token_count = 0

        for i, result in enumerate(reranked_results):
            # Check chunk limit
            if len(selected) >= self._max_chunks:
                break

            content = result.content
            # Rough token estimate: ~4 chars per token
            est_tokens = max(1, len(content) // 4)

            # Check token limit
            if token_count + est_tokens > self._max_tokens:
                # Try to fit a truncated version
                remaining_tokens = self._max_tokens - token_count
                if remaining_tokens > 50:
                    content = content[: remaining_tokens * 4]
                    est_tokens = remaining_tokens
                else:
                    break

            chunk = ContextChunk(
                chunk_id=result.chunk_id,
                document_id=result.document_id,
                score=result.rerank_score if hasattr(result, "rerank_score") else result.original_fusion_score,
                rank=i + 1,
                content=content,
                filename=result.filename,
                page_number=result.page_number,
                section=result.section,
                vector_rank=result.vector_rank if include_debug else None,
                bm25_rank=result.bm25_rank if include_debug else None,
                rerank_score=result.rerank_score if hasattr(result, "rerank_score") else 0.0,
            )

            selected.append(chunk)
            token_count += est_tokens

        context = BuiltContext(
            chunks=selected,
            total_chunks=len(selected),
            total_tokens_estimate=token_count,
        )

        logger.info(
            "Context built: %d chunks, ~%d tokens",
            context.total_chunks,
            context.total_tokens_estimate,
        )

        return context
