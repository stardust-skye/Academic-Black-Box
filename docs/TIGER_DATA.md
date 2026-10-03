# Tiger Data

Set `DATABASE_URL` (or `TIGER_DATABASE_URL`) to your Tiger Cloud service string. On startup the backend connects, runs `sql/schema.sql` (tables + `create_hypertable`), and seeds if empty. Run `python scripts/seed_database.py` to (re)seed manually.

- `student_activity` hypertable on `ts`, indexed by `(student_id, ts DESC)`; ~67k synthetic daily rows (800 students × 84 days).
- Queries (`sql/analytics.sql`): per-student weekly rollup with `time_bucket('7 days', ...)`, cohort study time by final outcome (join with `students`), daily rows for the trend.
- The activity is **synthetic, derived from the dataset's semester totals** (the Excel has no timestamps). Generator: `backend/services/activity_generator.py`.
- If the database is unreachable the app switches to a local SQLite file (`data/local_demo.db`) and shows "Demo mode — local data". On plain PostgreSQL (no TimescaleDB) it uses `date_trunc` instead of `time_bucket`.
- `docker-compose.yml` starts a local TimescaleDB for testing.
