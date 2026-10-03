"""Gemini = explanation + planning ONLY. The numbers always come from the decision tree.

Both public functions return structured JSON and NEVER raise: if Gemini is not configured or fails, a deterministic
Python fallback produces the same JSON shape (source = "fallback")."""
import json
import re

from backend import config
from backend.ml import predict
from backend.ml.features import LEVER_KEYS, fmt, label
from backend.services import data_service, simulation_service

ACTIONABLE = {"avg_weekly_study_hours", "attendance_rate", "on_time_submission_rate", "missed_deadlines",
              "avg_practice_quiz_score", "practice_quizzes_taken", "avg_sleep_hours", "late_night_study_pct",
              "avg_days_started_before_exam", "work_hours_per_week"}


def enabled() -> bool:
    return bool(config.GEMINI_API_KEY) and not config.FORCE_LOCAL


def status() -> dict:
    return {"configured": enabled(), "model": config.GEMINI_MODEL if enabled() else None,
            "mode": "live" if enabled() else "fallback"}


# ---------------------------------------------------------------- context (all numbers come from the model)
def build_context(student_id: str, overrides: dict = None) -> dict:
    base = data_service.features(student_id)
    pred = predict.predict(base)
    imp = predict.meta()["feature_importance"]
    plan = simulation_service.suggest_plan(student_id)
    targets = [{"feature": k, "label": label(k), "current": base[k], "current_display": fmt(k, base[k]),
                "target": v, "target_display": fmt(k, v)} for k, v in plan.items()]
    ctx = {
        "student_id": student_id, "course": base["course"], "class_year": base["class_year"],
        "risk_probability": round(pred["risk_probability"], 4), "predicted_class": pred["predicted_class"],
        "status": pred["status"],
        "study_hours": base["avg_weekly_study_hours"], "attendance": base["attendance_rate"],
        "submission_rate": base["on_time_submission_rate"], "missed_deadlines": base["missed_deadlines"],
        "midterm_score": base["midterm_score"],
        "decision_path": [f"{s['text']} (student value: {s['value_display']})" for s in pred["decision_path"]],
        "model_signals": [{"feature": c["label"], "tree_path_risk_shift_points": round(c["delta"] * 100, 1),
                           "signal_strength": c["strength"]}
                          for c in pred["contributions"]],
        "top_features": [label(i["feature"]) for i in imp[:5]],
        "suggested_targets_from_dataset_quartiles": targets,
    }
    if overrides:
        sim = simulation_service.simulate(student_id, overrides)
        ctx["simulation"] = {
            "risk_before": round(sim["current"]["risk_probability"], 4),
            "risk_after": round(sim["simulated"]["risk_probability"], 4),
            "predicted_class_after": sim["simulated"]["predicted_class"],
            "changes": [s["text"] for s in sim["steps"][1:]],
            "step_by_step_risk": [round(s["risk_after"], 4) for s in sim["steps"]],
            "decision_conditions_no_longer_true": [f["text"] for f in sim["flipped_conditions"]],
            "new_decision_path": [s["text"] for s in sim["simulated"]["decision_path"]],
        }
    return ctx


# ---------------------------------------------------------------- Gemini call
RULES = """You are the explanation layer of "Academic Black Box", a student early-warning demo built on synthetic data.
HARD RULES:
- A scikit-learn decision tree produced every number in the JSON context. NEVER invent, recompute or adjust a risk probability.
  Only quote numbers that appear in the context.
- Say "model signal", not "this caused". The tree is correlational, not causal; the data is synthetic and not academically validated.
- Be specific, kind, practical and concise. No guarantees. Address the student as "you".
- Return ONLY valid JSON matching the requested shape, no markdown."""

EXPLAIN_SHAPE = """{
 "summary": "2-3 sentences: what the model predicted and the headline reason",
 "prediction_meaning": "plain-English reading of the decision path",
 "key_factors": [{"factor": "feature name", "insight": "how it shows up in the path / model signal"}],
 "actionable_levers": [{"lever": "feature name", "suggestion": "concrete change using the provided targets"}],
 "what_changed": "ONLY if context has 'simulation': why the simulated risk moved, referencing the conditions no longer true; else empty string",
 "limitations": ["short caveats about uncertainty, synthetic data, correlation vs causation"]
}"""

PLAN_SHAPE = """{
 "headline": "one motivating sentence",
 "days": [{"day": 1, "focus": "short title", "actions": ["2-3 concrete actions"], "target_metric": "what to track"}],
 "success_signals": ["how the student will know it is working"],
 "disclaimer": "one short sentence: this is a planning aid based on a demo model, talk to your instructor/advisor"
}  (exactly 7 days)"""


def _call_gemini(prompt: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=config.GEMINI_API_KEY, http_options=types.HttpOptions(timeout=25000))
    resp = client.models.generate_content(
        model=config.GEMINI_MODEL, contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.3))
    txt = (resp.text or "").strip()
    txt = re.sub(r"^```(?:json)?|```$", "", txt, flags=re.M).strip()
    return json.loads(txt)


def _with_gemini(prompt: str, required: list, fallback: dict) -> dict:
    if not enabled():
        return {**fallback, "source": "fallback", "fallback_reason": "Gemini not configured"}
    try:
        out = _call_gemini(prompt)
        if not isinstance(out, dict) or any(k not in out for k in required):
            raise ValueError("incomplete JSON")
        return {**out, "source": "gemini", "model": config.GEMINI_MODEL}
    except Exception as e:  # never break the dashboard
        return {**fallback, "source": "fallback", "fallback_reason": f"Gemini call failed ({type(e).__name__})"}


# ---------------------------------------------------------------- deterministic fallbacks
def _fallback_explanation(ctx: dict) -> dict:
    p = ctx["risk_probability"]
    cls = "at risk of a D/F" if ctx["predicted_class"] == 1 else "not flagged as at risk"
    path = ctx["decision_path"]
    factors = []
    for sgn in ctx["model_signals"][:4]:
        d = sgn["tree_path_risk_shift_points"]
        factors.append({"factor": sgn["feature"],
                        "insight": f"{sgn['signal_strength'].capitalize()} model signal: the split on this feature moved the "
                                   f"tree's risk estimate {'up' if d > 0 else 'down'} along your path. "
                                   f"This is a pattern in the data, not proof of cause."})
    levers = [{"lever": t["label"], "suggestion": f"Move from {t['current_display']} toward {t['target_display']} "
                                                   f"(the better-performing quartile in the dataset)."}
              for t in ctx["suggested_targets_from_dataset_quartiles"]][:4]
    changed = ""
    if "simulation" in ctx:
        s = ctx["simulation"]
        flips = s["decision_conditions_no_longer_true"]
        changed = (f"Simulated risk moved from {s['risk_before']:.0%} to {s['risk_after']:.0%}. "
                   + (f"The tree stopped following these conditions: {'; '.join(flips)}. " if flips else
                      "The simulated changes did not cross any split used on your current path, so the score stayed in the same branch. ")
                   + "Changes: " + "; ".join(s["changes"]) + ".")
    return {
        "summary": f"The decision tree scores you {p:.0%} ({cls}). The score is the share of similar training records "
                   f"that ended with a D/F in the leaf your data lands in.",
        "prediction_meaning": "Your record followed this path: " + " → ".join(path) + ".",
        "key_factors": factors, "actionable_levers": levers, "what_changed": changed,
        "limitations": ["Synthetic WolfHacks data; not academically validated.",
                        "Tree splits describe correlation in the data, not what caused any outcome.",
                        "Scores are leaf proportions under class-balanced weighting, not calibrated probabilities."],
    }


def _fallback_plan(ctx: dict) -> dict:
    t = {x["feature"]: x for x in ctx["suggested_targets_from_dataset_quartiles"]}
    order = [k for k in ("on_time_submission_rate", "attendance_rate", "missed_deadlines", "avg_weekly_study_hours",
                         "avg_days_started_before_exam", "avg_practice_quiz_score", "practice_quizzes_taken", "avg_sleep_hours") if k in t]
    def goal(k): return f"{t[k]['label']}: {t[k]['current_display']} → {t[k]['target_display']}"
    focus = [goal(k) for k in order] or ["Keep current habits steady"]
    f = lambda i: focus[i % len(focus)]
    days = [
        {"day": 1, "focus": "Audit & calendar", "actions": ["List every upcoming deadline and exam for this course in one calendar.",
         "Block your study sessions for the week.", "Email or visit office hours to confirm priorities."],
         "target_metric": "All deadlines visible in one place"},
        {"day": 2, "focus": f(0), "actions": [f"Work on: {f(0)}.", "Set reminders 24h before each deadline."],
         "target_metric": f(0)},
        {"day": 3, "focus": f(1), "actions": [f"Work on: {f(1)}.", "Attend every class and note one question to ask."],
         "target_metric": f(1)},
        {"day": 4, "focus": f(2), "actions": [f"Work on: {f(2)}.", "Start the next assignment today, not the night before."],
         "target_metric": f(2)},
        {"day": 5, "focus": "Practice & retrieval", "actions": ["Do one practice quiz and review every miss.", "Review flashcards in two short sessions."],
         "target_metric": "Quiz score trending upward"},
        {"day": 6, "focus": "Sleep & rhythm", "actions": ["Avoid midnight–4am studying; move the session earlier.", "Aim for a consistent bedtime."],
         "target_metric": "Late-night study share down, sleep up"},
        {"day": 7, "focus": "Review & reset", "actions": ["Compare this week to your targets.", "Pick the next week's two highest-impact habits."],
         "target_metric": "Progress vs. targets"},
    ]
    return {"headline": "Small, specific habit changes this week — aimed at the signals the model flagged.",
            "days": days,
            "success_signals": ["On-time submissions rising", "No new missed deadlines", "Practice quiz scores improving"],
            "disclaimer": "Planning aid from a demo model on synthetic data; talk to your instructor or advisor."}


# ---------------------------------------------------------------- public API
def generate_risk_explanation(ctx: dict) -> dict:
    prompt = f"{RULES}\n\nReturn JSON of this shape:\n{EXPLAIN_SHAPE}\n\nCONTEXT (from the trained decision tree):\n{json.dumps(ctx, default=str)}"
    return _with_gemini(prompt, ["summary", "prediction_meaning", "key_factors", "actionable_levers", "limitations"],
                        _fallback_explanation(ctx))


def generate_recovery_plan(ctx: dict) -> dict:
    prompt = (f"{RULES}\n\nCreate a practical 7-day academic recovery plan using the suggested targets. "
              f"Return JSON of this shape:\n{PLAN_SHAPE}\n\nCONTEXT (from the trained decision tree):\n{json.dumps(ctx, default=str)}")
    out = _with_gemini(prompt, ["headline", "days", "success_signals"], _fallback_plan(ctx))
    if out.get("source") == "gemini" and (not isinstance(out["days"], list) or len(out["days"]) != 7):
        return {**_fallback_plan(ctx), "source": "fallback", "fallback_reason": "Gemini returned an invalid plan"}
    return out
