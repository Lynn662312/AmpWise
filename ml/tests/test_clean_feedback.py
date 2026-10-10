"""Run from the repo root:  python -m pytest ml/tests"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "preprocessing"))
from clean_feedback import clean_feedback  # noqa: E402

PRAISE = "Works great, appreciate it"
COMPLAINT = "Charger won't start. I tapped my card and nothing happens"


def test_sentiment_follows_the_comment_not_the_stars() -> None:
    feedback = pd.DataFrame({
        "free_text": [PRAISE] * 5 + [COMPLAINT] * 5 + [COMPLAINT, "Chargr won't start. I tapped my card and nothing hapens", "test"],
        "rating": [5, 4, 5, 4, 5] + [1, 2, 1, 2, 1] + [5, 3, 1],
        "category": ["Other"] * 5 + ["Won't start"] * 7 + ["Other"],
    })
    cleaned = clean_feedback(feedback)

    assert list(cleaned["sentiment"][:10]) == ["positive"] * 5 + ["negative"] * 5
    # A complaint with 5 stars, and one with typos and 3 stars, are still complaints.
    assert list(cleaned["sentiment"][10:12]) == ["negative", "negative"]
    assert list(cleaned["keep"][10:12]) == [True, True]
    # "test" is spam: no sentiment, not kept.
    assert cleaned["is_spam"].iloc[12] and not cleaned["keep"].iloc[12]
    assert not cleaned["keep"][:5].any()  # praise is not kept
    assert list(cleaned.columns) == ["free_text", "sentiment", "is_spam", "keep", "rating", "category"]
