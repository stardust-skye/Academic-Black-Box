# Machine learning

- Model: `DecisionTreeClassifier(max_depth=4, min_samples_leaf=30, class_weight="balanced", random_state=42)` in a `Pipeline` with `ColumnTransformer` (median imputer for numerics, `OneHotEncoder(handle_unknown="ignore")` for `course`, `class_year`).
- Features: 17 (see README). `at_risk` and `student_id` are excluded — no leakage. `midterm_score` is allowed (available mid-semester).
- Split: stratified 80/20, `random_state=42`. All reported metrics are on the 20% held-out set. Run `python scripts/train_model.py` to see them; `/api/model/metrics` serves them.
- Why `min_samples_leaf=30`: with fully grown leaves most scores were 0% or ~100%. We compared depth {3,4,5} × min leaf {1,10,20,30} by 5-fold CV on the training split (F1 and ROC-AUC were nearly flat) and chose the setting that keeps depth 4 and gives graded scores. Override with `TREE_MIN_SAMPLES_LEAF` / `TREE_MAX_DEPTH`.
- Interpretation: risk score = class-weighted leaf proportion (not calibrated). Per-student "model signal" = change in node risk along the decision path, summed per feature. Feature importance = impurity decrease, aggregated over one-hot columns.

## Tuning protocol (baseline vs tuned)
- The stratified 80/20 split (random_state 42, 160 test records) is made once. The search never sees the test split.
- Search: repeated stratified 5-fold CV (x3) on the 640 training records over `TUNE_GRID` (depth x min leaf). Candidates are ranked by mean CV F1 of the at-risk class, then CV ROC-AUC, then the simpler tree.
- Baseline (depth 4, min leaf 30) and the best tuned tree are each fitted on the training split and scored once on the same test split.
- The tuned tree replaces the baseline only if hold-out F1 improves by >= 0.5 pts, recall drops <= 2 pts and ROC-AUC drops <= 0.005 (`PROMOTE_*` in `backend/config.py`). Otherwise the baseline stays in production and Model Lab shows `TUNING DID NOT IMPROVE THE HOLD-OUT MODEL`.
- `metadata.json` -> `tuning` holds both models' CV and test metrics; `metrics` always belongs to the saved model (training asserts the saved file reproduces them).
