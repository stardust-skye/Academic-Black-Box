"""Feature catalogue: labels, units and slider ranges (ranges come from the dataset's Data Dictionary sheet)."""

ID = "student_id"
TARGET = "at_risk"
CATEGORICAL = ["course", "class_year"]
NUMERIC = [
    "credit_hours", "work_hours_per_week", "avg_weekly_study_hours", "study_sessions_logged",
    "materials_uploaded", "practice_quizzes_taken", "avg_practice_quiz_score", "flashcards_reviewed",
    "avg_days_started_before_exam", "on_time_submission_rate", "missed_deadlines",
    "late_night_study_pct", "attendance_rate", "avg_sleep_hours", "midterm_score",
]
FEATURES = CATEGORICAL + NUMERIC  # 17 candidate features. at_risk and student_id are never inputs.

# label, kind (pct | hours | count | score | days | text)
INFO = {
    "course": ("Course", "text"),
    "class_year": ("Class year", "text"),
    "credit_hours": ("Credit hours", "count"),
    "work_hours_per_week": ("Work hours / week", "hours"),
    "avg_weekly_study_hours": ("Weekly study time", "hours"),
    "study_sessions_logged": ("Study sessions logged", "count"),
    "materials_uploaded": ("Materials uploaded", "count"),
    "practice_quizzes_taken": ("Practice quizzes taken", "count"),
    "avg_practice_quiz_score": ("Practice quiz score", "score"),
    "flashcards_reviewed": ("Flashcards reviewed", "count"),
    "avg_days_started_before_exam": ("Days studied before exams", "days"),
    "on_time_submission_rate": ("On-time submissions", "pct"),
    "missed_deadlines": ("Missed deadlines", "count"),
    "late_night_study_pct": ("Late-night study share", "pct"),
    "attendance_rate": ("Attendance", "pct"),
    "avg_sleep_hours": ("Average sleep", "hours"),
    "midterm_score": ("Midterm score", "score"),
}

# Controllable "what if" levers. min/max from the Data Dictionary; step for the slider.
LEVERS = [
    {"key": "avg_weekly_study_hours", "min": 0.5, "max": 18, "step": 0.1, "good": "up"},
    {"key": "attendance_rate", "min": 0.30, "max": 1.0, "step": 0.01, "good": "up"},
    {"key": "on_time_submission_rate", "min": 0.30, "max": 1.0, "step": 0.01, "good": "up"},
    {"key": "missed_deadlines", "min": 0, "max": 10, "step": 1, "good": "down"},
    {"key": "avg_days_started_before_exam", "min": 0, "max": 14, "step": 0.1, "good": "up"},  # Data Dictionary: 0-14 days
    {"key": "avg_practice_quiz_score", "min": 30, "max": 100, "step": 1, "good": "up"},
    {"key": "practice_quizzes_taken", "min": 0, "max": 60, "step": 1, "good": "up"},
    {"key": "avg_sleep_hours", "min": 3.5, "max": 10, "step": 0.1, "good": "up"},
    {"key": "midterm_score", "min": 20, "max": 100, "step": 1, "good": "up"},
]
LEVER_KEYS = [l["key"] for l in LEVERS]


def label(feature: str) -> str:
    return INFO.get(feature, (feature, "text"))[0]


def kind(feature: str) -> str:
    return INFO.get(feature, (feature, "text"))[1]


def fmt(feature: str, value) -> str:
    """Human-friendly value formatting used in decision-path text."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)
    if v != v:  # NaN
        return "n/a"
    k = kind(feature)
    if k == "pct":
        return f"{v * 100:.0f}%"
    if k == "hours":
        return f"{v:.1f} h"
    if k == "score":
        return f"{v:.0f}"
    if k == "days":
        return f"{v:.1f} d"
    return f"{v:.0f}" if abs(v - round(v)) < 1e-9 else f"{v:.1f}"
