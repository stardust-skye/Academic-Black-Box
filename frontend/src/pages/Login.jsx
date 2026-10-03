import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Box, Check } from 'lucide-react'

export default function Login({ onLogin, onDemo, error, busy }) {
  const [id, setId] = useState('')
  const submit = (e) => { e.preventDefault(); if (id.trim()) onLogin(id.trim()) }
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,.22), rgba(56,189,248,.06) 45%, transparent 70%)', filter: 'blur(20px)' }} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <motion.div animate={{ rotate: [0, 90, 90, 180] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-8 grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/[0.04] text-indigo-300"
          style={{ boxShadow: '0 0 60px rgba(99,102,241,.35)' }}>
          <Box size={26} />
        </motion.div>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-[0.12em]">ACADEMIC<br />BLACK BOX</h1>
        <p className="mt-6 font-mono text-[11px] uppercase leading-[2] tracking-[0.28em] text-white/50">
          See the risk.<br />Understand why.<br />Change the outcome.
        </p>
        <div className="my-9 h-px w-24 bg-white/15" />

        <form onSubmit={submit} className="w-full space-y-4">
          <label className="label block text-left">Student ID</label>
          <input className="id-input" value={id} onChange={(e) => setId(e.target.value)} placeholder="S1030" maxLength={8}
            autoFocus spellCheck={false} autoComplete="off" aria-label="Student ID" />
          <div className="h-5 text-sm text-red-300" role="alert">{error || ''}</div>
          <button type="submit" className="btn btn-primary w-full !py-4" disabled={!id.trim() || busy}>
            Access my semester <ArrowRight size={16} />
          </button>
        </form>

        <div className="my-5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">or</div>
        <button className="btn btn-ghost w-full" onClick={onDemo} disabled={busy}>Try demo student</button>

        <div className="mt-12 font-mono text-[10px] uppercase leading-[1.9] tracking-[0.25em] text-white/30">
          WolfHacks 2026<br />Synthetic student data
        </div>
      </motion.div>
    </div>
  )
}

const STEPS = ['Student profile found', 'Academic signals loaded', 'Decision tree initialized', 'Risk trajectory calculated']

// Shown while the real data loads. The checklist is paced for the demo (~1.5 s), but the screen only
// advances once the backend has actually returned the student's record and activity.
export function Analyzing({ done }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 font-mono text-xs uppercase tracking-[0.3em] text-indigo-300">
          Analyzing your semester…
        </motion.div>
        <div className="space-y-4">
          {STEPS.map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i < done ? 1 : 0.2, x: 0 }} transition={{ delay: 0.05 * i }}
              className="flex items-center gap-3 text-lg">
              <span className="grid h-6 w-6 place-items-center rounded-full border"
                style={{ borderColor: i < done ? '#34d399' : 'rgba(255,255,255,.2)', color: '#34d399' }}>
                {i < done ? <Check size={14} /> : null}
              </span>
              <span className={i < done ? 'text-white' : 'text-white/30'}>{s}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
