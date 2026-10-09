import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import Papa from 'papaparse'
import {
  Activity, ArrowDownToLine, ArrowUpRight, Box, CalendarDays,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Dumbbell,
  FileSpreadsheet, Filter, Flame, MapPin, MoreHorizontal, Search, Sparkles,
  Upload, Users, X, Maximize2, BookOpen,
} from 'lucide-react'
import {
  AreaChart, BarChart, CartesianGrid, Cell, LineChart,
  PieChart, ResponsiveContainer, Tooltip,
} from 'recharts'
import './App.css'
import DevPage from './DevPage'
import TrainingCalendar from './TrainingCalendar'
import ChartFrame from './components/ChartFrame'
import { ChartXAxis as XAxis, ChartYAxis as YAxis } from './components/ChartAxes'
import TrainingTimeline from './components/TrainingTimeline'
import TrainingJourney from './components/TrainingJourney'
import { AnimatedArea as Area, AnimatedBar as Bar, AnimatedLine as Line, AnimatedPie as Pie } from './components/AnimatedChartSeries'
import { allocateTrainingStyles } from './lib/allocateTrainingStyles'
import { parseSession } from './lib/sessionParser'
import InstructionsPage from './InstructionsPage'
import { useTrainingWorkspace } from './lib/useTrainingWorkspace'
import { useAccount } from './components/AccountContext'
import AccountModal from './components/AccountModal'
import SessionBrowser from './components/SessionBrowser'
import ManualLog from './components/ManualLog'

import { ranksFromCsvRows, normalizeRankHistory, type RankPromotion } from './lib/rankHistory'
import { PromotionSummary } from './components/RankContext'

type Session = {
  id: number
  training: string
  date: Date
  duration: number
  style: 'Gi' | 'NoGi' | 'Other'
  styleEstimated?: boolean
  durationEstimated?: boolean
  timeRecorded?: boolean
  classType: string
  venue: string
  instructor: string
}

const demoRows = [
  ['Fundamentals - NoGi - Hladilnika BJJ | Ivan Dimitrov (I degree Black Belt)', 'Oct 1, 2026 5:42 PM 1h 10m'],
  ['Advanced - Gi - Hladilnika BJJ | Vladimir Dzharkalov (II degree Black Belt)', 'Sep 30, 2026 5:46 PM 1h 20m'],
  ['Fundamentals - NoGi - Hladilnika BJJ | Ivan Dimitrov (I degree Black Belt)', 'Sep 29, 2026 5:41 PM 1h 10m'],
  ['Fundamentals - Gi - Hladilnika BJJ | Alexander Dimitrov (I degree Black Belt)', 'Sep 28, 2026 7:19 AM 1h'],
]

const initialSessions: Session[] = demoRows.map(([training, dateText], index) => {
  const parsed = parseSession(training, dateText, index)
  return parsed!
})

function sessionsFromCsv(file: File, onDone: (sessions: Session[], error?: string, ranks?: RankPromotion[], skippedRanks?: number) => void) {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    complete: ({ data, meta, errors }) => {
      if (errors.length && !data.length) {
        onDone([], 'We couldn’t read that CSV. Check the file and try again.')
        return
      }
      const headers = meta.fields ?? []
      const keyFor = (terms: string[]) => headers.find((header) => terms.some((term) => header.toLowerCase().includes(term)))
      const trainingKey = keyFor(['training', 'class', 'activity', 'session']) ?? headers[0]
      const dateKey = keyFor(['date / time', 'datetime', 'date', 'time'])
      const durationKey = keyFor(['duration', 'length'])
      const recordTypeKey = keyFor(['record type'])
      const parsed = data.flatMap((row, index) => {
        if (String(row[recordTypeKey ?? ''] ?? '').trim().toLowerCase() === 'rank') return []
        const training = String(row[trainingKey ?? ''] ?? '').trim()
        const dateText = String(row[dateKey ?? ''] ?? '')
        if (!training || !dateText) return []
        const session = parseSession(training, dateText, index, String(row[durationKey ?? ''] ?? ''))
        return session ? [session] : []
      })
      const { ranks, skipped } = ranksFromCsvRows(data)
      onDone(parsed, parsed.length || ranks.length ? undefined : 'No sessions found. Include Training and Date / Time columns, or dated rank records, in your CSV.', ranks, skipped)
    },
    error: () => onDone([], 'We couldn’t read that CSV. Check the file and try again.'),
  })
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`
}

const shortDate = (date: Date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
const COLORS = ['#dc2626', '#52525b', '#d97706']
type Page = 'log' | 'overview' | 'sessions' | 'dev' | 'instructions'

function pageFromPath(): Page {
  if (window.location.pathname === '/log') return 'log'
  if (window.location.pathname === '/instructions') return 'instructions'
  if (window.location.pathname === '/dev') return 'dev'
  if (window.location.pathname === '/sessions') return 'sessions'
  return 'overview'
}

function App() {
  const [fillScreen, setFillScreen] = useState(() => {
    try { return localStorage.getItem('matmetrics-fill-screen') === 'true' }
    catch { return false }
  })

  useEffect(() => {
    const updateScale = () => {
      // Keep a comfortable desktop layout while scaling every pixel together.
      const scale = fillScreen ? Math.max(1, Math.min(1.75, window.innerWidth / 1600)) : 1
      document.body.style.setProperty('--screen-scale', String(scale))
      document.body.classList.toggle('fill-screen', fillScreen)
    }
    updateScale()
    try { localStorage.setItem('matmetrics-fill-screen', String(fillScreen)) } catch { /* Storage can be unavailable in private browsers. */ }
    window.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      document.body.style.removeProperty('--screen-scale')
      document.body.classList.remove('fill-screen')
    }
  }, [fillScreen])

  const workspace = useTrainingWorkspace()
  const { user } = useAccount()
  const [accountOpen, setAccountOpen] = useState(false)
  const { csvImport, manualData, updateManual, deleteManual, importCsv, removeImport } = workspace
  const savedLocally = true
  const storageMessage = workspace.error
  const rankHistory = useMemo(() => normalizeRankHistory(csvImport?.ranks ?? []), [csvImport])
  const manualSessions = manualData.sessions
  const sourceSessions = useMemo(() => {
    const imported = csvImport?.sessions ?? (manualData.initialized ? [] : initialSessions)
    return [...imported, ...manualSessions].map((row, id) => ({ ...row, id }))
  }, [csvImport, manualSessions, manualData.initialized])
  const allocation = useMemo(() => allocateTrainingStyles(sourceSessions), [sourceSessions])
  const sessions = allocation.sessions
  const [activePage, setActivePage] = useState<Page>(pageFromPath)
  const [period, setPeriod] = useState('All time')
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear())
  const [query, setQuery] = useState('')
  const [styleFilter, setStyleFilter] = useState('All styles')
  const [uploadMessage, setUploadMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRequest = useRef(0)

  const goToPage = (page: Page) => {
    const route = page === 'overview' ? '/' : `/${page}`
    if (window.location.pathname !== route) window.history.pushState({}, '', route)
    setActivePage(page)
  }

  useEffect(() => {
    const syncRoute = () => setActivePage(pageFromPath())
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const newest = sessions.reduce((latest, row) => row.date > latest ? row.date : latest, sessions[0]?.date ?? new Date())
  const availableYears = [...new Set([...sessions.map((session) => session.date.getFullYear()), ...rankHistory.map(rank => rank.date.getFullYear())])].sort((a, b) => a - b)
  const selectedYear = availableYears.includes(annualYear) ? annualYear : availableYears.at(-1) ?? annualYear
  const filteredSessions = useMemo(() => {
    const cutoff = period === 'All time' ? null : new Date(newest)
    if (cutoff && period === '30 days') cutoff.setDate(cutoff.getDate() - 30)
    else if (cutoff && period === '90 days') cutoff.setDate(cutoff.getDate() - 90)
    else if (cutoff && period === 'This year') cutoff.setMonth(0, 1)
    else if (cutoff) cutoff.setFullYear(cutoff.getFullYear() - 1)
    return sessions.filter((session) => (!cutoff || session.date >= cutoff) && (styleFilter === 'All styles' || session.style === styleFilter)
      && `${session.training} ${session.instructor} ${session.classType} ${session.venue}`.toLowerCase().includes(query.toLowerCase()))
  }, [newest, period, query, sessions, styleFilter])

  const metrics = useMemo(() => {
    const minutes = filteredSessions.reduce((total, session) => total + session.duration, 0)
    const gi = filteredSessions.filter((session) => session.style === 'Gi').length
    const noGi = filteredSessions.filter((session) => session.style === 'NoGi').length
    const other = filteredSessions.filter((session) => session.style === 'Other').length
    const month = newest.getMonth()
    const monthYear = newest.getFullYear()
    const thisMonth = filteredSessions.filter((session) => session.date.getMonth() === month && session.date.getFullYear() === monthYear).length
    const mostFrequent = gi >= noGi ? 'Gi' : 'No-Gi'
    return { minutes, gi, noGi, other, thisMonth, mostFrequent, average: filteredSessions.length ? Math.round(minutes / filteredSessions.length) : 0 }
  }, [filteredSessions, newest])

  const annualData = useMemo(() => {
    const months: { key: string; month: string; sessions: number; hours: number }[] = []
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const date = new Date(selectedYear, monthIndex, 1)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      const inMonth = sessions.filter((session) => session.date.getFullYear() === date.getFullYear() && session.date.getMonth() === date.getMonth()
        && (styleFilter === 'All styles' || session.style === styleFilter)
        && `${session.training} ${session.instructor} ${session.classType} ${session.venue}`.toLowerCase().includes(query.toLowerCase()))
      months.push({ key, month: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), sessions: inMonth.length, hours: Math.round(inMonth.reduce((sum, row) => sum + row.duration, 0) / 60 * 10) / 10 })
    }
    return months
  }, [query, selectedYear, sessions, styleFilter])

  const yearData = useMemo(() => {
    return availableYears.map((year) => {
      const inYear = sessions.filter((session) => session.date.getFullYear() === year
        && (styleFilter === 'All styles' || session.style === styleFilter)
        && `${session.training} ${session.instructor} ${session.classType} ${session.venue}`.toLowerCase().includes(query.toLowerCase()))
      return { year: String(year), sessions: inYear.length, hours: Math.round(inYear.reduce((sum, session) => sum + session.duration, 0) / 60 * 10) / 10 }
    })
  }, [availableYears, query, sessions, styleFilter])

  const typeData = useMemo(() => {
    const counts = new Map<string, number>()
    filteredSessions.forEach((session) => counts.set(session.classType, (counts.get(session.classType) ?? 0) + 1))
    return [...counts].map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions)
  }, [filteredSessions])

  const instructorData = useMemo(() => {
    const counts = new Map<string, number>()
    filteredSessions.forEach((session) => counts.set(session.instructor, (counts.get(session.instructor) ?? 0) + 1))
    return [...counts].map(([name, sessions]) => ({ name: name.split(' ').slice(0, 2).join(' '), sessions })).sort((a, b) => b.sessions - a.sessions).slice(0, 5)
  }, [filteredSessions])

  const weekdayData = useMemo(() => {
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return weekdays.map((day, index) => ({ day, sessions: filteredSessions.filter((session) => (session.date.getDay() + 6) % 7 === index).length }))
  }, [filteredSessions])

  const busiestMonth = annualData.reduce((busiest, month) => month.sessions > busiest.sessions ? month : busiest, annualData[0])

  const styleData = [
    { name: 'Gi', value: metrics.gi },
    { name: 'No-Gi', value: metrics.noGi },
    { name: 'Other', value: filteredSessions.filter((session) => session.style === 'Other').length },
  ].filter((slice) => slice.value > 0)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file || workspace.busy || !workspace.ready) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage('Please choose a .csv file.')
      return
    }
    const request = ++importRequest.current
    setUploadMessage(`Reading ${file.name}...`)
    sessionsFromCsv(file, async (rows, error, ranks = [], skippedRanks = 0) => {
      if (request !== importRequest.current) return
      if (error) setUploadMessage(error)
      else {
        const nextImport = { fileName: file.name, sessions: rows, ranks }
        if (!await importCsv(nextImport)) { setUploadMessage('CSV could not be saved. Please try again.'); return }
        if (request !== importRequest.current) return
        if (rows.length) setAnnualYear(Math.max(...rows.map((row) => row.date.getFullYear())))
        setUploadMessage(`${rows.length} sessions and ${ranks.length} rank records imported from ${file.name}${skippedRanks ? ` (${skippedRanks} rank records skipped: missing rank or invalid date)` : ''}`)
      }
    })
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
    event.target.value = ''
  }
  const removeFile = async () => {
    if (user || workspace.busy || !workspace.ready) return
    if (!await removeImport()) return
    importRequest.current++
    setUploadMessage('CSV removed from this browser. ' + (manualData.initialized ? 'Your manual log is still available.' : 'Showing sample data.'))
    setQuery(''); setStyleFilter('All styles'); setPeriod('All time')
    if (fileRef.current) fileRef.current.value = ''
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  const downloadTemplate = () => {
    const csv = 'Training,Date / Time / Duration\n"Fundamentals - NoGi - Your gym | Instructor","Oct 1, 2026 5:42 PM 1h 10m"\n'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = 'mat-metrics-template.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="app-shell" onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }} onDrop={onDrop}>
      {dragging && <div className="drop-overlay"><div className="drop-message"><Upload size={28} /><strong>Drop your CSV to import</strong><span>We’ll update your training dashboard</span></div></div>}
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Activity size={19} strokeWidth={2.5} /></div><span>mat<span className="brand-light">metrics</span></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => goToPage('overview')}><Activity size={17} /> Overview</button>
        <button className={`nav-item ${activePage === 'sessions' ? 'active' : ''}`} onClick={() => goToPage('sessions')}><CalendarDays size={17} /> Sessions <span className="nav-count">{sessions.length}</span></button>
        <button title="Log training" aria-label="Log training" className={`nav-item ${activePage === 'log' ? 'active' : ''}`} onClick={() => goToPage('log')}><Dumbbell size={17} /> Log training</button>
        <button className={`nav-item ${activePage === 'dev' ? 'active' : ''}`} onClick={() => goToPage('dev')}><Box size={17} /> 3D Data Lab</button>
        <div className="sidebar-divider" />
        <button className={`nav-item ${activePage === 'instructions' ? 'active' : ''}`} onClick={() => goToPage('instructions')}><BookOpen size={17} /> Get your CSV</button>
        <button className="nav-item quiet" onClick={downloadTemplate}><FileSpreadsheet size={17} /> CSV template</button>
        <div className="sidebar-bottom">
          <div className="coach-card"><div className="coach-icon"><Sparkles size={16} /></div><strong>Make every round count.</strong><span>Your mat time, made visible.</span><button onClick={() => fileRef.current?.click()}>Import training data <ArrowUpRight size={13} /></button></div>
          <button className="profile" onClick={() => setAccountOpen(true)}><div className="profile-avatar">{(user?.displayName || 'B').slice(0, 1).toUpperCase()}</div><span className="profile-copy"><strong>{user?.displayName || 'My training'}</strong><small>{user ? user.emailVerified ? 'Account workspace' : 'Verify your email' : 'Create profile / Log in'}</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activePage === 'log' ? 'Log training' : activePage === 'overview' ? 'Overview' : activePage === 'sessions' ? 'Sessions' : activePage === 'instructions' ? 'Get your CSV' : '3D Data Lab'}</strong></div><div className="top-actions">{csvImport && <div className="current-csv" title={`${csvImport.fileName} — ${workspace.cloud ? 'Saved to your account' : savedLocally ? 'Saved only in this browser' : 'Session only'}`}><FileSpreadsheet size={15} /><span className="current-csv-name">{csvImport.fileName}</span>{!user && <button className="current-csv-remove" aria-label={`Remove ${csvImport.fileName} and delete its saved data`} title="Remove CSV and delete saved data" disabled={!workspace.ready || workspace.busy} onClick={() => void removeFile()}><X size={14} /></button>}</div>}<button className="screen-toggle" aria-pressed={fillScreen} title="Expand the layout and scale the interface to fit your screen" onClick={() => setFillScreen((enabled) => !enabled)}><Maximize2 size={15} /><span>Fill screen</span><span className="screen-toggle-track" aria-hidden="true"><span /></span></button><span className="sync-status"><span className="status-dot" /> {workspace.cloud ? workspace.status : csvImport || manualData.initialized ? 'Saved in this browser' : 'Sample data'}</span><button className="icon-button" aria-label="CSV export instructions" onClick={() => goToPage('instructions')}><CircleHelp size={17} /></button><button className="top-avatar account-avatar-button" aria-label="Open profile" onClick={() => setAccountOpen(true)}>{(user?.displayName || 'B').slice(0, 1).toUpperCase()}</button></div></header>
        <div className="content">
          {user && !user.emailVerified && <div className="account-banner"><p>Verify your email to save training to your account. You’re currently using this browser’s guest data.</p><button className="button button-outline" onClick={() => setAccountOpen(true)}>Verify email</button></div>}
          {workspace.cloud && workspace.hasGuestData && <div className="account-banner"><p>This browser has guest training data. Import it into your account? Existing account records will be kept.</p><button className="button button-primary" disabled={!workspace.ready || workspace.busy} onClick={() => void workspace.importGuest()}>Import browser data</button><button className="button button-outline" disabled={workspace.busy} onClick={workspace.dismissGuest}>Not now</button></div>}
          {workspace.cloud && !workspace.ready && <div className="account-banner"><p>Connecting to your account. Training changes are available once the cloud connection is ready.</p><button className="button button-outline" onClick={workspace.retry}>Retry connection</button></div>}
          {workspace.cacheWarning && <div className="account-banner"><p>{workspace.cacheWarning}</p></div>}
          <div className="page-heading" inert={!workspace.ready || workspace.busy}><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR JIU-JITSU JOURNEY</div><h1>{activePage === 'log' ? 'Log your training' : activePage === 'overview' ? 'Training overview' : activePage === 'sessions' ? 'Training sessions' : activePage === 'instructions' ? 'Get your training data' : '3D Data Lab'}</h1><p>A little progress every day adds up to a lot.</p></div><div className="heading-actions"><button className="button button-primary manual-entry-button" onClick={() => goToPage('log')}><Dumbbell size={16} /> Log training</button><button className="button button-outline" onClick={downloadTemplate}><ArrowDownToLine size={15} /> Template</button><button className="button button-primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} hidden /></div></div>

          <div inert={!workspace.ready || workspace.busy} className="import-strip" onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') fileRef.current?.click() }}>
            <div className="import-icon"><FileSpreadsheet size={17} /></div><div className="import-copy"><strong>{uploadMessage || 'Your data, your dashboard'}</strong><span>{workspace.cloud ? 'CSV records are added to your account. Existing training is kept.' : uploadMessage ? 'Your CSV stays in this browser until you import it into an account.' : 'Drop a CSV anywhere or click to upload. Create a profile to save across devices.'}</span></div><button className="text-button" onClick={(event) => { event.stopPropagation(); fileRef.current?.click() }}>Choose file <ArrowUpRight size={14} /></button>
          </div>
          {uploadMessage && uploadMessage.includes('Please') || uploadMessage.startsWith('No sessions') || uploadMessage.startsWith('We couldn’t') ? <div className="upload-error"><X size={14} />{uploadMessage}</div> : null}

          {storageMessage && <div className="storage-message" role="alert">{storageMessage}</div>}
          {(allocation.estimatedCount > 0 || allocation.unknownCount > 0) && <div className="style-estimate-note" role="status">{allocation.estimatedCount > 0 ? `${allocation.estimatedCount} unclassified sessions distributed proportionally using the known Gi / No-Gi split (${Math.round((allocation.giShare ?? 0) * 100)}% / ${Math.round((1 - (allocation.giShare ?? 0)) * 100)}%). Estimated styles are included throughout the dashboard.` : `${allocation.unknownCount} sessions remain unclassified: no known Gi or No-Gi records are available to calculate a ratio.`}</div>}
          <div inert={!workspace.ready || workspace.busy}>
          {activePage === 'log' ? <ManualLog key={user?.uid ?? 'guest'} sessions={manualSessions} error={manualData.error} cloud={workspace.cloud} onSave={row => updateManual([...manualSessions.filter(item => row.cloudId ? item.cloudId !== row.cloudId : item.id !== row.id), row])} onDelete={deleteManual} /> : activePage === 'instructions' ? <InstructionsPage /> : activePage === 'dev' ? <DevPage sessions={sessions} ranks={rankHistory} /> : activePage === 'overview' ? <>
            <div className="section-toolbar"><div className="section-title"><span className="live-dot" /> AT A GLANCE</div><div className="toolbar-controls"><span className="updated-label">Based on {filteredSessions.length} sessions</span><label className="select-wrap"><CalendarDays size={14} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>All time</option><option>12 months</option><option>90 days</option><option>30 days</option><option>This year</option></select><ChevronDown size={13} /></label></div></div>

            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Total sessions</span><span className="stat-icon green"><Dumbbell size={16} /></span></div><div className="stat-value">{filteredSessions.length}<span className="stat-unit">sessions</span></div><div className="stat-foot"><span className="stat-accent"><ArrowUpRight size={13} /> Keep showing up</span><span>since you started</span></div></article>
              <article className="stat-card"><div className="stat-top"><span>Time on the mat</span><span className="stat-icon purple"><Clock3 size={16} /></span></div><div className="stat-value">{Math.floor(metrics.minutes / 60)}<span className="stat-unit">h</span> {metrics.minutes % 66}<span className="stat-unit">m</span></div><div className="stat-foot"><span>Avg. {formatDuration(metrics.average)}</span><span>per session</span></div></article>
              <article className="stat-card"><div className="stat-top"><span>This month</span><span className="stat-icon orange"><Flame size={16} /></span></div><div className="stat-value">{metrics.thisMonth}<span className="stat-unit">sessions</span></div><div className="stat-foot"><span>{new Intl.DateTimeFormat('en', { month: 'long' }).format(newest)}</span><span>{newest.getFullYear()}</span></div></article>
              <article className="stat-card"><div className="stat-top"><span>Favorite style</span><span className="stat-icon blue"><Users size={16} /></span></div><div className="stat-value stat-word">{metrics.mostFrequent}</div><div className="stat-foot"><span>{metrics.gi} Gi · {metrics.noGi} No-Gi</span><span>sessions</span></div></article>
            </div>

            <ChartFrame title="Training calendar"><TrainingCalendar ranks={rankHistory} sessions={sessions} year={selectedYear} years={availableYears} onYearChange={setAnnualYear} styleFilter={styleFilter} query={query} /></ChartFrame>

            <div className="charts-grid">
              <ChartFrame title="Training activity"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Training activity</h2><p>Yearly attendance · busiest month: {busiestMonth.sessions ? busiestMonth.month : '—'}</p><p className="chart-explanation">Red bars count sessions; charcoal bars show mat hours. Months without sessions remain visible as zero.</p></div><label className="year-select"><span>YEAR</span><select value={selectedYear} onChange={(event) => setAnnualYear(Number(event.target.value))}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={12} /></label></div><div className="chart-legend"><span><i className="legend-swatch lime" />Sessions</span><span><i className="legend-swatch lavender" />Hours on mat</span></div><div className="activity-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualData} margin={{ top: 7, right: 12, left: -18, bottom: 0 }} barGap={3}><CartesianGrid vertical={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} dy={10} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} /><Tooltip cursor={{ fill: '#f4f4f4' }} contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 25px #22222212' }} /><Bar dataKey="sessions" name="Sessions" fill="#dc2626" radius={[5, 5, 0, 0]} maxBarSize={19} /><Bar dataKey="hours" name="Hours on mat" fill="#52525b" radius={[5, 5, 0, 0]} maxBarSize={19} /></BarChart></ResponsiveContainer></div><div className="chart-bottom"><span><span className="bottom-dot" /> {annualData.reduce((sum, item) => sum + item.sessions, 0)} sessions in {selectedYear}</span><span>{selectedYear} <CalendarDays size={13} /></span></div><PromotionSummary ranks={rankHistory} year={selectedYear} /></section></ChartFrame>

              <ChartFrame title="Gi vs. No-Gi"><section className="panel style-panel"><div className="panel-heading"><div><h2>Gi vs. No-Gi</h2><p>Share of sessions by training uniform</p><p className="chart-explanation">Counts Gi, No-Gi, and any unclassified sessions.</p></div>
                <button className="subtle-icon" aria-label="Style chart settings"><MoreHorizontal size={18} /></button>
              </div><div className="donut-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={styleData} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="94%" paddingAngle={4} stroke="none" cornerRadius={5}>{styleData.map((entry) => <Cell key={entry.name} fill={entry.name === 'Gi' ? COLORS[0] : entry.name === 'No-Gi' ? COLORS[1] : COLORS[2]} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer></div><div className="donut-center"><strong>{filteredSessions.length}</strong><span>sessions</span></div></div><div className="style-legend">{[{ name: 'Gi', value: metrics.gi, color: COLORS[0] }, { name: 'No-Gi', value: metrics.noGi, color: COLORS[1] }, ...(metrics.other ? [{ name: 'Other', value: metrics.other, color: COLORS[2] }] : [])].map((item) => <div className="style-row" key={item.name}><span className="style-name"><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}<small> sessions</small></strong><span className="style-percent">{filteredSessions.length ? Math.round(item.value / filteredSessions.length * 100) : 0}%</span></div>)}</div><div className="style-note"><Sparkles size={14} /> Both styles build a well-rounded game.</div></section></ChartFrame>
            </div>

            <div className="insights-grid">
              <ChartFrame title="Class types"><section className="panel insight-panel"><div className="panel-heading"><div><h2>Class types</h2><p>Sessions grouped by the first class-title segment</p><p className="chart-explanation">For example, “Fundamentals” and “Advanced”.</p></div><span className="chart-type-label">BY CLASS</span></div><div className="insight-chart type-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={typeData} layout="vertical" margin={{ top: 8, right: 17, left: 4, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} /><YAxis type="category" dataKey="name" width={82} tickLine={false} axisLine={false} tick={{ fill: '#747474', fontSize: 10 }} /><Tooltip cursor={{ fill: '#f4f4f4' }} contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="sessions" name="Sessions" fill="#d97706" radius={[0, 5, 5, 0]} maxBarSize={17} /></BarChart></ResponsiveContainer></div></section></ChartFrame>
              <ChartFrame title="Weekly rhythm"><section className="panel insight-panel"><div className="panel-heading"><div><h2>Weekly rhythm</h2><p>Sessions counted by weekday</p><p className="chart-explanation">Uses each session’s calendar date, across the selected range.</p></div><span className="chart-type-label">BY DAY</span></div><div className="insight-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekdayData} margin={{ top: 15, right: 9, left: -20, bottom: 0 }}><defs><linearGradient id="weekdayFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#52525b" stopOpacity={0.45} /><stop offset="95%" stopColor="#52525b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} dy={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} /><Tooltip contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="sessions" name="Sessions" stroke="#52525b" strokeWidth={2} fill="url(#weekdayFill)" activeDot={{ r: 4 }} /></AreaChart></ResponsiveContainer></div><div className="insight-foot"><CalendarDays size={13} /> Most popular: <strong>{weekdayData.reduce((best, day) => day.sessions > best.sessions ? day : best, weekdayData[0]).day}</strong></div></section></ChartFrame>
              <ChartFrame title="Coaches & academy"><section className="panel insight-panel instructor-panel"><div className="panel-heading"><div><h2>Coaches & academy</h2><p>Session totals for each coach; venue below</p><p className="chart-explanation">Coach names are taken from the text after “|”.</p></div><span className="chart-type-label">COMMUNITY</span></div><div className="instructor-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={instructorData} layout="vertical" margin={{ top: 6, right: 16, left: 0, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 9 }} /><YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fill: '#747474', fontSize: 9 }} /><Tooltip cursor={{ fill: '#f4f4f4' }} contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="sessions" name="Sessions" fill="#71717a" radius={[0, 5, 5, 0]} maxBarSize={14} /></BarChart></ResponsiveContainer></div><div className="venue-summary"><span className="venue-icon"><MapPin size={14} /></span><span><small>TRAINING AT</small><strong>{[...new Set(filteredSessions.map((session) => session.venue))][0] ?? 'No venue yet'}</strong></span><span className="venue-count">{new Set(filteredSessions.map((session) => session.venue)).size} {new Set(filteredSessions.map((session) => session.venue)).size === 1 ? 'location' : 'locations'}</span></div></section></ChartFrame>
            </div>

            <TrainingTimeline ranks={rankHistory} sessions={sessions} styleFilter={styleFilter} query={query} />
            <TrainingJourney ranks={rankHistory} sessions={sessions} />
            <ChartFrame title="Year over year"><YearHistoryChart data={yearData} /></ChartFrame>

            <section className="panel sessions-panel">
              <div className="panel-heading sessions-heading"><div><h2>Recent sessions</h2><p>A record of time well spent</p></div><button className="button button-ghost" onClick={() => goToPage('sessions')}>View all <ArrowUpRight size={14} /></button></div><div className="table-tools"><label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions..." /></label><label className="filter-select"><Filter size={14} /><select value={styleFilter} onChange={(event) => setStyleFilter(event.target.value)}><option>All styles</option><option>Gi</option><option>NoGi</option></select><ChevronDown size={13} /></label></div><SessionTable sessions={filteredSessions.slice(0, 5)} /><div className="table-footer"><span>Showing {Math.min(filteredSessions.length, 5)} of {filteredSessions.length} sessions</span><button onClick={() => goToPage('sessions')}>See all sessions <ArrowUpRight size={13} /></button></div></section>
          </> : <SessionBrowser key={csvImport?.fileName ?? 'sample'} sessions={sessions} initialQuery={query} initialStyle={styleFilter} renderTable={rows => <SessionTable sessions={rows} />} />}
          </div>
        </div>
      </main>
      <nav className="mobile-navigation" aria-label="Modules">
        {([
          { page: 'overview', label: 'Overview', icon: Activity },
          { page: 'sessions', label: 'Sessions', icon: CalendarDays },
          { page: 'log', label: 'Log training', icon: Dumbbell },
          { page: 'dev', label: '3D Lab', icon: Box },
          { page: 'instructions', label: 'Get CSV', icon: BookOpen },
        ] as const).map(({ page, label, icon: Icon }) => <button key={page} className={activePage === page ? 'active' : undefined} aria-current={activePage === page ? 'page' : undefined} onClick={() => { if (activePage !== page) { goToPage(page); window.scrollTo({ top: 0, behavior: 'instant' }) } }}><Icon size={21} aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} pending={workspace.busy} />}
    </div>
  )
}

function SessionTable({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) return <div className="empty-table"><Search size={20} /><strong>No sessions match those filters</strong><span>Try a different search or import a CSV with training data.</span></div>
  return <div className="table-scroll"><table><thead><tr><th>CLASS</th><th>INSTRUCTOR</th><th>DATE</th><th>DURATION</th><th>STYLE</th><th aria-label="Actions" /></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><div className="class-cell"><div className={`class-avatar ${session.style === 'Gi' ? 'gi-avatar' : session.style === 'NoGi' ? 'nogi-avatar' : ''}`}>{session.style === 'Gi' ? 'G' : session.style === 'NoGi' ? 'N' : 'T'}</div><div><strong>{session.classType}</strong><span>{session.venue}</span></div></div></td><td className="instructor-cell">{session.instructor}</td><td><span className="date-main">{shortDate(session.date)}, {session.date.getFullYear()}</span><span className="date-time">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(session.date)}</span></td><td><span className="duration-pill"><Clock3 size={12} />{formatDuration(session.duration)}</span></td><td><span className={`style-badge ${session.style.toLowerCase()}`} title={session.styleEstimated ? 'Estimated from the known Gi / No-Gi ratio' : undefined}>{session.style === 'NoGi' ? 'No-Gi' : session.style}{session.styleEstimated && ' (est.)'}</span></td><td><button className="subtle-icon row-action" aria-label="Session details"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>
}

function YearHistoryChart({ data }: { data: { year: string; sessions: number; hours: number }[] }) {
  const totalSessions = data.reduce((total, year) => total + year.sessions, 0)
  return (
    <section className="panel year-history-panel">
      <div className="panel-heading">
        <div><h2>Year over year</h2><p>Full-year attendance across your training history</p><p className="chart-explanation">The line shows logged sessions per calendar year; the latest year may be incomplete.</p></div>
        <span className="chart-type-label">{data.length} {data.length === 1 ? 'YEAR' : 'YEARS'}</span>
      </div>
      <div className="year-history-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 15, right: 18, left: -17, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#eeeee9" strokeDasharray="4 5" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} dy={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#929292', fontSize: 10 }} />
            <Tooltip formatter={(value, name) => [name === 'Sessions' ? `${value} sessions` : `${value} hours`, name]} labelFormatter={(year) => `Calendar year ${year}`} contentStyle={{ border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12 }} />
            <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#b91c1c" strokeWidth={2.5} dot={{ r: 4, fill: '#dc2626', stroke: '#b91c1c', strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="history-summary"><span><span className="bottom-dot" />{totalSessions} sessions across {data.length} {data.length === 1 ? 'year' : 'years'}</span><span>Uses complete calendar years from the CSV</span></div>
    </section>
  )
}

export default App
