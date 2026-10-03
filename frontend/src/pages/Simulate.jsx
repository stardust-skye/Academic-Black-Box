import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarCheck, ChevronDown, RotateCcw, Wand2 } from 'lucide-react'
import { api } from '../api.js'
import DecisionPath from '../components/DecisionPath.jsx'
import { ExplainCard, PlanCard, Spark } from '../components/GeminiCards.jsx'
import { BAND, ErrorBox, Eyebrow, Glass, Label, pct, useCountUp } from '../components/ui.jsx'

// Slider groups use ONLY levers the backend exposes (ranges come from the dataset's Data Dictionary).
const GROUPS = [
  { title: 'Study', keys: ['avg_weekly_study_hours', 'practice_quizzes_taken', 'avg_practice_quiz_score', 'avg_days_started_before_exam'] },
  { title: 'Consistency', keys: ['attendance_rate', 'on_time_submission_rate', 'missed_deadlines'] },
  { title: 'Wellbeing', keys: ['avg_sleep_hours'] },
  { title: 'Academics', keys: ['midterm_score'], note: 'Your midterm already happened. Explore it to see how much the model leans on it.' },
]
const FRAC = new Set(['attendance_rate', 'on_time_submission_rate'])
const show = (k, v) => {
  if (v == null) return 'n/a'
  if (FRAC.has(k)) return `${(v * 100).toFixed(0)}%`
  if (k === 'avg_weekly_study_hours' || k === 'avg_sleep_hours') return `${Number(v).toFixed(1)} h`
  if (k === 'avg_days_started_before_exam') return `${Number(v).toFixed(1)} d`
  if (k === 'avg_practice_quiz_score' || k === 'midterm_score') return `${Number(v).toFixed(0)}%`
  return Number(v).toFixed(0)
}
const bandOf = (p) => (p < 0.3 ? 'low' : p < 0.5 ? 'medium' : 'high')

function Slider({ lever, value, onChange }) {
  const changed = Math.abs(value - lever.default) > 1e-9
  const tick = ((lever.default - lever.min) / (lever.max - lever.min)) * 100
  return (
    <div className="rounded-2xl border p-4 transition" style={{ borderColor: changed ? 'rgba(129,140,248,.55)' : 'rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{lever.label}</span>
        <span className="font-mono text-sm">
          <span className="text-white/40">{show(lever.key, lever.default)}{lever.imputed ? '*' : ''}</span>
          {changed ? <span className="text-indigo-300"> → {show(lever.key, value)}</span> : null}
        </span>
      </div>
      <div className="relative">
        <input type="range" min={lever.min} max={lever.max} step={lever.step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} aria-label={lever.label} />
        <div className="pointer-events-none absolute -top-1.5 h-4 w-px bg-white/40" style={{ left: `${tick}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-white/30"><span>{show(lever.key, lever.min)}</span><span>{lever.good === 'up' ? 'higher is better' : 'lower is better'}</span><span>{show(lever.key, lever.max)}</span></div>
    </div>
  )
}

// Every number here is a real model re-run returned by POST /api/simulate.
function Journey({ steps }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {steps.map((s, i) => {
        const b = BAND[bandOf(s.risk_after)]
        return (
          <div key={i} className="flex items-center gap-3">
            {i > 0 ? <ArrowRight size={18} className="text-white/25" /> : null}
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 * i, type: 'spring', stiffness: 160 }}
              className="rounded-2xl border px-4 py-3 text-center" style={{ borderColor: `${b.color}55`, background: `${b.color}10`, minWidth: 92 }}>
              <div className="text-3xl font-extrabold" style={{ color: b.color }}>{Math.round(s.risk_after * 100)}%</div>
              <div className="mt-1 max-w-[150px] text-[11px] leading-tight text-white/50">{s.key ? s.text : 'current'}</div>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

export default function Simulate({ ctx }) {
  const { studentId, detail } = ctx
  const levers = detail.levers
  const byKey = useMemo(() => Object.fromEntries(levers.map((l) => [l.key, l])), [levers])
  const defaults = useMemo(() => Object.fromEntries(levers.map((l) => [l.key, l.default])), [levers])
  const [vals, setVals] = useState(defaults)
  const [res, setRes] = useState(null)
  const [ranWith, setRanWith] = useState('')
  const [busy, setBusy] = useState(false)
  const [ex, setEx] = useState(null)
  const [plan, setPlan] = useState(null)
  const [gbusy, setGbusy] = useState('')
  const [showPath, setShowPath] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => { setVals(defaults); setRes(null); setEx(null); setPlan(null); setErr(null) }, [studentId, defaults])

  const overrides = () => Object.fromEntries(levers.filter((l) => Math.abs(vals[l.key] - l.default) > 1e-9).map((l) => [l.key, vals[l.key]]))
  const nChanged = Object.keys(overrides()).length
  const stale = res && JSON.stringify(overrides()) !== ranWith

  const run = async () => {
    setBusy(true); setErr(null); setEx(null); setPlan(null)
    const o = overrides()
    try { setRes(await api.simulate(studentId, o)); setRanWith(JSON.stringify(o)) } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  const gem = async (kind) => {
    setGbusy(kind); setErr(null)
    try {
      const o = JSON.parse(ranWith || '{}')
      const body = Object.keys(o).length ? o : null
      if (kind === 'explain') setEx(await api.explain(studentId, body)); else setPlan(await api.plan(studentId, body))
    } catch (e) { setErr(e) } finally { setGbusy('') }
  }

  const cur = detail.prediction
  const to = res ? res.simulated.risk_probability : cur.risk_probability
  const shown = useCountUp(to, 1400)
  const simBand = res ? res.simulated.band : cur.band

  // Smart move: the simulated step that lowered the model's risk the most (from the real re-run, never invented).
  const best = res ? res.steps.slice(1).reduce((m, s) => (s.delta < (m?.delta ?? 0) ? s : m), null) : null
  const improved = best && best.delta < -0.005

  return (
    <div className="space-y-12">
      <ErrorBox error={err} />
      <div className="text-center">
        <Eyebrow className="mb-4">Simulate</Eyebrow>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">What if I change?</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-white/55">Your current trajectory isn't a verdict.<br />Let's see what happens if you change the inputs.</p>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[1.2fr_1fr]">
        {/* SLIDERS */}
        <section className="space-y-9">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <Eyebrow className="mb-4">{g.title}</Eyebrow>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {g.keys.filter((k) => byKey[k]).map((k) => (
                  <Slider key={k} lever={byKey[k]} value={vals[k]} onChange={(v) => setVals((s) => ({ ...s, [k]: v }))} />
                ))}
              </div>
              {g.note ? <div className="mt-2 text-xs text-white/35">{g.note}</div> : null}
            </div>
          ))}
          <div className="text-[11px] leading-relaxed text-white/30">The tick marks your current value. * = blank in your record, dataset median used. Ranges come from the dataset's data dictionary. Results are re-run on the trained decision tree by the backend; nothing is calculated in the browser.</div>
        </section>

        {/* CURRENT -> SIMULATED (sticky) */}
        <aside className="space-y-5 xl:sticky xl:top-6">
          <Glass className="px-6 py-8">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="text-center">
                <Label>Current</Label>
                <div className="mt-2 text-6xl font-extrabold leading-none" style={{ color: BAND[cur.band].color }}>{pct(cur.risk_probability)}</div>
              </div>
              <ArrowRight size={26} className="text-white/25" />
              <div className="text-center">
                <Label>Simulated</Label>
                <div className="mt-2 text-6xl font-extrabold leading-none" style={{ color: res ? BAND[simBand].color : 'rgba(255,255,255,.2)', opacity: stale ? 0.45 : 1 }}>
                  {res ? `${Math.round(shown * 100)}%` : '???'}
                </div>
              </div>
            </div>
            {stale ? <div className="mt-3 text-center text-xs text-amber-300">Sliders changed. Run the simulation again.</div> : null}
            <button className="btn btn-primary mt-7 w-full !py-4" onClick={run} disabled={busy || nChanged === 0}>
              {busy ? 'Re-running the model…' : nChanged === 0 ? 'Move a slider first' : 'Simulate my semester'}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button className="btn !px-3 !text-[10px]" onClick={() => setVals({ ...defaults, ...detail.suggested_plan })} title="Moves each lever to the better quartile of the dataset (midterm excluded)"><Wand2 size={13} /> Suggested targets</button>
              <button className="btn !px-3 !text-[10px]" onClick={() => { setVals(defaults); setRes(null); setEx(null); setPlan(null) }}><RotateCcw size={13} /> Reset</button>
            </div>
          </Glass>

          {res ? (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <Glass className="p-6">
                <Eyebrow className="mb-4">The model re-ran · each step is a real prediction</Eyebrow>
                <Journey steps={res.steps} />
              </Glass>
              <Glass className="p-6" style={{ borderColor: 'rgba(129,140,248,.3)' }}>
                <Eyebrow className="mb-3">Your biggest opportunity</Eyebrow>
                {improved ? (
                  <p className="text-lg leading-snug">
                    According to this model simulation, <b>{best.text}</b> moved your prediction from {pct(best.risk_after - best.delta)} to {pct(best.risk_after)}.
                  </p>
                ) : (
                  <p className="text-base leading-snug text-white/80">
                    According to this model simulation, these changes did not move you into a different branch of the tree. Try a larger change, or a different lever.
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-white/45">
                  {res.flipped_conditions.length
                    ? <>The tree no longer follows: {res.flipped_conditions.map((f) => f.text).join(' · ')}.</>
                    : <>No split on your current path was crossed, so the score stayed on the same branch.</>}
                  {' '}Model signal, not a guarantee.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <button className="btn btn-primary" onClick={() => gem('explain')} disabled={!!gbusy || stale}><Spark size={13} /> {gbusy === 'explain' ? 'Asking Gemini…' : 'Ask Gemini what to do next'}</button>
                  <button className="btn" onClick={() => gem('plan')} disabled={!!gbusy || stale}><CalendarCheck size={14} /> {gbusy === 'plan' ? 'Planning…' : 'Get my 7-day plan'}</button>
                </div>
              </Glass>
            </motion.div>
          ) : null}
        </aside>
      </div>

      {res ? (
        <section className="space-y-8">
          <ExplainCard data={ex} />
          <PlanCard data={plan} />
          <div>
            <button className="btn btn-ghost !text-[11px]" onClick={() => setShowPath((v) => !v)}><ChevronDown size={14} className={showPath ? 'rotate-180' : ''} /> {showPath ? 'Hide' : 'Show'} your new risk path</button>
            {showPath ? <div className="mt-6"><DecisionPath pred={res.simulated} compact /></div> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
