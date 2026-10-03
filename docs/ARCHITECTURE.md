# Architecture

- `backend/ml/train.py` — loads Excel, cleans, trains sklearn Pipeline, evaluates on held-out split, saves `model.joblib` + `metadata.json`.
- `backend/ml/predict.py` — loads the artifact (auto-retrains if missing or sklearn version differs); `predict()` returns risk, class, decision path and per-feature contributions.
- `backend/services/simulation_service.py` — re-runs the tree with slider overrides; cumulative step-by-step cascade; picks demo students from real predictions.
- `backend/services/tiger_service.py` + `backend/database.py` — Tiger Data / PostgreSQL with automatic SQLite fallback; seeding and SQL analytics (`sql/analytics.sql`).
- `backend/services/gemini_service.py` — builds the model-derived context, calls Gemini, falls back to Python text.
- `backend/main.py` — FastAPI routes (`/api/health`, `/students`, `/student/{id}`, `/student/{id}/activity`, `/predict`, `/simulate`, `/model/metrics`, `/model/feature-importance`, `/model/tree-path/{id}`, `/gemini/explain`, `/gemini/recovery-plan`, `/analytics/overview`).
- `frontend/` — React app; every number shown comes from those endpoints.

Data flow for "Simulate": slider values → `POST /api/simulate` → `simulation_service.simulate()` → `predict.predict()` (the tree) once for current, once for simulated, plus once per changed lever for the cascade.
