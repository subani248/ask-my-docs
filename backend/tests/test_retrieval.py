"""Tests for the retrieval pipeline components."""

import pytest

from app.services.score_normalizer import ScoreNormalizer
from app.services.context_builder import ContextBuilder, ContextChunk


# ── ScoreNormalizer tests ─────────────────────────────────────


def test_rank_normalize_empty():
    """Empty results should return empty list."""
    result = ScoreNormalizer.rank_normalize([])
    assert result == []


def test_rank_normalize_single():
    """Single result should get rank 1."""
    results = [{"chunk_id": "c1", "score": 0.9}]
    normalized = ScoreNormalizer.rank_normalize(results, k=60)
    assert len(normalized) == 1
    assert normalized[0].id == "c1"
    assert normalized[0].rank == 1
    assert normalized[0].normalized_score == pytest.approx(1.0 / 61)


def test_rank_normalize_ordering():
    """Higher raw scores should get lower ranks (better position)."""
    results = [
        {"chunk_id": "c1", "score": 0.3},
        {"chunk_id": "c2", "score": 0.9},
        {"chunk_id": "c3", "score": 0.6},
    ]
    normalized = ScoreNormalizer.rank_normalize(results, k=60)
    # c2 has highest score → rank 1
    assert normalized[0].id == "c2"
    assert normalized[0].rank == 1
    # c3 has second highest → rank 2
    assert normalized[1].id == "c3"
    assert normalized[1].rank == 2
    # c1 has lowest → rank 3
    assert normalized[2].id == "c1"
    assert normalized[2].rank == 3


def test_rank_normalize_scores_between_0_and_1():
    """All normalized scores should be in (0, 1]."""
    results = [
        {"chunk_id": f"c{i}", "score": float(i)}
        for i in range(10)
    ]
    normalized = ScoreNormalizer.rank_normalize(results, k=60)
    for n in normalized:
        assert 0 < n.normalized_score <= 1.0


def test_min_max_normalize_empty():
    """Empty results should return empty list."""
    result = ScoreNormalizer.min_max_normalize([])
    assert result == []


def test_min_max_normalize():
    """Min-max normalization should map min→0, max→1."""
    results = [
        {"chunk_id": "c1", "score": 0.2},
        {"chunk_id": "c2", "score": 0.8},
        {"chunk_id": "c3", "score": 0.5},
    ]
    normalized = ScoreNormalizer.min_max_normalize(results)
    # c2 (max) should have normalized_score = 1.0
    c2 = next(n for n in normalized if n.id == "c2")
    assert c2.normalized_score == pytest.approx(1.0)
    # c1 (min) should have normalized_score = 0.0
    c1 = next(n for n in normalized if n.id == "c1")
    assert c1.normalized_score == pytest.approx(0.0)


# ── ContextBuilder tests ──────────────────────────────────────


def _make_reranked_result(chunk_id="c1", score=0.9, content="test content"):
    """Helper to create a mock reranked result."""
    from dataclasses import dataclass

    @dataclass
    class MockResult:
        chunk_id: str
        document_id: str
        rerank_score: float
        original_fusion_score: float
        vector_rank: int | None
        bm25_rank: int | None
        content: str
        filename: str
        page_number: int | None
        section: str | None

    return MockResult(
        chunk_id=chunk_id,
        document_id="doc-1",
        rerank_score=score,
        original_fusion_score=score * 0.8,
        vector_rank=1,
        bm25_rank=2,
        content=content,
        filename="test.pdf",
        page_number=1,
        section="Introduction",
    )


def test_context_builder_empty():
    """Empty results should return empty context."""
    builder = ContextBuilder()
    ctx = builder.build([])
    assert ctx.total_chunks == 0
    assert ctx.chunks == []


def test_context_builder_basic():
    """Should build context from reranked results."""
    results = [_make_reranked_result(f"c{i}", score=0.9 - i * 0.1) for i in range(5)]
    builder = ContextBuilder()
    ctx = builder.build(results)
    assert ctx.total_chunks == 5
    assert ctx.chunks[0].chunk_id == "c0"  # highest score first


def test_context_builder_respects_max_chunks():
    """Should not exceed MAX_CONTEXT_CHUNKS."""
    results = [_make_reranked_result(f"c{i}", score=1.0 - i * 0.01) for i in range(20)]
    builder = ContextBuilder()
    ctx = builder.build(results)
    assert ctx.total_chunks <= builder._max_chunks


def test_context_builder_respects_token_limit():
    """Should respect MAX_CONTEXT_TOKENS."""
    # Create chunks with very long content
    long_content = "word " * 2000  # ~10000 tokens
    results = [_make_reranked_result(f"c{i}", score=0.9, content=long_content) for i in range(5)]
    builder = ContextBuilder()
    ctx = builder.build(results)
    assert ctx.total_tokens_estimate <= builder._max_tokens


def test_context_builder_preserves_metadata():
    """Chunks should include metadata."""
    results = [_make_reranked_result("c1", score=0.9)]
    builder = ContextBuilder()
    ctx = builder.build(results)
    chunk = ctx.chunks[0]
    assert chunk.filename == "test.pdf"
    assert chunk.page_number == 1
    assert chunk.section == "Introduction"


def test_context_builder_debug_fields():
    """Debug mode should include vector_rank and bm25_rank."""
    results = [_make_reranked_result("c1", score=0.9)]
    builder = ContextBuilder()
    ctx = builder.build(results, include_debug=True)
    chunk = ctx.chunks[0]
    assert chunk.vector_rank is not None
    assert chunk.bm25_rank is not None


def test_context_builder_no_debug_fields():
    """Non-debug mode should not include vector_rank and bm25_rank."""
    results = [_make_reranked_result("c1", score=0.9)]
    builder = ContextBuilder()
    ctx = builder.build(results, include_debug=False)
    chunk = ctx.chunks[0]
    assert chunk.vector_rank is None
    assert chunk.bm25_rank is None


# ── RRF Fusion logic tests ────────────────────────────────────


def test_rrf_formula():
    """Verify RRF formula: score = sum(1 / (k + rank))."""
    k = 60
    # If a chunk is rank 1 in both vector and BM25
    score = 1.0 / (k + 1) + 1.0 / (k + 1)
    assert score == pytest.approx(2.0 / 61)


def test_rrf_favors_top_results():
    """Top-ranked results should get higher fusion scores."""
    k = 60
    # Rank 1 in vector + rank 1 in BM25
    score_top = 1.0 / (k + 1) + 1.0 / (k + 1)
    # Rank 5 in vector + rank 5 in BM25
    score_mid = 1.0 / (k + 5) + 1.0 / (k + 5)
    # Rank 20 in vector + rank 20 in BM25
    score_low = 1.0 / (k + 20) + 1.0 / (k + 20)
    assert score_top > score_mid > score_low


# ── Deduplication test ────────────────────────────────────────


def test_hybrid_deduplication():
    """Same chunk appearing in both vector and BM25 should be deduped."""
    # Simulate hybrid fusion merging
    chunk_id = "chunk-abc"
    vector_results = [{"chunk_id": chunk_id, "rank": 1, "score": 0.9}]
    bm25_results = [{"chunk_id": chunk_id, "rank": 2, "score": 0.7}]

    # Merge into single entry
    merged = {}
    for r in vector_results:
        cid = r["chunk_id"]
        merged[cid] = {
            "chunk_id": cid,
            "vector_rank": r["rank"],
            "vector_score": r["score"],
        }
    for r in bm25_results:
        cid = r["chunk_id"]
        if cid in merged:
            merged[cid]["bm25_rank"] = r["rank"]
            merged[cid]["bm25_score"] = r["score"]
        else:
            merged[cid] = {
                "chunk_id": cid,
                "bm25_rank": r["rank"],
                "bm25_score": r["score"],
            }

    # Should be 1 entry, not 2
    assert len(merged) == 1
    assert merged[chunk_id]["vector_rank"] == 1
    assert merged[chunk_id]["bm25_rank"] == 2


# ── Config tests ──────────────────────────────────────────────


def test_retrieval_config():
    """Retrieval config should be loaded."""
    from app.core.config import get_settings

    settings = get_settings()
    assert settings.VECTOR_TOP_K > 0
    assert settings.BM25_TOP_K > 0
    assert settings.HYBRID_TOP_K > 0
    assert settings.RERANKER_TOP_K > 0
    assert settings.RRF_K > 0
    assert settings.USER_MAX_TOP_K > 0
    assert settings.RERANK_BATCH_SIZE > 0
    assert settings.MAX_CONTEXT_CHUNKS > 0
    assert settings.MAX_CONTEXT_TOKENS > 0
