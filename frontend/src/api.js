// All data comes from the FastAPI backend (proxied at /api in dev).
const BASE = import.meta.env.VITE_API_URL || ''

// FastAPI returns `detail` as a string (HTTPException) or a list of {loc, msg, type} objects (422 validation).
// Turn either into one readable sentence instead of "[object Object]".
function explain(detail, fallback) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      if (typeof d === 'string') return d
      const loc = (d.loc || []).filter((x) => !['body', 'features', 'overrides'].includes(x))
      const field = loc.length ? String(loc[loc.length - 1]).replace(/_/g, ' ') : ''
      const msg = String(d.msg || 'invalid value').replace(/^Value error, /, '')
      return field ? `${field.charAt(0).toUpperCase()}${field.slice(1)}: ${msg}` : msg
    })
    return `Please check: ${parts.join('; ')}`
  }
  if (detail && typeof detail === 'object') return detail.message || JSON.stringify(detail)
  return fallback
}

async function req(path, opts) {
  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    let msg = res.statusText
    let body = null
    try { body = await res.json(); msg = explain(body.detail, msg) } catch (e) { /* ignore */ }
    if (import.meta.env.DEV) console.error(`[api] ${opts?.method || 'GET'} ${path} -> ${res.status}`, body)
    throw new Error(msg)
  }
  return res.json()
}
const post = (path, body) => req(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  health: () => req('/api/health'),
  login: (student_id) => post('/api/login', { student_id }),
  students: () => req('/api/students'), // used only to find the model-selected demo student
  student: (id) => req(`/api/student/${id}`),
  activity: (id) => req(`/api/student/${id}/activity`),
  predict: (body) => post('/api/predict', body),
  simulate: (student_id, overrides) => post('/api/simulate', { student_id, overrides }),
  metrics: () => req('/api/model/metrics'),
  importance: () => req('/api/model/feature-importance'),
  treePath: (id) => req(`/api/model/tree-path/${id}`),
  explain: (student_id, overrides) => post('/api/gemini/explain', { student_id, overrides }),
  plan: (student_id, overrides) => post('/api/gemini/recovery-plan', { student_id, overrides }),
  overview: () => req('/api/analytics/overview'),
}
