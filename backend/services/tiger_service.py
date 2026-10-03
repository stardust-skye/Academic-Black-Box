"""Tiger Data (TimescaleDB/PostgreSQL) access layer: seeding + time-series analytics queries.
Falls back to local SQLite transparently (see backend/database.py)."""
import re
from datetime import timedelta
from functools import lru_cache

import numpy as np
from sqlalchemy import text

from backend import config, database
from backend.ml import predict
from backend.ml.features import FEATURES, ID, TARGET
from backend.services import activity_generator, data_service

STUDENT_COLS = [ID] + FEATURES + [TARGET]


@lru_cache(maxsize=1)
def _queries() -> dict:
    out, name = {}, None
    for line in (config.SQL_DIR / "analytics.sql").read_text().splitlines():
        m = re.match(r"--\s*name:\s*(\w+)", line)
        if m:
            name = m.group(1)
            out[name] = []
        elif name and not line.strip().startswith("--"):
            out[name].append(line)
    return {k: "\n".join(v).strip().rstrip(";") for k, v in out.items()}


def _q(base: str) -> str:
    q = _queries()
    if database.get_engine().dialect.name == "sqlite":
        return q[base + "_sqlite"] if base + "_sqlite" in q else q[base]
    if base + "_timescale" in q:
        return q[base + "_timescale" if database.INFO["timescale"] else base + "_pg"]
    return q[base]


def _run(fn):
    """Run fn(engine); on connection problems fall back to the local demo DB and retry once."""
    try:
        return fn(database.get_engine())
    except Exception as e:
        if database.INFO["mode"] == "tiger":
            database.use_local(f"Tiger Data query failed, using local data ({type(e).__name__})")
            ensure_seeded()
            return fn(database.get_engine())
        raise


def _ts_param(dt):
    return dt if database.get_engine().dialect.name == "postgresql" else dt.strftime("%Y-%m-%d %H:%M:%S")


def seed_all(verbose: bool = False) -> dict:
    """(Re)create demo data: students + synthetic activity timeline."""
    df = data_service.dataset()

    def work(engine):
        stu = []
        for _, r in df.iterrows():
            stu.append({c: (None if (not isinstance(r[c], str) and r[c] != r[c]) else
                            (r[c] if isinstance(r[c], str) else float(r[c]))) for c in STUDENT_COLS})
        act = []
        for rec in stu:
            for row in activity_generator.generate_for_student(rec):
                row["ts"] = _ts_param(row["ts"])
                act.append(row)
        with engine.begin() as c:
            c.execute(text("DELETE FROM student_activity"))
            c.execute(text("DELETE FROM students"))
            c.execute(text(f"INSERT INTO students ({', '.join(STUDENT_COLS)}) VALUES "
                           f"({', '.join(':' + k for k in STUDENT_COLS)})"), stu)
            ins = text("INSERT INTO student_activity (student_id, course, ts, study_minutes, study_sessions, "
                       "quizzes_taken, assignment_completion_rate, attendance_rate, quiz_score, missed_deadlines) "
                       "VALUES (:student_id, :course, :ts, :study_minutes, :study_sessions, :quizzes_taken, "
                       ":assignment_completion_rate, :attendance_rate, :quiz_score, :missed_deadlines)")
            for i in range(0, len(act), 5000):
                c.execute(ins, act[i:i + 5000])
                if verbose:
                    print(f"  inserted {min(i + 5000, len(act))}/{len(act)} activity rows")
        return {"students": len(stu), "activity_rows": len(act)}

    return _run(work)


def counts() -> dict:
    def work(engine):
        with engine.connect() as c:
            r = c.execute(text(_queries()["counts"])).mappings().one()
        return {"students": int(r["students"]), "activity_rows": int(r["activity_rows"])}
    return _run(work)


def ensure_seeded() -> dict:
    try:
        c = counts()
        if c["activity_rows"] == 0 or c["students"] == 0:
            return seed_all()
        return c
    except Exception:
        return {"students": 0, "activity_rows": 0}


def _day(ts) -> str:
    return str(ts)[:10]


def daily(student_id: str) -> list:
    def work(engine):
        with engine.connect() as c:
            rows = c.execute(text(_q("daily")), {"sid": student_id}).mappings().all()
        return [{**{k: (None if v is None else (float(v) if isinstance(v, (float, np.floating)) else v))
                    for k, v in r.items() if k != "ts"}, "date": _day(r["ts"])} for r in rows]
    return _run(work)


def weekly(student_id: str) -> list:
    def work(engine):
        with engine.connect() as c:
            rows = c.execute(text(_q("weekly")), {"sid": student_id}).mappings().all()
        out = []
        for i, r in enumerate(rows):
            d = dict(r)
            d.pop("wk", None)
            ws = d.pop("week_start", None)
            default_start = (activity_generator.START + timedelta(days=7 * i)).strftime("%Y-%m-%d")
            out.append({"week": i + 1, "week_start": _day(ws) if ws is not None else default_start,
                        **{k: (None if v is None else float(v)) for k, v in d.items()}})
        return out
    return _run(work)


def cohort_weekly() -> list:
    """Average weekly study minutes per student, split by final outcome (at_risk 0/1)."""
    def work(engine):
        with engine.connect() as c:
            rows = c.execute(text(_q("cohort"))).mappings().all()
        weeks = {}
        for r in rows:
            key = r["week_start"] if "week_start" in r else r["wk"]
            weeks.setdefault(key, {})["at_risk" if int(r["at_risk"]) == 1 else "on_track"] = float(r["minutes_per_student"])
        return [{"week": i + 1, **v} for i, (_, v) in enumerate(sorted(weeks.items(), key=lambda kv: str(kv[0])))]
    return _run(work)


def risk_trend(student_id: str) -> list:
    """Re-score the student week by week from the activity stream (pace-projected to a full semester).
    Features not yet observed (midterm before week 7) are median-imputed by the pipeline."""
    base = data_service.features(student_id)
    rows = daily(student_id)
    W = config.SEMESTER_WEEKS
    cum = {"min": 0.0, "sess": 0.0, "quiz": 0.0, "miss": 0.0}
    scores = []
    out_feats = []
    for w in range(1, W + 1):
        chunk = rows[(w - 1) * 7: w * 7]
        for r in chunk:
            cum["min"] += r["study_minutes"]; cum["sess"] += r["study_sessions"]
            cum["quiz"] += r["quizzes_taken"]; cum["miss"] += r["missed_deadlines"]
        last = chunk[-1]
        f = dict(base)
        if w < W:
            scale = W / w
            f.update({
                "avg_weekly_study_hours": cum["min"] / 60.0 / w,
                "study_sessions_logged": cum["sess"] * scale, "practice_quizzes_taken": cum["quiz"] * scale,
                "missed_deadlines": cum["miss"] * scale,
                "on_time_submission_rate": last["assignment_completion_rate"],
                "attendance_rate": last["attendance_rate"],
            })
        if w < config.MIDTERM_WEEK:
            f["midterm_score"] = None
        out_feats.append(f)
    import pandas as pd
    df = pd.concat([predict.frame(f) for f in out_feats], ignore_index=True)
    probs = predict.score_all(df)
    return [{"week": i + 1, "risk": float(p), "midterm_known": i + 1 >= config.MIDTERM_WEEK}
            for i, p in enumerate(probs)]
