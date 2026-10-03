"""Train the interpretable decision tree on the WolfHacks 2026 dataset.

Pipeline: ColumnTransformer(median imputation for numerics, one-hot for categoricals) -> DecisionTreeClassifier.
Metrics are computed on a stratified 20% held-out test set. Nothing is hardcoded.
"""
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

from backend import config
from backend.ml.features import CATEGORICAL, FEATURES, ID, NUMERIC, TARGET

MODEL_PATH = config.ARTIFACT_DIR / "model.joblib"
META_PATH = config.ARTIFACT_DIR / "metadata.json"


def load_dataset(path=config.DATA_PATH) -> pd.DataFrame:
    """Read + clean the 'Student Data' sheet."""
    df = pd.read_excel(path, sheet_name="Student Data")
    df.columns = [str(c).strip() for c in df.columns]
    missing = [c for c in FEATURES + [TARGET, ID] if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing columns: {missing}")
    df = df.drop_duplicates(subset=ID).copy()
    for c in NUMERIC + [TARGET]:
        df[c] = pd.to_numeric(df[c], errors="coerce")  # blanks -> NaN (imputed inside the pipeline)
    for c in CATEGORICAL + [ID]:
        df[c] = df[c].astype(str).str.strip()
    df = df.dropna(subset=[TARGET])
    df[TARGET] = df[TARGET].astype(int)
    return df.reset_index(drop=True)


def build_pipeline(max_depth: int = config.TREE_MAX_DEPTH, min_samples_leaf: int = config.TREE_MIN_SAMPLES_LEAF) -> Pipeline:
    pre = ColumnTransformer(
        [
            ("num", SimpleImputer(strategy="median"), NUMERIC),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ],
        verbose_feature_names_out=True,
    )
    tree = DecisionTreeClassifier(max_depth=max_depth, min_samples_leaf=min_samples_leaf, random_state=config.RANDOM_STATE,
                                  class_weight="balanced")
    return Pipeline([("pre", pre), ("tree", tree)])


def original_feature(tf_name: str) -> str:
    """'num__attendance_rate' -> 'attendance_rate';  'cat__course_BIO 181' -> 'course'."""
    name = tf_name.split("__", 1)[1]
    for c in CATEGORICAL:
        if name.startswith(c + "_"):
            return c
    return name


CV_SCORING = {"accuracy": "accuracy", "precision": "precision", "recall": "recall", "f1": "f1", "roc_auc": "roc_auc"}
METRIC_KEYS = list(CV_SCORING)


def evaluate(pipe: Pipeline, X, y) -> dict:
    """The five reported metrics + confusion matrix for a fitted pipeline on (X, y)."""
    pred, proba = pipe.predict(X), pipe.predict_proba(X)[:, 1]
    cm = confusion_matrix(y, pred, labels=[0, 1])
    return {
        "accuracy": float(accuracy_score(y, pred)), "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)), "f1": float(f1_score(y, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, proba)),
        "confusion_matrix": {"labels": ["not at risk", "at risk"], "matrix": cm.tolist(),
                             "tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1])},
    }


def _params(pipe: Pipeline) -> dict:
    t = pipe.named_steps["tree"]
    return {"max_depth": t.max_depth, "min_samples_leaf": t.min_samples_leaf}


def tune_and_select(X_tr, y_tr, X_te, y_te) -> dict:
    """Baseline vs tuned, with a leak-free protocol.

    1. SEARCH: repeated stratified k-fold CV on the TRAINING split only (the test split is not passed in here).
       Candidate ranking: mean CV F1 of the at-risk class (primary), then CV ROC-AUC, then the simpler tree.
    2. COMPARE: baseline and tuned are each fitted on the full training split and scored once on the SAME test split.
    3. SELECT: the tuned tree replaces the baseline only if it clears the promotion rule in backend/config.py
       (F1 gain, bounded recall and ROC-AUC loss). Otherwise the baseline stays the production model.
    """
    cv = RepeatedStratifiedKFold(n_splits=config.TUNE_CV_FOLDS, n_repeats=config.TUNE_CV_REPEATS, random_state=config.RANDOM_STATE)
    grid = {f"tree__{k}": v for k, v in config.TUNE_GRID.items()}
    gs = GridSearchCV(build_pipeline(), grid, scoring=CV_SCORING, refit=False, cv=cv, n_jobs=1)
    gs.fit(X_tr, y_tr)  # test split never enters the search
    res = gs.cv_results_
    cands = []
    for i, p in enumerate(res["params"]):
        cands.append({"max_depth": int(p["tree__max_depth"]), "min_samples_leaf": int(p["tree__min_samples_leaf"]),
                      "cv": {k: float(res[f"mean_test_{k}"][i]) for k in METRIC_KEYS}})
    cands.sort(key=lambda c: (-round(c["cv"]["f1"], 4), -round(c["cv"]["roc_auc"], 4), c["max_depth"], -c["min_samples_leaf"]))
    best = cands[0]

    base_pipe = build_pipeline().fit(X_tr, y_tr)
    tuned_pipe = build_pipeline(best["max_depth"], best["min_samples_leaf"]).fit(X_tr, y_tr)
    base_p, tuned_p = _params(base_pipe), _params(tuned_pipe)
    base_cv = next((c["cv"] for c in cands if (c["max_depth"], c["min_samples_leaf"]) == (base_p["max_depth"], base_p["min_samples_leaf"])), None)
    b, t = evaluate(base_pipe, X_te, y_te), evaluate(tuned_pipe, X_te, y_te)

    same_config = base_p == tuned_p
    checks = {
        "f1_gain": t["f1"] - b["f1"] >= config.PROMOTE_MIN_F1_GAIN,
        "recall_kept": b["recall"] - t["recall"] <= config.PROMOTE_MAX_RECALL_DROP,
        "auc_kept": b["roc_auc"] - t["roc_auc"] <= config.PROMOTE_MAX_AUC_DROP,
    }
    promoted = (not same_config) and all(checks.values())
    if same_config:
        reason = "The search picked the same settings as the baseline, so there is nothing to compare."
    elif promoted:
        reason = "The tuned tree improved hold-out F1 without losing recall or ROC-AUC beyond the allowed margins."
    else:
        failed = [{"f1_gain": f"F1 did not improve by at least {config.PROMOTE_MIN_F1_GAIN * 100:.1f} points",
                   "recall_kept": f"recall fell by more than {config.PROMOTE_MAX_RECALL_DROP * 100:.0f} points",
                   "auc_kept": f"ROC-AUC fell by more than {config.PROMOTE_MAX_AUC_DROP:.3f}"}[k] for k, ok in checks.items() if not ok]
        reason = "Baseline kept: " + "; ".join(failed) + "."
    return {
        "pipe": tuned_pipe if promoted else base_pipe, "tuning": {
            "strategy": {
                "search": f"{config.TUNE_CV_FOLDS}-fold stratified CV x {config.TUNE_CV_REPEATS} repeats on the {len(X_tr)}-record training split only",
                "ranking": "highest mean CV F1 (at-risk class), then CV ROC-AUC, then the simpler tree",
                "promotion_rule": (f"tuned replaces baseline only if hold-out F1 improves by >= {config.PROMOTE_MIN_F1_GAIN * 100:.1f} pts, "
                                   f"recall drops <= {config.PROMOTE_MAX_RECALL_DROP * 100:.0f} pts and ROC-AUC drops <= {config.PROMOTE_MAX_AUC_DROP:.3f}"),
                "test_set": f"{len(X_te)} held-out records, not used in the search; used once to compare the two final models",
                "grid": config.TUNE_GRID, "candidates_evaluated": len(cands),
            },
            "baseline": {"params": base_p, "cv": base_cv, "test": b},
            "tuned": {"params": tuned_p, "cv": best["cv"], "test": t},
            "top_candidates": cands[:5],
            "same_config": same_config, "checks": checks, "promoted": promoted,
            "selected": "tuned" if promoted else "baseline",
            "improved": promoted,
            "verdict": "TUNED MODEL SELECTED" if promoted else "TUNING DID NOT IMPROVE THE HOLD-OUT MODEL",
            "reason": reason,
        },
    }


def train(verbose: bool = False) -> dict:
    df = load_dataset()
    X, y = df[FEATURES], df[TARGET]
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=config.RANDOM_STATE)

    sel = tune_and_select(X_tr, y_tr, X_te, y_te)
    pipe, tuning = sel["pipe"], sel["tuning"]
    ev = evaluate(pipe, X_te, y_te)  # metrics of the model that is actually saved and served

    pre, tree = pipe.named_steps["pre"], pipe.named_steps["tree"]
    names = [str(n) for n in pre.get_feature_names_out()]
    raw_imp = tree.feature_importances_
    agg = {}
    for n, v in zip(names, raw_imp):
        agg[original_feature(n)] = agg.get(original_feature(n), 0.0) + float(v)
    importance = [{"feature": f, "importance": v} for f, v in sorted(agg.items(), key=lambda kv: -kv[1])]

    desc = df[NUMERIC].describe(percentiles=[0.25, 0.5, 0.75]).T
    ranges = {c: {"min": float(desc.loc[c, "min"]), "p25": float(desc.loc[c, "25%"]),
                  "median": float(desc.loc[c, "50%"]), "p75": float(desc.loc[c, "75%"]),
                  "max": float(desc.loc[c, "max"]), "mean": float(desc.loc[c, "mean"])} for c in NUMERIC}

    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "dataset": {
            "records": int(len(df)), "at_risk_count": int(y.sum()), "at_risk_rate": float(y.mean()),
            "n_candidate_features": len(FEATURES), "features": FEATURES,
            "train_size": int(len(X_tr)), "test_size": int(len(X_te)),
            "missing_values": {c: int(df[c].isna().sum()) for c in FEATURES if df[c].isna().any()},
        },
        "model": {
            "type": "DecisionTreeClassifier", "max_depth": int(tree.get_depth()),
            "max_depth_param": tree.max_depth, "n_leaves": int(tree.get_n_leaves()),
            "class_weight": "balanced", "min_samples_leaf": tree.min_samples_leaf, "random_state": config.RANDOM_STATE,
            "selected": tuning["selected"],
            "preprocessing": "median imputation (numeric) + one-hot (course, class_year)",
        },
        "metrics": {
            **{k: ev[k] for k in METRIC_KEYS},
            "majority_baseline_accuracy": float(1 - y_te.mean()),
            "confusion_matrix": ev["confusion_matrix"],
            "evaluated_on": "held-out stratified 20% test split",
            "model_selected": tuning["selected"],
        },
        "tuning": tuning,
        "feature_importance": importance,
        "feature_importance_transformed": [
            {"feature": n, "importance": float(v)} for n, v in sorted(zip(names, raw_imp), key=lambda t: -t[1]) if v > 0],
        "tree_text": export_text(tree, feature_names=names, decimals=2),
        "ranges": ranges,
        "test_ids": df.loc[X_te.index, ID].tolist(),
    }
    config.ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, MODEL_PATH)
    META_PATH.write_text(json.dumps(meta, indent=2))
    # Guard: the saved file must reproduce the metrics written to metadata (Model Lab shows these numbers).
    again = evaluate(joblib.load(MODEL_PATH), X_te, y_te)
    assert all(abs(again[k] - meta["metrics"][k]) < 1e-12 for k in METRIC_KEYS), "saved model does not match saved metrics"
    if verbose:
        m = meta["metrics"]
        print(f"Records: {len(df)} | at-risk: {y.mean():.2%} | train/test: {len(X_tr)}/{len(X_te)}")
        print(f"Tree depth {meta['model']['max_depth']}, leaves {meta['model']['n_leaves']}")
        print(f"Accuracy {m['accuracy']:.3f}  Precision {m['precision']:.3f}  Recall {m['recall']:.3f}  "
              f"F1 {m['f1']:.3f}  ROC-AUC {m['roc_auc']:.3f}")
        print("Confusion matrix [[TN FP][FN TP]]:", m["confusion_matrix"]["matrix"])
        print("Top features:", [(i["feature"], round(i["importance"], 3)) for i in importance[:5]])
        t = tuning
        print(f"\nBASELINE {t['baseline']['params']}  test: " + "  ".join(f"{k} {t['baseline']['test'][k]:.3f}" for k in METRIC_KEYS))
        print(f"TUNED    {t['tuned']['params']}  test: " + "  ".join(f"{k} {t['tuned']['test'][k]:.3f}" for k in METRIC_KEYS))
        print(f"SELECTED: {t['selected'].upper()} | {t['verdict']} | {t['reason']}")
        print(f"Saved: {MODEL_PATH}\n       {META_PATH}")
    return meta


if __name__ == "__main__":
    train(verbose=True)
