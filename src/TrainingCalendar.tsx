import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip'

type TrainingSession = {
  id: number
  date: Date
  duration: number
  classType: string
  instructor: string
  venue: string
  style: 'Gi' | 'NoGi' | 'Other'
}
type CalendarDay = { date: Date; sessions: TrainingSession[]; minutes: number }
const keyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const fullDate = (date: Date) => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
const levelOf = (count: number) => Math.min(count, 4)

export default function TrainingCalendar({ sessions, year, years, onYearChange, styleFilter, query }: {
  sessions: TrainingSession[]
  year: number
  years: number[]
  onYearChange: (year: number) => void
  styleFilter: string
  query: string
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const calendar = useMemo(() => {
    const byDay = new Map<string, TrainingSession[]>()
    sessions.filter(session => session.date.getFullYear() === year
      && (styleFilter === 'All styles' || session.style === styleFilter)
      && `${session.classType} ${session.instructor} ${session.venue}`.toLowerCase().includes(query.toLowerCase()))
      .forEach(session => byDay.set(keyOf(session.date), [...(byDay.get(keyOf(session.date)) ?? []), session]))
    const days: CalendarDay[] = []
    // Calendar iteration uses local dates, including leap years and daylight-saving changes.
    for (const date = new Date(year, 0, 1); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
      const items = byDay.get(keyOf(date)) ?? []
      days.push({ date: new Date(date), sessions: items, minutes: items.reduce((sum, session) => sum + session.duration, 0) })
    }
    const offset = days[0].date.getDay()
    const columns = Math.ceil((offset + days.length) / 7)
    const cells = Array.from({ length: columns * 7 }, (_, index) => days[index - offset] ?? null)
    const months = days.filter(day => day.date.getDate() === 1).map(day => ({
      name: new Intl.DateTimeFormat('en', { month: 'short' }).format(day.date),
      column: Math.floor((offset + days.indexOf(day)) / 7) + 1,
    }))
    return { days, cells, columns, months }
  }, [sessions, year, styleFilter, query])
  const total = calendar.days.reduce((sum, day) => sum + day.sessions.length, 0)
  const activeDays = calendar.days.filter(day => day.sessions.length).length
  const selected = calendar.days.find(day => keyOf(day.date) === selectedKey)
  const tabKey = calendar.days.some(day => keyOf(day.date) === focusedKey) ? focusedKey : keyOf(calendar.days.find(day => day.sessions.length)?.date ?? calendar.days[0].date)
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, day: CalendarDay) => {
    const offsets: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }
    const index = calendar.days.indexOf(day)
    let next = index
    if (event.key in offsets) next += offsets[event.key]
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = calendar.days.length - 1
    else return
    event.preventDefault()
    const nextKey = keyOf(calendar.days[Math.max(0, Math.min(calendar.days.length - 1, next))].date)
    setFocusedKey(nextKey)
    buttons.current.get(nextKey)?.focus()
  }
  return <Card className="training-calendar">
    <CardHeader className="training-calendar-header"><div><div className="training-calendar-kicker"><CalendarDays size={14} /> YOUR TIME ON THE MAT</div><CardTitle>Training calendar</CardTitle><CardDescription>Every square is a day. More practices, deeper green.</CardDescription></div><label className="year-select"><span>YEAR</span><select aria-label="Training calendar year" value={year} onChange={event => { onYearChange(Number(event.target.value)); setSelectedKey(null); setFocusedKey(null) }}>{(years.length ? years : [year]).map(value => <option value={value} key={value}>{value}</option>)}</select><ChevronDown size={12} /></label></CardHeader>
    <CardContent><div className="training-calendar-summary"><strong>{total} {total === 1 ? 'practice' : 'practices'} in {year}</strong><span>{activeDays} active {activeDays === 1 ? 'day' : 'days'}{styleFilter !== 'All styles' ? ` · ${styleFilter === 'NoGi' ? 'No-Gi' : styleFilter}` : ''}{query ? ' · Search applied' : ''}</span></div>
      <div className="contribution-scroll" role="region" aria-label="Yearly training contributions calendar"><div className="contribution-chart" style={{ '--week-count': calendar.columns } as CSSProperties}>
        <div className="contribution-months">{calendar.months.map(month => <span key={month.name} style={{ gridColumn: `${month.column} / span 3` }}>{month.name}</span>)}</div>
        <div className="contribution-weekdays" aria-hidden="true"><span style={{ gridRow: 2 }}>Mon</span><span style={{ gridRow: 4 }}>Wed</span><span style={{ gridRow: 6 }}>Fri</span></div>
        <TooltipProvider delayDuration={120}><div className="contribution-grid" aria-label="Daily practice counts">{calendar.cells.map((day, index) => day ? <Tooltip key={keyOf(day.date)}><TooltipTrigger asChild><button ref={node => { if (node) buttons.current.set(keyOf(day.date), node); else buttons.current.delete(keyOf(day.date)) }} className={`contribution-day contribution-level-${levelOf(day.sessions.length)} ${selectedKey === keyOf(day.date) ? 'is-selected' : ''}`} aria-label={`${fullDate(day.date)}: ${day.sessions.length} ${day.sessions.length === 1 ? 'practice' : 'practices'}, ${day.minutes} minutes`} aria-pressed={selectedKey === keyOf(day.date)} tabIndex={tabKey === keyOf(day.date) ? 0 : -1} onFocus={() => setFocusedKey(keyOf(day.date))} onKeyDown={event => moveFocus(event, day)} onClick={() => setSelectedKey(keyOf(day.date))} /></TooltipTrigger><TooltipContent><strong>{day.sessions.length ? `${day.sessions.length} ${day.sessions.length === 1 ? 'practice' : 'practices'} · ${day.minutes} min` : 'No practice logged'}</strong><span>{fullDate(day.date)}</span></TooltipContent></Tooltip> : <span key={`padding-${index}`} className="contribution-padding" />)}</div></TooltipProvider>
      </div></div>
      <div className="contribution-footer"><span>Full calendar year · Click a day for details</span><div className="contribution-legend" aria-label="Daily practice intensity: zero, one, two, three, four or more practices"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <i key={level} className={`contribution-level-${level}`} title={`${level}${level === 4 ? '+' : ''} practices`} />)}<span>More</span></div></div>
      {total === 0 && <p className="contribution-empty">{sessions.length ? 'No practices match this year and your filters.' : 'Import a CSV to see your training days appear here.'}</p>}
      {selected && <div className="contribution-details"><div className="contribution-details-heading"><div><h3>{fullDate(selected.date)}</h3><p>{selected.sessions.length} {selected.sessions.length === 1 ? 'practice' : 'practices'} · {selected.minutes} minutes on the mat</p></div><button aria-label="Close training day details" onClick={() => setSelectedKey(null)}><X size={15} /></button></div>{selected.sessions.length ? <div className="contribution-sessions">{[...selected.sessions].sort((a, b) => a.date.getTime() - b.date.getTime()).map(session => <div key={session.id}><span className={`style-badge ${session.style.toLowerCase()}`}>{session.style === 'NoGi' ? 'No-Gi' : session.style}</span><div><strong>{session.classType}</strong><small>{session.instructor} · {session.venue}</small></div><span>{new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(session.date)}</span><b>{session.duration} min</b></div>)}</div> : <p className="contribution-empty">No practice was logged on this day.</p>}</div>}
    </CardContent>
  </Card>
}

