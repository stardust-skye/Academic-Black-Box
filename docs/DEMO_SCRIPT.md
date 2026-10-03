# 3-minute demo script

Setup: backend + frontend running, click **DEMO SCENARIO** once to warm up. The demo student is picked by the model (check the exact numbers on your screen; they are computed live).

**Memorize it as: PROBLEM → SEE → WHY → CHANGE → ASK → STREAM → PITCH**

| Time | Say / do |
|---|---|
| 0:00 **Problem** | "Students find out they're failing when it's too late — and risk scores are black boxes. Nobody tells you *why* or *what to change*." |
| 0:20 **Dashboard** | Show BLACK BOX page. "Fall 2026 demo, WolfHacks synthetic data. Risk ring, status, signals." |
| 0:45 **Prediction** | Point at the risk ring. "This is a real scikit-learn decision tree — not an LLM. Depth 4, trained on 800 records." |
| 1:00 **Click WHY** | Click **WHY AM I AT RISK?** |
| 1:20 **Tree path** | "Here's this student's exact path: each split, their value, and how the risk moved." Point at the biggest red step. Say "model signal, not blame." |
| 1:40 **Change sliders** | Click SIMULATE. Hit **Strong-semester plan** (or drag on-time submissions, attendance). |
| 2:00 **Run** | Click **SIMULATE MY SEMESTER**. |
| 2:15 **Risk change** | Show the cascade (e.g. 99% → … → 21% in our run). "Every step is the tree re-running. Notice which lever actually flips a split — the model tells us what matters." |
| 2:30 **Gemini** | Click **EXPLAIN WHAT CHANGED**, then **GET MY 7-DAY PLAN**. "Gemini explains and plans; it never touches the numbers." |
| 2:45 **Tiger Data** | Back to BLACK BOX / INSIGHTS: activity stream + cohort chart. "Time-series in Tiger Data — a hypertable with `time_bucket` queries." |
| 3:00 **Pitch** | "Google Maps for academic risk: see the risk, understand why, change the outcome." |

Judge-proofing: Model Lab (INSIGHTS) shows accuracy/precision/recall/F1/confusion matrix computed on a held-out split, no leakage (`at_risk` never an input). Be upfront: data is synthetic, timeline is generated, scores are uncalibrated.
