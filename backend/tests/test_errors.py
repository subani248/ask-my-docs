"""Tests for error handling."""

import pytest
from httpx import AsyncClient

from app.core.errors import AppError, NotFoundError, ServiceUnavailableError, ValidationError
from app.main import app


def test_app_error_base():
    """AppError should set message and status code."""
    err = AppError("test error", status_code=400)
    assert err.message == "test error"
    assert err.status_code == 400
    assert str(err) == "test error"


def test_not_found_error():
    """NotFoundError should format message with resource."""
    err = NotFoundError("User", "abc123")
    assert "User" in err.message
    assert "abc123" in err.message
    assert err.status_code == 404


def test_service_unavailable_error():
    """ServiceUnavailableError should reference the service."""
    err = ServiceUnavailableError("Valkey")
    assert "Valkey" in err.message
    assert err.status_code == 503


def test_validation_error():
    """ValidationError should accept detail."""
    err = ValidationError("bad input", detail={"field": "email"})
    assert err.status_code == 422
    assert err.detail == {"field": "email"}


@pytest.mark.anyio
async def test_unhandled_error_returns_500(client: AsyncClient):
    """Unhandled exceptions should return 500 without stack trace."""
    from starlette.testclient import TestClient
    from app.main import app as _app

    with TestClient(_app, raise_server_exceptions=False) as tc:

        @_app.get("/test-crash")
        async def crash():
            raise RuntimeError("boom")

        try:
            response = tc.get("/test-crash")
            assert response.status_code == 500
            data = response.json()
            assert "error" in data
            # Must NOT expose internal details
            assert "boom" not in data.get("error", "")
        finally:
            _app.routes.pop()
