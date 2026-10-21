"""Tests for document management and ingestion pipeline."""

import os
import tempfile

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.api.deps import get_current_user
from app.main import app
from app.models.user import UserModel
from app.services.auth import hash_password
from app.services.parsers import (
    DocumentParser,
    PDFParser,
    DOCXParser,
    TXTParser,
    MarkdownParser,
    ParsedDocument,
    get_parser,
)
from app.services.cleaning import clean_text
from app.services.chunker import chunk_text, create_chunks, _make_deterministic_chunk_id


def _mock_user() -> UserModel:
    return UserModel(
        id="user-123",
        full_name="Test User",
        email="test@example.com",
        password_hash=hash_password("TestPass1!"),
        role="user",
        is_active=True,
    )


@pytest.fixture(autouse=True)
def _override_auth():
    app.dependency_overrides[get_current_user] = _mock_user
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Parser Format Detection ──────────────────────────────────

def test_detect_pdf():
    assert DocumentParser.detect_format("report.pdf") == "pdf"

def test_detect_docx():
    assert DocumentParser.detect_format("report.docx") == "docx"

def test_detect_txt():
    assert DocumentParser.detect_format("notes.txt") == "txt"

def test_detect_markdown():
    assert DocumentParser.detect_format("readme.md") == "markdown"

def test_detect_unknown():
    assert DocumentParser.detect_format("file.xyz") == "unknown"

def test_get_parser_pdf():
    assert isinstance(get_parser("test.pdf"), PDFParser)

def test_get_parser_docx():
    assert isinstance(get_parser("test.docx"), DOCXParser)

def test_get_parser_txt():
    assert isinstance(get_parser("test.txt"), TXTParser)

def test_get_parser_md():
    assert isinstance(get_parser("test.md"), MarkdownParser)

def test_get_parser_unknown_raises():
    with pytest.raises(ValueError, match="Unsupported"):
        get_parser("test.xyz")


# ── TXT Parsing ──────────────────────────────────────────────

def test_parse_txt():
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False, encoding="utf-8") as f:
        f.write("Hello world\nSecond line\n")
        path = f.name
    try:
        result = TXTParser().parse(path)
        assert isinstance(result, ParsedDocument)
        assert "Hello world" in result.text
        assert result.format == "txt"
    finally:
        os.unlink(path)

def test_parse_empty_txt():
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False, encoding="utf-8") as f:
        f.write("")
        path = f.name
    try:
        result = TXTParser().parse(path)
        assert result.text == ""
    finally:
        os.unlink(path)


# ── Markdown Parsing ─────────────────────────────────────────

def test_parse_markdown():
    content = "# Title\n\nSome text.\n\n## Section\n\nMore content.\n"
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False, encoding="utf-8") as f:
        f.write(content)
        path = f.name
    try:
        result = MarkdownParser().parse(path)
        assert "Title" in result.text
        assert result.format == "markdown"
        assert "Title" in result.pages[0].sections
    finally:
        os.unlink(path)


# ── Text Cleaning ────────────────────────────────────────────

def test_clean_text_normalizes_whitespace():
    dirty = "Hello  \t  world\r\n\r\n\n\n\nNew paragraph"
    clean = clean_text(dirty)
    assert "\r" not in clean
    assert "\n\n\n" not in clean

def test_clean_empty_text():
    assert clean_text("") == ""

def test_clean_preserves_content():
    text = "Important number: 42. Section: Intro."
    assert clean_text(text) == text


# ── Chunking ─────────────────────────────────────────────────

def test_chunk_text_basic():
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    chunks = chunk_text(text, chunk_size=50, chunk_overlap=10, min_chunk_size=5)
    assert len(chunks) >= 1

def test_chunk_text_empty():
    assert chunk_text("") == []

def test_chunk_id_deterministic():
    id1 = _make_deterministic_chunk_id("doc-1", 0, "Hello world")
    id2 = _make_deterministic_chunk_id("doc-1", 0, "Hello world")
    assert id1 == id2

def test_chunk_id_varies_by_index():
    id1 = _make_deterministic_chunk_id("doc-1", 0, "Hello world")
    id2 = _make_deterministic_chunk_id("doc-1", 1, "Hello world")
    assert id1 != id2


# ── Create Chunks ────────────────────────────────────────────

def test_create_chunks():
    text = "First paragraph content with enough words to be a valid chunk. " * 10
    parsed = ParsedDocument(text=text, pages=[], metadata={}, format="txt")
    chunks = create_chunks("doc-1", "tenant-1", parsed)
    assert len(chunks) >= 1
    for chunk in chunks:
        assert chunk.document_id == "doc-1"
        assert chunk.tenant_id == "tenant-1"


# ── Document API ─────────────────────────────────────────────

@pytest.mark.anyio
async def test_upload_requires_auth(client: AsyncClient):
    app.dependency_overrides.clear()
    resp = await client.post(
        "/api/v1/documents",
        files={"file": ("test.txt", b"content", "text/plain")},
    )
    assert resp.status_code == 401
    app.dependency_overrides[get_current_user] = _mock_user


@pytest.mark.anyio
async def test_list_requires_auth(client: AsyncClient):
    app.dependency_overrides.clear()
    resp = await client.get("/api/v1/documents")
    assert resp.status_code == 401
    app.dependency_overrides[get_current_user] = _mock_user


@pytest.mark.anyio
async def test_upload_unsupported_file(client: AsyncClient):
    resp = await client.post(
        "/api/v1/documents",
        files={"file": ("test.exe", b"MZ", "application/octet-stream")},
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_upload_empty_file(client: AsyncClient):
    resp = await client.post(
        "/api/v1/documents",
        files={"file": ("test.txt", b"", "text/plain")},
    )
    assert resp.status_code == 422
