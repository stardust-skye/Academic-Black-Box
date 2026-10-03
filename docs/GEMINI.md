# Gemini

`backend/services/gemini_service.py`, official `google-genai` SDK, key read from `GEMINI_API_KEY` (server-side only; model via `GEMINI_MODEL`, default `gemini-2.5-flash`).

- `build_context()` assembles JSON from the tree: risk score, class, course, key behaviours, decision path, per-feature signals, top global features, dataset-quartile targets, and (optionally) the simulation result.
- `generate_risk_explanation()` → `{summary, prediction_meaning, key_factors[], actionable_levers[], what_changed, limitations[]}`.
- `generate_recovery_plan()` → `{headline, days[7], success_signals[], disclaimer}`.
- Prompts forbid inventing probabilities and require "model signal" wording; responses are requested as JSON and validated. The probabilities shown in the UI always come from the API's tree output.
- Any failure (no key, network, bad JSON) returns the deterministic Python fallback with `source: "fallback"` and a reason; the UI labels it.
