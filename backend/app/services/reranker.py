"""Cross-encoder reranker for improving retrieval quality."""

import logging
from dataclasses import dataclass

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class RerankedResult:
    """A result after cross-encoder reranking."""

    chunk_id: str
    document_id: str
    rerank_score: float
    original_fusion_score: float
    vector_rank: int | None
    bm25_rank: int | None
    content: str
    filename: str
    page_number: int | None
    section: str | None


class CrossEncoderReranker:
    """Reranks candidates using a cross-encoder model.

    Uses sentence-transformers CrossEncoder for scoring (query, chunk) pairs.
    Supports batching and CPU/GPU configuration.
    """

    def __init__(self):
        self._model = None
        self._model_name = settings.RERANKER_MODEL
        self._batch_size = settings.RERANK_BATCH_SIZE
        self._device = settings.RERANKER_DEVICE

    def _get_model(self):
        """Lazy-load the cross-encoder model."""
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder

                self._model = CrossEncoder(
                    self._model_name,
                    max_length=512,
                    device=self._device,
                )
                logger.info(
                    "Loaded cross-encoder reranker: %s (device=%s)",
                    self._model_name,
                    self._device,
                )
            except ImportError:
                raise ImportError(
                    "sentence-transformers not installed. "
                    "Run: pip install sentence-transformers"
                )
        return self._model

    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int | None = None,
    ) -> list[RerankedResult]:
        """Rerank candidates using cross-encoder scoring.

        Args:
            query: The original query string.
            candidates: List of candidate dicts with chunk_id, content, etc.
            top_k: Number of results to return after reranking.

        Returns:
            List of RerankedResult sorted by rerank_score descending.
        """
        top_k = top_k or settings.RERANKER_TOP_K

        if not candidates:
            return []

        model = self._get_model()

        # Build query-document pairs
        pairs = []
        for c in candidates:
            content = c.get("content", "")
            # Truncate long content to fit model max length
            if len(content) > 2000:
                content = content[:2000]
            pairs.append([query, content])

        # Batch scoring
        all_scores: list[float] = []
        for i in range(0, len(pairs), self._batch_size):
            batch = pairs[i : i + self._batch_size]
            batch_scores = model.predict(batch, show_progress_bar=False)
            all_scores.extend(batch_scores.tolist() if hasattr(batch_scores, 'tolist') else list(batch_scores))

        # Build results with scores
        reranked: list[RerankedResult] = []
        for candidate, score in zip(candidates, all_scores):
            reranked.append(
                RerankedResult(
                    chunk_id=candidate.get("chunk_id", ""),
                    document_id=candidate.get("document_id", ""),
                    rerank_score=float(score),
                    original_fusion_score=candidate.get("fusion_score", 0.0),
                    vector_rank=candidate.get("vector_rank"),
                    bm25_rank=candidate.get("bm25_rank"),
                    content=candidate.get("content", ""),
                    filename=candidate.get("filename", ""),
                    page_number=candidate.get("page_number"),
                    section=candidate.get("section"),
                )
            )

        # Sort by rerank score descending
        reranked.sort(key=lambda r: r.rerank_score, reverse=True)

        # Apply score threshold
        threshold = settings.RERANK_SCORE_THRESHOLD
        if threshold > 0:
            reranked = [r for r in reranked if r.rerank_score >= threshold]

        logger.info(
            "Reranked %d candidates → %d results (top %d)",
            len(candidates),
            len(reranked),
            top_k,
        )

        return reranked[:top_k]
