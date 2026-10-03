import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Box, LogOut, Moon, Sun } from 'lucide-react'
import { api } from './api.js'
import { ErrorBox } from './components/ui.jsx'
import DemoQuestionnaire from './components/DemoQuestionnaire.jsx'
import SimulatedResult from './components/SimulatedResult.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Insights from './pages/Insights.jsx'
import Login, { Analyzing } from './pages/Login.jsx'
import Simulate from './pages/Simulate.jsx'
import Why from './pages/Why.jsx'

const NAV = [
  { id: 'semester', label: 'MY SEMESTER' },
  { id: 'why', label: 'WHY?' },
  { id: 'simulate', label: 'SIMULATE' },
  { id: 'lab', label: 'MODEL LAB' },
]
const THEME_KEY = 'abb-theme'
const readTheme = () => { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch (e) { return 'dark' } }
function ThemeToggle({ theme, onToggle, className = '' }) {
  return (
    <button className={`btn !px-3 !py-2 ${className}`} onClick={onToggle} aria-label="Toggle dark/light theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  )
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export default function App() {
  const [stage, setStage] = useState('login') // login -> analyzing -> app
  const [steps, setSteps] = useState(0)
  const [studentId, setStudentId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [activity, setActivity] = useState(null)
  const [health, setHealth] = useState(null)
  const [page, setPage] = useState('semester')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const [theme, setTheme] = useState(readTheme)
  const [simResult, setSimResult] = useState(null)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch (e) { /* storage unavailable */ }
  }, [theme])
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  useEffect(() => { api.health().then(setHealth).catch(() => {}) }, [])

  const enter = useCallback(async (id) => {
    setBusy(true); setError('')
    const run = ++seq.current
    try {
      const who = await api.login(id) // backend verifies the ID exists ("Student ID not found.")
      setStage('analyzing'); setSteps(1)
      const data = Promise.all([api.student(who.student_id), api.activity(who.student_id), api.health()])
      // pace the checklist for the demo while the real requests are in flight
      for (let i = 2; i <= 4; i++) { await wait(380); if (run !== seq.current) return; setSteps(i) }
      const [d, a, h] = await data
      await wait(350)
      if (run !== seq.current) return
      setStudentId(who.student_id); setDetail(d); setActivity(a); setHealth(h); setPage('semester'); setStage('app')
    } catch (e) {
      setStage('login')
      setError(/failed to fetch|networkerror|load failed/i.test(e.message)
        ? 'Cannot reach the backend. Start it with: uvicorn backend.main:app --reload' : e.message)
    } finally { setBusy(false) }
  }, [])

  const demo = () => { setError(''); setStage('questionnaire') } // opens the questionnaire; the prediction comes from the real model
  const exit = () => { seq.current++; setStage('login'); setDetail(null); setActivity(null); setStudentId(null); setError('') }

  const floatToggle = <ThemeToggle theme={theme} onToggle={toggleTheme} className="fixed right-4 top-4 z-50" />
  if (stage === 'login') return <>{floatToggle}<Login onLogin={enter} onDemo={demo} error={error} busy={busy} /></>
  if (stage === 'analyzing') return <>{floatToggle}<Analyzing done={steps} /></>
  if (stage === 'questionnaire') return <>{floatToggle}<DemoQuestionnaire onCancel={() => setStage('login')} onResult={(r) => { setSimResult(r); setStage('simulated') }} /></>
  if (stage === 'simulated') return <>{floatToggle}<SimulatedResult result={simResult} onBack={() => { setSimResult(null); setStage('login') }} /></>

  const ctx = { health, studentId, detail, activity, setPage }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="mx-auto max-w-[1240px] px-6 pb-16 pt-6">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/[0.04] text-indigo-300"><Box size={17} /></div>
          <div className="text-sm font-extrabold tracking-[0.22em]">ACADEMIC BLACK BOX</div>
        </div>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`relative rounded-xl px-4 py-2 font-mono text-[11px] tracking-[0.18em] transition ${page === n.id ? 'text-white' : 'text-white/45 hover:text-white'}`}>
              {n.label}
              {page === n.id ? <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-px bg-indigo-300" /> : null}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="label !text-[9px]">Student ID</div>
            <div className="font-mono text-sm tracking-widest">{studentId}</div>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button className="btn !px-4 !py-2 !text-[11px]" onClick={exit}><LogOut size={13} /> Exit</button>
        </div>
      </header>

      <ErrorBox error={error} />
      <AnimatePresence mode="wait">
        <motion.main key={page} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {page === 'semester' && <Dashboard ctx={ctx} />}
          {page === 'why' && <Why ctx={ctx} />}
          {page === 'simulate' && <Simulate ctx={ctx} />}
          {page === 'lab' && <Insights />}
        </motion.main>
      </AnimatePresence>

      <footer className="mt-16 text-center font-mono text-[10px] uppercase leading-[1.9] tracking-[0.22em] text-white/25">
        {health?.notice || 'Demo uses synthetic WolfHacks 2026 student-course data. No real students are represented.'}
        <br />Not an academically validated prediction system · model signals are not proof of causation
      </footer>
    </motion.div>
  )
}
