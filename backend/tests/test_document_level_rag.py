"""Tests for document-level RAG (Phase 4.2).

Tests:
1. Intent detection — document-level phrases
2. Intent detection — targeted questions
3. Intent detection — single document auto-selection
4. Intent detection — ambiguous fallback
5. Intent detection — explicit document_ids
6. Document retriever — representative chunk selection
7. Document retriever — section diversity
8. Document retriever — empty document
9. Document context builder
10. AskResponse includes rag_mode
11. RAG_MODE_LABELS correct
12. Document summary prompt exists
"""

import pytest

from app.services.rag.intent_detector import (
    DOCUMENT_LEVEL_INTENTS,
    DOCUMENT_OVERVIEW,
    DOCUMENT_SUMMARY,
    KEY_POINTS,
    OUT_OF_SCOPE,
    TARGETED_QUESTION,
    classify_question,
)


# ── Intent Detection Tests ──


class TestIntentDetection:
    """Test document-level vs targeted intent detection."""

    @pytest.mark.parametrize(
        "question",
        [
            "Summarize this document",
            "Give me a summary",
            "Tell me about this document",
            "What is this document about?",
            "What are the key points?",
            "Give me an overview",
            "What are the main points of this file?",
            "What topics are covered in this document?",
            "Give me an overview of this PDF",
            "What are the important things in this document?",
            "Summarize the file",
            "Key takeaways",
            "What does this document cover?",
            "What information is in this document?",
            "Brief summary please",
            "Important points",
            "What sections are in this document?",
            "Table of contents",
        ],
    )
    def test_document_level_intent_detected(self, question: str):
        """Document-level phrases should be detected."""
        result = classify_question(question, user_document_count=3)
        assert result.intent in DOCUMENT_LEVEL_INTENTS
        assert result.allowed is True
        assert result.confidence >= 0.8

    @pytest.mark.parametrize(
        "question",
        [
            "What is the leave policy?",
            "When does the policy expire?",
            "How many vacation days do employees get?",
            "What is the salary for a senior engineer?",
            "How do I submit an expense report?",
            "What are the parking rules?",
        ],
    )
    def test_targeted_intent_detected(self, question: str):
        """Specific questions about document content should use targeted retrieval."""
        result = classify_question(question, user_document_count=3)
        assert result.intent == TARGETED_QUESTION
        assert result.allowed is True

    @pytest.mark.parametrize(
        "question",
        [
            "Who is the CEO?",
            "What is the company's revenue?",
            "When was the company founded?",
            "What programming languages are used?",
        ],
    )
    def test_general_questions_are_out_of_scope(self, question: str):
        """General knowledge questions without document context are OUT_OF_SCOPE."""
        result = classify_question(question, user_document_count=3)
        assert result.intent == OUT_OF_SCOPE
        assert result.allowed is False

    def test_explicit_document_ids_boosts_confidence(self):
        """Explicit document_ids with a summary phrase = doc-level with target."""
        result = classify_question(
            "Summarize this document",
            document_ids=["doc-123"],
            user_document_count=5,
        )
        assert result.intent in DOCUMENT_LEVEL_INTENTS
        assert result.target_document_id == "doc-123"

    def test_explicit_document_ids_short_question(self):
        """Explicit doc_id + targeted question = targeted with target doc."""
        result = classify_question(
            "What is the leave policy?",
            document_ids=["doc-456"],
            user_document_count=5,
        )
        assert result.intent == TARGETED_QUESTION
        assert result.target_document_id == "doc-456"

    def test_single_document_auto_select(self):
        """With one document + summary phrase = document-level."""
        result = classify_question(
            "Tell me about this document",
            user_document_count=1,
        )
        assert result.intent in DOCUMENT_LEVEL_INTENTS
        assert result.allowed is True

    def test_empty_query_is_out_of_scope(self):
        """Empty query is out of scope."""
        result = classify_question("", user_document_count=3)
        assert result.intent == OUT_OF_SCOPE
        assert result.allowed is False

    def test_no_documents_summary(self):
        """Single-word 'Summarize' is out of scope (too short)."""
        result = classify_question("Summarize", user_document_count=0)
        assert result.intent == OUT_OF_SCOPE
        assert result.allowed is False


# ── Document Context Builder Tests ──


class TestDocumentContext:
    """Test that document-level RAG uses the right schemas."""

    def test_ask_response_has_rag_mode(self):
        """AskResponse should include rag_mode field."""
        from app.schemas.ask import AskResponse, AskStatus

        resp = AskResponse(
            question="Summarize this document",
            answer="This document covers...",
            citations=[],
            grounded=True,
            status=AskStatus.SUCCESS,
            rag_mode="DOCUMENT_LEVEL",
        )
        assert resp.rag_mode == "DOCUMENT_LEVEL"

    def test_ask_response_default_rag_mode(self):
        """AskResponse should default rag_mode to None."""
        from app.schemas.ask import AskResponse, AskStatus

        resp = AskResponse(
            question="What is the leave policy?",
            answer="Employees get 20 days.",
            citations=[],
            grounded=True,
            status=AskStatus.SUCCESS,
        )
        assert resp.rag_mode is None

    def test_document_summary_prompt_exists(self):
        """DOCUMENT_SUMMARY_PROMPT should be importable and non-empty."""
        from app.services.llm import DOCUMENT_SUMMARY_PROMPT
        assert len(DOCUMENT_SUMMARY_PROMPT) > 100
        assert "untrusted" in DOCUMENT_SUMMARY_PROMPT.lower()

    def test_document_summary_prompt_has_citation_instructions(self):
        """Document summary prompt should reference citation IDs."""
        from app.services.llm import DOCUMENT_SUMMARY_PROMPT
        assert "[C1]" in DOCUMENT_SUMMARY_PROMPT
        assert "citation" in DOCUMENT_SUMMARY_PROMPT.lower()


# ── Representative Chunk Selection Tests ──


class TestRepresentativeChunkSelection:
    """Test the document retriever's chunk selection strategy."""

    def test_select_representative_includes_first_and_last(self):
        """First and last chunks should always be included."""
        from app.services.rag.document_retriever import DocumentLevelRetriever

        retriever = DocumentLevelRetriever()
        chunks = [
            {"id": f"chunk-{i}", "content": f"Content {i}", "section": f"Section {i % 3}", "page_number": i // 3, "chunk_index": i}
            for i in range(10)
        ]
        selected = retriever._select_representative(chunks)

        selected_ids = [c["id"] for c in selected]
        assert "chunk-0" in selected_ids  # first
        assert "chunk-9" in selected_ids  # last

    def test_select_representative_respects_limit(self):
        """Selection should not exceed max_chunks."""
        from app.services.rag.document_retriever import DocumentLevelRetriever

        retriever = DocumentLevelRetriever()
        chunks = [
            {"id": f"chunk-{i}", "content": f"Content {i}", "section": f"Section {i}", "page_number": i, "chunk_index": i}
            for i in range(50)
        ]
        selected = retriever._select_representative(chunks)
        assert len(selected) <= retriever._max_chunks

    def test_select_representative_empty_input(self):
        """Empty chunk list should return empty selection."""
        from app.services.rag.document_retriever import DocumentLevelRetriever

        retriever = DocumentLevelRetriever()
        selected = retriever._select_representative([])
        assert selected == []

    def test_select_representative_section_diversity(self):
        """Each section should have at least one representative chunk."""
        from app.services.rag.document_retriever import DocumentLevelRetriever

        retriever = DocumentLevelRetriever()
        chunks = []
        for i in range(30):
            chunks.append({
                "id": f"chunk-{i}",
                "content": f"Content {i}",
                "section": f"Section {i % 10}",
                "page_number": i,
                "chunk_index": i,
            })
        selected = retriever._select_representative(chunks)

        sections_in_selected = set(c.get("section") for c in selected)
        # All 10 sections should be represented
        assert len(sections_in_selected) >= 10

    def test_select_representative_sorted_by_index(self):
        """Selected chunks should be in document order."""
        from app.services.rag.document_retriever import DocumentLevelRetriever

        retriever = DocumentLevelRetriever()
        chunks = [
            {"id": f"chunk-{i}", "content": f"Content {i}", "section": f"Section {i % 5}", "page_number": i, "chunk_index": i}
            for i in range(15)
        ]
        selected = retriever._select_representative(chunks)

        indices = [c["chunk_index"] for c in selected]
        assert indices == sorted(indices)


# ── Config Tests ──


class TestDocumentLevelConfig:
    """Test that document-level config values exist."""

    def test_document_summary_max_chunks(self):
        from app.core.config import get_settings
        settings = get_settings()
        assert settings.DOCUMENT_SUMMARY_MAX_CHUNKS >= 10

    def test_document_summary_max_tokens(self):
        from app.core.config import get_settings
        settings = get_settings()
        assert settings.DOCUMENT_SUMMARY_MAX_TOKENS >= 4000
