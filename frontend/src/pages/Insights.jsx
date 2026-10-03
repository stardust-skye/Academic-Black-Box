import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { CohortChart, ConfusionMatrix, FeatureBars } from '../components/Charts.jsx'
import TreeView from '../components/TreeView.jsx'
import { ErrorBox, Eyebrow, Glass, Label, PageHead, Spinner } from '../components/ui.jsx'

const Tile = ({ label, value, sub }) => (
  <Glass className="p-5"><Label>{label}</Label><div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>{sub ? <div className="mt-1 font-mono text-[11px] text-white/40">{sub}</div> : null}</Glass>
)

const METRICS = [['accuracy', 'Accuracy', 'pct'], ['precision', 'Precision', 'pct'], ['recall', 'Recall', 'pct'], ['f1', 'F1', 'pct'], ['roc_auc', 'ROC-AUC', 'auc']]
const fmtM = (v, kind) => (v == null ? '—' : kind === 'auc' ? v.toFixed(3) : `${(v * 100).toFixed(1)}%`)
const pstr = (p) => `depth ${p.max_depth} · min leaf ${p.min_samples_leaf}`

// Baseline vs tuned on the SAME held-out test set. The tuning search itself only ever saw the training split.
function TuningCompare({ t, n }) {
  const keep = t.selected === 'baseline'
  return (
    <section>
      <Eyebrow className="mb-4">Baseline vs tuned · same {n}-record held-out test set</Eyebrow>
      <Glass className="p-6" style={{ borderColor: keep ? 'rgba(251,191,36,.45)' : 'rgba(52,211,153,.45)' }}>
        <div className="mb-1 font-mono text-sm font-bold tracking-[0.18em]" style={{ color: keep ? '#fbbf24' : '#34d399' }}>{t.verdict}</div>
        <p className="mb-5 text-sm leading-relaxed text-white/60">
          {t.reason} Model in production: <b className="text-white">{keep ? 'baseline' : 'tuned'}</b> ({pstr((keep ? t.baseline : t.tuned).params)}). The metrics above are this model's.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead><tr className="text-left"><th className="pb-2 pr-3"><Label>Held-out test</Label></th><th className="pb-2 pr-3"><Label>Baseline · {pstr(t.baseline.params)}</Label></th><th className="pb-2"><Label>Tuned · {pstr(t.tuned.params)}</Label></th></tr></thead>
            <tbody>
              {METRICS.map(([k, name, kind]) => {
                const b = t.baseline.test[k], u = t.tuned.test[k]
                return (
                  <tr key={k} className="border-t border-white/10">
                    <td className="py-2 pr-3 font-mono text-xs uppercase tracking-widest text-white/50">{name}</td>
                    <td className="py-2 pr-3 font-mono">{fmtM(b, kind)}</td>
                    <td className="py-2 font-mono">{fmtM(u, kind)} <span className="text-xs text-white/40">{t.same_config ? '' : u > b + 1e-9 ? '▲' : u < b - 1e-9 ? '▼' : '='}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 space-y-1.5 text-[11px] leading-relaxed text-white/40">
          <div><b className="text-white/60">Search:</b> {t.strategy.search}; {t.strategy.candidates_evaluated} depth × leaf settings ranked by {t.strategy.ranking}.</div>
          <div><b className="text-white/60">Selection rule:</b> {t.strategy.promotion_rule}.</div>
          <div><b className="text-white/60">Test set:</b> {t.strategy.test_set}. With only {n} records one student moves a metric by roughly 1 to 2 points, so small differences are noise.</div>
        </div>
      </Glass>
    </section>
  )
}

export default function Insights() {
  const [m, setM] = useState(null)
  const [imp, setImp] = useState(null)
  const [ov, setOv] = useState(null)
  const [err, setErr] = useState(null)
  const [showRules, setShowRules] = useState(false)
  useEffect(() => {
    Promise.all([api.metrics(), api.importance(), api.overview()]).then(([a, b, c]) => { setM(a); setImp(b); setOv(c) }).catch(setErr)
  }, [])
  if (!m || !imp || !ov) return <><ErrorBox error={err} /><Spinner text="Loading model lab…" /></>
  const x = m.metrics, d = m.dataset, mo = m.model
  const live = ov.database.mode === 'tiger'
  return (
    <div className="space-y-12">
      <PageHead eyebrow="Model Lab · for judges" title="The machine learning underneath."
        sub="Everything here is computed from the trained model and its held-out test set. Nothing on this page is hand-entered." />

      <section>
        <Eyebrow className="mb-4">The data</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="Dataset" value={d.records} sub="student-course records" />
          <Tile label="At-risk" value={`${(d.at_risk_rate * 100).toFixed(2)}%`} sub={`${d.at_risk_count} finished with a D/F`} />
          <Tile label="Model" value="Decision Tree" sub={`depth ${mo.max_depth} · ${mo.n_leaves} leaves · min leaf ${mo.min_samples_leaf}`} />
          <Tile label="Held-out test set" value={d.test_size} sub={`trained on ${d.train_size}, never seen at fit time`} />
        </div>
      </section>

      <section>
        <Eyebrow className="mb-4">Held-out test performance</Eyebrow>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Tile label="Accuracy" value={`${(x.accuracy * 100).toFixed(1)}%`} sub={`majority baseline ${(x.majority_baseline_accuracy * 100).toFixed(1)}%`} />
          <Tile label="Precision" value={`${(x.precision * 100).toFixed(1)}%`} />
          <Tile label="Recall" value={`${(x.recall * 100).toFixed(1)}%`} sub="at-risk students caught" />
          <Tile label="F1" value={`${(x.f1 * 100).toFixed(1)}%`} />
          <Tile label="ROC-AUC" value={x.roc_auc.toFixed(3)} sub={`test n=${d.test_size}`} />
        </div>
      </section>

      {m.tuning ? <TuningCompare t={m.tuning} n={d.test_size} /> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Glass className="p-6"><Label className="mb-4">Confusion matrix · held-out test set</Label>
          <ConfusionMatrix cm={x.confusion_matrix} />
          <p className="mt-4 text-[11px] leading-relaxed text-white/35">Class-balanced tree, tuned toward catching at-risk students (recall) at the cost of some false alarms.</p></Glass>
        <Glass className="p-6"><Label className="mb-4">Feature importance (model signal)</Label>
          <FeatureBars items={imp.features.filter((f) => f.importance > 0).map((f) => ({ label: f.label, value: f.importance }))} />
          <p className="mt-4 text-[11px] text-white/35">{imp.note}</p></Glass>
      </div>

      <section>
        <Eyebrow className="mb-4">Tree visualization</Eyebrow>
        <Glass className="p-6">
          <TreeView text={m.tree_text} features={imp.features} />
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="text-[11px] text-white/35">The trained DecisionTreeClassifier, drawn from its exported rules. Left branch = condition true.</span>
            <button className="btn !px-3 !py-2 !text-[10px]" onClick={() => setShowRules((v) => !v)}>{showRules ? 'Hide' : 'Show'} raw rules</button>
          </div>
          {showRules ? <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-white/65">{m.tree_text}</pre> : null}
        </Glass>
      </section>

      <section>
        <Eyebrow className="mb-4">Dataset &amp; pipeline</Eyebrow>
        <Glass className="grid gap-8 p-6 text-sm leading-relaxed text-white/70 md:grid-cols-2">
          <div className="space-y-2">
            <div><b className="text-white">Source:</b> WolfHacks 2026 synthetic student outcomes, {d.records} rows, 19 columns.</div>
            <div><b className="text-white">Target:</b> <span className="font-mono">at_risk</span> (1 = final D/F). It is never a model input.</div>
            <div><b className="text-white">ID:</b> <span className="font-mono">student_id</span> is never a model input.</div>
            <div><b className="text-white">Inputs ({d.n_candidate_features}):</b> <span className="font-mono text-xs text-white/55">{d.features.join(', ')}</span></div>
          </div>
          <div className="space-y-2">
            <div><b className="text-white">Preprocessing:</b> {mo.preprocessing}, inside one sklearn Pipeline.</div>
            <div><b className="text-white">Model:</b> DecisionTreeClassifier(max_depth={mo.max_depth_param}, class_weight={mo.class_weight}, min_samples_leaf={mo.min_samples_leaf}, random_state={mo.random_state})</div>
            <div><b className="text-white">Evaluation:</b> stratified 80/20 split; {d.train_size} train, {d.test_size} test.</div>
            <div><b className="text-white">Blank values:</b> {Object.entries(d.missing_values).map(([k, v]) => `${k} (${v})`).join(', ')}, median-imputed.</div>
            <div className="text-xs text-white/40">Risk score = share of class-weighted training records in the student's leaf that finished D/F. Not a calibrated probability. Feature importance is not causal.</div>
          </div>
        </Glass>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Glass className="p-6"><Label className="mb-4">Mean model risk by course</Label>
          <FeatureBars items={ov.by_course.map((c) => ({ label: `${c.course} (${c.students})`, value: c.mean_model_risk, right: `${(c.mean_model_risk * 100).toFixed(0)}% · actual D/F ${(c.actual_rate * 100).toFixed(0)}%` }))} />
        </Glass>
        <Glass className="p-6">
          <div className="mb-3 flex items-center justify-between"><Label>Cohort study time</Label>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: live ? '#34d399' : '#fbbf24' }}>{live ? `Tiger Data · Live${ov.database.timescale ? ' · hypertable' : ''}` : 'Demo data · Local mode'}</span></div>
          <p className="mb-3 text-[11px] leading-relaxed text-white/45">Average study hours per student in each week of a synthetic 12-week semester (W1–W12), split by the final outcome recorded in the dataset.</p>
          <CohortChart data={ov.cohort_weekly_study} />
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">{ov.db_counts.activity_rows.toLocaleString()} activity rows for {ov.db_counts.students} students. {ov.activity_notice} The x-axis is a week index, not a calendar date: each student's real semester totals are spread over 12 weeks, so this shows how study effort is distributed, not measured week-by-week behaviour.</p>
        </Glass>
      </div>
    </div>
  )
}
