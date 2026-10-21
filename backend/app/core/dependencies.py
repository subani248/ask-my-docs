"""FastAPI dependencies for database and Qdrant."""

from collections.abc import AsyncGenerator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session_factory
from app.db.qdrant import QdrantClientWrapper


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_qdrant(request: Request) -> QdrantClientWrapper:
    """Get the Qdrant client from app state."""
    return request.app.state.qdrant
