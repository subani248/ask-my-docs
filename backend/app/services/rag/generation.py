"""RAG generation service: orchestrates the full RAG pipeline.

Supports two modes:
  TARGETED: Specific question → hybrid retrieval → LLM → citation-validated answer
  DOCUMENT_LEVEL: Summary/overview request → representative chunks → LLM → citation-validated answer

Both modes share citation validation and grounding enforcement.
"""

import json
import logging
import time
import uuid

from app.core.config import get_settings
from app.db.database import CONVERSATIONS, DOCUMENTS, MESSAGES, get_db
from app.schemas.ask import AskResponse, AskStatus, CitationSource, SearchStats
from app.services.llm import (
    DOCUMENT_SUMMARY_PROMPT,
    RAG_SYSTEM_PROMPT,
    REGENERATION_SYSTEM_PROMPT,
    get_llm_provider,
)
from app.services.rag.context_builder import (
    BuiltRAGContext,
    CitationChunk,
    RAGContextBuilder,
)
from app.services.rag.citation_validator import CitationValidator
from app.services.rag.document_retriever import DocumentLevelRetriever
from app.services.rag.intent_detector import (
    DOCUMENT_LEVEL_INTENTS,
    OUT_OF_SCOPE,
    SUGGESTED_QUESTIONS,
    IntentClassificationResult,
    classify_question,
)
from app.services.retrieval import RetrievalService
from app.schemas.retrieval import RetrievalStatus

logger = logging.getLogger(__name__)
settings = get_settings()


class RAGService:
    """Orchestrates the complete RAG generation pipeline.

    Detects intent and routes to:
      - TARGETED: Phase 4.1 hybrid retrieval for specific questions
      - DOCUMENT_LEVEL: Phase 4.2 representative chunk selection for summaries
    """

    def __init__(self):
        self._retrieval = RetrievalService()
        self._doc_retriever = DocumentLevelRetriever()
        self._context_builder = RAGContextBuilder()
        self._validator = CitationValidator()
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            self._llm = get_llm_provider()
        return self._llm

    async def ask(
        self,
        question: str,
        user_id: str,
        document_ids: list[str] | None = None,
        conversation_id: str | None = None,
    ) -> AskResponse:
        """Answer a question using RAG.

        Detects intent and routes to the appropriate pipeline.
        """
        t_start = time.time()

        # Validate question
        question = question.strip()
        if not question or len(question) < settings.MIN_QUESTION_LENGTH:
            return AskResponse(
                question=question,
                answer="Please provide a valid question.",
                citations=[],
                grounded=True,
                status=AskStatus.INVALID_QUERY,
            )

        if len(question) > settings.MAX_QUESTION_LENGTH:
            question = question[: settings.MAX_QUESTION_LENGTH]

        # Count user's documents and chunks for search stats
        db = get_db()
        doc_count = await db[DOCUMENTS].count_documents(
            {"owner_id": user_id, "status": "ready"}
        )
        from app.db.database import CHUNKS
        total_chunks = await db[CHUNKS].count_documents({"owner_id": user_id})
        if total_chunks == 0:
            total_chunks = await db[CHUNKS].count_documents({"tenant_id": user_id})

        # ── QUESTION GATE ──
        classification = classify_question(
            question=question,
            document_ids=document_ids,
            user_document_count=doc_count,
        )

        logger.info(
            "Question gate: intent=%s allowed=%s confidence=%.2f question='%s' [user=%s]",
            classification.intent,
            classification.allowed,
            classification.confidence,
            question[:50],
            user_id[:8],
        )

        # OUT_OF_SCOPE → reject immediately, NO retrieval, NO LLM
        if not classification.allowed:
            # Still save to conversation history
            conv_id = await self._store_conversation(
                user_id=user_id,
                question=question,
                answer="Sorry, I can only answer questions about your uploaded document.",
                citations=[],
                model="",
                conversation_id=conversation_id,
                document_ids=document_ids,
                rag_mode=None,
                intent=OUT_OF_SCOPE,
            )
            return AskResponse(
                question=question,
                answer="Sorry, I can only answer questions about your uploaded document.",
                citations=[],
                grounded=True,
                status=AskStatus.OUT_OF_SCOPE,
                allowed=False,
                intent=OUT_OF_SCOPE,
                suggested_questions=SUGGESTED_QUESTIONS,
                conversation_id=conv_id,
            )

        # Document-level intents → Phase 4.2
        if classification.intent in DOCUMENT_LEVEL_INTENTS:
            return await self._handle_document_level(
                question=question,
                user_id=user_id,
                document_ids=document_ids,
                target_doc_id=classification.target_document_id,
                doc_count=doc_count,
                t_start=t_start,
                intent=classification.intent,
                conversation_id=conversation_id,
            )

        # TARGETED_QUESTION → Phase 4.1
        return await self._handle_targeted(
            question=question,
            user_id=user_id,
            document_ids=document_ids,
            doc_count=doc_count,
            total_chunks=total_chunks,
            t_start=t_start,
            conversation_id=conversation_id,
        )

    async def _handle_targeted(
        self,
        question: str,
        user_id: str,
        document_ids: list[str] | None,
        doc_count: int,
        total_chunks: int,
        t_start: float,
        conversation_id: str | None = None,
    ) -> AskResponse:
        """Handle targeted questions using Phase 4.1 hybrid retrieval."""
        # Handle no documents
        if doc_count == 0:
            return AskResponse(
                question=question,
                answer="You haven't uploaded any documents yet. Please upload documents first.",
                citations=[],
                grounded=True,
                status=AskStatus.NO_DOCUMENTS,
                rag_mode="TARGETED",
                intent="TARGETED_QUESTION",
            )

        # Retrieve via hybrid retrieval
        t_retrieval_start = time.time()
        retrieval_response = await self._retrieval.search(
            query=question,
            owner_id=user_id,
            top_k=settings.USER_MAX_TOP_K,
            document_ids=document_ids,
        )
        retrieval_latency_ms = (time.time() - t_retrieval_start) * 1000
        search_stats = SearchStats(
            documents_searched=doc_count,
            chunks_searched=total_chunks,
            candidates_found=len(retrieval_response.results),
            retrieval_latency_ms=round(retrieval_latency_ms, 1),
        )

        # Handle no relevant context
        if retrieval_response.retrieval_status in (
            RetrievalStatus.NO_RELEVANT_CONTEXT,
            RetrievalStatus.INVALID_QUERY,
        ) or not retrieval_response.results:
            return AskResponse(
                question=question,
                answer="This information is not present in your documents.",
                citations=[],
                grounded=True,
                status=AskStatus.NO_RELEVANT_CONTEXT,
                retrieval_status=retrieval_response.retrieval_status.value,
                rag_mode="TARGETED",
                search_stats=search_stats,
                intent="TARGETED_QUESTION",
            )

        # Build context with citation IDs
        rag_context = self._context_builder.build(retrieval_response.results)

        # Generate answer
        llm = self._get_llm()
        user_prompt = (
            f"Question: {question}\n\n"
            f"Below are relevant excerpts from the user's documents. "
            f"Use them to answer the question thoroughly. You may summarize, count, analyze, and reason over the content. "
            f"Cite sources using [C1], [C2] etc.\n\n"
            f"{rag_context.context_text}"
        )

        try:
            raw_response = llm.generate(
                system_prompt=RAG_SYSTEM_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception as e:
            logger.error("LLM generation failed: %s", e)
            return AskResponse(
                question=question,
                answer="I encountered an error generating a response. Please try again.",
                citations=[],
                grounded=False,
                status=AskStatus.GENERATION_FAILED,
                retrieval_status=retrieval_response.retrieval_status.value,
                rag_mode="TARGETED",
            )

        # Validate and potentially regenerate
        validation = self._validate_and_regenerate(
            raw_response, rag_context, question, llm
        )

        if not validation.is_valid:
            return AskResponse(
                question=question,
                answer="I couldn't generate a sufficiently grounded answer from the available documents. Please try rephrasing your question.",
                citations=[],
                grounded=False,
                status=AskStatus.UNGROUNDED,
                retrieval_status=retrieval_response.retrieval_status.value,
                rag_mode="TARGETED",
            )

        # Build citation sources
        citation_sources = self._build_citation_sources(validation.validated_citations)

        t_total = (time.time() - t_start) * 1000
        logger.info(
            "RAG TARGETED: question='%s' → %d citations (%.0fms) [user=%s]",
            question[:50], len(citation_sources), t_total, user_id[:8],
        )

        # Store conversation
        conv_id = await self._store_conversation(
            user_id=user_id,
            question=question,
            answer=validation.answer_text,
            citations=citation_sources,
            model=llm.model_name,
            conversation_id=conversation_id,
            document_ids=document_ids,
            rag_mode="TARGETED",
            intent="TARGETED_QUESTION",
        )

        return AskResponse(
            question=question,
            answer=validation.answer_text,
            citations=citation_sources,
            grounded=True,
            status=AskStatus.SUCCESS,
            model=llm.model_name,
            retrieval_status=retrieval_response.retrieval_status.value,
            rag_mode="TARGETED",
            search_stats=search_stats,
            intent="TARGETED_QUESTION",
            conversation_id=conv_id,
        )

    async def _handle_document_level(
        self,
        question: str,
        user_id: str,
        document_ids: list[str] | None,
        target_doc_id: str | None,
        doc_count: int,
        t_start: float,
        intent: str = "DOCUMENT_OVERVIEW",
        conversation_id: str | None = None,
    ) -> AskResponse:
        """Handle document-level questions (summarize, overview, key points)."""
        # Handle no documents
        if doc_count == 0:
            return AskResponse(
                question=question,
                answer="You haven't uploaded any documents yet. Please upload documents first.",
                citations=[],
                grounded=True,
                status=AskStatus.NO_DOCUMENTS,
                rag_mode="DOCUMENT_LEVEL",
            )

        # Determine target document
        if target_doc_id:
            document_id = target_doc_id
        elif document_ids and len(document_ids) == 1:
            document_id = document_ids[0]
        elif doc_count == 1:
            # Auto-select the only document
            db = get_db()
            doc = await db[DOCUMENTS].find_one(
                {"owner_id": user_id, "status": "ready"},
                {"_id": 0, "id": 1},
            )
            if not doc:
                return AskResponse(
                    question=question,
                    answer="I couldn't find a document to summarize.",
                    citations=[],
                    grounded=True,
                    status=AskStatus.NO_DOCUMENTS,
                    rag_mode="DOCUMENT_LEVEL",
                )
            document_id = doc["id"]
        else:
            # Multiple documents, no selection — ask user to select
            return AskResponse(
                question=question,
                answer="You have multiple documents. Please select a specific document you'd like me to summarize.",
                citations=[],
                grounded=True,
                status=AskStatus.NO_RELEVANT_CONTEXT,
                rag_mode="DOCUMENT_LEVEL",
            )

        # Get representative chunks from the document
        doc_context = await self._doc_retriever.get_document_context(
            document_id=document_id,
            owner_id=user_id,
        )

        if not doc_context.chunks:
            # Check document status
            db = get_db()
            doc = await db[DOCUMENTS].find_one(
                {"id": document_id, "owner_id": user_id},
                {"_id": 0, "status": 1},
            )
            if not doc:
                return AskResponse(
                    question=question,
                    answer="I couldn't find that document. It may have been deleted.",
                    citations=[],
                    grounded=True,
                    status=AskStatus.NO_DOCUMENTS,
                    rag_mode="DOCUMENT_LEVEL",
                )
            if doc.get("status") == "processing":
                return AskResponse(
                    question=question,
                    answer="This document is still being processed. Please try again shortly.",
                    citations=[],
                    grounded=True,
                    status=AskStatus.NO_RELEVANT_CONTEXT,
                    rag_mode="DOCUMENT_LEVEL",
                )
            if doc.get("status") == "failed":
                return AskResponse(
                    question=question,
                    answer="This document could not be processed. Please try uploading it again.",
                    citations=[],
                    grounded=True,
                    status=AskStatus.NO_RELEVANT_CONTEXT,
                    rag_mode="DOCUMENT_LEVEL",
                )
            return AskResponse(
                question=question,
                answer="I couldn't find enough readable content in this document to summarize it.",
                citations=[],
                grounded=True,
                status=AskStatus.NO_RELEVANT_CONTEXT,
                rag_mode="DOCUMENT_LEVEL",
            )

        # Build context from document chunks
        rag_context = self._build_document_context(doc_context)

        # Generate answer with document summary prompt
        llm = self._get_llm()
        user_prompt = (
            f"Question: {question}\n\n"
            f"Below are representative excerpts from a document titled \"{doc_context.filename}\". "
            f"Provide a comprehensive summary/overview based on these excerpts. "
            f"Cite sources using [C1], [C2] etc.\n\n"
            f"{rag_context.context_text}"
        )

        try:
            raw_response = llm.generate(
                system_prompt=DOCUMENT_SUMMARY_PROMPT,
                user_prompt=user_prompt,
            )
        except Exception as e:
            logger.error("LLM generation failed for document summary: %s", e)
            return AskResponse(
                question=question,
                answer="I encountered an error generating a response. Please try again.",
                citations=[],
                grounded=False,
                status=AskStatus.GENERATION_FAILED,
                rag_mode="DOCUMENT_LEVEL",
            )

        # Validate and potentially regenerate
        validation = self._validate_and_regenerate(
            raw_response, rag_context, question, llm
        )

        if not validation.is_valid:
            return AskResponse(
                question=question,
                answer="I couldn't generate a sufficiently grounded summary from this document. Please try again.",
                citations=[],
                grounded=False,
                status=AskStatus.UNGROUNDED,
                rag_mode="DOCUMENT_LEVEL",
            )

        # Build citation sources
        citation_sources = self._build_citation_sources(validation.validated_citations)

        t_total = (time.time() - t_start) * 1000
        logger.info(
            "RAG DOCUMENT_LEVEL: question='%s' → %d citations, doc=%s (%.0fms) [user=%s]",
            question[:50], len(citation_sources), document_id[:8], t_total, user_id[:8],
        )

        # Store conversation
        doc_ids_for_conv = [document_id] if document_id else (document_ids or [])
        conv_id = await self._store_conversation(
            user_id=user_id,
            question=question,
            answer=validation.answer_text,
            citations=citation_sources,
            model=llm.model_name,
            conversation_id=conversation_id,
            document_ids=doc_ids_for_conv,
            rag_mode="DOCUMENT_LEVEL",
            intent=intent,
        )

        return AskResponse(
            question=question,
            answer=validation.answer_text,
            citations=citation_sources,
            grounded=True,
            status=AskStatus.SUCCESS,
            model=llm.model_name,
            retrieval_status="SUCCESS",
            rag_mode="DOCUMENT_LEVEL",
            intent=intent,
            conversation_id=conv_id,
        )

    def _build_document_context(self, doc_context) -> BuiltRAGContext:
        """Build RAG context from document-level chunks."""
        from app.schemas.retrieval import RetrievalResult, RetrievalResultMetadata

        # Convert DocumentChunk objects to RetrievalResult-like objects
        results = []
        for i, chunk in enumerate(doc_context.chunks):
            results.append(RetrievalResult(
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                score=chunk.score,
                rank=i + 1,
                content=chunk.content,
                metadata=RetrievalResultMetadata(
                    filename=chunk.filename,
                    page_number=chunk.page_number,
                    section=chunk.section,
                ),
            ))

        return self._context_builder.build(results)

    def _validate_and_regenerate(self, raw_response, rag_context, question, llm):
        """Validate citations and regenerate once if invalid."""
        validation = self._validator.validate(raw_response, rag_context)

        if not validation.is_valid and settings.MAX_REGENERATION_ATTEMPTS > 0:
            logger.info(
                "Citation validation failed (invalid: %s), regenerating",
                validation.invalid_ids,
            )
            try:
                regen_prompt = (
                    f"Question: {question}\n\n"
                    f"Context:\n{rag_context.context_text}\n\n"
                    f"IMPORTANT: Your previous answer had invalid citations ({', '.join(validation.invalid_ids)}). "
                    f"Only use citation IDs from the context: {', '.join(rag_context.citation_map.keys())}. "
                    f"Answer using ONLY the provided context."
                )
                raw_response = llm.generate(
                    system_prompt=REGENERATION_SYSTEM_PROMPT,
                    user_prompt=regen_prompt,
                )
                validation = self._validator.validate(raw_response, rag_context)
            except Exception as e:
                logger.error("LLM regeneration failed: %s", e)

        return validation

    def _build_citation_sources(self, validated_citations: list[CitationChunk]) -> list[CitationSource]:
        """Build citation source list from validated chunks."""
        return [
            CitationSource(
                citation_id=chunk.citation_id,
                document_id=chunk.document_id,
                filename=chunk.filename,
                page_number=chunk.page_number,
                section=chunk.section,
                excerpt=chunk.content[:300],
            )
            for chunk in validated_citations
        ]

    async def _store_conversation(
        self,
        user_id: str,
        question: str,
        answer: str,
        citations: list[CitationSource],
        model: str,
        conversation_id: str | None = None,
        document_ids: list[str] | None = None,
        rag_mode: str | None = None,
        intent: str | None = None,
    ) -> str:
        """Store the Q&A interaction in MongoDB. Returns conversation_id."""
        from datetime import UTC, datetime

        db = get_db()
        now = datetime.now(UTC)
        doc_ids = document_ids or []

        # Create or get conversation
        if conversation_id:
            conv = await db[CONVERSATIONS].find_one({"id": conversation_id, "user_id": user_id})
            if not conv:
                # Conversation not found or not owned — create new
                conversation_id = str(uuid.uuid4())
                await self._create_conversation(db, conversation_id, user_id, question, doc_ids, now)
            else:
                # Update existing conversation
                title = conv.get("title", "")
                merged_docs = list(set(doc_ids + conv.get("document_ids", [])))
                await db[CONVERSATIONS].update_one(
                    {"id": conversation_id},
                    {
                        "$set": {
                            "updated_at": now,
                            "last_message": question[:200],
                            "document_ids": merged_docs,
                        },
                        "$inc": {"message_count": 2},
                    },
                )
        else:
            conversation_id = str(uuid.uuid4())
            await self._create_conversation(db, conversation_id, user_id, question, doc_ids, now)

        # Store user message
        await db[MESSAGES].insert_one(
            {
                "id": str(uuid.uuid4()),
                "conversation_id": conversation_id,
                "user_id": user_id,
                "role": "user",
                "content": question,
                "document_ids": doc_ids,
                "created_at": now,
            }
        )

        # Store assistant message
        await db[MESSAGES].insert_one(
            {
                "id": str(uuid.uuid4()),
                "conversation_id": conversation_id,
                "user_id": user_id,
                "role": "assistant",
                "content": answer,
                "citations": [c.model_dump() for c in citations],
                "rag_mode": rag_mode,
                "intent": intent,
                "document_ids": doc_ids,
                "model": model,
                "created_at": now,
            }
        )

        return conversation_id

    async def _create_conversation(
        self, db, conversation_id: str, user_id: str, question: str,
        document_ids: list[str], now
    ) -> None:
        """Create a new conversation with a deterministic title."""
        title = self._generate_title(question)
        await db[CONVERSATIONS].insert_one(
            {
                "id": conversation_id,
                "user_id": user_id,
                "title": title,
                "document_ids": document_ids,
                "last_message": question[:200],
                "created_at": now,
                "updated_at": now,
                "message_count": 2,
            }
        )

    @staticmethod
    def _generate_title(question: str) -> str:
        """Generate a conversation title from the first question."""
        # Remove question marks and clean up
        title = question.strip().rstrip("?.!")
        # Capitalize first letter
        if title:
            title = title[0].upper() + title[1:]
        # Truncate
        if len(title) > 70:
            title = title[:70].rsplit(" ", 1)[0] + "..."
        return title or "New Conversation"
