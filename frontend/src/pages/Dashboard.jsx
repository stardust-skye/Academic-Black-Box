import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Database, GitBranch, Minus } from 'lucide-react'
import { ActivityPanels } from '../components/Charts.jsx'
import { BAND, DISCLAIMER, Eyebrow, Glass, Label, STRENGTH, pct, useCountUp } from '../components/ui.jsx'

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'GOOD MORNING' : h < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING' }

const HEADLINE = {
  high: 'Your current model signal indicates elevated risk of finishing this course with a D/F.',
  medium: 'Your current model signal says a few habits are worth watching in this course.',
  low: 'Your current model signal places you on a lower-risk path in this course.',
}

// Compare a student's value with the dataset median (real ranges from the trained model's metadata). No invented numbers.
function Compare({ kind, value, median }) {
  if (value == null || median == null) return null
  let diff, text
  if (kind === 'rel') { diff = (value - median) / median; text = `${Math.abs(diff * 100).toFixed(0)}%` }
  else { diff = kind === 'frac' ? (value - median) * 100 : value - median; text = `${Math.abs(diff).toFixed(0)} pts` }
  const flat = Math.abs(kind === 'rel' ? diff * 100 : diff) < 0.5
  const Icon = flat ? Minus : diff > 0 ? ArrowUp : ArrowDown
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-white/50">
      <Icon size={12} className={flat ? '' : diff > 0 ? 'text-emerald-300' : 'text-amber-300'} />
      {flat ? 'at dataset median' : `${text} ${diff > 0 ? 'above' : 'below'} dataset median`}
    </div>
  )
}

function Signal({ label, value, unit, kind, raw, median }) {
  return (
    <Glass className="p-5">
      <Label>{label}</Label>
      <div className="mt-2 flex items-baseline gap-1.5"><span className="text-4xl font-extrabold tracking-tight">{value}</span><span className="text-sm text-white/45">{unit}</span></div>
      <Compare kind={kind} value={raw} median={median} />
    </Glass>
  )
}

export default function Dashboard({ ctx }) {
  const { detail, activity, setPage, studentId } = ctx
  const p = detail.prediction, f = detail.features, band = BAND[p.band]
  const shown = useCountUp(p.risk_probability, 1600, true)
  const med = (k) => detail.levers.find((l) => l.key === k)?.median
  const src = activity?.source
  const live = src?.mode === 'tiger'

  return (
    <div className="space-y-14">
      <div>
        <Eyebrow className="mb-3">{greeting()}, {studentId}.</Eyebrow>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Here's your semester.</h1>
        <div className="mt-3 font-mono text-sm tracking-widest text-white/50">{detail.profile.course} · {detail.profile.class_year.toUpperCase()}</div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07] px-8 py-14 text-center md:py-16"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${band.color}1f, transparent 65%), rgba(255,255,255,.015)` }}>
        <Label>Semester health</Label>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
          className="my-2 font-extrabold leading-none tracking-tighter"
          style={{ fontSize: 'clamp(110px, 15vw, 210px)', color: band.color, textShadow: `0 0 80px ${band.color}55` }}>
          {Math.round(shown * 100)}<span style={{ fontSize: '0.4em' }}>%</span>
        </motion.div>
        <div className="text-2xl font-extrabold tracking-[0.3em]" style={{ color: band.color }}>{band.text}</div>
        <div className="mt-2 font-mono text-xs tracking-widest text-white/45">{detail.profile.course} · {detail.profile.class_year.toUpperCase()}</div>
        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4 border-t border-white/10 pt-5 text-center">
          <div><Label>MODEL PREDICTION</Label><div className="mt-1 text-lg font-bold">{pct(p.risk_probability)} risk of D/F</div></div>
          <div><Label>RECORDED OUTCOME</Label><div className="mt-1 text-lg font-bold">{detail.profile.actual_at_risk === 1 ? 'D/F' : 'C or better'}</div></div>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/70">{HEADLINE[p.band]}</p>
        <button className="btn btn-primary mt-8 !px-8 !py-4" onClick={() => setPage('why')}><GitBranch size={16} /> Why am I at risk?</button>
        <div className="mx-auto mt-6 max-w-md text-[11px] leading-relaxed text-white/30">
          Model risk score: the share of similar training records in your decision-tree leaf that finished with a D/F. Not a calibrated probability.
        </div>
      </section>

      {/* YOUR ACADEMIC SIGNALS */}
      <section>
        <Eyebrow className="mb-5">Your academic signals</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Signal label="Study time" value={f.avg_weekly_study_hours.toFixed(1)} unit="hrs/week" kind="rel" raw={f.avg_weekly_study_hours} median={med('avg_weekly_study_hours')} />
          <Signal label="Attendance" value={pct(f.attendance_rate)} unit="of classes" kind="frac" raw={f.attendance_rate} median={med('attendance_rate')} />
          <Signal label="On-time submissions" value={pct(f.on_time_submission_rate)} unit="" kind="frac" raw={f.on_time_submission_rate} median={med('on_time_submission_rate')} />
          <Signal label="Midterm" value={f.midterm_score.toFixed(0)} unit="%" kind="abs" raw={f.midterm_score} median={med('midterm_score')} />
        </div>
      </section>

      {/* MODEL SIGNALS */}
      <section>
        <Eyebrow className="mb-5">Model signals</Eyebrow>
        <div className="space-y-3">
          {p.contributions.slice(0, 3).map((c, i) => (
            <Glass key={c.feature} className="flex items-center gap-6 px-6 py-4">
              <span className="font-mono text-sm text-indigo-300">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1"><div className="text-lg font-semibold">{c.label}</div></div>
              <div className="text-sm text-white/55">{STRENGTH[c.strength]}</div>
            </Glass>
          ))}
        </div>
        <div className="mt-3 text-xs text-white/35">{DISCLAIMER}</div>
      </section>

      {/* ACTIVITY */}
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Your academic activity</Eyebrow>
          {src ? (
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: live ? '#34d399' : '#fbbf24' }}>
              <Database size={11} />{live ? 'Tiger Data · Live' : 'Demo data · Local mode'}
            </span>
          ) : null}
        </div>
        <Glass className="p-6">
          {activity ? <ActivityPanels weekly={activity.weekly} /> : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/35">
            <span>{activity?.notice}</span>
            <span className="font-mono uppercase tracking-[0.2em]">{live ? 'Powered by Tiger Data' : 'Tiger Data not connected'}</span>
          </div>
        </Glass>
      </section>
    </div>
  )
}
