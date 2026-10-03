"""Preview / export the synthetic activity timeline for one student (no database needed).
   python scripts/generate_activity.py S1030 [out.csv]"""
import _path  # noqa: F401
import sys
import pandas as pd
from backend.services import activity_generator, data_service

if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else "S1030"
    rows = activity_generator.generate_for_student({**data_service.features(sid), "student_id": sid})
    df = pd.DataFrame(rows)
    print(df.head(10).to_string())
    print(f"... {len(df)} daily rows | total study hours/week = {df.study_minutes.sum()/60/12:.2f}")
    if len(sys.argv) > 2:
        df.to_csv(sys.argv[2], index=False); print("wrote", sys.argv[2])
