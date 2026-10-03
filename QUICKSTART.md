# Quickstart

Requires Python 3.10+ and Node 18+.

```bash
# 1. backend deps
pip install -r backend/requirements.txt

# 2. train the decision tree (prints accuracy / precision / recall / F1)
python scripts/train_model.py

# 3. seed the activity data (Tiger Data if DATABASE_URL is set, otherwise local SQLite)
python scripts/seed_database.py

# 4. API (run from the repo root)
uvicorn backend.main:app --reload

# 5. frontend (new terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Open http://localhost:5173. Enter a student ID such as `S1030` (any `S1000`-`S1799`) or click **Try demo student**.

## Environment variables (optional)

Copy `.env.example` to `.env`.

- `DATABASE_URL` (or `TIGER_DATABASE_URL`): Tiger Data connection string. Empty = local SQLite ("Demo mode — local data").
- `GEMINI_API_KEY`: from https://aistudio.google.com/apikey. Empty = deterministic local explanations.
- `DEMO_MODE=true` forces both fallbacks even if keys are set.

Steps 2 and 3 are optional — the API trains and seeds itself on first start.

## One-port build (optional)

`cd frontend && npm run build` — then `uvicorn backend.main:app` serves the UI at http://localhost:8000.
