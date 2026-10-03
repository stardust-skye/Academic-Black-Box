import { motion } from 'framer-motion'
import { CalendarCheck, Cpu } from 'lucide-react'
import { Glass, Label } from './ui.jsx'

const Spark = ({ size = 14 }) => <span style={{ fontSize: size }} className="text-indigo-300">✦</span>

const Source = ({ d }) =>
  d.source === 'gemini'
    ? <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-indigo-300" title={d.model}><Spark size={11} /> Gemini live</span>
    : <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300" title={d.fallback_reason}><Cpu size={11} /> Local mode · {d.fallback_reason}</span>

// Gemini explains the model's result. It never produces or changes a number.
export function ExplainCard({ data }) {
  if (!data) return null
  const ex = data.explanation
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <Glass className="space-y-6 p-8" style={{ borderColor: 'rgba(129,140,248,.3)', boxShadow: '0 0 70px rgba(99,102,241,.12)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-indigo-200"><Spark /> Black Box Intelligence</div>
          <Source d={ex} />
        </div>
        <p className="text-xl leading-relaxed">{ex.summary}</p>
        <p className="leading-relaxed text-white/65">{ex.prediction_meaning}</p>
        {ex.what_changed ? <div className="rounded-2xl border border-indigo-300/25 bg-indigo-300/[0.07] p-5 leading-relaxed"><Label className="mb-2">According to this simulation</Label>{ex.what_changed}</div> : null}
        <div className="grid gap-8 md:grid-cols-2">
          <div><Label className="mb-3">What the model is seeing</Label>
            <ul className="space-y-3 text-sm">{(ex.key_factors || []).map((f, i) => <li key={i}><b>{f.factor}</b><br /><span className="text-white/60">{f.insight}</span></li>)}</ul></div>
          <div><Label className="mb-3">Most actionable changes</Label>
            <ul className="space-y-3 text-sm">{(ex.actionable_levers || []).map((f, i) => <li key={i}><b>{f.lever}</b><br /><span className="text-white/60">{f.suggestion}</span></li>)}</ul></div>
        </div>
        <div className="space-y-1 border-t border-white/10 pt-4 text-xs text-white/40">{(ex.limitations || []).map((l, i) => <div key={i}>· {l}</div>)}</div>
      </Glass>
    </motion.div>
  )
}

export function PlanCard({ data }) {
  if (!data) return null
  const p = data.plan
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <Glass className="space-y-6 p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-indigo-200"><CalendarCheck size={13} /> Your 7-day recovery plan</div>
          <Source d={p} />
        </div>
        <p className="text-xl leading-relaxed">{p.headline}</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(p.days || []).map((d, i) => (
            <motion.div key={d.day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 * i }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="font-mono text-xs tracking-[0.2em] text-indigo-300">DAY {d.day}</div>
              <div className="mb-2 mt-1 font-semibold leading-snug">{d.focus}</div>
              <ul className="space-y-1.5 text-sm text-white/65">{(d.actions || []).map((a, j) => <li key={j}>· {a}</li>)}</ul>
              <div className="mt-3 text-xs text-white/40">Track: {d.target_metric}</div>
            </motion.div>
          ))}
        </div>
        <div className="text-sm text-white/65"><Label className="mb-2">Success signals</Label>{(p.success_signals || []).map((s, i) => <div key={i}>✓ {s}</div>)}</div>
        <div className="text-xs text-white/35">{p.disclaimer}</div>
      </Glass>
    </motion.div>
  )
}

export { Spark }
