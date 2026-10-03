import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, Wand2 } from 'lucide-react'
import { api } from '../api.js'
import { ErrorBox, Eyebrow, Glass } from './ui.jsx'

const COURSES = ['BIO 181', 'CH 101', 'CSC 216', 'EC 201', 'ECE 200', 'MA 241', 'PY 205', 'ST 311'] // the 8 course codes in the dataset
const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior']

// Field definitions use the existing model input names. Ranges follow the Data Dictionary where the backend exposes them.
const STEPS = [
  { title: 'Your course load', fields: [
    { k: 'courses', label: 'Courses', type: 'courses' },
    { k: 'class_year', label: 'Class year', type: 'select', options: YEARS },
    { k: 'credit_hours', label: 'Credit hours', min: 12, max: 18, step: 1 },
    { k: 'work_hours_per_week', label: 'Work hours / week', min: 0, max: 40, step: 1 },
  ] },
  { title: 'How you study', fields: [
    { k: 'avg_weekly_study_hours', label: 'Weekly study hours', min: 0.5, max: 18, step: 0.1 },
    { k: 'study_sessions_logged', label: 'Study sessions', min: 3, max: 200, step: 1 },
    { k: 'avg_days_started_before_exam', label: 'Days studied before exams', min: 0, max: 14, step: 0.1 },
    { k: 'practice_quizzes_taken', label: 'Practice quizzes taken', min: 0, max: 60, step: 1 },
    { k: 'avg_practice_quiz_score', label: 'Practice quiz score (%)', min: 30, max: 100, step: 1 },
    { k: 'flashcards_reviewed', label: 'Flashcards reviewed', min: 0, max: 1000, step: 1 },
    { k: 'materials_uploaded', label: 'Materials uploaded', min: 0, max: 40, step: 1 },
  ] },
  { title: 'Consistency', fields: [
    { k: 'attendance_pct', label: 'Attendance (%)', min: 30, max: 100, step: 1 },
    { k: 'on_time_pct', label: 'On-time submission rate (%)', min: 30, max: 100, step: 1 },
    { k: 'missed_deadlines', label: 'Missed deadlines', min: 0, max: 10, step: 1 },
    { k: 'late_night_pct', label: 'Late-night study (%)', min: 0, max: 90, step: 1 },
  ] },
  { title: 'Sleep and midterm', fields: [
    { k: 'avg_sleep_hours', label: 'Average sleep hours', min: 3.5, max: 10, step: 0.1 },
    { k: 'midterm_score', label: 'Midterm score', min: 20, max: 100, step: 1 },
  ] },
]

const SAMPLE = {
  courses: ['BIO 181', 'CSC 216', 'MA 241'], class_year: 'Sophomore', credit_hours: '15', work_hours_per_week: '18',
  avg_weekly_study_hours: '5.5', study_sessions_logged: '40', avg_days_started_before_exam: '2',
  practice_quizzes_taken: '6', avg_practice_quiz_score: '58', flashcards_reviewed: '120', materials_uploaded: '10',
  attendance_pct: '70', on_time_pct: '65', missed_deadlines: '4', late_night_pct: '45',
  avg_sleep_hours: '5.8', midterm_score: '55',
}

const EMPTY = { ...Object.fromEntries(STEPS.flatMap((s) => s.fields).map((f) => [f.k, ''])), courses: [] }

// Percent fields are typed as 0-100 and converted to the 0-1 fractions the model was trained on.
// `course` is added per run (the model takes one course at a time), so it is not part of this object.
function toFeatures(a) {
  const n = (k) => Number(a[k])
  return {
    class_year: a.class_year,
    credit_hours: n('credit_hours'), work_hours_per_week: n('work_hours_per_week'),
    avg_weekly_study_hours: n('avg_weekly_study_hours'), study_sessions_logged: n('study_sessions_logged'),
    avg_days_started_before_exam: n('avg_days_started_before_exam'), practice_quizzes_taken: n('practice_quizzes_taken'),
    avg_practice_quiz_score: n('avg_practice_quiz_score'), flashcards_reviewed: n('flashcards_reviewed'),
    materials_uploaded: n('materials_uploaded'),
    attendance_rate: n('attendance_pct') / 100, on_time_submission_rate: n('on_time_pct') / 100,
    missed_deadlines: n('missed_deadlines'), late_night_study_pct: n('late_night_pct') / 100,
    avg_sleep_hours: n('avg_sleep_hours'), midterm_score: n('midterm_score'),
  }
}

// Simple checkbox dropdown. Styling lives in index.css (.ms-*) so it follows the dark/light theme.
function CourseSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const all = value.length === COURSES.length
  const toggle = (c) => onChange(COURSES.filter((x) => (x === c ? !value.includes(c) : value.includes(x))))
  const toggleAll = () => onChange(all ? [] : [...COURSES])
  return (
    <div ref={ref} className="relative">
      <div className="id-input !flex min-h-[3.4rem] flex-wrap items-center gap-1.5 !p-2.5 !text-left !text-base !normal-case !tracking-normal cursor-pointer"
        role="button" tabIndex={0} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}>
        {value.length
          ? value.map((c) => (
            <span key={c} className="ms-chip">{c}
              <button type="button" aria-label={`Remove ${c}`} onClick={(e) => { e.stopPropagation(); toggle(c) }}>×</button>
            </span>))
          : <span className="opacity-50">Select courses</span>}
        <ChevronDown size={16} className={`ml-auto shrink-0 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
      </div>
      {open ? (
        <div className="ms-pop" role="listbox" aria-multiselectable="true">
          <label className="ms-opt"><input type="checkbox" checked={all} onChange={toggleAll} /> All Courses</label>
          {COURSES.map((c) => (
            <label key={c} className="ms-opt"><input type="checkbox" checked={value.includes(c)} onChange={() => toggle(c)} /> {c}</label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const outOfRange = (f, v) => f.type !== 'select' && f.type !== 'courses' && String(v).trim() !== '' && (isNaN(Number(v)) || Number(v) < f.min || Number(v) > f.max)

export default function DemoQuestionnaire({ onResult, onCancel }) {
  const [step, setStep] = useState(0)
  const [a, setA] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const cur = STEPS[step]
  const complete = cur.fields.every((f) => (f.type === 'courses' ? a.courses.length > 0
    : String(a[f.k]).trim() !== '' && (f.type === 'select' || !outOfRange(f, a[f.k]))))
  const set = (k, v) => setA((s) => ({ ...s, [k]: v }))

  // The model takes ONE course per prediction, so the same answers are sent once per selected course.
  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      const base = toFeatures(a)
      const runs = await Promise.all(a.courses.map(async (course) => {
        const features = { ...base, course }
        if (import.meta.env.DEV) console.debug('[demo] POST /api/predict payload', { features })
        const prediction = await api.predict({ features }) // real model prediction, no student_id
        if (import.meta.env.DEV) console.debug('[demo] /api/predict response', course, prediction)
        return { course, features, prediction }
      }))
      onResult({ features: base, runs })
    } catch (e) {
      if (import.meta.env.DEV) console.error('[demo] prediction failed', e)
      setErr(/failed to fetch|networkerror|load failed/i.test(e.message) ? 'Cannot reach the backend. Start it with: uvicorn backend.main:app --reload' : e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-xl">
        <Eyebrow className="mb-3">Simulated student · Step {step + 1} of {STEPS.length}</Eyebrow>
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{cur.title}</h1>
        <Glass className="space-y-4 p-6">
          {cur.fields.map((f) => (f.type === 'courses' ? (
            <div key={f.k}>
              <span className="label mb-1.5 block">{f.label}</span>
              <CourseSelect value={a.courses} onChange={(v) => set('courses', v)} />
            </div>
          ) : (
            <label key={f.k} className="block">
              <span className="label mb-1.5 block">{f.label}{f.type === 'select' ? '' : ` (${f.min}–${f.max})`}</span>
              {f.type === 'select' ? (
                <select className="id-input !text-base !tracking-normal !normal-case" value={a[f.k]} onChange={(e) => set(f.k, e.target.value)}>
                  <option value="">Select…</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="id-input !text-base !tracking-normal" type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step}
                  value={a[f.k]} onChange={(e) => set(f.k, e.target.value)} />
              )}
              {outOfRange(f, a[f.k]) ? <span className="mt-1 block text-xs text-red-500">{f.label.replace(/ \(.*\)/, '')} must be between {f.min} and {f.max}.</span> : null}
            </label>
          )))}
          {step === 0 ? <div className="text-xs text-white/40">Every answer is reused for each selected course (the model scores one course at a time).</div> : null}
        </Glass>
        <div className="mt-4"><ErrorBox error={err} /></div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn btn-ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)} disabled={busy}><ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}</button>
          <button className="btn" onClick={() => setA(SAMPLE)} disabled={busy}><Wand2 size={14} /> Use Sample Answers</button>
          {step < STEPS.length - 1
            ? <button className="btn btn-primary ml-auto" onClick={() => setStep(step + 1)} disabled={!complete}>Next <ArrowRight size={14} /></button>
            : <button className="btn btn-primary ml-auto" onClick={submit} disabled={!complete || busy}>{busy ? 'Running model…' : 'See prediction'}</button>}
        </div>
      </div>
    </div>
  )
}
