# Academic Black Box

> **See the risk. Understand why. Change the outcome.**

Academic Black Box is an AI-powered academic early-warning and intervention dashboard — "Google Maps for academic risk." A real scikit-learn **decision tree** (trained on the WolfHacks 2026 synthetic student-outcomes dataset) scores each student-course record, shows the exact **path through the tree** that produced the score, lets the student **simulate** a different semester (the tree is re-run, never faked), and asks **Gemini** to explain what changed and write a 7-day recovery plan. **Tiger Data (TimescaleDB/PostgreSQL)** stores and queries the activity time series behind the dashboard.

> Demo uses synthetic WolfHacks 2026 student-course data. No real students are represented. This is not an academically validated prediction system.

## The journey

`CURRENT RISK → WHY → SIMULATE CHANGE → NEW RISK → GEMINI ACTION PLAN`

## The product

A student-facing app, not an admin dashboard. The student enters a student ID (no passwords, hackathon demo), watches their semester get analyzed, and moves through one story:

`LOGIN → MY SEMESTER → RISK → WHY? → WHAT IF? → GEMINI RECOVERY PLAN`

- **Login**: full-screen entry. The backend (`POST /api/login`) checks the ID exists ("Student ID not found." otherwise). **Try demo student** loads the model-selected high-risk showcase record from `/api/students`; nothing is hardcoded.
- **My Semester**: huge animated risk number (the real model score), the student's own signals compared with the dataset median (from the trained model's metadata), top model signals, and "Your academic activity" (Tiger Data or local fallback, labelled honestly).
- **Why?**: the student's actual route through the decision tree as a visual path, the strongest model signals, and Gemini ("Black Box Intelligence") explaining the result.
- **Simulate** (hero): grouped sliders (Study, Consistency, Wellbeing, Academics) over real dataset fields and ranges. "Simulate my semester" calls `POST /api/simulate`, which re-runs the trained tree; the UI shows the returned numbers only. A "biggest opportunity" card and Gemini recovery plan follow.
- **Model Lab** (for judges): 800 records, 27.75% at-risk, held-out metrics, confusion matrix, feature importance, a drawn tree, dataset and pipeline details.
- Language is deliberately non-causal: "model signals", "risk path", "According to this model simulation...", plus "These are model signals, not proof of causation."
- Runs with **zero external services** (local SQLite + deterministic explanations); lights up Tiger Data and Gemini when keys are present.

## Architecture

```
 Excel (800 rows) ──► ml/train.py ──► Pipeline(impute + one-hot + DecisionTree) ──► model.joblib + metadata.json
                                                    │
 React + Vite + Tailwind ◄── FastAPI (/api/*) ◄─────┤ predict / decision path / simulate (REAL tree)
   Recharts · Framer Motion        │                │
                                   ├── tiger_service ──► Tiger Data / PostgreSQL + TimescaleDB  (fallback: local SQLite)
                                   └── gemini_service ─► Google Gemini (fallback: deterministic Python text)
```

## Tech stack

Frontend: React 18, Vite, Tailwind CSS 3, Recharts, Framer Motion, Lucide.
Backend: Python, FastAPI, Uvicorn, pandas, numpy, scikit-learn, openpyxl, joblib.
Data: PostgreSQL / Tiger Data (TimescaleDB) via SQLAlchemy + psycopg; SQLite fallback.
AI: Google Gemini via the official `google-genai` SDK (backend only).

## How the decision tree works

- Data: `Student Data` sheet, 800 records, target `at_risk` (1 = final D/F, ~28%).
- Features (17): course, class_year, credit_hours, work_hours_per_week, avg_weekly_study_hours, study_sessions_logged, materials_uploaded, practice_quizzes_taken, avg_practice_quiz_score, flashcards_reviewed, avg_days_started_before_exam, on_time_submission_rate, missed_deadlines, late_night_study_pct, attendance_rate, avg_sleep_hours, midterm_score.
- **No leakage**: `at_risk` and `student_id` are never inputs; `midterm_score` is allowed because it exists mid-semester.
- Preprocessing (in one sklearn `Pipeline`): median imputation for blanks (work hours, quiz score, sleep), one-hot for course and class year.
- Model: `DecisionTreeClassifier(max_depth=4, class_weight="balanced", min_samples_leaf=30, random_state=42)`. `min_samples_leaf` was picked by 5-fold CV on the training split so leaves give graded scores instead of 0%/100%.
- Evaluation: stratified 80/20 split; metrics computed on the 160 held-out rows and exposed at `/api/model/metrics`.
- **Risk score** = fraction of (class-weighted) training records in the student's leaf that ended D/F. It is a tree leaf proportion, *not* a calibrated probability. Bands: <30% on track, 30–50% watch, ≥50% at risk (= predicted class 1).
- **Per-student explanation**: along the decision path, each split changes the node's risk estimate; the movement is attributed to that feature and bucketed into strong / moderate / light **model signals**. This is descriptive, not causal. Feature importance is impurity-based and is not causal.

## How Tiger Data is used

`sql/schema.sql` creates `students` and a `student_activity` **hypertable** (`create_hypertable('student_activity','ts')`). `sql/analytics.sql` holds the `time_bucket` queries that power the activity stream and the cohort chart. Activity is a **synthetic timeline derived from the dataset** (the Excel file has no timestamps) — generated deterministically per student and preserving each student's totals. Details: `docs/TIGER_DATA.md`.

## How Gemini is used

The backend builds a JSON context **from the tree** (risk score, decision path, signals, targets, optional simulation result) and asks Gemini for structured JSON: `generate_risk_explanation()` and `generate_recovery_plan()`. Gemini never produces or alters a probability. Without a key (or on any error) a deterministic Python fallback returns the same JSON shape. Details: `docs/GEMINI.md`.

## Run locally

See `QUICKSTART.md`. Short version:

```bash
pip install -r backend/requirements.txt
python scripts/train_model.py        # trains + prints metrics
python scripts/seed_database.py      # seeds Tiger Data if DATABASE_URL set, else local SQLite
uvicorn backend.main:app --reload    # API on :8000
cd frontend && npm install && npm run dev   # UI on :5173
```

The API also trains/seeds automatically on first start if you skip the scripts.

### Environment variables (all optional)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `TIGER_DATABASE_URL` | Tiger Data / PostgreSQL connection string (`postgresql://user:pass@host:port/db?sslmode=require`) |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_MODEL` | default `gemini-2.5-flash` |
| `DEMO_MODE` | `auto` (default) or `true` to force local SQLite + local explanations |

### Run without Tiger Data / without Gemini

Just leave the variables empty. The activity section shows **DEMO DATA · LOCAL MODE** and Gemini cards show **Local mode**; every screen still works. Tiger Data is only labelled **LIVE** when the backend is actually connected to it.

## 3-minute demo

See `DEMO_SCRIPT.md`.

## Known limitations

- Synthetic data; the tree captures patterns planted in the dataset, not real academic causation.
- The risk score is an uncalibrated leaf proportion under class-balanced weighting.
- The tree is shallow by design (interpretability). In this dataset the midterm score dominates; study hours do not appear in the depth-4 tree, so moving study time alone may not change the score — the simulator shows this honestly.
- Activity timeline is generated from semester totals, not observed. Week-by-week risk trend uses pace-projection and median imputation before the midterm.
- The saved model is trained on 80% of the records (the rest are the held-out test set); 'held-out' badges show which is which.
- ElevenLabs, Solana and domain setup were intentionally not implemented.
