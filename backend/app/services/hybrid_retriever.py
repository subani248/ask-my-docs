"""Hybrid retriever: fuses vector and BM25 results using Reciprocal Rank Fusion."""

import logging
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.services.bm25_retriever import BM25Retriever
from app.services.score_normalizer import ScoreNormalizer
from app.services.vector_retriever import VectorRetriever

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class HybridResult:
    """A fused result from both vector and BM25 retrieval."""

    chunk_id: str
    document_id: str
    fusion_score: float
    vector_rank: int | None = None
    vector_score: float = 0.0
    bm25_rank: int | None = None
    bm25_score: float = 0.0
    content: str = ""
    filename: str = ""
    page_number: int | None = None
    section: str | None = None


class HybridRetriever:
    """Combines vector and BM25 retrieval using Reciprocal Rank Fusion (RRF).

    RRF score = sum(1 / (k + rank_i)) for each retrieval system.
    """

    def __init__(self):
        self._vector_retriever = VectorRetriever()
        self._bm25_retriever = BM25Retriever()
        self._rrf_k = settings.RRF_K

    def search(
        self,
        query: str,
        owner_id: str,
        top_k: int | None = None,
        document_ids: list[str] | None = None,
    ) -> list[HybridResult]:
        """Perform hybrid retrieval with RRF fusion.

        Args:
            query: Natural language query string.
            owner_id: The authenticated user's ID.
            top_k: Number of final results.
            document_ids: Optional document filter.

        Returns:
            List of HybridResult sorted by fusion_score descending.
        """
        top_k = top_k or settings.HYBRID_TOP_K

        # Retrieve from both systems
        vector_results = []
        bm25_results = []
        vector_error = None
        bm25_error = None

        try:
            vector_results = self._vector_retriever.search(
                query=query,
                owner_id=owner_id,
                top_k=settings.VECTOR_TOP_K,
                document_ids=document_ids,
            )
        except Exception as e:
            vector_error = e
            logger.warning("Vector retrieval failed: %s", e)

        try:
            bm25_results = self._bm25_retriever.search(
                query=query,
                owner_id=owner_id,
                top_k=settings.BM25_TOP_K,
                document_ids=document_ids,
            )
        except Exception as e:
            bm25_error = e
            logger.warning("BM25 retrieval failed: %s", e)

        if not vector_results and not bm25_error is None and bm25_error is not None:
            raise bm25_error
        if not bm25_results and vector_error is not None:
            raise vector_error

        # Build chunk_id -> result maps
        vector_map: dict[str, dict] = {}
        for i, r in enumerate(vector_results):
            vector_map[r.chunk_id] = {
                "chunk_id": r.chunk_id,
                "document_id": r.document_id,
                "rank": i + 1,
                "score": r.score,
                "content": r.content,
                "filename": r.filename,
                "page_number": r.page_number,
                "section": r.section,
            }

        bm25_map: dict[str, dict] = {}
        for i, r in enumerate(bm25_results):
            bm25_map[r.chunk_id] = {
                "chunk_id": r.chunk_id,
                "document_id": r.document_id,
                "rank": i + 1,
                "score": r.score,
                "content": r.content,
                "filename": r.filename,
                "page_number": r.page_number,
                "section": r.section,
            }

        # Collect all unique chunk IDs
        all_chunk_ids = set(vector_map.keys()) | set(bm25_map.keys())

        # Compute RRF fusion score for each chunk
        fused: list[HybridResult] = []
        for chunk_id in all_chunk_ids:
            fusion_score = 0.0
            vector_rank = None
            vector_score = 0.0
            bm25_rank = None
            bm25_score = 0.0
            content = ""
            filename = ""
            page_number = None
            section = None
            document_id = ""

            if chunk_id in vector_map:
                v = vector_map[chunk_id]
                vector_rank = v["rank"]
                vector_score = v["score"]
                fusion_score += 1.0 / (self._rrf_k + v["rank"])
                content = v["content"]
                filename = v["filename"]
                page_number = v["page_number"]
                section = v["section"]
                document_id = v["document_id"]

            if chunk_id in bm25_map:
                b = bm25_map[chunk_id]
                bm25_rank = b["rank"]
                bm25_score = b["score"]
                fusion_score += 1.0 / (self._rrf_k + b["rank"])
                # Prefer BM25 content if vector content is empty
                if not content:
                    content = b["content"]
                if not filename:
                    filename = b["filename"]
                if page_number is None:
                    page_number = b["page_number"]
                if section is None:
                    section = b["section"]
                if not document_id:
                    document_id = b["document_id"]

            fused.append(
                HybridResult(
                    chunk_id=chunk_id,
                    document_id=document_id,
                    fusion_score=fusion_score,
                    vector_rank=vector_rank,
                    vector_score=vector_score,
                    bm25_rank=bm25_rank,
                    bm25_score=bm25_score,
                    content=content,
                    filename=filename,
                    page_number=page_number,
                    section=section,
                )
            )

        # Sort by fusion score descending
        fused.sort(key=lambda r: r.fusion_score, reverse=True)

        logger.info(
            "Hybrid fusion: %d vector + %d BM25 → %d candidates (top %d)",
            len(vector_results),
            len(bm25_results),
            len(fused),
            top_k,
        )

        return fused[:top_k]

    @property
    def vector_retriever(self) -> VectorRetriever:
        return self._vector_retriever

    @property
    def bm25_retriever(self) -> BM25Retriever:
        return self._bm25_retriever
