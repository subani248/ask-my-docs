"""Qdrant vector database client abstraction."""

import logging

from qdrant_client import QdrantClient as Qdrant

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class QdrantClientWrapper:
    """Wrapper around the Qdrant client."""

    def __init__(self, url: str | None = None, api_key: str | None = None):
        self._url = url or settings.QDRANT_URL
        self._api_key = api_key or settings.QDRANT_API_KEY or None
        self._client: Qdrant | None = None

    async def connect(self) -> None:
        """Initialize the Qdrant connection."""
        try:
            # qdrant-client is sync-only for HTTP; use httpx-based client
            if self._url and self._url.startswith("http"):
                self._client = Qdrant(
                    url=self._url,
                    api_key=self._api_key,
                    timeout=10,
                )
            else:
                self._client = Qdrant(
                    path="./qdrant_storage",
                )
            # Verify connectivity
            self._client.get_collections()
            logger.info("Qdrant connected: %s", self._url)
        except Exception as e:
            logger.error("Qdrant connection failed: %s", e)
            self._client = None
            raise

    def disconnect(self) -> None:
        """Close the Qdrant connection."""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None

    def is_healthy(self) -> bool:
        """Check if Qdrant is reachable."""
        if not self._client:
            return False
        try:
            self._client.get_collections()
            return True
        except Exception:
            return False

    @property
    def client(self) -> Qdrant | None:
        """Return the underlying Qdrant client."""
        return self._client
