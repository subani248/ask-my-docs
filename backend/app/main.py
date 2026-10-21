"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.ask import router as ask_router
from app.api.conversations import router as conversations_router
from app.api.retrieval import router as retrieval_router
from app.api.stats import router as stats_router
from app.api.payments import router as payments_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.db.database import close_db, connect_db
from app.db.qdrant import QdrantClientWrapper

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    settings = get_settings()

    setup_logging(settings.APP_LOG_LEVEL)
    logger.info("Starting application in %s mode", settings.APP_ENV)

    # Connect to MongoDB
    try:
        await connect_db()
    except Exception as e:
        logger.error("MongoDB connection failed: %s", e)

    # Initialize Qdrant
    qdrant = QdrantClientWrapper()
    try:
        await qdrant.connect()
    except Exception:
        logger.warning("Qdrant not available — running without vector DB")
    app.state.qdrant = qdrant

    logger.info("Application started")
    yield

    logger.info("Shutting down application")
    qdrant.disconnect()
    await close_db()
    logger.info("Application shut down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Ask My Docs",
        description="Production RAG application for document-based Q&A",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.APP_DEBUG else None,
        redoc_url="/redoc" if settings.APP_DEBUG else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(documents_router)
    app.include_router(retrieval_router)
    app.include_router(ask_router)
    app.include_router(conversations_router)
    app.include_router(stats_router)
    app.include_router(payments_router)

    return app


app = create_app()
