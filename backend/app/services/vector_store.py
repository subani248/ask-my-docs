"""Vector store abstraction with Qdrant implementation."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

COLLECTION_NAME = "document_chunks"


@dataclass
class VectorPoint:
    """A point to upsert into the vector store."""

    id: str
    vector: list[float]
    payload: dict


class VectorStore(ABC):
    """Base class for vector stores."""

    @abstractmethod
    def upsert(self, points: list[VectorPoint]) -> bool:
        """Upsert vector points."""
        ...

    @abstractmethod
    def delete_by_document(self, document_id: str) -> bool:
        """Delete all vectors for a document."""
        ...

    @abstractmethod
    def ensure_collection(self, dimension: int) -> bool:
        """Create collection if it doesn't exist."""
        ...


class QdrantVectorStore(VectorStore):
    """Qdrant vector store implementation."""

    def __init__(self):
        self._client = None
        self._collection = COLLECTION_NAME

    def _get_client(self):
        if self._client is None:
            from qdrant_client import QdrantClient

            self._client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
                timeout=10,
            )
        return self._client

    def ensure_collection(self, dimension: int) -> bool:
        """Create collection if it doesn't exist, or recreate if dimension changed."""
        try:
            client = self._get_client()
            collections = client.get_collections().collections
            names = [c.name for c in collections]

            if self._collection in names:
                # Check if dimension matches
                info = client.get_collection(self._collection)
                existing_dim = info.config.params.vectors.size
                if existing_dim != dimension:
                    logger.warning(
                        "Collection dimension mismatch (%d vs %d), recreating",
                        existing_dim, dimension,
                    )
                    client.delete_collection(self._collection)
                    # Fall through to create below
                else:
                    return True

            from qdrant_client.models import Distance, PayloadSchemaType, VectorParams

            client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(
                    size=dimension,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("Created Qdrant collection: %s (dim=%d)", self._collection, dimension)

            # Create payload indexes for filtered search (required by qdrant-client >= 1.19)
            for field in ("tenant_id", "document_id"):
                try:
                    client.create_payload_index(
                        collection_name=self._collection,
                        field_name=field,
                        field_schema=PayloadSchemaType.KEYWORD,
                    )
                except Exception as idx_err:
                    logger.warning("Failed to create index for %s: %s", field, idx_err)

            return True
        except Exception as e:
            logger.error("Failed to ensure Qdrant collection: %s", e)
            return False

    def upsert(self, points: list[VectorPoint]) -> bool:
        """Upsert vector points into Qdrant."""
        if not points:
            return True

        from qdrant_client.models import PointStruct

        client = self._get_client()
        qdrant_points = [
            PointStruct(
                id=p.id,
                vector=p.vector,
                payload=p.payload,
            )
            for p in points
        ]
        client.upsert(
            collection_name=self._collection,
            points=qdrant_points,
        )
        logger.info("Upserted %d points to Qdrant", len(points))
        return True

    def delete_by_document(self, document_id: str) -> bool:
        """Delete all vectors for a document."""
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            client = self._get_client()
            client.delete(
                collection_name=self._collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=document_id),
                        )
                    ]
                ),
            )
            logger.info("Deleted vectors for document %s", document_id)
            return True
        except Exception as e:
            logger.error("Qdrant delete failed: %s", e)
            return False


class FallbackVectorStore(VectorStore):
    """In-memory fallback vector store for development/testing."""

    def __init__(self):
        self._points: dict[str, VectorPoint] = {}

    def ensure_collection(self, dimension: int) -> bool:
        return True

    def upsert(self, points: list[VectorPoint]) -> bool:
        for p in points:
            self._points[p.id] = p
        return True

    def delete_by_document(self, document_id: str) -> bool:
        to_remove = [
            pid
            for pid, p in self._points.items()
            if p.payload.get("document_id") == document_id
        ]
        for pid in to_remove:
            del self._points[pid]
        return True


def get_vector_store() -> VectorStore:
    """Get the configured vector store."""
    try:
        store = QdrantVectorStore()
        store._get_client().get_collections()
        return store
    except Exception:
        logger.warning("Qdrant not available, using fallback vector store")
        return FallbackVectorStore()
