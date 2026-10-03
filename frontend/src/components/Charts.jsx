import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Label } from './ui.jsx'

const axis = { stroke: 'rgba(255,255,255,.25)', fontSize: 11, tickLine: false, axisLine: false }
const tip = { contentStyle: { background: 'rgba(8,10,16,.95)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, fontSize: 12 }, labelStyle: { color: '#9aa4b5' } }

export function ActivityStream({ weekly }) {
  const data = (weekly || []).map((w) => ({
    week: `W${w.week}`, minutes: w.study_minutes, quizzes: w.quizzes,
    assignments: w.assignment_rate == null ? null : +(w.assignment_rate * 100).toFixed(1),
    attendance: w.attendance == null ? null : +(w.attendance * 100).toFixed(1),
  }))
  return (
    <div>
      <div style={{ height: 230 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ left: -10, right: 0, top: 8 }}>
            <defs>
              <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} /><stop offset="100%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="week" {...axis} />
            <YAxis yAxisId="l" {...axis} />
            <YAxis yAxisId="r" orientation="right" domain={[40, 100]} {...axis} unit="%" />
            <Tooltip {...tip} />
            <Area yAxisId="l" type="monotone" dataKey="minutes" name="Study minutes" stroke="#38bdf8" strokeWidth={2} fill="url(#gm)" />
            <Line yAxisId="r" type="monotone" dataKey="assignments" name="Assignments %" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="attendance" name="Attendance %" stroke="#34d399" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 70 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: -10, right: 0, top: 4 }}>
            <XAxis dataKey="week" {...axis} />
            <Tooltip {...tip} />
            <Bar dataKey="quizzes" name="Practice quizzes" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-widest text-white/50">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />study minutes</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-400" />assignments</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />attendance</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />quizzes / week</span>
      </div>
    </div>
  )
}

export function RiskTrend({ trend, color = '#f87171', midtermWeek = 7 }) {
  const data = (trend || []).map((t) => ({ week: `W${t.week}`, risk: +(t.risk * 100).toFixed(1) }))
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.5} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
          <XAxis dataKey="week" {...axis} />
          <YAxis domain={[0, 100]} {...axis} unit="%" />
          <Tooltip {...tip} formatter={(v) => [`${v}%`, 'Model risk score']} />
          <ReferenceLine y={50} stroke="rgba(255,255,255,.25)" strokeDasharray="4 4" label={{ value: 'at-risk threshold', fill: '#9aa4b5', fontSize: 10, position: 'insideTopLeft' }} />
          <ReferenceLine x={`W${midtermWeek}`} stroke="rgba(125,211,252,.5)" strokeDasharray="2 4" label={{ value: 'midterm', fill: '#7dd3fc', fontSize: 10, position: 'top' }} />
          <Area type="stepAfter" dataKey="risk" stroke={color} strokeWidth={2.5} fill="url(#gr)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// items: [{label, value}] with value in 0..1 (importance share)
export function FeatureBars({ items, colorFn }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001)
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span>{i.label}</span>
            <span className="font-mono text-xs text-white/50">{i.right ?? `${(i.value * 100).toFixed(0)}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(i.value / max) * 100}%`, background: colorFn ? colorFn(i) : 'linear-gradient(90deg,#38bdf8,#8b5cf6)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConfusionMatrix({ cm }) {
  const [[tn, fp], [fn, tp]] = cm.matrix
  const cell = (v, name, good) => (
    <div className="rounded-xl p-4 text-center" style={{ background: good ? 'rgba(52,211,153,.10)' : 'rgba(248,113,113,.10)', border: `1px solid ${good ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)'}` }}>
      <div className="text-3xl font-bold">{v}</div><Label>{name}</Label>
    </div>
  )
  return (
    <div>
      <div className="mb-2 grid grid-cols-[auto_1fr_1fr] items-center gap-2">
        <span /><Label className="text-center">pred: not at risk</Label><Label className="text-center">pred: at risk</Label>
        <Label>actual: not</Label>{cell(tn, 'true neg', true)}{cell(fp, 'false pos', false)}
        <Label>actual: at risk</Label>{cell(fn, 'false neg', false)}{cell(tp, 'true pos', true)}
      </div>
    </div>
  )
}

// Data = average study MINUTES per student in each synthetic semester week (W1-W12), split by final outcome.
// Shown in hours. The Excel dataset has no timestamps, so the x-axis is a week index, not a calendar date.
const tick = { fill: '#9aa4b5', fontSize: 11 }
export function CohortChart({ data }) {
  const rows = (data || []).map((d) => ({
    week: `W${d.week}`,
    on_track: d.on_track == null ? null : +(d.on_track / 60).toFixed(2),
    at_risk: d.at_risk == null ? null : +(d.at_risk / 60).toFixed(2),
  }))
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ left: 4, right: 12, top: 8, bottom: 22 }}>
          <CartesianGrid stroke="rgba(154,164,181,.18)" vertical={false} />
          <XAxis dataKey="week" tick={tick} tickLine={false} axisLine={{ stroke: 'rgba(154,164,181,.4)' }} interval={0}
            label={{ value: 'Student / cohort progression', position: 'insideBottom', offset: -14, fill: '#9aa4b5', fontSize: 11 }} />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} width={44}
            label={{ value: 'Average weekly study hours', angle: -90, position: 'insideLeft', offset: 8, fill: '#9aa4b5', fontSize: 11, style: { textAnchor: 'middle' } }} />
          <Tooltip {...tip} labelFormatter={(l) => `${l} (synthetic week)`} formatter={(v, name) => [v == null ? 'n/a' : `${Number(v).toFixed(2)} h`, name]} />
          <Legend verticalAlign="top" height={30} iconType="plainline" formatter={(v) => <span style={{ color: '#9aa4b5', fontSize: 11 }}>{v}</span>} />
          <Line type="monotone" dataKey="on_track" name="Students who finished C or better" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          <Line type="monotone" dataKey="at_risk" name="Students who finished D/F" stroke="#f87171" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// "Your academic activity": four small panels over the weekly time series (Tiger Data or local fallback).
export function ActivityPanels({ weekly }) {
  const data = (weekly || []).map((w) => ({
    week: `W${w.week}`, study: w.study_minutes, quizzes: w.quizzes,
    assignments: w.assignment_rate == null ? null : +(w.assignment_rate * 100).toFixed(1),
    attendance: w.attendance == null ? null : +(w.attendance * 100).toFixed(1),
  }))
  const panel = (title, node) => (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <Label className="mb-2">{title}</Label>
      <div style={{ height: 130 }}><ResponsiveContainer>{node}</ResponsiveContainer></div>
    </div>
  )
  const m = { left: -22, right: 4, top: 6, bottom: 0 }
  const grid = <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {panel('Study activity · minutes / week',
        <AreaChart data={data} margin={m}>{grid}<XAxis dataKey="week" {...axis} /><YAxis {...axis} /><Tooltip {...tip} />
          <Area type="monotone" dataKey="study" name="Study minutes" stroke="#818cf8" strokeWidth={2} fill="rgba(129,140,248,.18)" /></AreaChart>)}
      {panel('Quiz activity · practice quizzes / week',
        <BarChart data={data} margin={m}>{grid}<XAxis dataKey="week" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} />
          <Bar dataKey="quizzes" name="Practice quizzes" fill="#38bdf8" radius={[4, 4, 0, 0]} /></BarChart>)}
      {panel('Assignment behavior · on-time %',
        <AreaChart data={data} margin={m}>{grid}<XAxis dataKey="week" {...axis} /><YAxis domain={[40, 100]} {...axis} unit="%" /><Tooltip {...tip} />
          <Area type="monotone" dataKey="assignments" name="On time" stroke="#a78bfa" strokeWidth={2} fill="rgba(167,139,250,.16)" connectNulls /></AreaChart>)}
      {panel('Attendance · %',
        <AreaChart data={data} margin={m}>{grid}<XAxis dataKey="week" {...axis} /><YAxis domain={[40, 100]} {...axis} unit="%" /><Tooltip {...tip} />
          <Area type="monotone" dataKey="attendance" name="Attendance" stroke="#34d399" strokeWidth={2} fill="rgba(52,211,153,.14)" connectNulls /></AreaChart>)}
    </div>
  )
}
