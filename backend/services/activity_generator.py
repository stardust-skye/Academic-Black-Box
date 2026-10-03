"""Deterministic SYNTHETIC activity timeline derived from each student's dataset row.

The Excel file has NO timestamps. We spread each student's semester totals over 12 weeks (84 days) so the
dashboard has a time series. Totals are preserved exactly (sessions, minutes, quizzes, missed deadlines) and the
running rates converge to the student's real end-of-semester values.
"""
from datetime import datetime, timedelta, timezone

import numpy as np

from backend import config

DAYS = config.SEMESTER_WEEKS * 7
START = datetime.fromisoformat(config.SEMESTER_START).replace(hour=12, tzinfo=timezone.utc)  # noon avoids tz edge cases
EXAM_WEEKS = (config.MIDTERM_WEEK, config.SEMESTER_WEEKS)


def _multinomial(rng, total, p):
    p = np.asarray(p, dtype=float)
    return rng.multinomial(int(total), p / p.sum()) if total > 0 else np.zeros(len(p), dtype=int)


def generate_for_student(rec: dict) -> list:
    sid = rec["student_id"]
    rng = np.random.default_rng(int(sid[1:]) + 2026)
    weeks = np.repeat(np.arange(1, config.SEMESTER_WEEKS + 1), 7)  # week number for each day

    # Students who start studying late cram near exams.
    cram = max(0.0, (4.0 - float(rec["avg_days_started_before_exam"])) / 4.0)
    near_exam = np.zeros(DAYS)
    for ew in EXAM_WEEKS:
        near_exam += np.exp(-np.abs(weeks - ew) / 1.2)
    weight = (1.0 + 2.5 * cram * near_exam) * rng.gamma(2.0, 0.5, DAYS)

    sessions = _multinomial(rng, rec["study_sessions_logged"], weight)
    total_minutes = int(round(float(rec["avg_weekly_study_hours"]) * 60 * config.SEMESTER_WEEKS))
    w = sessions * rng.uniform(0.6, 1.4, DAYS)
    minutes = np.zeros(DAYS, dtype=int)
    if w.sum() > 0:
        minutes = np.floor(total_minutes * w / w.sum()).astype(int)
        minutes[int(np.argmax(w))] += total_minutes - int(minutes.sum())

    quizzes = _multinomial(rng, rec["practice_quizzes_taken"], weight * rng.uniform(0.5, 1.5, DAYS))
    q_mean = rec.get("avg_practice_quiz_score")
    missed = np.zeros(DAYS, dtype=int)
    if rec["missed_deadlines"] > 0:
        p = np.where(weeks > 1, 1.0, 0.0) * (1 + near_exam)
        missed = _multinomial(rng, rec["missed_deadlines"], p)

    # running rates converge to the real end-of-semester value on the last day
    prog = 1 - np.arange(DAYS) / (DAYS - 1)
    comp_final, att_final = float(rec["on_time_submission_rate"]), float(rec["attendance_rate"])
    comp = comp_final + rng.normal(0, 0.06) * prog + rng.normal(0, 0.008, DAYS) * prog
    att = att_final + rng.normal(0, 0.04) * prog + rng.normal(0, 0.006, DAYS) * prog

    rows = []
    for d in range(DAYS):
        qs = None
        if quizzes[d] > 0 and q_mean is not None and q_mean == q_mean:
            qs = round(float(np.clip(rng.normal(q_mean, 7), 0, 100)), 1)
        rows.append({
            "student_id": sid, "course": rec["course"], "ts": START + timedelta(days=d),
            "study_minutes": int(minutes[d]), "study_sessions": int(sessions[d]), "quizzes_taken": int(quizzes[d]),
            "assignment_completion_rate": round(float(np.clip(comp[d], 0, 1)), 4),
            "attendance_rate": round(float(np.clip(att[d], 0, 1)), 4),
            "quiz_score": qs, "missed_deadlines": int(missed[d]),
        })
    return rows
