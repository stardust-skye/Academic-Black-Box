"""FastAPI app. Run from the repo root:  uvicorn backend.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend import config, database
from backend.ml import predict
from backend.ml.features import LEVER_KEYS
from backend.schemas import GeminiRequest, LoginRequest, PredictRequest, SimulateRequest
from backend.services import data_service, gemini_service, simulation_service, tiger_service


@asynccontextmanager
async def lifespan(app):
    predict.bundle()                 # trains automatically if no artifact exists
    data_service.dataset()
    tiger_service.ensure_seeded()    # seeds synthetic activity once (Tiger Data or local SQLite)
    simulation_service.demo_students()
    yield


app = FastAPI(title="Academic Black Box API", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


def _need(student_id: str):
    if not data_service.exists(student_id):
        raise HTTPException(404, f"Unknown student {student_id}")


@app.get("/api/health")
def health():
    m = predict.meta()
    return {"status": "ok", "demo_mode": database.status()["mode"] == "local",
            "database": database.status(), "gemini": gemini_service.status(),
            "model": {"type": m["model"]["type"], "depth": m["model"]["max_depth"], "trained_at": m["trained_at"]},
            "dataset": {"records": m["dataset"]["records"]},
            "notice": config.SYNTHETIC_NOTICE, "activity_notice": config.ACTIVITY_NOTICE}


@app.post("/api/login")
def login(req: LoginRequest):
    """Demo 'login': no password. Only verifies that the student ID exists in the dataset."""
    sid = req.student_id.strip().upper()
    if not sid or not data_service.exists(sid):
        raise HTTPException(404, "Student ID not found.")
    pr = data_service.profile(sid)
    return {"student_id": sid, "course": pr["course"], "class_year": pr["class_year"]}


@app.get("/api/students")
def students():
    return {"students": data_service.student_list(), "demo": simulation_service.demo_students(),
            "courses": sorted({s["course"] for s in data_service.student_list()})}


@app.get("/api/student/{student_id}")
def student(student_id: str):
    _need(student_id)
    return {
        "profile": data_service.profile(student_id), "features": data_service.features(student_id),
        "prediction": predict.predict(data_service.features(student_id)),
        "levers": simulation_service.lever_config(student_id),
        "suggested_plan": simulation_service.suggest_plan(student_id),
        "notice": config.SYNTHETIC_NOTICE,
    }


@app.get("/api/student/{student_id}/activity")
def activity(student_id: str):
    _need(student_id)
    return {"daily": tiger_service.daily(student_id), "weekly": tiger_service.weekly(student_id),
            "risk_trend": tiger_service.risk_trend(student_id), "midterm_week": config.MIDTERM_WEEK,
            "source": database.status(), "notice": config.ACTIVITY_NOTICE}


@app.post("/api/predict")
def predict_endpoint(req: PredictRequest):
    if not req.student_id and not req.features:
        raise HTTPException(422, "Provide student_id and/or features")
    feats = {}
    if req.student_id:
        _need(req.student_id)
        feats = data_service.features(req.student_id)
    for k, v in (req.features or {}).items():
        feats[k] = v
    return predict.predict(feats)


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    _need(req.student_id)
    return simulation_service.simulate(req.student_id, req.overrides)


@app.get("/api/model/metrics")
def metrics():
    m = predict.meta()
    return {"dataset": m["dataset"], "model": m["model"], "metrics": m["metrics"], "trained_at": m["trained_at"],
            "tree_text": m["tree_text"], "tuning": m.get("tuning"), "notice": config.SYNTHETIC_NOTICE}


@app.get("/api/model/feature-importance")
def feature_importance():
    from backend.ml.features import label
    m = predict.meta()
    return {"features": [{**i, "label": label(i["feature"])} for i in m["feature_importance"]],
            "transformed": m["feature_importance_transformed"],
            "note": "Feature importance is model signal (impurity reduction), not causal impact."}


@app.get("/api/model/tree-path/{student_id}")
def tree_path(student_id: str):
    _need(student_id)
    p = predict.predict(data_service.features(student_id))
    return {"student_id": student_id, **{k: p[k] for k in (
        "risk_probability", "predicted_class", "band", "status", "baseline_risk", "decision_path", "contributions", "leaf")}}


@app.post("/api/gemini/explain")
def gemini_explain(req: GeminiRequest):
    _need(req.student_id)
    ctx = gemini_service.build_context(req.student_id, req.overrides)
    return {"explanation": gemini_service.generate_risk_explanation(ctx),
            "model_numbers": {"risk_probability": ctx["risk_probability"], "simulation": ctx.get("simulation")}}


@app.post("/api/gemini/recovery-plan")
def gemini_plan(req: GeminiRequest):
    _need(req.student_id)
    ctx = gemini_service.build_context(req.student_id, req.overrides)
    return {"plan": gemini_service.generate_recovery_plan(ctx),
            "model_numbers": {"risk_probability": ctx["risk_probability"], "simulation": ctx.get("simulation")}}


@app.get("/api/analytics/overview")
def overview():
    import pandas as pd
    df = data_service.dataset().copy()
    sc = data_service.all_scores()
    df["score"] = df["student_id"].map(sc)
    df["band"] = df["score"].map(predict.band)
    by_course = (df.groupby("course").agg(students=("student_id", "count"), actual_rate=("at_risk", "mean"),
                                          mean_model_risk=("score", "mean")).reset_index().sort_values("mean_model_risk", ascending=False))
    by_year = df.groupby("class_year").agg(students=("student_id", "count"), actual_rate=("at_risk", "mean"),
                                           mean_model_risk=("score", "mean")).reset_index()
    return {
        "records": int(len(df)), "actual_at_risk_rate": float(df["at_risk"].mean()),
        "band_counts": df["band"].value_counts().to_dict(),
        "by_course": by_course.to_dict("records"), "by_class_year": by_year.to_dict("records"),
        "cohort_weekly_study": tiger_service.cohort_weekly(), "db_counts": tiger_service.counts(),
        "database": database.status(), "activity_notice": config.ACTIVITY_NOTICE,
    }


# Serve the built frontend (npm run build) from the same port, if present.
import os
from fastapi.staticfiles import StaticFiles
_dist = os.path.join(str(config.ROOT), "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
