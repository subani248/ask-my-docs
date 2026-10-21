"""Tests for the retrieval API endpoint."""

from unittest.mock import AsyncMock, patch

import pytest

from app.models.user import UserModel


def _mock_user() -> UserModel:
    """Create a mock user for testing."""
    return UserModel(
        id="user-test-123",
        full_name="Test User",
        email="test@example.com",
        role="user",
        is_active=True,
    )


@pytest.mark.anyio
async def test_search_requires_auth(client):
    """Unauthenticated search should return 401."""
    resp = await client.post(
        "/api/v1/retrieval/search",
        json={"query": "test", "top_k": 5},
    )
    assert resp.status_code in (401, 422)


@pytest.mark.anyio
async def test_search_empty_query(client):
    """Empty query should return 422."""
    with (
        patch("app.api.deps.decode_access_token", return_value="user-123"),
        patch("app.api.deps.get_db") as mock_get_db,
    ):
        mock_db = mock_get_db.return_value
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=_mock_user().model_dump()),
        )

        resp = await client.post(
            "/api/v1/retrieval/search",
            json={"query": "", "top_k": 5},
            cookies={"access_token": "fake-token"},
        )
        assert resp.status_code == 422


@pytest.mark.anyio
async def test_search_no_documents(client):
    """Search with no documents should return NO_DOCUMENTS."""
    with (
        patch("app.api.deps.decode_access_token", return_value="user-123"),
        patch("app.api.deps.get_db") as mock_get_db,
    ):
        mock_db = mock_get_db.return_value
        # Return mock user for auth, then 0 documents
        user_col = AsyncMock()
        user_col.find_one = AsyncMock(return_value=_mock_user().model_dump())

        docs_col = AsyncMock()
        docs_col.count_documents = AsyncMock(return_value=0)

        chunks_col = AsyncMock()
        chunks_col.find = AsyncMock(return_value=AsyncMock(__aiter__=AsyncMock(iter=iter([]))))

        mock_db.__getitem__ = lambda self, key: {
            "users": user_col,
            "documents": docs_col,
            "chunks": chunks_col,
        }.get(key, AsyncMock())

        resp = await client.post(
            "/api/v1/retrieval/search",
            json={"query": "test query", "top_k": 5},
            cookies={"access_token": "fake-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["retrieval_status"] == "NO_DOCUMENTS"
        assert data["results"] == []


@pytest.mark.anyio
async def test_search_invalid_top_k(client):
    """top_k > max should be rejected."""
    with (
        patch("app.api.deps.decode_access_token", return_value="user-123"),
        patch("app.api.deps.get_db") as mock_get_db,
    ):
        mock_db = mock_get_db.return_value
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=_mock_user().model_dump()),
        )

        resp = await client.post(
            "/api/v1/retrieval/search",
            json={"query": "test", "top_k": 50},
            cookies={"access_token": "fake-token"},
        )
        assert resp.status_code == 422  # validation error


@pytest.mark.anyio
async def test_search_get_variant(client):
    """GET variant should work."""
    with (
        patch("app.api.deps.decode_access_token", return_value="user-123"),
        patch("app.api.deps.get_db") as mock_get_db,
    ):
        mock_db = mock_get_db.return_value
        user_col = AsyncMock()
        user_col.find_one = AsyncMock(return_value=_mock_user().model_dump())

        docs_col = AsyncMock()
        docs_col.count_documents = AsyncMock(return_value=0)

        mock_db.__getitem__ = lambda self, key: {
            "users": user_col,
            "documents": docs_col,
        }.get(key, AsyncMock())

        resp = await client.get(
            "/api/v1/retrieval/search",
            params={"q": "test query", "top_k": 5},
            cookies={"access_token": "fake-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "query" in data
        assert "results" in data
        assert "retrieval_status" in data


@pytest.mark.anyio
async def test_search_response_structure(client):
    """Response should have the correct structure."""
    with (
        patch("app.api.deps.decode_access_token", return_value="user-123"),
        patch("app.api.deps.get_db") as mock_get_db,
    ):
        mock_db = mock_get_db.return_value
        user_col = AsyncMock()
        user_col.find_one = AsyncMock(return_value=_mock_user().model_dump())

        docs_col = AsyncMock()
        docs_col.count_documents = AsyncMock(return_value=0)

        mock_db.__getitem__ = lambda self, key: {
            "users": user_col,
            "documents": docs_col,
        }.get(key, AsyncMock())

        resp = await client.post(
            "/api/v1/retrieval/search",
            json={"query": "test", "top_k": 5},
            cookies={"access_token": "fake-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["query"], str)
        assert isinstance(data["results"], list)
        assert isinstance(data["retrieval_status"], str)
        assert isinstance(data["total_results"], int)
