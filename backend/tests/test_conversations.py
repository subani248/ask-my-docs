"""Tests for conversation history management."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import UTC, datetime


class TestConversationSchemas:
    """Test conversation schemas."""

    def test_conversation_list_item(self):
        from app.schemas.conversation import ConversationListItem

        item = ConversationListItem(
            id="conv-123",
            title="Test Conversation",
            document_ids=["doc-1"],
            last_message="What is X?",
            updated_at=datetime.now(UTC),
            message_count=4,
        )
        assert item.id == "conv-123"
        assert item.title == "Test Conversation"
        assert item.message_count == 4

    def test_conversation_detail(self):
        from app.schemas.conversation import ConversationDetailResponse, MessageResponse

        msg = MessageResponse(
            id="msg-1",
            role="user",
            content="What is the policy?",
            citations=[],
            rag_mode=None,
            created_at=datetime.now(UTC),
        )
        detail = ConversationDetailResponse(
            id="conv-123",
            title="Policy Q&A",
            document_ids=["doc-1"],
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            message_count=2,
            messages=[msg],
        )
        assert len(detail.messages) == 1
        assert detail.messages[0].role == "user"

    def test_rename_request_validation(self):
        from app.schemas.conversation import ConversationRenameRequest
        from pydantic import ValidationError

        # Valid
        req = ConversationRenameRequest(title="New Title")
        assert req.title == "New Title"

        # Too short
        with pytest.raises(ValidationError):
            ConversationRenameRequest(title="")

        # Too long
        with pytest.raises(ValidationError):
            ConversationRenameRequest(title="x" * 81)


class TestConversationTitleGeneration:
    """Test the title generation helper."""

    def test_basic_title(self):
        from app.services.rag.generation import RAGService

        title = RAGService._generate_title("What is this document about?")
        assert title == "What is this document about"

    def test_title_removes_punctuation(self):
        from app.services.rag.generation import RAGService

        title = RAGService._generate_title("Summarize this PDF.")
        assert title == "Summarize this PDF"

    def test_title_capitalizes(self):
        from app.services.rag.generation import RAGService

        title = RAGService._generate_title("what is the leave policy?")
        assert title[0].isupper()

    def test_title_truncates_long(self):
        from app.services.rag.generation import RAGService

        long_q = "What are the detailed requirements for ISO 27001 compliance including access control and encryption standards? " * 3
        title = RAGService._generate_title(long_q)
        assert len(title) <= 73  # 70 + "..."

    def test_empty_title(self):
        from app.services.rag.generation import RAGService

        title = RAGService._generate_title("")
        assert title == "New Conversation"


class TestMessageRoles:
    """Test message role validation."""

    def test_user_role(self):
        from app.schemas.conversation import MessageResponse

        msg = MessageResponse(
            id="m1", role="user", content="Hello", created_at=datetime.now(UTC)
        )
        assert msg.role == "user"

    def test_assistant_role(self):
        from app.schemas.conversation import MessageResponse

        msg = MessageResponse(
            id="m1", role="assistant", content="Hi there", created_at=datetime.now(UTC)
        )
        assert msg.role == "assistant"


class TestAskResponseConversationId:
    """Test that AskResponse includes conversation_id."""

    def test_ask_response_has_conversation_id_field(self):
        from app.schemas.ask import AskResponse, AskStatus

        resp = AskResponse(
            question="Test",
            answer="Answer",
            citations=[],
            grounded=True,
            status=AskStatus.SUCCESS,
            conversation_id="conv-abc",
        )
        assert resp.conversation_id == "conv-abc"

    def test_ask_response_conversation_id_defaults_none(self):
        from app.schemas.ask import AskResponse, AskStatus

        resp = AskResponse(
            question="Test",
            answer="Answer",
            citations=[],
            grounded=True,
            status=AskStatus.SUCCESS,
        )
        assert resp.conversation_id is None


class TestConversationRequestField:
    """Test that AskRequest includes conversation_id."""

    def test_ask_request_has_conversation_id(self):
        from app.schemas.ask import AskRequest

        req = AskRequest(question="Hello", conversation_id="conv-123")
        assert req.conversation_id == "conv-123"

    def test_ask_request_conversation_id_optional(self):
        from app.schemas.ask import AskRequest

        req = AskRequest(question="Hello")
        assert req.conversation_id is None
