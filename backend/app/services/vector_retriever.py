"""Vector retriever: searches Qdrant with authorization filtering."""

import logging
from dataclasses import dataclass

from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.core.config import get_settings
from app.services.embeddings import get_embedding_provider

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class VectorSearchResult:
    """A single vector search result."""

    chunk_id: str
    document_id: str
    score: float
    content: str
    filename: str
    page_number: int | None
    section: str | None


class VectorRetriever:
    """Searches Qdrant for semantically similar document chunks.

    Enforces authorization by filtering on owner_id in the payload.
    """

    def __init__(self):
        self._client = None
        self._collection = "document_chunks"
        self._embedder = get_embedding_provider()

    def _get_client(self):
        if self._client is None:
            from qdrant_client import QdrantClient

            self._client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
                timeout=10,
            )
        return self._client

    def search(
        self,
        query: str,
        owner_id: str,
        top_k: int | None = None,
        document_ids: list[str] | None = None,
    ) -> list[VectorSearchResult]:
        """Search for similar chunks, filtered by owner authorization.

        Args:
            query: Natural language query string.
            owner_id: The authenticated user's ID (used for authorization).
            top_k: Number of results to return.
            document_ids: Optional filter to specific document IDs.

        Returns:
            List of VectorSearchResult sorted by score descending.
        """
        top_k = top_k or settings.VECTOR_TOP_K

        try:
            # Embed the query
            query_vector = self._embedder.embed_query(query)
        except Exception as e:
            logger.error("Query embedding failed: %s", e)
            raise

        # Build authorization filter
        must_conditions = [
            FieldCondition(key="tenant_id", match=MatchValue(value=owner_id)),
        ]

        # Optional document filter
        if document_ids:
            from qdrant_client.models import MatchAny

            must_conditions.append(
                FieldCondition(key="document_id", match=MatchAny(any=document_ids))
            )

        search_filter = Filter(must=must_conditions)

        try:
            client = self._get_client()
            # qdrant-client >= 1.19: use query_points() instead of removed search()
            query_result = client.query_points(
                collection_name=self._collection,
                query=query_vector,
                query_filter=search_filter,
                limit=top_k,
            )
            results = query_result.points
        except Exception as e:
            logger.error("Qdrant search failed: %s", e)
            raise

        search_results = []
        for hit in results:
            payload = hit.payload or {}
            search_results.append(
                VectorSearchResult(
                    chunk_id=payload.get("chunk_id", hit.id),
                    document_id=payload.get("document_id", ""),
                    score=hit.score,
                    content="",  # Content loaded separately if needed
                    filename=payload.get("filename", ""),
                    page_number=payload.get("page_number"),
                    section=payload.get("section"),
                )
            )

        logger.info(
            "Vector search returned %d results for owner %s",
            len(search_results),
            owner_id[:8],
        )
        return search_results

    def close(self):
        """Close the Qdrant client."""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
