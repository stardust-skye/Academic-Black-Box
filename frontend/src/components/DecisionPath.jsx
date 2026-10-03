import { motion } from 'framer-motion'
import { ArrowDown, User } from 'lucide-react'
import { BAND, Label, pct } from './ui.jsx'

// The student's own route through the trained decision tree (data from /api/model/tree-path/{id}).
// Risk values are the tree's node estimates along the route (a "risk path"), not causal effects.
export default function DecisionPath({ pred, compact = false }) {
  if (!pred) return null
  const color = BAND[pred.band].color
  const n = pred.decision_path.length
  return (
    <div className="mx-auto flex max-w-xl flex-col items-stretch">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-400/20 text-indigo-200"><User size={15} /></span>
        <div>
          <div className="text-sm font-bold tracking-[0.2em]">YOU</div>
          {!compact && <Label className="!text-[9px]">tree starts at {pct(pred.baseline_risk)} for everyone</Label>}
        </div>
      </motion.div>
      {pred.decision_path.map((s, i) => (
        <div key={`${s.node}-${i}`} className="flex flex-col items-stretch">
          <Connector />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * (i + 1) }}
            className="glass px-5 py-4" style={{ borderColor: 'rgba(129,140,248,.35)', boxShadow: '0 0 30px rgba(99,102,241,.10)' }}>
            <div className="flex items-start gap-4">
              <span className="mt-0.5 font-mono text-xs text-indigo-300">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1">
                <div className="text-lg font-semibold leading-snug">{s.text}</div>
                <div className="mt-1 text-sm text-white/50">
                  Your value: <span className="font-mono text-white/85">{s.value_display}</span>
                  {s.imputed ? <span className="text-white/35"> (blank in data, dataset median used)</span> : null}
                </div>
              </div>
              {!compact && (
                <div className="text-right font-mono text-[11px] text-white/40">
                  tree risk estimate<br /><span className="text-sm text-white/70">{pct(s.risk_before)} → {pct(s.risk_after)}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ))}
      <Connector />
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 * (n + 1) }}
        className="rounded-2xl px-6 py-5 text-center" style={{ border: `1px solid ${color}88`, background: `${color}14`, boxShadow: `0 0 50px ${color}26` }}>
        <Label className="!text-[9px]">you land in the</Label>
        <div className="mt-1 text-2xl font-extrabold tracking-[0.2em]" style={{ color }}>{pred.band === 'high' ? 'HIGH-RISK LEAF' : pred.band === 'medium' ? 'WATCH LEAF' : 'LOWER-RISK LEAF'}</div>
        <div className="mt-2 font-mono text-xs text-white/55">
          {pct(pred.leaf.risk)} of {pred.leaf.training_samples} similar training records finished D/F
        </div>
      </motion.div>
    </div>
  )
}

const Connector = () => <div className="flex justify-center py-1.5 text-white/25"><ArrowDown size={16} /></div>
