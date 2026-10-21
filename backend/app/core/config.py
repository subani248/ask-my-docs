"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_LOG_LEVEL: str = "INFO"

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "ask_my_docs"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""

    # JWT Authentication
    JWT_SECRET_KEY: str = "change-me-in-production-use-a-real-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Document Storage
    STORAGE_DIR: str = "../storage"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Ingestion
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50
    MIN_CHUNK_SIZE: int = 100
    MAX_CHUNK_SIZE: int = 1024

    # Embedding
    EMBEDDING_PROVIDER: str = "gemini"
    EMBEDDING_MODEL: str = "gemini-embedding-2"
    EMBEDDING_DIMENSION: int = 3072
    EMBEDDING_BATCH_SIZE: int = 100
    GOOGLE_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""

    # Retrieval
    VECTOR_TOP_K: int = 20
    BM25_TOP_K: int = 20
    HYBRID_TOP_K: int = 40
    RERANK_TOP_K: int = 15
    RRF_K: int = 60
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANKER_TOP_K: int = 15
    RERANK_BATCH_SIZE: int = 16
    RERANKER_DEVICE: str = "cpu"
    RERANK_SCORE_THRESHOLD: float = -1.0
    MAX_CONTEXT_CHUNKS: int = 15
    MAX_CONTEXT_TOKENS: int = 8000
    ADJACENT_CHUNKS: int = 1
    USER_MAX_TOP_K: int = 20

    # LLM Generation (NVIDIA NIM — Nemotron 3 Ultra)
    LLM_PROVIDER: str = "nvidia"
    LLM_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b"
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    # Legacy Groq fallback
    GROQ_API_KEY: str = ""
    LLM_TEMPERATURE: float = 0.3
    LLM_MAX_OUTPUT_TOKENS: int = 4096
    LLM_TIMEOUT: int = 120

    # RAG
    MIN_QUESTION_LENGTH: int = 1
    MAX_QUESTION_LENGTH: int = 2000
    MAX_REGENERATION_ATTEMPTS: int = 1

    # Document-Level RAG
    DOCUMENT_SUMMARY_MAX_CHUNKS: int = 20
    DOCUMENT_SUMMARY_MAX_TOKENS: int = 12000

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_CURRENCY: str = "INR"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    """Cached singleton for application settings."""
    return Settings()
