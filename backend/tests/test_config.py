"""Tests for configuration loading."""

import os
import pytest

# Ensure test environment
os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "ask_my_docs_test")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from app.core.config import get_settings


def test_settings_loads_defaults():
    """Settings should load with defaults when env vars are set."""
    settings = get_settings()
    assert settings.APP_ENV in ("development", "testing", "production")
    assert settings.MONGODB_URL.startswith("mongodb://")
    assert settings.QDRANT_URL.startswith("http://") or settings.QDRANT_URL.startswith("https://")


def test_cors_origins_parsed():
    """CORS origins should be parsed from comma-separated string."""
    settings = get_settings()
    origins = settings.cors_origins_list
    assert isinstance(origins, list)
    assert all(isinstance(o, str) for o in origins)


def test_is_development_flag():
    """is_development should reflect APP_ENV."""
    settings = get_settings()
    if settings.APP_ENV == "development":
        assert settings.is_development is True
    elif settings.APP_ENV == "testing":
        assert settings.is_development is False
