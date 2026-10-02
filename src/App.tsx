import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import Papa from 'papaparse'
import {
  Activity, ArrowDownToLine, ArrowUpRight, Box, CalendarDays,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Dumbbell,
  FileSpreadsheet, Filter, Flame, MapPin, MoreHorizontal, Search, Sparkles,
  Upload, Users, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import './App.css'
import DevPage from './DevPage'
import TrainingCalendar from './TrainingCalendar'

type Session = {
  id: number
  training: string
  date: Date
  duration: number
  style: 'Gi' | 'NoGi' | 'Other'
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

function parseDuration(value: string) {
  const hours = value.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/i)
  const minutes = value.match(/(\d+)\s*m(?:in(?:utes?)?)?/i)
  if (hours || minutes) return Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0)
  const plainMinutes = value.match(/(\d+(?:\.\d+)?)\s*(?:min|minutes)/i)
  return plainMinutes ? Number(plainMinutes[1]) : 60
}

function parseSession(training: string, dateText: string, id: number, durationText = ''): Session | null {
  const dateMatch = dateText.match(/([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)/i)
  const date = new Date(dateMatch?.[1] ?? dateText)
  if (Number.isNaN(date.getTime())) return null
  const [details, instructorText = ''] = training.split('|')
  const parts = details.split('-').map((part) => part.trim()).filter(Boolean)
  const classType = parts[0] ?? 'Training'
  const styleText = parts.find((part) => /^(no\s*-?\s*gi|gi)$/i.test(part)) ?? ''
  const style: Session['style'] = /nogi|no\s*-?\s*gi/i.test(styleText) ? 'NoGi' : /^gi$/i.test(styleText) ? 'Gi' : 'Other'
  const venue = parts.slice(styleText ? parts.indexOf(styleText) + 1 : 1).join(' - ').trim() || 'Venue not listed'
  const instructor = instructorText.trim().replace(/\s*\([^)]*\)/, '') || 'Instructor not listed'
  const duration = parseDuration(durationText || dateText)
  return { id, training: classType, date, duration, style, classType, venue, instructor }
}

function sessionsFromCsv(file: File, onDone: (sessions: Session[], error?: string) => void) {
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
      const parsed = data.flatMap((row, index) => {
        const training = String(row[trainingKey ?? ''] ?? '').trim()
        const dateText = String(row[dateKey ?? ''] ?? '')
        if (!training || !dateText) return []
        const session = parseSession(training, dateText, index, String(row[durationKey ?? ''] ?? ''))
        return session ? [session] : []
      })
      onDone(parsed, parsed.length ? undefined : 'No sessions found. Include Training and Date / Time columns in your CSV.')
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
const COLORS = ['#cbf36b', '#c7b7ff', '#f7a68c']
type Page = 'overview' | 'sessions' | 'dev'

function pageFromPath(): Page {
  if (window.location.pathname === '/dev') return 'dev'
  if (window.location.pathname === '/sessions') return 'sessions'
  return 'overview'
}

function App() {
  const [uploadedSessions, setUploadedSessions] = useState<Session[] | null>(null)
  const sessions = uploadedSessions ?? initialSessions
  const [activePage, setActivePage] = useState<Page>(pageFromPath)
  const [period, setPeriod] = useState('All time')
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear())
  const [query, setQuery] = useState('')
  const [styleFilter, setStyleFilter] = useState('All styles')
  const [uploadMessage, setUploadMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const newest = sessions.reduce((latest, row) => row.date > latest ? row.date : latest, new Date(0))
  const availableYears = [...new Set(sessions.map((session) => session.date.getFullYear()))].sort((a, b) => a - b)
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
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadMessage('Please choose a .csv file.')
      return
    }
    // Once the user chooses a CSV, stop using the built-in sample rows.
    setUploadedSessions([])
    sessionsFromCsv(file, (rows, error) => {
      if (error) setUploadMessage(error)
      else {
        setUploadedSessions(rows)
        if (rows.length) setAnnualYear(Math.max(...rows.map((row) => row.date.getFullYear())))
        setUploadMessage(`${rows.length} sessions imported from ${file.name}`)
      }
    })
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => handleFiles(event.target.files)
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
        <button className={`nav-item ${activePage === 'dev' ? 'active' : ''}`} onClick={() => goToPage('dev')}><Box size={17} /> 3D Data Lab <span className="nav-badge">NEW</span></button>
        <div className="sidebar-divider" />
        <button className="nav-item quiet" onClick={downloadTemplate}><FileSpreadsheet size={17} /> CSV template</button>
        <div className="sidebar-bottom">
          <div className="coach-card"><div className="coach-icon"><Sparkles size={16} /></div><strong>Make every round count.</strong><span>Your mat time, made visible.</span><button onClick={() => fileRef.current?.click()}>Import training data <ArrowUpRight size={13} /></button></div>
          <button className="profile"><div className="profile-avatar">B</div><span className="profile-copy"><strong>My training</strong><small>Personal workspace</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activePage === 'overview' ? 'Overview' : activePage === 'sessions' ? 'Sessions' : '3D Data Lab'}</strong></div><div className="top-actions"><span className="sync-status"><span className="status-dot" /> All changes saved</span><button className="icon-button" aria-label="Help"><CircleHelp size={17} /></button><div className="top-avatar">B</div></div></header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR JIU-JITSU JOURNEY</div><h1>{activePage === 'overview' ? 'Training overview' : activePage === 'sessions' ? 'Training sessions' : '3D Data Lab'}</h1><p>A little progress every day adds up to a lot.</p></div><div className="heading-actions"><button className="button button-outline" onClick={downloadTemplate}><ArrowDownToLine size={15} /> Template</button><button className="button button-primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFileChange} hidden /></div></div>

          <div className="import-strip" onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') fileRef.current?.click() }}>
            <div className="import-icon"><FileSpreadsheet size={17} /></div><div className="import-copy"><strong>{uploadMessage || 'Your data, your dashboard'}</strong><span>{uploadMessage ? 'Your CSV stays in this browser session.' : 'Drop a CSV anywhere or click to upload. Your data never leaves your device.'}</span></div><button className="text-button" onClick={(event) => { event.stopPropagation(); fileRef.current?.click() }}>Choose file <ArrowUpRight size={14} /></button>
          </div>
          {uploadMessage && uploadMessage.includes('Please') || uploadMessage.startsWith('No sessions') || uploadMessage.startsWith('We couldn’t') ? <div className="upload-error"><X size={14} />{uploadMessage}</div> : null}

          {activePage === 'dev' ? <DevPage sessions={sessions} /> : activePage === 'overview' ? <>
            <div className="section-toolbar"><div className="section-title"><span className="live-dot" /> AT A GLANCE</div><div className="toolbar-controls"><span className="updated-label">Based on {filteredSessions.length} sessions</span><label className="select-wrap"><CalendarDays size={14} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>All time</option><option>12 months</option><option>90 days</option><option>30 days</option><option>This year</option></select><ChevronDown size={13} /></label></div></div>

            <div className="stats-grid">
              <article className="stat-card"><div className="stat-top"><span>Total sessions</span><span className="stat-icon green"><Dumbbell size={16} /></span></div><div className="stat-value">{filteredSessions.length}<span className="stat-unit">sessions</span></div><div className="stat-foot"><span className="stat-accent"><ArrowUpRight size={13} /> Keep showing up</span><span>since you started</span></div></article>
              <article className="stat-card"><div className="stat-top"><span>Time on the mat</span><span className="stat-icon purple"><Clock3 size={16} /></span></div><div className="stat-value">{Math.floor(metrics.minutes / 60)}<span className="stat-unit">h</span> {metrics.minutes % 66}<span className="stat-unit">m</span></div><div className="stat-foot"><span>Avg. {formatDuration(metrics.average)}</span><span>per session</span></div></article>
              <article className="stat-card"><div className="stat-top"><span>This month</span><span className="stat-icon orange"><Flame size={16} /></span></div><div className="stat-value">{metrics.thisMonth}<span className="stat-unit">sessions</span></div><div className="stat-foot"><span>{new Intl.DateTimeFormat('en', { month: 'long' }).format(newest)}</span><span>{newest.getFullYear()}</span></div></article>
              <article className="stat-card"><div className="stat-top"><span>Favorite style</span><span className="stat-icon blue"><Users size={16} /></span></div><div className="stat-value stat-word">{metrics.mostFrequent}</div><div className="stat-foot"><span>{metrics.gi} Gi · {metrics.noGi} No-Gi</span><span>sessions</span></div></article>
            </div>

            <TrainingCalendar sessions={sessions} year={selectedYear} years={availableYears} onYearChange={setAnnualYear} styleFilter={styleFilter} query={query} />

            <div className="charts-grid">
              <section className="panel activity-panel"><div className="panel-heading"><div><h2>Training activity</h2><p>Yearly attendance · busiest month: {busiestMonth.sessions ? busiestMonth.month : '—'}</p><p className="chart-explanation">Green bars count sessions; purple bars show mat hours. Months without sessions remain visible as zero.</p></div><label className="year-select"><span>YEAR</span><select value={selectedYear} onChange={(event) => setAnnualYear(Number(event.target.value))}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={12} /></label></div><div className="chart-legend"><span><i className="legend-swatch lime" />Sessions</span><span><i className="legend-swatch lavender" />Hours on mat</span></div><div className="activity-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualData} margin={{ top: 7, right: 12, left: -18, bottom: 0 }} barGap={3}><CartesianGrid vertical={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} dy={10} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} /><Tooltip cursor={{ fill: '#f6f7f1' }} contentStyle={{ border: '1px solid #e9eae4', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 25px #25291b12' }} /><Bar dataKey="sessions" name="Sessions" fill="#c7ec69" radius={[5, 5, 0, 0]} maxBarSize={19} /><Bar dataKey="hours" name="Hours on mat" fill="#c9baf6" radius={[5, 5, 0, 0]} maxBarSize={19} /></BarChart></ResponsiveContainer></div><div className="chart-bottom"><span><span className="bottom-dot" /> {annualData.reduce((sum, item) => sum + item.sessions, 0)} sessions in {selectedYear}</span><span>{selectedYear} <CalendarDays size={13} /></span></div></section>

              <section className="panel style-panel"><div className="panel-heading"><div><h2>Gi vs. No-Gi</h2><p>Share of sessions by training uniform</p><p className="chart-explanation">Counts Gi, No-Gi, and any unclassified sessions.</p></div>
                <button className="subtle-icon" aria-label="Style chart settings"><MoreHorizontal size={18} /></button>
              </div><div className="donut-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={styleData} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="94%" paddingAngle={4} stroke="none" cornerRadius={5}>{styleData.map((entry) => <Cell key={entry.name} fill={entry.name === 'Gi' ? COLORS[0] : entry.name === 'No-Gi' ? COLORS[1] : COLORS[2]} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #e9eae4', borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer></div><div className="donut-center"><strong>{filteredSessions.length}</strong><span>sessions</span></div></div><div className="style-legend">{[{ name: 'Gi', value: metrics.gi, color: COLORS[0] }, { name: 'No-Gi', value: metrics.noGi, color: COLORS[1] }, ...(metrics.other ? [{ name: 'Other', value: metrics.other, color: COLORS[2] }] : [])].map((item) => <div className="style-row" key={item.name}><span className="style-name"><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}<small> sessions</small></strong><span className="style-percent">{filteredSessions.length ? Math.round(item.value / filteredSessions.length * 100) : 0}%</span></div>)}</div><div className="style-note"><Sparkles size={14} /> Both styles build a well-rounded game.</div></section>
            </div>

            <div className="insights-grid">
              <section className="panel insight-panel"><div className="panel-heading"><div><h2>Class types</h2><p>Sessions grouped by the first class-title segment</p><p className="chart-explanation">For example, “Fundamentals” and “Advanced”.</p></div><span className="chart-type-label">BY CLASS</span></div><div className="insight-chart type-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={typeData} layout="vertical" margin={{ top: 8, right: 17, left: 4, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} /><YAxis type="category" dataKey="name" width={82} tickLine={false} axisLine={false} tick={{ fill: '#77796f', fontSize: 10 }} /><Tooltip cursor={{ fill: '#f6f7f1' }} contentStyle={{ border: '1px solid #e9eae4', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="sessions" name="Sessions" fill="#f4a68c" radius={[0, 5, 5, 0]} maxBarSize={17} /></BarChart></ResponsiveContainer></div></section>
              <section className="panel insight-panel"><div className="panel-heading"><div><h2>Weekly rhythm</h2><p>Sessions counted by weekday</p><p className="chart-explanation">Uses each session’s calendar date, across the selected range.</p></div><span className="chart-type-label">BY DAY</span></div><div className="insight-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekdayData} margin={{ top: 15, right: 9, left: -20, bottom: 0 }}><defs><linearGradient id="weekdayFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9baf6" stopOpacity={0.45} /><stop offset="95%" stopColor="#c9baf6" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} dy={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} /><Tooltip contentStyle={{ border: '1px solid #e9eae4', borderRadius: 10, fontSize: 12 }} /><Area type="monotone" dataKey="sessions" name="Sessions" stroke="#a38dd7" strokeWidth={2} fill="url(#weekdayFill)" activeDot={{ r: 4 }} /></AreaChart></ResponsiveContainer></div><div className="insight-foot"><CalendarDays size={13} /> Most popular: <strong>{weekdayData.reduce((best, day) => day.sessions > best.sessions ? day : best, weekdayData[0]).day}</strong></div></section>
              <section className="panel insight-panel instructor-panel"><div className="panel-heading"><div><h2>Coaches & academy</h2><p>Session totals for each coach; venue below</p><p className="chart-explanation">Coach names are taken from the text after “|”.</p></div><span className="chart-type-label">COMMUNITY</span></div><div className="instructor-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={instructorData} layout="vertical" margin={{ top: 6, right: 16, left: 0, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eeeee9" strokeDasharray="4 5" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 9 }} /><YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fill: '#77796f', fontSize: 9 }} /><Tooltip cursor={{ fill: '#f6f7f1' }} contentStyle={{ border: '1px solid #e9eae4', borderRadius: 10, fontSize: 12 }} /><Bar dataKey="sessions" name="Sessions" fill="#9fb9d1" radius={[0, 5, 5, 0]} maxBarSize={14} /></BarChart></ResponsiveContainer></div><div className="venue-summary"><span className="venue-icon"><MapPin size={14} /></span><span><small>TRAINING AT</small><strong>{[...new Set(filteredSessions.map((session) => session.venue))][0] ?? 'No venue yet'}</strong></span><span className="venue-count">{new Set(filteredSessions.map((session) => session.venue)).size} {new Set(filteredSessions.map((session) => session.venue)).size === 1 ? 'location' : 'locations'}</span></div></section>
            </div>

            <YearHistoryChart data={yearData} />

            <section className="panel sessions-panel">
              <div className="panel-heading sessions-heading"><div><h2>Recent sessions</h2><p>A record of time well spent</p></div><button className="button button-ghost" onClick={() => setActivePage('sessions')}>View all <ArrowUpRight size={14} /></button></div><div className="table-tools"><label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions..." /></label><label className="filter-select"><Filter size={14} /><select value={styleFilter} onChange={(event) => setStyleFilter(event.target.value)}><option>All styles</option><option>Gi</option><option>NoGi</option></select><ChevronDown size={13} /></label></div><SessionTable sessions={filteredSessions.slice(0, 5)} /><div className="table-footer"><span>Showing {Math.min(filteredSessions.length, 5)} of {filteredSessions.length} sessions</span><button onClick={() => setActivePage('sessions')}>See all sessions <ArrowUpRight size={13} /></button></div></section>
          </> : <section className="panel all-sessions-panel"><div className="panel-heading sessions-heading"><div><h2>All sessions</h2><p>Your training history, all in one place</p></div><div className="session-total"><strong>{filteredSessions.length}</strong> sessions</div></div><div className="table-tools"><label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sessions or instructors..." /></label><label className="filter-select"><Filter size={14} /><select value={styleFilter} onChange={(event) => setStyleFilter(event.target.value)}><option>All styles</option><option>Gi</option><option>NoGi</option></select><ChevronDown size={13} /></label></div><SessionTable sessions={filteredSessions} /></section>}
        </div>
      </main>
    </div>
  )
}

function SessionTable({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) return <div className="empty-table"><Search size={20} /><strong>No sessions match those filters</strong><span>Try a different search or import a CSV with training data.</span></div>
  return <div className="table-scroll"><table><thead><tr><th>CLASS</th><th>INSTRUCTOR</th><th>DATE</th><th>DURATION</th><th>STYLE</th><th aria-label="Actions" /></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><div className="class-cell"><div className={`class-avatar ${session.style === 'Gi' ? 'gi-avatar' : session.style === 'NoGi' ? 'nogi-avatar' : ''}`}>{session.style === 'Gi' ? 'G' : session.style === 'NoGi' ? 'N' : 'T'}</div><div><strong>{session.classType}</strong><span>{session.venue}</span></div></div></td><td className="instructor-cell">{session.instructor}</td><td><span className="date-main">{shortDate(session.date)}, {session.date.getFullYear()}</span><span className="date-time">{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(session.date)}</span></td><td><span className="duration-pill"><Clock3 size={12} />{formatDuration(session.duration)}</span></td><td><span className={`style-badge ${session.style.toLowerCase()}`}>{session.style === 'NoGi' ? 'No-Gi' : session.style}</span></td><td><button className="subtle-icon row-action" aria-label="Session details"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>
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
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} dy={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#96978e', fontSize: 10 }} />
            <Tooltip formatter={(value, name) => [name === 'Sessions' ? `${value} sessions` : `${value} hours`, name]} labelFormatter={(year) => `Calendar year ${year}`} contentStyle={{ border: '1px solid #e9eae4', borderRadius: 10, fontSize: 12 }} />
            <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#8da943" strokeWidth={2.5} dot={{ r: 4, fill: '#c7ec69', stroke: '#8da943', strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="history-summary"><span><span className="bottom-dot" />{totalSessions} sessions across {data.length} {data.length === 1 ? 'year' : 'years'}</span><span>Uses complete calendar years from the CSV</span></div>
    </section>
  )
}

export default App
