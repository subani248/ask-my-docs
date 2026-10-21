"""Tests for authentication endpoints."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from app.main import app
from app.models.user import UserModel
from app.services.auth import hash_password, verify_password


def _make_user(
    id: str = "test-user-id",
    full_name: str = "Test User",
    email: str = "test@example.com",
    role: str = "user",
    is_active: bool = True,
) -> UserModel:
    return UserModel(
        id=id,
        full_name=full_name,
        email=email,
        password_hash=hash_password("TestPass123!"),
        role=role,
        is_active=is_active,
    )


@pytest.fixture
async def client():
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Register ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_register_success(client: AsyncClient):
    mock_user = _make_user(email="new@example.com", full_name="New User")

    with (
        patch("app.api.auth.get_db") as mock_get_db,
        patch("app.services.auth.hash_password", return_value="hashed"),
    ):
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=None),
            insert_one=AsyncMock(),
        )
        mock_get_db.return_value = mock_db

        resp = await client.post(
            "/api/v1/auth/register",
            json={"full_name": "New User", "email": "new@example.com", "password": "StrongPass1!"},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "new@example.com"
    assert "access_token" in data


@pytest.mark.anyio
async def test_register_duplicate_email(client: AsyncClient):
    with patch("app.api.auth.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value={"email": "dup@example.com"}),
        )
        mock_get_db.return_value = mock_db

        resp = await client.post(
            "/api/v1/auth/register",
            json={"full_name": "Dup", "email": "dup@example.com", "password": "StrongPass1!"},
        )
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_register_invalid_email(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Bad", "email": "not-an-email", "password": "StrongPass1!"},
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_register_weak_password(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Weak", "email": "weak@example.com", "password": "123"},
    )
    assert resp.status_code == 422


# ── Login ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_login_success(client: AsyncClient):
    mock_user = _make_user()

    with patch("app.api.auth.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=mock_user.model_dump()),
        )
        mock_get_db.return_value = mock_db

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPass123!"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "test@example.com"
    assert "access_token" in data


@pytest.mark.anyio
async def test_login_wrong_password(client: AsyncClient):
    mock_user = _make_user()

    with patch("app.api.auth.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=mock_user.model_dump()),
        )
        mock_get_db.return_value = mock_db

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "WrongPassword1!"},
        )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_login_unknown_email(client: AsyncClient):
    with patch("app.api.auth.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=None),
        )
        mock_get_db.return_value = mock_db

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "unknown@example.com", "password": "anything"},
        )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_login_inactive_user(client: AsyncClient):
    inactive = _make_user(is_active=False)

    with patch("app.api.auth.get_db") as mock_get_db:
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=inactive.model_dump()),
        )
        mock_get_db.return_value = mock_db

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@example.com", "password": "TestPass123!"},
        )
    assert resp.status_code == 403


# ── /auth/me ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_me_authenticated(client: AsyncClient):
    mock_user = _make_user()

    with (
        patch("app.api.deps.decode_access_token", return_value="test-user-id"),
        patch("app.api.deps.get_db") as mock_get_db,
    ):
        mock_db = AsyncMock()
        mock_db.__getitem__ = lambda self, key: AsyncMock(
            find_one=AsyncMock(return_value=mock_user.model_dump()),
        )
        mock_get_db.return_value = mock_db

        resp = await client.get(
            "/api/v1/auth/me",
            cookies={"access_token": "valid-token"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert "password" not in str(data)


@pytest.mark.anyio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


# ── Logout ────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_logout(client: AsyncClient):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out successfully"


# ── Password hashing ──────────────────────────────────────────


def test_password_is_hashed():
    raw = "MySecurePassword123!"
    h = hash_password(raw)
    assert h != raw
    assert verify_password(raw, h)


def test_password_hash_not_returned():
    from app.schemas.auth import UserResponse

    resp = UserResponse(
        id="x", full_name="T", email="t@e.com", role="user", is_active=True
    )
    assert "password" not in resp.model_dump()
    assert "password_hash" not in resp.model_dump()
