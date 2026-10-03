# Demo script (about 3 minutes)

Setup: backend (`uvicorn backend.main:app --reload`) and frontend (`npm run dev`) running. Open http://localhost:5173. Numbers below come from the live model; read them off your screen. In our run the demo student is S1030 (PY 205, Junior) with a 99% model risk score.

**Story: ENTER > RISK > WHY > CHANGE > PLAN > ACTIVITY > MODEL LAB**

| Time | Do | Say |
|---|---|---|
| 0:00 | Landing page. Type `S1030` and press **Access my semester** (or click **Try demo student**). | "Students find out they're failing when it's too late, and risk scores are black boxes. This one tells you where you stand, why, and what to change." |
| 0:15 | Watch "Analyzing your semester..." | "Real record, real decision tree, loading now." |
| 0:25 | **My Semester**: point at the huge number. | "This is a real scikit-learn decision tree score, not an LLM. 800 records, held-out test set." Point at the signals vs. dataset median. |
| 0:45 | Click **Why am I at risk?** | |
| 0:55 | **Why?** page: walk the path cards top to bottom. | "This is this student's exact route through the tree. Model signals, not proof of causation." |
| 1:15 | Click **Explain my risk**. | "Gemini explains the model's result. It never makes or changes the prediction." |
| 1:30 | Go to **Simulate**. Raise on-time submissions, study time, attendance. | "Your current trajectory isn't a verdict." |
| 1:50 | Click **Simulate my semester**. | "Every number comes from the backend re-running the tree. Here it goes from 99% to 21% because on-time submissions crossed a split. Study time alone doesn't move it; the model tells us honestly what matters." |
| 2:15 | Read the **Biggest opportunity** card. Click **Get my 7-day plan**. | "According to this model simulation..." then show the Gemini plan (or the local fallback if no key). |
| 2:35 | Back to **My Semester**, scroll to **Your academic activity**. | "Time-series activity in Tiger Data: a hypertable with time_bucket queries." (If the badge says DEMO DATA, say it is running in local mode.) |
| 2:50 | Open **Model Lab**. | "For judges: accuracy, precision, recall, F1, ROC-AUC, confusion matrix, feature importance, the drawn tree. `at_risk` and `student_id` are never inputs." |

Judge-proofing: be upfront that the data is synthetic, the activity timeline is generated from semester totals (the Excel file has no timestamps), and risk scores are leaf proportions, not calibrated probabilities. Moving only study time may not change the score in this shallow tree; the simulator shows this rather than faking it.

Other IDs worth trying: `S1086` (medium), `S1001` (low). Invalid IDs show "Student ID not found."
