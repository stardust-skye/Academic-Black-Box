-- Academic Black Box schema for Tiger Data (TimescaleDB) / PostgreSQL.
-- Executed statement-by-statement by backend/database.py and scripts/seed_database.py.

CREATE TABLE IF NOT EXISTS students (
    student_id                    TEXT PRIMARY KEY,
    course                        TEXT NOT NULL,
    class_year                    TEXT,
    credit_hours                  DOUBLE PRECISION,
    work_hours_per_week           DOUBLE PRECISION,
    avg_weekly_study_hours        DOUBLE PRECISION,
    study_sessions_logged         DOUBLE PRECISION,
    materials_uploaded            DOUBLE PRECISION,
    practice_quizzes_taken        DOUBLE PRECISION,
    avg_practice_quiz_score       DOUBLE PRECISION,
    flashcards_reviewed           DOUBLE PRECISION,
    avg_days_started_before_exam  DOUBLE PRECISION,
    on_time_submission_rate       DOUBLE PRECISION,
    missed_deadlines              DOUBLE PRECISION,
    late_night_study_pct          DOUBLE PRECISION,
    attendance_rate               DOUBLE PRECISION,
    avg_sleep_hours               DOUBLE PRECISION,
    midterm_score                 DOUBLE PRECISION,
    at_risk                       INTEGER
);

-- Time-series table. SYNTHETIC activity timeline derived from the WolfHacks dataset.
-- Hypertables require the partition column (ts) in every unique key, hence PRIMARY KEY (id, ts).
CREATE TABLE IF NOT EXISTS student_activity (
    id                          BIGSERIAL,
    student_id                  TEXT NOT NULL,
    course                      TEXT NOT NULL,
    ts                          TIMESTAMPTZ NOT NULL,
    study_minutes               INTEGER NOT NULL DEFAULT 0,
    study_sessions              INTEGER NOT NULL DEFAULT 0,
    quizzes_taken               INTEGER NOT NULL DEFAULT 0,
    assignment_completion_rate  DOUBLE PRECISION,
    attendance_rate             DOUBLE PRECISION,
    quiz_score                  DOUBLE PRECISION,
    missed_deadlines            INTEGER NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, ts)
);

CREATE INDEX IF NOT EXISTS idx_activity_student_ts ON student_activity (student_id, ts DESC);

-- Tiger Data / TimescaleDB: turn the table into a hypertable (skipped automatically on plain PostgreSQL).
SELECT create_hypertable('student_activity', 'ts', if_not_exists => TRUE);
