"""BM25 retriever: keyword-based search with authorization filtering."""

import logging
import math
import re
from collections import Counter
from dataclasses import dataclass

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class BM25SearchResult:
    """A single BM25 search result."""

    chunk_id: str
    document_id: str
    score: float
    content: str
    filename: str
    page_number: int | None
    section: str | None


def _tokenize(text: str) -> list[str]:
    """Simple whitespace + punctuation tokenizer."""
    text = text.lower()
    tokens = re.findall(r"\b\w+\b", text)
    return tokens


class BM25Retriever:
    """Searches the local BM25 index for keyword-matching chunks.

    Enforces authorization by filtering on owner_id.
    Implements BM25 scoring from scratch.
    """

    def __init__(self):
        self._index: dict[str, dict] = {}
        self._load_index()

    def _load_index(self):
        """Load the BM25 index from disk."""
        import json
        from pathlib import Path

        index_file = Path(settings.STORAGE_DIR) / "bm25_index" / "index.json"
        if index_file.exists():
            try:
                with open(index_file) as f:
                    self._index = json.load(f)
                logger.info("Loaded BM25 index: %d entries", len(self._index))
            except Exception as e:
                logger.warning("Failed to load BM25 index: %s", e)
                self._index = {}
        else:
            logger.info("No BM25 index found at %s", index_file)
            self._index = {}

    def search(
        self,
        query: str,
        owner_id: str,
        top_k: int | None = None,
        document_ids: list[str] | None = None,
    ) -> list[BM25SearchResult]:
        """Search the BM25 index with authorization filtering.

        Args:
            query: Natural language query string.
            owner_id: The authenticated user's ID.
            top_k: Number of results to return.
            document_ids: Optional filter to specific document IDs.

        Returns:
            List of BM25SearchResult sorted by score descending.
        """
        top_k = top_k or settings.BM25_TOP_K

        if not self._index:
            return []

        # Filter entries by authorization
        candidates = {}
        for chunk_id, entry in self._index.items():
            # Authorization: must be owned by this user
            if entry.get("tenant_id") != owner_id:
                continue
            # Optional document filter
            if document_ids and entry.get("document_id") not in document_ids:
                continue
            candidates[chunk_id] = entry

        if not candidates:
            return []

        # Compute BM25 scores
        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        # Document frequency
        n_docs = len(candidates)
        df: Counter[str] = Counter()
        doc_tokens: dict[str, list[str]] = {}

        for chunk_id, entry in candidates.items():
            tokens = _tokenize(entry.get("text", ""))
            doc_tokens[chunk_id] = tokens
            unique_tokens = set(tokens)
            for token in unique_tokens:
                df[token] += 1

        # Average document length
        avg_dl = sum(len(t) for t in doc_tokens.values()) / max(n_docs, 1)

        # BM25 parameters
        k1 = 1.5
        b = 0.75

        scores: list[tuple[str, float]] = []

        for chunk_id, entry in candidates.items():
            tokens = doc_tokens[chunk_id]
            dl = len(tokens)
            tf = Counter(tokens)
            score = 0.0

            for qt in query_tokens:
                if qt not in tf:
                    continue
                term_freq = tf[qt]
                doc_freq = df.get(qt, 0)
                idf = math.log((n_docs - doc_freq + 0.5) / (doc_freq + 0.5) + 1)
                tf_norm = (term_freq * (k1 + 1)) / (
                    term_freq + k1 * (1 - b + b * dl / max(avg_dl, 1))
                )
                score += idf * tf_norm

            if score > 0:
                scores.append((chunk_id, score))

        # Sort by score descending
        scores.sort(key=lambda x: x[1], reverse=True)

        results = []
        seen_doc_ids = set()
        for chunk_id, score in scores[:top_k]:
            entry = candidates[chunk_id]
            results.append(
                BM25SearchResult(
                    chunk_id=chunk_id,
                    document_id=entry.get("document_id", ""),
                    score=score,
                    content=entry.get("text", ""),
                    filename=entry.get("metadata", {}).get("filename", ""),
                    page_number=entry.get("metadata", {}).get("page_number"),
                    section=entry.get("metadata", {}).get("section"),
                )
            )

        logger.info(
            "BM25 search returned %d results for owner %s",
            len(results),
            owner_id[:8],
        )
        return results

    @property
    def entry_count(self) -> int:
        return len(self._index)
