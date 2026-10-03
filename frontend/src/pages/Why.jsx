import { useEffect, useState } from 'react'
import { api } from '../api.js'
import DecisionPath from '../components/DecisionPath.jsx'
import { ExplainCard, Spark } from '../components/GeminiCards.jsx'
import { BAND, DISCLAIMER, ErrorBox, Eyebrow, Glass, Label, STRENGTH, Spinner, pct, useCountUp } from '../components/ui.jsx'

export default function Why({ ctx }) {
  const { studentId, detail } = ctx
  const [path, setPath] = useState(null)
  const [ex, setEx] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const shown = useCountUp(path ? path.risk_probability : 0, 1200, true)

  useEffect(() => { setPath(null); setEx(null); setErr(null); api.treePath(studentId).then(setPath).catch(setErr) }, [studentId])

  const explain = async () => {
    setBusy(true); setErr(null)
    try { setEx(await api.explain(studentId, null)) } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  if (!path) return <><ErrorBox error={err} /><Spinner text="Reading the tree…" /></>
  const band = BAND[path.band]
  const top = path.contributions.slice(0, 5)

  return (
    <div className="space-y-16">
      <ErrorBox error={err} />
      <div className="text-center">
        <Eyebrow className="mb-4">Why?</Eyebrow>
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
          Why does the black box think I'm {path.band === 'high' ? 'at risk' : path.band === 'medium' ? 'on watch' : 'on a lower-risk path'}?
        </h1>
        <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">Your risk</div>
        <div className="font-extrabold leading-none tracking-tighter" style={{ fontSize: 'clamp(80px, 10vw, 130px)', color: band.color, textShadow: `0 0 60px ${band.color}44` }}>
          {Math.round(shown * 100)}<span style={{ fontSize: '0.4em' }}>%</span>
        </div>
        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4 border-t border-white/10 pt-5 text-center">
          <div><Label>MODEL PREDICTION</Label><div className="mt-1 text-lg font-bold">{pct(path.risk_probability)} risk of D/F</div></div>
          <div><Label>RECORDED OUTCOME</Label><div className="mt-1 text-lg font-bold">{detail.profile.actual_at_risk === 1 ? 'D/F' : 'C or better'}</div></div>
        </div>
      </div>

      <section>
        <Eyebrow className="mb-6 text-center">Your risk path · the route your record took through the decision tree</Eyebrow>
        <DecisionPath pred={path} />
      </section>

      <section>
        <Eyebrow className="mb-5">What the model is seeing</Eyebrow>
        <div className="space-y-3">
          {top.map((c, i) => (
            <Glass key={c.feature} className="px-6 py-4">
              <div className="flex items-center gap-6">
                <span className="font-mono text-sm text-indigo-300">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{c.label}</div>
                  <div className="text-sm text-white/50">{STRENGTH[c.strength]} · {c.delta > 0 ? 'points toward higher risk' : 'points toward lower risk'}</div>
                </div>
                <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-white/5 md:block">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400" style={{ width: `${Math.max(6, c.share * 100)}%` }} />
                </div>
              </div>
            </Glass>
          ))}
        </div>
        <div className="mt-3 text-xs text-white/35">{DISCLAIMER} Bar length = share of the total movement along your tree path.</div>
      </section>

      <section>
        <Eyebrow className="mb-5">Ask Gemini</Eyebrow>
        <Glass className="flex flex-col items-start justify-between gap-5 p-8 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold"><Spark size={16} /> Black Box Intelligence</div>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-white/55">Gemini receives your real model prediction, tree path and features and explains them in plain language. It never makes or changes the prediction.</p>
          </div>
          <button className="btn btn-primary shrink-0" onClick={explain} disabled={busy}><Spark size={13} /> {busy ? 'Reading your result…' : 'Explain my risk'}</button>
        </Glass>
        <div className="mt-5"><ExplainCard data={ex} /></div>
      </section>
      <div className="text-center text-xs text-white/30">Risk estimate {pct(path.risk_probability)} · predicted class {path.predicted_class === 1 ? 'D/F' : 'C or better'}</div>
    </div>
  )
}
