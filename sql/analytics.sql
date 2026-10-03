-- Named analytics queries, loaded by backend/services/tiger_service.py ("-- name: <key>" starts a query).
-- Three dialect variants: *_timescale (Tiger Data), *_pg (plain PostgreSQL), *_sqlite (local demo mode).

-- name: daily
SELECT ts, study_minutes, study_sessions, quizzes_taken, assignment_completion_rate,
       attendance_rate, quiz_score, missed_deadlines
FROM student_activity WHERE student_id = :sid ORDER BY ts;

-- name: weekly_timescale
SELECT time_bucket('7 days', ts, TIMESTAMPTZ '2026-08-17 00:00:00+00') AS week_start,
       SUM(study_minutes) AS study_minutes, SUM(study_sessions) AS study_sessions,
       SUM(quizzes_taken) AS quizzes, AVG(quiz_score) AS avg_quiz_score,
       AVG(assignment_completion_rate) AS assignment_rate, AVG(attendance_rate) AS attendance,
       SUM(missed_deadlines) AS missed
FROM student_activity WHERE student_id = :sid GROUP BY 1 ORDER BY 1;

-- name: weekly_pg
SELECT date_trunc('week', ts) AS week_start,
       SUM(study_minutes) AS study_minutes, SUM(study_sessions) AS study_sessions,
       SUM(quizzes_taken) AS quizzes, AVG(quiz_score) AS avg_quiz_score,
       AVG(assignment_completion_rate) AS assignment_rate, AVG(attendance_rate) AS attendance,
       SUM(missed_deadlines) AS missed
FROM student_activity WHERE student_id = :sid GROUP BY 1 ORDER BY 1;

-- name: weekly_sqlite
SELECT CAST((julianday(substr(ts,1,10)) - julianday('2026-08-17')) / 7 AS INTEGER) AS wk,
       SUM(study_minutes) AS study_minutes, SUM(study_sessions) AS study_sessions,
       SUM(quizzes_taken) AS quizzes, AVG(quiz_score) AS avg_quiz_score,
       AVG(assignment_completion_rate) AS assignment_rate, AVG(attendance_rate) AS attendance,
       SUM(missed_deadlines) AS missed
FROM student_activity WHERE student_id = :sid GROUP BY 1 ORDER BY 1;

-- name: cohort_timescale
SELECT time_bucket('7 days', a.ts, TIMESTAMPTZ '2026-08-17 00:00:00+00') AS week_start, s.at_risk,
       SUM(a.study_minutes)::float / COUNT(DISTINCT a.student_id) AS minutes_per_student
FROM student_activity a JOIN students s USING (student_id) GROUP BY 1, 2 ORDER BY 1, 2;

-- name: cohort_pg
SELECT date_trunc('week', a.ts) AS week_start, s.at_risk,
       SUM(a.study_minutes)::float / COUNT(DISTINCT a.student_id) AS minutes_per_student
FROM student_activity a JOIN students s USING (student_id) GROUP BY 1, 2 ORDER BY 1, 2;

-- name: cohort_sqlite
SELECT CAST((julianday(substr(a.ts,1,10)) - julianday('2026-08-17')) / 7 AS INTEGER) AS wk, s.at_risk,
       CAST(SUM(a.study_minutes) AS REAL) / COUNT(DISTINCT a.student_id) AS minutes_per_student
FROM student_activity a JOIN students s ON s.student_id = a.student_id GROUP BY 1, 2 ORDER BY 1, 2;

-- name: counts
SELECT (SELECT COUNT(*) FROM student_activity) AS activity_rows,
       (SELECT COUNT(*) FROM students) AS students;
