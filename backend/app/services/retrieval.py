"""Retrieval service: orchestrates the full hybrid retrieval pipeline.

Flow:
  validate query
  → authorize user
  → vector search
  → BM25 search
  → hybrid fusion
  → rerank
  → threshold filter
  → context build
  → return results
"""

import logging
import time

from app.core.config import get_settings
from app.db.database import CHUNKS, DOCUMENTS, get_db
from app.schemas.retrieval import (
    RetrievalResult,
    RetrievalResultMetadata,
    RetrievalStatus,
    RetrievalTrace,
    SearchResponse,
)
from app.services.context_builder import ContextBuilder
from app.services.hybrid_retriever import HybridRetriever

logger = logging.getLogger(__name__)
settings = get_settings()


class RetrievalService:
    """Orchestrates the complete retrieval pipeline.

    Combines vector search, BM25, hybrid fusion, cross-encoder reranking,
    and context building into a single service.
    """

    def __init__(self):
        self._hybrid = HybridRetriever()
        self._reranker = None  # Lazy-loaded
        self._context_builder = ContextBuilder()

    def _get_reranker(self):
        """Lazy-load the cross-encoder reranker."""
        if self._reranker is None:
            from app.services.reranker import CrossEncoderReranker

            self._reranker = CrossEncoderReranker()
        return self._reranker

    async def search(
        self,
        query: str,
        owner_id: str,
        top_k: int = 8,
        document_ids: list[str] | None = None,
        include_trace: bool = False,
    ) -> SearchResponse:
        """Execute the full retrieval pipeline.

        Args:
            query: Natural language query.
            owner_id: Authenticated user's ID.
            top_k: Number of final results (max 20).
            document_ids: Optional document filter.
            include_trace: Whether to include debug trace info.

        Returns:
            SearchResponse with results and status.
        """
        # Validate query
        query = query.strip()
        if not query:
            return SearchResponse(
                query=query,
                results=[],
                retrieval_status=RetrievalStatus.INVALID_QUERY,
                total_results=0,
            )

        # Clamp top_k
        top_k = min(max(1, top_k), settings.USER_MAX_TOP_K)

        # Check if user has any ready documents
        db = get_db()
        doc_count = await db[DOCUMENTS].count_documents(
            {"owner_id": owner_id, "status": "ready"}
        )
        if doc_count == 0:
            return SearchResponse(
                query=query,
                results=[],
                retrieval_status=RetrievalStatus.NO_DOCUMENTS,
                total_results=0,
            )

        trace = RetrievalTrace() if include_trace else None
        t_total_start = time.time()

        try:
            # Step 1: Hybrid retrieval (vector + BM25 + RRF fusion)
            t_hybrid_start = time.time()
            hybrid_results = self._hybrid.search(
                query=query,
                owner_id=owner_id,
                top_k=settings.HYBRID_TOP_K,
                document_ids=document_ids,
            )
            t_hybrid_ms = (time.time() - t_hybrid_start) * 1000

            if trace:
                vector_count = sum(
                    1 for r in hybrid_results if r.vector_rank is not None
                )
                bm25_count = sum(
                    1 for r in hybrid_results if r.bm25_rank is not None
                )
                trace.vector_candidates = vector_count
                trace.bm25_candidates = bm25_count
                trace.hybrid_candidates = len(hybrid_results)
                trace.latency_ms["hybrid"] = round(t_hybrid_ms, 1)

            if not hybrid_results:
                if trace:
                    trace.latency_ms["total"] = round(
                        (time.time() - t_total_start) * 1000, 1
                    )
                return SearchResponse(
                    query=query,
                    results=[],
                    retrieval_status=RetrievalStatus.NO_RELEVANT_CONTEXT,
                    total_results=0,
                    trace=trace,
                )

            # Step 2: Rerank with cross-encoder
            t_rerank_start = time.time()
            try:
                reranker = self._get_reranker()
                candidates = [
                    {
                        "chunk_id": r.chunk_id,
                        "document_id": r.document_id,
                        "content": r.content,
                        "fusion_score": r.fusion_score,
                        "vector_rank": r.vector_rank,
                        "bm25_rank": r.bm25_rank,
                        "filename": r.filename,
                        "page_number": r.page_number,
                        "section": r.section,
                    }
                    for r in hybrid_results
                ]
                reranked = reranker.rerank(
                    query=query,
                    candidates=candidates,
                    top_k=min(top_k, settings.RERANKER_TOP_K),
                )
            except Exception as e:
                logger.warning(
                    "Reranker failed, falling back to fusion order: %s", e
                )
                # Degraded: use hybrid results without reranking
                from app.services.reranker import RerankedResult

                reranked = [
                    RerankedResult(
                        chunk_id=r.chunk_id,
                        document_id=r.document_id,
                        rerank_score=r.fusion_score,
                        original_fusion_score=r.fusion_score,
                        vector_rank=r.vector_rank,
                        bm25_rank=r.bm25_rank,
                        content=r.content,
                        filename=r.filename,
                        page_number=r.page_number,
                        section=r.section,
                    )
                    for r in hybrid_results[:top_k]
                ]

            t_rerank_ms = (time.time() - t_rerank_start) * 1000

            if trace:
                trace.reranked_candidates = len(reranked)
                trace.latency_ms["reranker"] = round(t_rerank_ms, 1)

            # Step 3: Load chunk content and metadata from MongoDB if not already available
            chunk_ids = [r.chunk_id for r in reranked]
            chunk_docs = {}
            if chunk_ids:
                cursor = db[CHUNKS].find(
                    {"id": {"$in": chunk_ids}},
                    {"_id": 0, "id": 1, "content": 1, "document_id": 1},
                )
                async for doc in cursor:
                    chunk_docs[doc["id"]] = doc

            # Fill in content from MongoDB
            for r in reranked:
                if not r.content and r.chunk_id in chunk_docs:
                    r.content = chunk_docs[r.chunk_id].get("content", "")

            # Fill in missing filenames from MongoDB documents
            doc_ids_needing_names = set()
            for r in reranked:
                if not r.filename and r.chunk_id in chunk_docs:
                    doc_ids_needing_names.add(chunk_docs[r.chunk_id].get("document_id", r.document_id))
                elif not r.filename:
                    doc_ids_needing_names.add(r.document_id)

            filename_map = {}
            if doc_ids_needing_names:
                doc_cursor = db[DOCUMENTS].find(
                    {"id": {"$in": list(doc_ids_needing_names)}},
                    {"_id": 0, "id": 1, "original_filename": 1},
                )
                async for doc in doc_cursor:
                    filename_map[doc["id"]] = doc.get("original_filename", "")

            for r in reranked:
                if not r.filename:
                    r.filename = filename_map.get(r.document_id, "Unknown")

            # Step 4: Build context
            t_context_start = time.time()
            built_context = self._context_builder.build(
                reranked_results=reranked,
                include_debug=include_trace,
            )
            t_context_ms = (time.time() - t_context_start) * 1000

            # Step 5: Format response
            results = []
            for chunk in built_context.chunks:
                results.append(
                    RetrievalResult(
                        chunk_id=chunk.chunk_id,
                        document_id=chunk.document_id,
                        score=round(chunk.score, 4),
                        rank=chunk.rank,
                        content=chunk.content,
                        metadata=RetrievalResultMetadata(
                            filename=chunk.filename,
                            page_number=chunk.page_number,
                            section=chunk.section,
                        ),
                    )
                )

            t_total_ms = (time.time() - t_total_start) * 1000

            if trace:
                trace.latency_ms["context"] = round(t_context_ms, 1)
                trace.latency_ms["total"] = round(t_total_ms, 1)

            status = (
                RetrievalStatus.SUCCESS
                if results
                else RetrievalStatus.NO_RELEVANT_CONTEXT
            )

            logger.info(
                "Retrieval complete: query='%s' → %d results (%.0fms) [user=%s]",
                query[:50],
                len(results),
                t_total_ms,
                owner_id[:8],
            )

            return SearchResponse(
                query=query,
                results=results,
                retrieval_status=status,
                total_results=len(results),
                trace=trace,
            )

        except Exception as e:
            logger.exception("Retrieval pipeline failed for query: %s", query[:50])
            t_total_ms = (time.time() - t_total_start) * 1000
            if trace:
                trace.latency_ms["total"] = round(t_total_ms, 1)
            return SearchResponse(
                query=query,
                results=[],
                retrieval_status=RetrievalStatus.NO_RELEVANT_CONTEXT,
                total_results=0,
                trace=trace,
            )
