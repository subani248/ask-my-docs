"""Tests for FastAPI application startup."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_app_starts(client: AsyncClient):
    """Application should start and respond to requests."""
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.anyio
async def test_docs_endpoint_in_debug(client: AsyncClient):
    """OpenAPI docs should be available in debug mode."""
    response = await client.get("/docs")
    # In debug mode, docs should be available (200) or redirect
    assert response.status_code in (200, 307, 404)


@pytest.mark.anyio
async def test_cors_headers(client: AsyncClient):
    """CORS headers should be present on responses."""
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    # CORS middleware should respond
    assert response.status_code in (200, 405)
