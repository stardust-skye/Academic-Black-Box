"""Inference + explanation helpers. Every probability in the app comes from here (the trained tree)."""
import json
import warnings

import joblib
import numpy as np
import pandas as pd
import sklearn

from backend import config
from backend.ml import train
from backend.ml.features import CATEGORICAL, FEATURES, NUMERIC, fmt, label

_B = None


def bundle() -> dict:
    """Load the saved pipeline (retrain automatically if missing or built with another sklearn version)."""
    global _B
    if _B is not None:
        return _B
    ok = train.MODEL_PATH.exists() and train.META_PATH.exists()
    if ok:
        try:
            meta = json.loads(train.META_PATH.read_text())
            if meta.get("sklearn_version") != sklearn.__version__:
                ok = False
            else:
                with warnings.catch_warnings():
                    warnings.simplefilter("error")
                    pipe = joblib.load(train.MODEL_PATH)
        except Exception:
            ok = False
    if not ok:
        meta = train.train()
        pipe = joblib.load(train.MODEL_PATH)
    _B = {"pipeline": pipe, "meta": meta}
    return _B


def meta() -> dict:
    return bundle()["meta"]


def frame(features: dict) -> pd.DataFrame:
    row = {}
    for f in FEATURES:
        v = features.get(f)
        if f in CATEGORICAL:
            row[f] = str(v) if v is not None else "unknown"
        else:
            row[f] = np.nan if v is None else float(v)
    return pd.DataFrame([row], columns=FEATURES)


def band(p: float) -> str:
    return "low" if p < config.LOW_T else ("medium" if p < config.HIGH_T else "high")


STATUS = {"low": "ON TRACK", "medium": "WATCH", "high": "AT RISK"}


def score_all(df: pd.DataFrame) -> np.ndarray:
    return bundle()["pipeline"].predict_proba(df[FEATURES])[:, 1]


def _node_risk(tree, node: int) -> float:
    v = tree.tree_.value[node][0]
    return float(v[1] / v.sum())


def transform_row(features: dict) -> dict:
    pre = bundle()["pipeline"].named_steps["pre"]
    X = np.asarray(pre.transform(frame(features)))[0]
    return dict(zip([str(n) for n in pre.get_feature_names_out()], X))


def predict(features: dict) -> dict:
    pipe = bundle()["pipeline"]
    pre, tree = pipe.named_steps["pre"], pipe.named_steps["tree"]
    df = frame(features)
    X = np.asarray(pre.transform(df))
    names = [str(n) for n in pre.get_feature_names_out()]
    prob = float(pipe.predict_proba(df)[0, 1])
    cls = int(pipe.predict(df)[0])

    t = tree.tree_
    nodes = tree.decision_path(X).indices.tolist()
    steps, contrib = [], {}
    for node, child in zip(nodes[:-1], nodes[1:]):
        fi = int(t.feature[node])
        tf = names[fi]
        orig = train.original_feature(tf)
        thr = float(t.threshold[node])
        x = float(X[0, fi])
        went_left = child == t.children_left[node]
        before, after = _node_risk(tree, node), _node_risk(tree, child)
        if orig in CATEGORICAL:
            val = tf.split("__", 1)[1][len(orig) + 1:]
            text = f"{label(orig)} is {val}" if not went_left else f"{label(orig)} is not {val}"
            value_disp = str(features.get(orig))
            op, thr_disp = ("=" if not went_left else "≠"), val
        else:
            op = "≤" if went_left else ">"
            thr_disp = fmt(orig, thr)
            value_disp = fmt(orig, x)
            text = f"{label(orig)} {op} {thr_disp}"
        steps.append({
            "node": int(node), "feature": orig, "tf_feature": tf, "label": label(orig),
            "operator": "<=" if went_left else ">", "threshold": thr, "threshold_display": thr_disp,
            "value": x, "value_display": value_disp,
            "imputed": bool(orig in NUMERIC and (features.get(orig) is None or features.get(orig) != features.get(orig))),
            "text": text, "risk_before": before, "risk_after": after, "delta": after - before,
        })
        contrib[orig] = contrib.get(orig, 0.0) + (after - before)

    leaf = nodes[-1]
    total = sum(abs(d) for d in contrib.values()) or 1.0

    def strength(share):  # share of the total tree-path risk movement; descriptive, not causal
        return "strong" if share >= 0.30 else ("moderate" if share >= 0.12 else "light")

    contributions = [
        {"feature": f, "label": label(f), "delta": d, "direction": "raises" if d > 0 else "lowers",
         "share": abs(d) / total, "strength": strength(abs(d) / total)}
        for f, d in sorted(contrib.items(), key=lambda kv: -abs(kv[1]))]
    b = band(prob)
    return {
        "risk_probability": prob, "predicted_class": cls, "band": b, "status": STATUS[b],
        "baseline_risk": _node_risk(tree, 0),
        "decision_path": steps, "contributions": contributions,
        "leaf": {"node": int(leaf), "training_samples": int(t.n_node_samples[leaf]), "risk": _node_risk(tree, leaf)},
    }


def condition_holds(step: dict, tf_values: dict) -> bool:
    x = tf_values[step["tf_feature"]]
    return (x <= step["threshold"]) if step["operator"] == "<=" else (x > step["threshold"])
