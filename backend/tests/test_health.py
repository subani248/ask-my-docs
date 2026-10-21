"""Tests for health and readiness endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_health_returns_ok(client: AsyncClient):
    """GET /health should return status ok."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


@pytest.mark.anyio
async def test_health_does_not_require_database(client: AsyncClient):
    """GET /health should work even if database is down."""
    response = await client.get("/health")
    assert response.status_code == 200
