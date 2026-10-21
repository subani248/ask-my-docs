"""Pytest fixtures and configuration for backend tests."""

import os

# Set test environment before importing app
os.environ["APP_ENV"] = "testing"
os.environ["APP_DEBUG"] = "true"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
os.environ["MONGODB_DB_NAME"] = "ask_my_docs_test"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from app.main import app
from app.db import database


@pytest.fixture(autouse=True)
def setup_test_db():
    """Set up a mock MongoDB for each test."""
    try:
        from mongomock_motor import AsyncMongoMockClient

        mock_client = AsyncMongoMockClient()
        test_db = mock_client["ask_my_docs_test"]

        # Patch the database module
        with patch.object(database, "client", mock_client), \
             patch.object(database, "db", test_db):
            yield
    except ImportError:
        # If mongomock_motor not installed, tests that need DB will be skipped
        yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
