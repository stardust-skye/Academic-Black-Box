import { useMemo } from 'react'

const PCT = new Set(['on_time_submission_rate', 'attendance_rate', 'late_night_study_pct'])

// Parse sklearn's export_text() (stored in metadata.json) into nested nodes and draw it. Nothing is invented:
// every condition and leaf class below is a line of the trained tree.
function parse(text) {
  const root = { children: [] }, stack = [{ depth: -1, node: root }]
  for (const line of text.split('\n')) {
    const m = line.match(/^((?:\|   )*)\|--- (.*)$/)
    if (!m) continue
    const depth = m[1].length / 4, body = m[2]
    const node = { body, children: [] }
    while (stack[stack.length - 1].depth >= depth) stack.pop()
    stack[stack.length - 1].node.children.push(node)
    stack.push({ depth, node })
  }
  return root.children
}

function pretty(body, labels) {
  const m = body.match(/^(?:num|cat)__(\S+)\s+(<=|>)\s+(\S+)$/)
  if (!m) return body
  const [, feat, op, thr] = m
  const key = feat
  const label = labels[key] || key.replace(/_/g, ' ')
  const n = parseFloat(thr)
  const val = PCT.has(key) ? `${(n * 100).toFixed(0)}%` : Number.isInteger(n) ? n : n.toFixed(1)
  return `${label} ${op === '<=' ? '≤' : '>'} ${val}`
}

function Node({ n, labels, depth }) {
  const leaf = /^class:/.test(n.body)
  if (leaf) {
    const risky = n.body.trim().endsWith('1')
    return (
      <div className="my-1 inline-block rounded-lg border px-3 py-1.5 font-mono text-xs"
        style={{ borderColor: risky ? 'rgba(248,113,113,.45)' : 'rgba(52,211,153,.45)', background: risky ? 'rgba(248,113,113,.08)' : 'rgba(52,211,153,.08)', color: risky ? '#fca5a5' : '#6ee7b7' }}>
        → {risky ? 'at risk (D/F)' : 'not at risk'}
      </div>
    )
  }
  return (
    <div className="my-1">
      <div className="inline-block rounded-lg border border-indigo-300/25 bg-indigo-300/[0.06] px-3 py-1.5 text-sm">{pretty(n.body, labels)}</div>
      <div className="ml-4 border-l border-white/10 pl-4">
        {n.children.map((c, i) => <Node key={i} n={c} labels={labels} depth={depth + 1} />)}
      </div>
    </div>
  )
}

export default function TreeView({ text, features }) {
  const nodes = useMemo(() => parse(text), [text])
  const labels = useMemo(() => Object.fromEntries((features || []).map((f) => [f.feature, f.label])), [features])
  return <div className="overflow-x-auto">{nodes.map((n, i) => <Node key={i} n={n} labels={labels} depth={0} />)}</div>
}
