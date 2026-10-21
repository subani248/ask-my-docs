"""Conservative text cleaning for ingested documents."""

import re


def clean_text(text: str) -> str:
    """Clean extracted text while preserving meaning.

    This is intentionally conservative — we do NOT want to destroy
    meaningful content, headings, numbers, or structure.
    """
    if not text:
        return ""

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove null bytes
    text = text.replace("\x00", "")

    # Collapse runs of 3+ blank lines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove trailing whitespace on each line
    text = re.sub(r"[ \t]+$", "", text, flags=re.MULTILINE)

    # Remove excessive spaces (but preserve single spaces and newlines)
    text = re.sub(r"[^\S\n]{3,}", "  ", text)

    # Strip leading/trailing whitespace
    text = text.strip()

    return text


def normalize_whitespace(text: str) -> str:
    """Normalize whitespace without destroying content."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+$", "", text, flags=re.MULTILINE)
    return text.strip()
