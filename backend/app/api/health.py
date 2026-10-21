"""Health and readiness check endpoints."""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.db.database import check_database_connection
from app.db.qdrant import QdrantClientWrapper

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Liveness probe — is the API process running?"""
    return {
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/ready")
async def readiness_check(request: Request) -> dict:
    """Readiness probe — can the API serve requests?"""
    checks: dict[str, str] = {}

    db_ok = await check_database_connection()
    checks["mongodb"] = "ok" if db_ok else "error"

    qdrant: QdrantClientWrapper = request.app.state.qdrant
    qdrant_ok = qdrant.is_healthy()
    checks["qdrant"] = "ok" if qdrant_ok else "error"

    all_ok = all(v == "ok" for v in checks.values())

    return {
        "status": "ready" if all_ok else "not_ready",
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": checks,
    }
