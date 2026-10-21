"""Citation validator: verifies LLM citations against trusted retrieval results."""

import json
import logging
import re

from app.services.rag.context_builder import BuiltRAGContext, CitationChunk

logger = logging.getLogger(__name__)


class CitationValidationResult:
    """Result of citation validation."""

    def __init__(
        self,
        is_valid: bool,
        validated_citations: list[CitationChunk],
        invalid_ids: list[str],
        answer_text: str,
    ):
        self.is_valid = is_valid
        self.validated_citations = validated_citations
        self.invalid_ids = invalid_ids
        self.answer_text = answer_text


class CitationValidator:
    """Validates that LLM citations are legitimate.

    Checks:
    - Every cited ID exists in the context
    - Every citation maps to a real chunk
    - No invented citation IDs
    - Citations are referenced in the answer text
    """

    def validate(
        self,
        llm_response: str,
        rag_context: BuiltRAGContext,
    ) -> CitationValidationResult:
        """Validate an LLM response against the RAG context.

        Args:
            llm_response: Raw LLM response (JSON string or text).
            rag_context: The built context with citation map.

        Returns:
            CitationValidationResult with validation outcome.
        """
        # Parse LLM response
        parsed = self._parse_response(llm_response)
        answer = parsed.get("answer", "")
        cited_ids = parsed.get("citations", [])

        # Extract citation IDs from the answer text too
        text_citations = self._extract_citations_from_text(answer)
        all_cited = list(set(cited_ids + text_citations))

        valid_citations = []
        invalid_ids = []

        for cid in all_cited:
            if cid in rag_context.citation_map:
                valid_citations.append(rag_context.citation_map[cid])
            else:
                invalid_ids.append(cid)
                logger.warning("Invalid citation ID in LLM response: %s", cid)

        is_valid = len(invalid_ids) == 0

        return CitationValidationResult(
            is_valid=is_valid,
            validated_citations=valid_citations,
            invalid_ids=invalid_ids,
            answer_text=answer,
        )

    def _parse_response(self, raw_response: str) -> dict:
        """Parse LLM response as JSON, with fallback."""
        # Try to extract JSON from the response
        text = raw_response.strip()

        # Try direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block in markdown
        json_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find { ... } pattern
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        # Fallback: treat entire response as the answer
        logger.warning("Could not parse LLM response as JSON, using raw text")
        return {"answer": text, "citations": []}

    def _extract_citations_from_text(self, text: str) -> list[str]:
        """Extract citation IDs like [C1], [C2] from text."""
        return [f"C{num}" for num in re.findall(r"\[C(\d+)\]", text)]
