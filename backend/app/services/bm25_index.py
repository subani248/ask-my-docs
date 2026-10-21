"""BM25 indexer for keyword-based document search."""

import json
import logging
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class BM25Indexer:
    """BM25 index backed by a local JSON file.

    This is a simple implementation that can be replaced with
    Elasticsearch or another search engine later.
    """

    def __init__(self, index_dir: str | None = None):
        self._index_dir = Path(index_dir or settings.STORAGE_DIR) / "bm25_index"
        self._index_dir.mkdir(parents=True, exist_ok=True)
        self._index_file = self._index_dir / "index.json"
        self._entries: dict[str, dict] = self._load()

    def _load(self) -> dict:
        """Load existing index from disk."""
        if self._index_file.exists():
            try:
                with open(self._index_file) as f:
                    return json.load(f)
            except Exception as e:
                logger.warning("Failed to load BM25 index: %s", e)
        return {}

    def _save(self) -> None:
        """Persist index to disk."""
        try:
            with open(self._index_file, "w") as f:
                json.dump(self._entries, f)
        except Exception as e:
            logger.error("Failed to save BM25 index: %s", e)

    def index(
        self,
        chunk_id: str,
        document_id: str,
        tenant_id: str,
        text: str,
        metadata: dict | None = None,
    ) -> bool:
        """Index a single chunk."""
        try:
            self._entries[chunk_id] = {
                "document_id": document_id,
                "tenant_id": tenant_id,
                "text": text,
                "metadata": metadata or {},
            }
            self._save()
            return True
        except Exception as e:
            logger.error("BM25 index failed for chunk %s: %s", chunk_id, e)
            return False

    def index_batch(self, entries: list[dict]) -> int:
        """Index multiple chunks. Returns count of successful entries."""
        count = 0
        for entry in entries:
            if self.index(
                chunk_id=entry["chunk_id"],
                document_id=entry["document_id"],
                tenant_id=entry["tenant_id"],
                text=entry["text"],
                metadata=entry.get("metadata"),
            ):
                count += 1
        return count

    def delete_by_document(self, document_id: str) -> bool:
        """Remove all entries for a document."""
        to_remove = [
            cid
            for cid, entry in self._entries.items()
            if entry.get("document_id") == document_id
        ]
        for cid in to_remove:
            del self._entries[cid]
        self._save()
        logger.info("Removed %d BM25 entries for document %s", len(to_remove), document_id)
        return True

    def get_entry_count(self) -> int:
        """Return total indexed entries."""
        return len(self._entries)
