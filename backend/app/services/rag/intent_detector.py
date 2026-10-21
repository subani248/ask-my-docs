"""Strict document question gate.

Classifies every user question into exactly one of:
  DOCUMENT_OVERVIEW | DOCUMENT_SUMMARY | KEY_POINTS | DOCUMENT_TOPICS |
  MAIN_FINDINGS | SECTION_EXPLANATION | TARGETED_QUESTION | OUT_OF_SCOPE

OUT_OF_SCOPE questions are rejected BEFORE retrieval and LLM.
"""

import logging
import re

logger = logging.getLogger(__name__)

# ── Intent constants ──

DOCUMENT_OVERVIEW = "DOCUMENT_OVERVIEW"
DOCUMENT_SUMMARY = "DOCUMENT_SUMMARY"
KEY_POINTS = "KEY_POINTS"
DOCUMENT_TOPICS = "DOCUMENT_TOPICS"
MAIN_FINDINGS = "MAIN_FINDINGS"
SECTION_EXPLANATION = "SECTION_EXPLANATION"
TARGETED_QUESTION = "TARGETED_QUESTION"
OUT_OF_SCOPE = "OUT_OF_SCOPE"

DOCUMENT_LEVEL_INTENTS = {
    DOCUMENT_OVERVIEW,
    DOCUMENT_SUMMARY,
    KEY_POINTS,
    DOCUMENT_TOPICS,
    MAIN_FINDINGS,
    SECTION_EXPLANATION,
}

# ── Suggested questions (returned with OUT_OF_SCOPE) ──

SUGGESTED_QUESTIONS = [
    "What is this document about?",
    "Summarize this document.",
    "What are the key points?",
    "What topics are covered?",
    "What are the main findings?",
    "Explain the important sections.",
]


# ── Pattern groups for each document-level intent ──

_OVERVIEW_PATTERNS = [
    r"\bwhat\s+is\s+this\s+(document|file|pdf|paper|report)\b",
    r"\bwhat[''']?s\s+this\s+(document|file|pdf|paper|report)\b",
    r"\btell\s+me\s+about\s+(this|the|my)\s+(document|file|pdf|paper|report|upload)\b",
    r"\bgive\s+me\s+an?\s+overview\b",
    r"\bprovide\s+an?\s+overview\b",
    r"\boverview\s+(of|about|for)\s+(this|the|my)\s+(document|file|pdf)\b",
    r"\bwhat\s+is\s+(?:this|the\s+document)\s+about\b",
    r"\bwhat[''']?s\s+this\s+(document|file)\s+about\b",
    r"\bwhat\s+(?:is\s+)?inside\s+(this|the)\s+(document|file|pdf)\b",
    r"\bwhat\s+is\s+(?:in|inside)\s+(this|the)\s+(document|file|pdf)\b",
    r"\bwhat\s+does\s+(this|the)\s+(document|file)\s+talk\s+about\b",
    r"\bwhat\s+information\s+(?:is\s+)?(?:in|inside|contained)\b",
]

_SUMMARY_PATTERNS = [
    r"\bsummar(?:ize|ise|y)\s+(this|the|my)?\s*(document|file|pdf|paper|report|upload)?\b",
    r"\bsummar(?:ize|ise|y)\s+the\s+uploaded\s+file\b",
    r"\bgive\s+me\s+a\s+summary\b",
    r"\bprovide\s+a\s+summary\b",
    r"\bshort\s+summary\b",
    r"\bbrief\s+summary\b",
    r"\bcan\s+you\s+summarize\b",
    r"\bwrite\s+a\s+summary\b",
    r"\bcreate\s+a\s+summary\b",
    r"\bgenerate\s+a\s+summary\b",
    r"\bsummary\s+of\s+(this|the|my)\s+(document|file|pdf)\b",
]

_KEY_POINTS_PATTERNS = [
    r"\bkey\s+points?\b",
    r"\bmain\s+points?\b",
    r"\bimportant\s+points?\b",
    r"\bimportant\s+things?\b",
    r"\bkey\s+takeaways?\b",
    r"\bmain\s+takeaways?\b",
    r"\bsalient\s+points?\b",
    r"\bmost\s+important\b",
    r"\bcrucial\s+points?\b",
    r"\bessential\s+points?\b",
    r"\bwhat\s+are\s+the\s+(important|key|main|critical)\s+(points?|things?|takeaways?|information)\b",
    r"\bwhat\s+should\s+i\s+know\b",
    r"\bgive\s+me\s+the\s+(important|key|main|crucial)\s+(points?|things?|takeaways?|information)\b",
    r"\bimportant\s+information\b",
    r"\bkey\s+information\b",
    r"\bmain\s+information\b",
]

_TOPICS_PATTERNS = [
    r"\bwhat\s+topics?\s+(?:are\s+covered|is\s+covered|does)\b",
    r"\bwhat\s+topics?\s+(?:are|is)\s+(?:in|inside|contained)\b",
    r"\bwhat\s+subjects?\s+(?:are|is)\s+(?:covered|included|discussed)\b",
    r"\bwhat\s+(?:areas?|areas?)\s+(?:does|do)\s+(this|the)\s+(document|file)\s+cover\b",
    r"\bwhat\s+does\s+(this|the)\s+(document|file|pdf)\s+(?:discuss|cover|contain|address)\b",
    r"\bwhat\s+is\s+(?:discussed|covered|contained|addressed)\s+in\b",
    r"\bwhat\s+kind\s+of\s+(?:content|topics?|subjects?|information)\b",
    r"\bwhat\s+type\s+of\s+(?:content|topics?|subjects?|information)\b",
    r"\blist\s+(?:the\s+)?(?:topics?|subjects?|contents?|areas?)\b",
    r"\bwhat\s+is\s+(?:this|the)\s+(document|file)\s+(?:about|covering)\b",
    r"\bwhat[''']?s\s+(?:this|the)\s+(document|file)\s+(?:about|covering)\b",
]

_FINDINGS_PATTERNS = [
    r"\bwhat\s+are\s+the\s+main\s+findings?\b",
    r"\bwhat\s+are\s+the\s+important\s+findings?\b",
    r"\bwhat\s+are\s+the\s+major\s+conclusions?\b",
    r"\bwhat\s+conclusions?\s+does\s+(this|the)\s+(document|file)\s+contain\b",
    r"\bwhat\s+are\s+the\s+(?:key|major|important)\s+(?:findings?|conclusions?|results?)\b",
    r"\bwhat\s+(?:did|does)\s+(this|the)\s+(document|file)\s+(?:find|conclude|reveal|show)\b",
    r"\bwhat\s+are\s+the\s+(?:primary|principal)\s+(?:findings?|conclusions?|results?)\b",
    r"\bmain\s+(?:findings?|conclusions?|results?)\b",
    r"\bkey\s+(?:findings?|conclusions?|results?)\b",
    r"\bimportant\s+(?:findings?|conclusions?|results?)\b",
]

_SECTION_PATTERNS = [
    r"\bexplain\s+(?:the\s+)?(?:important\s+)?sections?\b",
    r"\bwhat\s+are\s+the\s+main\s+sections?\b",
    r"\bexplain\s+(?:the\s+)?sections?\s+of\s+(this|the)\s+(document|file)\b",
    r"\bwhat\s+does\s+each\s+section\s+contain\b",
    r"\bwhat\s+(?:sections?|chapters?|parts?)\s+(?:are|is|does)\b",
    r"\blist\s+(?:the\s+)?(?:sections?|chapters?|parts?)\b",
    r"\btable\s+of\s+contents?\b",
    r"\bcontents?\s+(?:of|in)\s+(this|the)\s+(document|file|pdf)\b",
    r"\bdescribe\s+(?:the\s+)?(?:structure|sections?|layout)\b",
    r"\bwhat\s+(?:sections?|chapters?|parts?|parts?)\s+(?:does|do)\s+(this|the)\s+(document|file)\s+have\b",
    r"\bsections?\s+(?:in|of)\s+(this|the)\s+(document|file)\b",
]


def _count_matches(patterns: list[str], text: str) -> int:
    """Count how many patterns match the text."""
    count = 0
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            count += 1
    return count


def _best_intent_score(normalized: str) -> tuple[str, float]:
    """Return the best document-level intent and its confidence.

    Returns (intent, confidence). If no document-level intent matches
    well enough, returns (TARGETED_QUESTION, 0.0).
    """
    scores = [
        (DOCUMENT_OVERVIEW, _count_matches(_OVERVIEW_PATTERNS, normalized)),
        (DOCUMENT_SUMMARY, _count_matches(_SUMMARY_PATTERNS, normalized)),
        (KEY_POINTS, _count_matches(_KEY_POINTS_PATTERNS, normalized)),
        (DOCUMENT_TOPICS, _count_matches(_TOPICS_PATTERNS, normalized)),
        (MAIN_FINDINGS, _count_matches(_FINDINGS_PATTERNS, normalized)),
        (SECTION_EXPLANATION, _count_matches(_SECTION_PATTERNS, normalized)),
    ]

    best_intent, best_count = max(scores, key=lambda x: x[1])

    if best_count >= 2:
        return best_intent, 0.98
    if best_count == 1:
        return best_intent, 0.85
    return TARGETED_QUESTION, 0.0


class IntentClassificationResult:
    """Result of the question gate."""

    __slots__ = ("intent", "allowed", "confidence", "target_document_id")

    def __init__(
        self,
        intent: str,
        allowed: bool,
        confidence: float,
        target_document_id: str | None = None,
    ):
        self.intent = intent
        self.allowed = allowed
        self.confidence = confidence
        self.target_document_id = target_document_id

    def to_dict(self) -> dict:
        return {
            "intent": self.intent,
            "allowed": self.allowed,
            "confidence": self.confidence,
        }


def classify_question(
    question: str,
    document_ids: list[str] | None = None,
    user_document_count: int = 0,
) -> IntentClassificationResult:
    """Classify a user question through the strict question gate.

    Returns IntentClassificationResult with:
      - intent: one of the 8 allowed intents
      - allowed: True if question should proceed to RAG
      - confidence: classifier confidence
      - target_document_id: if explicitly selected
    """
    normalized = question.strip().lower()

    # Empty question → OUT_OF_SCOPE
    if not normalized:
        return IntentClassificationResult(
            intent=OUT_OF_SCOPE,
            allowed=False,
            confidence=1.0,
        )

    # Short single-word questions are almost always OUT_OF_SCOPE
    words = normalized.split()
    if len(words) == 1 and len(normalized) < 8:
        if not any(
            kw in normalized
            for kw in ["document", "file", "pdf", "summary", "overview"]
        ):
            return IntentClassificationResult(
                intent=OUT_OF_SCOPE,
                allowed=False,
                confidence=0.95,
            )

    # ── Jailbreak / injection detection ──
    injection_markers = [
        "ignore",
        "previous instructions",
        "system prompt",
        "repeat your",
        "your instructions",
        "override",
        "bypass",
        "forget everything",
    ]
    if any(marker in normalized for marker in injection_markers):
        return IntentClassificationResult(
            intent=OUT_OF_SCOPE,
            allowed=False,
            confidence=0.99,
        )

    # ── Classify document-level intents ──
    best_intent, confidence = _best_intent_score(normalized)

    if confidence >= 0.85 and best_intent in DOCUMENT_LEVEL_INTENTS:
        target_doc = document_ids[0] if document_ids else None
        return IntentClassificationResult(
            intent=best_intent,
            allowed=True,
            confidence=confidence,
            target_document_id=target_doc,
        )

    # ── TARGETED_QUESTION detection ──
    # Specific factual questions about document content
    targeted_question_words = [
        "what is", "what are", "what does", "what do",
        "how many", "how much", "how long", "how often",
        "who is", "who are", "who was",
        "when is", "when are", "when was", "when does",
        "where is", "where are", "where was",
        "why is", "why are", "why does",
        "which", "can you explain", "can you describe",
    ]
    has_targeted_start = any(normalized.startswith(qw) for qw in targeted_question_words)

    # Document-related keywords that indicate the question is about content
    doc_keywords = [
        "document", "file", "pdf", "paper", "report", "upload",
        "policy", "handbook", "manual", "guide", "memo", "letter",
        "contract", "agreement", "terms", "condition", "rule", "regulation",
        "page", "section", "chapter", "part", "appendix",
        "according", "mentioned", "stated", "says", "contains", "includes",
        "written", "described", "outlined", "specified", "defined",
        "remote", "leave", "salary", "hours", "holiday", "vacation",
        "employee", "manager", "department", "security", "compliance",
    ]

    has_doc_keyword = any(kw in normalized for kw in doc_keywords)

    if has_targeted_start and has_doc_keyword:
        target_doc = document_ids[0] if document_ids else None
        return IntentClassificationResult(
            intent=TARGETED_QUESTION,
            allowed=True,
            confidence=0.85,
            target_document_id=target_doc,
        )

    # Explicit document_ids → likely targeted about that doc
    if document_ids and len(document_ids) > 0:
        return IntentClassificationResult(
            intent=TARGETED_QUESTION,
            allowed=True,
            confidence=0.75,
            target_document_id=document_ids[0],
        )

    # User has documents + question word → targeted
    question_words = ["what", "how", "who", "when", "where", "why", "which"]
    has_question_word = any(normalized.startswith(qw) for qw in question_words)
    if has_question_word and user_document_count > 0 and has_doc_keyword:
        return IntentClassificationResult(
            intent=TARGETED_QUESTION,
            allowed=True,
            confidence=0.80,
        )

    # Everything else → OUT_OF_SCOPE
    return IntentClassificationResult(
        intent=OUT_OF_SCOPE,
        allowed=False,
        confidence=0.90,
    )
