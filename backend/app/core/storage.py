"""Storage abstraction for document file storage."""

import hashlib
import logging
import uuid
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _get_storage_dir() -> Path:
    """Get the base storage directory."""
    base = Path(settings.STORAGE_DIR)
    base.mkdir(parents=True, exist_ok=True)
    return base


def compute_file_hash(data: bytes) -> str:
    """Compute SHA-256 hash of file content."""
    return hashlib.sha256(data).hexdigest()


def compute_file_hash_file(path: str) -> str:
    """Compute SHA-256 hash of a file on disk."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def generate_storage_id() -> str:
    """Generate a unique storage identifier."""
    return str(uuid.uuid4())


def get_document_dir(document_id: str) -> Path:
    """Get the storage directory for a document."""
    doc_dir = _get_storage_dir() / "documents" / document_id
    doc_dir.mkdir(parents=True, exist_ok=True)
    return doc_dir


def get_document_file_path(document_id: str) -> Path:
    """Get the path to the original file for a document."""
    return get_document_dir(document_id) / "original_file"


def save_uploaded_file(document_id: str, content: bytes) -> str:
    """Save uploaded file content and return the storage path."""
    file_path = get_document_file_path(document_id)
    file_path.write_bytes(content)
    logger.info("Saved document %s to %s", document_id, file_path)
    return str(file_path)


def delete_document_files(document_id: str) -> bool:
    """Delete all files for a document. Returns True if files existed."""
    doc_dir = _get_storage_dir() / "documents" / document_id
    if doc_dir.exists():
        import shutil

        shutil.rmtree(doc_dir)
        logger.info("Deleted storage for document %s", document_id)
        return True
    return False


def get_storage_root() -> str:
    """Return the absolute storage root path."""
    return str(_get_storage_dir().resolve())
