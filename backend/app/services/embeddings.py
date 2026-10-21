"""Embedding provider abstraction.

Supports:
- Google Gemini (free tier, cloud-hosted)
- Local sentence-transformers (free, runs on CPU)
- Fallback random vectors (testing only)
"""

import logging
from abc import ABC, abstractmethod

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmbeddingProvider(ABC):
    """Base class for embedding providers."""

    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of document texts."""
        ...

    @abstractmethod
    def embed_query(self, text: str) -> list[float]:
        """Embed a single query text."""
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding dimension."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name."""
        ...


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Google Gemini embedding provider using the new google-genai SDK.

    Free tier available.
    Get API key at: https://aistudio.google.com/apikey
    """

    def __init__(self):
        self._model = settings.EMBEDDING_MODEL
        self._dimension = settings.EMBEDDING_DIMENSION
        self._batch_size = settings.EMBEDDING_BATCH_SIZE
        self._client = None

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        return self._client

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed documents using Gemini API with batching."""
        if not texts:
            return []

        try:
            client = self._get_client()
            all_embeddings: list[list[float]] = []

            for i in range(0, len(texts), self._batch_size):
                batch = texts[i : i + self._batch_size]
                result = client.models.embed_content(
                    model=f"models/{self._model}" if not self._model.startswith("models/") else self._model,
                    contents=batch,
                )
                batch_embeddings = [e.values for e in result.embeddings]
                all_embeddings.extend(batch_embeddings)
                logger.debug(
                    "Embedded batch %d/%d (%d texts)",
                    i // self._batch_size + 1,
                    (len(texts) + self._batch_size - 1) // self._batch_size,
                    len(batch),
                )

            return all_embeddings

        except Exception as e:
            logger.error("Gemini embedding failed: %s", e)
            raise

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query."""
        try:
            client = self._get_client()
            result = client.models.embed_content(
                model=f"models/{self._model}" if not self._model.startswith("models/") else self._model,
                contents=[text],
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error("Gemini query embedding failed: %s", e)
            raise

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def provider_name(self) -> str:
        return "gemini"


class LocalEmbeddingProvider(EmbeddingProvider):
    """Local embedding provider using sentence-transformers.

    Runs on CPU, no API key needed. Good for development and offline use.
    Default model: all-MiniLM-L6-v2 (384 dimensions).
    """

    def __init__(self, model_name: str | None = None):
        self._model_name = model_name or "all-MiniLM-L6-v2"
        self._model = None
        self._dimension = 384  # all-MiniLM-L6-v2 output dimension

    def _get_model(self):
        """Lazy-load the model on first use."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self._model_name)
                logger.info("Loaded local embedding model: %s", self._model_name)
            except ImportError:
                raise ImportError(
                    "sentence-transformers not installed. Run: pip install sentence-transformers"
                )
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed documents locally."""
        if not texts:
            return []
        model = self._get_model()
        embeddings = model.encode(texts, show_progress_bar=False)
        return [e.tolist() for e in embeddings]

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query locally."""
        model = self._get_model()
        embedding = model.encode([text], show_progress_bar=False)
        return embedding[0].tolist()

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def provider_name(self) -> str:
        return "local"


class FallbackEmbeddingProvider(EmbeddingProvider):
    """Fallback provider using random vectors for testing only."""

    def __init__(self, dim: int | None = None):
        self._dimension = dim or settings.EMBEDDING_DIMENSION

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        import random

        return [[random.random() for _ in range(self._dimension)] for _ in texts]

    def embed_query(self, text: str) -> list[float]:
        import random

        return [random.random() for _ in range(self._dimension)]

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def provider_name(self) -> str:
        return "fallback"


def get_embedding_provider() -> EmbeddingProvider:
    """Get the configured embedding provider.

    Priority:
    1. "gemini" + GOOGLE_API_KEY set → GeminiEmbeddingProvider
    2. "local" → LocalEmbeddingProvider
    3. Anything else → FallbackEmbeddingProvider
    """
    provider_name = settings.EMBEDDING_PROVIDER.lower()

    if provider_name == "gemini" and settings.GOOGLE_API_KEY:
        logger.info("Using Gemini embedding provider (model=%s)", settings.EMBEDDING_MODEL)
        return GeminiEmbeddingProvider()

    if provider_name == "local":
        logger.info("Using local embedding provider (sentence-transformers)")
        return LocalEmbeddingProvider()

    # Fallback for development/testing
    logger.warning(
        "No embedding provider configured (EMBEDDING_PROVIDER=%s, GOOGLE_API_KEY=%s). "
        "Using fallback random vectors.",
        provider_name,
        "set" if settings.GOOGLE_API_KEY else "not set",
    )
    return FallbackEmbeddingProvider()
