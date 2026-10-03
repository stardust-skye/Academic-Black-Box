import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export const BAND = {
  low: { color: '#34d399', text: 'ON TRACK' },
  medium: { color: '#fbbf24', text: 'WATCH' },
  high: { color: '#f87171', text: 'AT RISK' },
}
export const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`)

export function useCountUp(target, ms = 900, fromZero = false) {
  const [v, setV] = useState(fromZero ? 0 : target)
  const from = useRef(fromZero ? 0 : target)
  useEffect(() => {
    const start = performance.now(), a = from.current, b = target
    let raf
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const cur = a + (b - a) * e
      setV(cur); from.current = cur
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function Glass({ className = '', children, ...rest }) {
  return <div className={`glass ${className}`} {...rest}>{children}</div>
}

export function Label({ children, className = '' }) {
  return <div className={`label ${className}`}>{children}</div>
}

export function Badge({ children, color = '#7dd3fc', title }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
      style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{children}
    </span>
  )
}

export function RiskRing({ value, band, size = 220, stroke = 14 }) {
  const color = BAND[band]?.color || '#7dd3fc'
  const shown = useCountUp(value)
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(1, value)) }}
          transition={{ duration: 1, ease: 'easeOut' }} style={{ filter: `drop-shadow(0 0 10px ${color}88)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-6xl font-extrabold tracking-tight" style={{ color }}>{Math.round(shown * 100)}<span className="text-3xl">%</span></div>
        <Label>risk score</Label>
      </div>
    </div>
  )
}

export function Bar({ value, max = 1, color = '#7dd3fc', height = 8 }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/5" style={{ height }}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} transition={{ duration: 0.8 }} />
    </div>
  )
}

export function Spinner({ text = 'Loading…' }) {
  return <div className="flex items-center gap-3 p-6 font-mono text-xs uppercase tracking-widest text-white/50"><span className="h-3 w-3 animate-pulse rounded-full bg-sky-300" />{text}</div>
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="glass border-red-400/30 p-4 text-sm text-red-300">⚠ {String(error.message || error)}</div>
}

export const STRENGTH = { strong: 'Strong signal in this prediction', moderate: 'Moderate signal', light: 'Light signal' }
export const DISCLAIMER = 'These are model signals, not proof of causation.'

export function Eyebrow({ children, className = '' }) {
  return <div className={`eyebrow ${className}`}>{children}</div>
}

export function PageHead({ eyebrow, title, sub }) {
  return (
    <div className="mb-8">
      {eyebrow ? <Eyebrow className="mb-3">{eyebrow}</Eyebrow> : null}
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{title}</h1>
      {sub ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/55">{sub}</p> : null}
    </div>
  )
}
