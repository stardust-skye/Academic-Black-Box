"""Database connection with automatic fallback.

DATABASE_URL / TIGER_DATABASE_URL set and reachable  -> PostgreSQL / Tiger Data (TimescaleDB hypertable if available)
otherwise (or DEMO_MODE=true)                        -> local SQLite file ("Demo mode — local data")
The app never crashes because the database is missing.
"""
import re
import threading

from sqlalchemy import create_engine, text

from backend import config

_lock = threading.Lock()
_engine = None
INFO = {"mode": "local", "backend": "sqlite", "timescale": False, "error": None}

SQLITE_DDL = [
    """CREATE TABLE IF NOT EXISTS students (
        student_id TEXT PRIMARY KEY, course TEXT NOT NULL, class_year TEXT, credit_hours REAL,
        work_hours_per_week REAL, avg_weekly_study_hours REAL, study_sessions_logged REAL,
        materials_uploaded REAL, practice_quizzes_taken REAL, avg_practice_quiz_score REAL,
        flashcards_reviewed REAL, avg_days_started_before_exam REAL, on_time_submission_rate REAL,
        missed_deadlines REAL, late_night_study_pct REAL, attendance_rate REAL, avg_sleep_hours REAL,
        midterm_score REAL, at_risk INTEGER)""",
    """CREATE TABLE IF NOT EXISTS student_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, course TEXT NOT NULL, ts TEXT NOT NULL,
        study_minutes INTEGER NOT NULL DEFAULT 0, study_sessions INTEGER NOT NULL DEFAULT 0,
        quizzes_taken INTEGER NOT NULL DEFAULT 0, assignment_completion_rate REAL, attendance_rate REAL,
        quiz_score REAL, missed_deadlines INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""",
    "CREATE INDEX IF NOT EXISTS idx_activity_student_ts ON student_activity (student_id, ts)",
]


def _normalize(url: str) -> str:
    return re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg://", url)


def _init_postgres(engine):
    sql = (config.SQL_DIR / "schema.sql").read_text()
    sql = re.sub(r"--.*", "", sql)
    timescale = False
    for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
        try:
            with engine.begin() as c:
                c.execute(text(stmt))
            if "create_hypertable" in stmt.lower():
                timescale = True
        except Exception:
            if "create_hypertable" not in stmt.lower():
                raise
    return timescale


def _init_sqlite(engine):
    with engine.begin() as c:
        for stmt in SQLITE_DDL:
            c.execute(text(stmt))


def use_local(error=None):
    global _engine
    config.LOCAL_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(f"sqlite:///{config.LOCAL_DB_PATH}", connect_args={"check_same_thread": False})
    _init_sqlite(_engine)
    INFO.update({"mode": "local", "backend": "sqlite", "timescale": False, "error": error})
    return _engine


def get_engine():
    global _engine
    with _lock:
        if _engine is not None:
            return _engine
        if config.DATABASE_URL and not config.FORCE_LOCAL:
            try:
                eng = create_engine(_normalize(config.DATABASE_URL), pool_pre_ping=True,
                                    connect_args={"connect_timeout": 6})
                with eng.connect() as c:
                    c.execute(text("SELECT 1"))
                ts = _init_postgres(eng)
                _engine = eng
                INFO.update({"mode": "tiger", "backend": "postgresql", "timescale": ts, "error": None})
                return _engine
            except Exception as e:  # unreachable / bad credentials -> demo mode
                return use_local(f"Tiger Data unavailable, using local data ({type(e).__name__})")
        return use_local(None)


def is_postgres() -> bool:
    return get_engine().dialect.name == "postgresql"


def status() -> dict:
    get_engine()
    return dict(INFO)
