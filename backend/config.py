"""Central configuration. Everything secret comes from environment variables (see .env.example)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

try:  # optional: load .env if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:  # pragma: no cover
    pass

DATA_PATH = ROOT / "data" / "wolfhacks_2026_student_outcomes.xlsx"
ARTIFACT_DIR = ROOT / "backend" / "ml" / "artifacts"
LOCAL_DB_PATH = ROOT / "data" / "local_demo.db"
SQL_DIR = ROOT / "sql"

DATABASE_URL = (os.getenv("TIGER_DATABASE_URL") or os.getenv("DATABASE_URL") or "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

# DEMO_MODE=true forces local SQLite + deterministic (non-Gemini) explanations.
# Anything else ("auto" by default) enables Tiger Data / Gemini automatically when credentials exist.
FORCE_LOCAL = os.getenv("DEMO_MODE", "auto").strip().lower() in ("true", "1", "yes")

TREE_MAX_DEPTH = int(os.getenv("TREE_MAX_DEPTH", "4"))
# min_samples_leaf=30 chosen by 5-fold CV on the training split: keeps leaves graded (not 0%/100%) with ~same F1/AUC.
TREE_MIN_SAMPLES_LEAF = int(os.getenv("TREE_MIN_SAMPLES_LEAF", "30"))
RANDOM_STATE = 42

# Hyperparameter search (backend/ml/train.py). The 20% test split is never used for the search.
TUNE_GRID = {"max_depth": [3, 4, 5, 6], "min_samples_leaf": [5, 10, 20, 30, 40, 50]}
TUNE_CV_FOLDS, TUNE_CV_REPEATS = 5, 3
# The tuned tree replaces the baseline only if, on the SAME held-out test set, ALL of these hold:
PROMOTE_MIN_F1_GAIN = 0.005    # F1 (at-risk class) improves by at least 0.5 percentage points
PROMOTE_MAX_RECALL_DROP = 0.02  # recall (at-risk students caught) falls by no more than 2 points
PROMOTE_MAX_AUC_DROP = 0.005    # ROC-AUC falls by no more than 0.005

# Risk bands (tree leaf probability). >= HIGH_T is exactly "predicted class 1".
LOW_T = 0.30
HIGH_T = 0.50

SEMESTER_START = "2026-08-17"  # Monday
SEMESTER_WEEKS = 12
MIDTERM_WEEK = 7

SYNTHETIC_NOTICE = "Demo uses synthetic WolfHacks 2026 student-course data. No real students are represented."
ACTIVITY_NOTICE = "Synthetic activity timeline derived from the WolfHacks dataset (the Excel file has no timestamps)."
