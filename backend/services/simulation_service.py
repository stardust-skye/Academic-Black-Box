"""'Simulate my semester': re-run the REAL decision tree with modified behaviour values."""
from functools import lru_cache

import math

from backend.ml import predict
from backend.ml.features import LEVERS, LEVER_KEYS, fmt, label
from backend.services import data_service

LEVER_BY_KEY = {l["key"]: l for l in LEVERS}


def _isnan(v):
    return v is None or (isinstance(v, float) and math.isnan(v))


def lever_config(student_id: str) -> list:
    """Slider config for the UI: Data-Dictionary bounds + dataset quartiles + this student's current value."""
    base = data_service.features(student_id)
    rng = predict.meta()["ranges"]
    out = []
    for l in LEVERS:
        k = l["key"]
        cur = base[k]
        out.append({**l, "label": label(k), "current": cur, "imputed": _isnan(cur),
                    "default": rng[k]["median"] if _isnan(cur) else cur, "p25": rng[k]["p25"],
                    "median": rng[k]["median"], "p75": rng[k]["p75"], "dataset_min": rng[k]["min"],
                    "dataset_max": rng[k]["max"]})
    return out


def clean_overrides(overrides: dict) -> dict:
    out = {}
    for k, v in (overrides or {}).items():
        if k in LEVER_BY_KEY and v is not None:
            l = LEVER_BY_KEY[k]
            out[k] = min(max(float(v), l["min"]), l["max"])
    return out


def suggest_plan(student_id: str) -> dict:
    """A data-driven 'strong semester' target: move each lever to the dataset's better quartile if it is worse.
    (Midterm is excluded: it has already happened.)"""
    base = data_service.features(student_id)
    rng = predict.meta()["ranges"]
    plan = {}
    for l in LEVERS:
        k = l["key"]
        if k == "midterm_score":
            continue
        cur = base[k]
        r = rng[k]
        if l["good"] == "up":
            target = r["p75"]
            if _isnan(cur) or cur < target:
                plan[k] = round(target, 2)
        else:
            target = r["p25"]
            if not _isnan(cur) and cur > target:
                plan[k] = round(target, 2)
    return plan


def _summary(p: dict) -> dict:
    return {k: p[k] for k in ("risk_probability", "predicted_class", "band", "status")}


def simulate(student_id: str, overrides: dict) -> dict:
    base = data_service.features(student_id)
    ov = clean_overrides(overrides)
    changed = {k: v for k, v in ov.items() if _isnan(base[k]) or abs(v - base[k]) > 1e-9}
    sim = {**base, **changed}

    cur, new = predict.predict(base), predict.predict(sim)

    def span(k):
        return LEVER_BY_KEY[k]["max"] - LEVER_BY_KEY[k]["min"]

    order = sorted(changed, key=lambda k: -abs(changed[k] - (base[k] if not _isnan(base[k]) else changed[k])) / span(k))
    steps = [{"key": None, "label": "Current", "text": "Where you are now", "risk_after": cur["risk_probability"],
              "delta": 0.0}]
    running, prev = dict(base), cur["risk_probability"]
    for k in order:
        running[k] = changed[k]
        r = predict.predict(running)["risk_probability"]
        was = "n/a" if _isnan(base[k]) else fmt(k, base[k])
        steps.append({"key": k, "label": label(k), "text": f"{label(k)}: {was} → {fmt(k, changed[k])}",
                      "risk_after": r, "delta": r - prev})
        prev = r

    tf_new = predict.transform_row(sim)
    flipped = [{"text": s["text"], "label": s["label"]} for s in cur["decision_path"]
               if not predict.condition_holds(s, tf_new)]
    return {
        "student_id": student_id,
        "applied_overrides": changed,
        "current": cur, "simulated": new,
        "current_values": {k: base[k] for k in LEVER_KEYS},
        "simulated_values": {k: sim[k] for k in LEVER_KEYS},
        "delta": new["risk_probability"] - cur["risk_probability"],
        "steps": steps,
        "flipped_conditions": flipped,
        "note": "Probabilities are produced by re-running the trained decision tree. They describe model signal, not causation.",
    }


@lru_cache(maxsize=1)
def demo_students() -> dict:
    """Pick showcase students from the model's real predictions (nothing is hand-assigned)."""
    df = data_service.dataset()
    scores = data_service.all_scores()
    test_ids = set(predict.meta()["test_ids"])
    held = [s for s in df.index if s in test_ids]

    high = [s for s in held if scores[s] >= 0.5 and int(df.loc[s, "at_risk"]) == 1]
    best, best_drop = None, -1.0
    for s in sorted(high):
        plan = suggest_plan(s)
        drop = scores[s] - predict.predict({**data_service.features(s), **plan})["risk_probability"]
        if drop > best_drop + 1e-12:
            best, best_drop = s, drop
    medium = [s for s in sorted(held) if 0.30 <= scores[s] < 0.5]
    low = [s for s in sorted(held) if scores[s] < 0.30 and int(df.loc[s, "at_risk"]) == 0]
    mid_target = 0.4
    return {
        "high": best or (sorted(held, key=lambda s: -scores[s])[0]),
        "medium": min(medium, key=lambda s: abs(scores[s] - mid_target)) if medium else None,
        "low": min(low, key=lambda s: scores[s]) if low else None,
        "criteria": "Held-out students; 'high' = at-risk in the data and the model, with the largest drop under the "
                    "data-driven strong-semester plan.",
    }
