"""Score normalization for hybrid retrieval fusion."""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NormalizedResult:
    """A result with a normalized score in [0, 1]."""

    id: str
    raw_score: float
    normalized_score: float
    rank: int


class ScoreNormalizer:
    """Normalizes scores from different retrieval systems to a common scale.

    Uses rank-based normalization: score = 1 / (k + rank)
    where rank is 1-indexed. This produces scores in (0, 1/k] range
    that are directly comparable across retrieval systems.
    """

    @staticmethod
    def rank_normalize(
        results: list[dict],
        score_key: str = "score",
        id_key: str = "chunk_id",
        k: int = 60,
    ) -> list[NormalizedResult]:
        """Normalize results using rank-based scoring (RRF-compatible).

        Args:
            results: List of result dicts with scores.
            score_key: Key for the raw score in each dict.
            id_key: Key for the unique identifier in each dict.
            k: RRF constant (higher = smoother distribution).

        Returns:
            List of NormalizedResult sorted by normalized_score descending.
        """
        if not results:
            return []

        # Sort by raw score descending
        sorted_results = sorted(results, key=lambda r: r.get(score_key, 0), reverse=True)

        normalized = []
        for rank, result in enumerate(sorted_results, start=1):
            normalized.append(
                NormalizedResult(
                    id=result.get(id_key, ""),
                    raw_score=result.get(score_key, 0.0),
                    normalized_score=1.0 / (k + rank),
                    rank=rank,
                )
            )

        return normalized

    @staticmethod
    def min_max_normalize(
        results: list[dict],
        score_key: str = "score",
        id_key: str = "chunk_id",
    ) -> list[NormalizedResult]:
        """Min-max normalization to [0, 1] range.

        Fallback alternative to rank-based normalization.
        """
        if not results:
            return []

        scores = [r.get(score_key, 0) for r in results]
        min_score = min(scores)
        max_score = max(scores)
        range_score = max_score - min_score

        sorted_results = sorted(results, key=lambda r: r.get(score_key, 0), reverse=True)

        normalized = []
        for rank, result in enumerate(sorted_results, start=1):
            raw = result.get(score_key, 0.0)
            if range_score > 0:
                norm = (raw - min_score) / range_score
            else:
                norm = 1.0 if raw > 0 else 0.0

            normalized.append(
                NormalizedResult(
                    id=result.get(id_key, ""),
                    raw_score=raw,
                    normalized_score=norm,
                    rank=rank,
                )
            )

        return normalized
