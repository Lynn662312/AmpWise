"""Cleans ML's driver feedback: reads the sentiment from the comment text and marks spam.

Run from the repo root (needs scikit-learn: pip install -r ml/requirements.txt):
    python ml/src/preprocessing/clean_feedback.py
Reads   ml/output/acn_synth/feedback.csv
Writes  ml/output/acn_synth/feedback_clean.csv   same rows, plus the columns sentiment, is_spam and keep

Why not use the star rating directly: some drivers write a complaint and still give 4 or 5 stars.
So a small text model learns which wording goes with high and low ratings, and every comment is then
judged by its wording alone. Two comments with the same text always get the same sentiment.
"""

from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

SYNTH_DIR = Path(__file__).resolve().parents[2] / "output" / "acn_synth"
MIN_WORDS = 3  # a comment with fewer different words ("test", "aaaaaa", ".") describes nothing: spam


def mark_spam(text: pd.Series) -> pd.Series:
    """True for comments too short to describe anything."""
    different_words = text.str.lower().str.findall(r"[a-z']+").apply(lambda words: len(set(words)))
    return different_words < MIN_WORDS


def read_sentiment(text: pd.Series, rating: pd.Series) -> pd.Series:
    """ "positive" or "negative" for each comment, from its wording.

    The ratings only teach the model: comments with 4-5 stars are the examples of positive wording and
    comments with 1-2 stars of negative wording (3 stars are left out). It looks at pieces of words,
    so a comment with a typo is still recognised.
    """
    clear = rating != 3
    model = make_pipeline(TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4)), LogisticRegression(max_iter=1000))
    model.fit(text[clear], rating[clear] >= 4)
    return pd.Series(model.predict(text), index=text.index).map({True: "positive", False: "negative"})


def clean_feedback(feedback: pd.DataFrame) -> pd.DataFrame:
    """The same rows with three new columns after the comment: sentiment, is_spam, keep."""
    is_spam = mark_spam(feedback["free_text"])
    real = feedback[~is_spam]
    sentiment = read_sentiment(real["free_text"], real["rating"]).reindex(feedback.index)  # empty for spam

    cleaned = feedback.copy()
    after_comment = cleaned.columns.get_loc("free_text") + 1
    cleaned.insert(after_comment, "sentiment", sentiment)
    cleaned.insert(after_comment + 1, "is_spam", is_spam)
    # keep = a real complaint: this is what the backend counts.
    cleaned.insert(after_comment + 2, "keep", (sentiment == "negative") & ~is_spam)
    return cleaned


if __name__ == "__main__":
    cleaned = clean_feedback(pd.read_csv(SYNTH_DIR / "feedback.csv"))
    cleaned.to_csv(SYNTH_DIR / "feedback_clean.csv", index=False)

    complaints = cleaned[cleaned["keep"]]
    print(f"Rows: {len(cleaned)} | spam: {cleaned['is_spam'].sum()} | positive: {(cleaned['sentiment'] == 'positive').sum()}")
    print(f"Complaints kept: {len(complaints)}, of which {(complaints['rating'] >= 4).sum()} had 4 or 5 stars")
    print(f"Written to {SYNTH_DIR / 'feedback_clean.csv'}")
