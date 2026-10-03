import { ArrowLeft } from 'lucide-react'
import DecisionPath from './DecisionPath.jsx'
import { BAND, Eyebrow, Glass, Label } from './ui.jsx'

// Result for a questionnaire-built (hypothetical) student: one real model prediction per selected course.
// Every number comes from the backend model. No recorded outcome is ever shown here.
export default function SimulatedResult({ result, onBack }) {
  const { runs, features: f } = result
  const single = runs.length === 1
  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <div className="text-center">
        <Eyebrow className="mb-3">SIMULATED STUDENT</Eyebrow>
        <div className="font-mono text-sm tracking-widest text-white/50">{runs.map((r) => r.course).join(' · ')} · {f.class_year.toUpperCase()}</div>
        <Glass className="mx-auto mt-8 max-w-xl px-8 py-10">
          <Label>MODEL PREDICTION</Label>
          {single ? (
            <div className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color: BAND[runs[0].prediction.band].color }}>
              MODEL PREDICTION: {Math.round(runs[0].prediction.risk_probability * 100)}% risk of D/F
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {runs.map((r) => (
                <div key={r.course} className="text-xl font-extrabold leading-tight sm:text-2xl" style={{ color: BAND[r.prediction.band].color }}>
                  {r.course} — {Math.round(r.prediction.risk_probability * 100)}% risk of D/F
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="text-base text-white/70">OUTCOME: Hypothetical — no recorded course outcome</div>
          </div>
        </Glass>
      </div>
      {runs.map((r) => (
        <section key={r.course} className="mt-14">
          <Eyebrow className="mb-6 text-center">{single ? '' : `${r.course} · `}The route these answers took through the decision tree</Eyebrow>
          <DecisionPath pred={r.prediction} />
        </section>
      ))}
      <div className="mt-12 text-center">
        <button className="btn" onClick={onBack}><ArrowLeft size={14} /> Back to start</button>
      </div>
      <div className="mt-8 text-center text-xs text-white/30">Model signal, not proof of causation. Not a calibrated probability.</div>
    </div>
  )
}
