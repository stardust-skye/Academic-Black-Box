"""Read-only access to the Excel dataset (source of truth for student feature values)."""
from functools import lru_cache

import numpy as np

from backend.ml import predict, train
from backend.ml.features import FEATURES, ID, TARGET


@lru_cache(maxsize=1)
def dataset():
    return train.load_dataset().set_index(ID, drop=False)


def exists(student_id: str) -> bool:
    return student_id in dataset().index


def features(student_id: str) -> dict:
    """Model input for a student; NaN (blank) values become None."""
    row = dataset().loc[student_id]
    out = {}
    for f in FEATURES:
        v = row[f]
        out[f] = None if (not isinstance(v, str) and v != v) else (v if isinstance(v, str) else float(v))
    return out


def profile(student_id: str) -> dict:
    row = dataset().loc[student_id]
    test_ids = set(predict.meta()["test_ids"])
    return {
        "student_id": student_id, "course": row["course"], "class_year": row["class_year"],
        "actual_at_risk": int(row[TARGET]),
        "split": "held-out test" if student_id in test_ids else "training",
    }


@lru_cache(maxsize=1)
def all_scores():
    df = dataset()
    p = predict.score_all(df)
    return dict(zip(df.index, p.tolist()))


def student_list() -> list:
    df = dataset()
    scores = all_scores()
    test_ids = set(predict.meta()["test_ids"])
    out = []
    for sid, row in df.iterrows():
        p = scores[sid]
        out.append({"student_id": sid, "course": row["course"], "class_year": row["class_year"],
                    "risk_probability": p, "band": predict.band(p), "held_out": sid in test_ids})
    return out
