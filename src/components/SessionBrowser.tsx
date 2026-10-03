import { useMemo, useState, type ReactNode } from 'react'
import { RotateCcw, Search } from 'lucide-react'
import type { ImportedSession } from '../lib/importStorage'
import { emptySessionFilters, filterSessions, type SessionFilters } from '../lib/sessionFilters'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const timeOptions = [
  { value: 'morning', label: 'Morning · 05:00–11:00' },
  { value: 'lunch', label: 'Lunch · 11:00–14:00' },
  { value: 'afternoon', label: 'Afternoon · 14:00–17:00' },
  { value: 'evening', label: 'Evening · 17:00–22:00' },
  { value: 'night', label: 'Night · 22:00–05:00' },
]

export default function SessionBrowser({ sessions, initialQuery, initialStyle, renderTable }: {
  sessions: ImportedSession[]
  initialQuery: string
  initialStyle: string
  renderTable: (sessions: ImportedSession[]) => ReactNode
}) {
  const [filters, setFilters] = useState<SessionFilters>(() => ({ ...emptySessionFilters, query: initialQuery, style: initialStyle === 'All styles' ? '' : initialStyle }))
  const [sort, setSort] = useState('newest')
  const options = useMemo(() => {
    const distinct = (field: 'classType' | 'instructor' | 'venue') => [...new Set(sessions.map(session => session[field]))].sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value }))
    return {
      classType: distinct('classType'), instructor: distinct('instructor'), venue: distinct('venue'),
      year: [...new Set(sessions.map(session => session.date.getFullYear()))].sort((a, b) => b - a).map(year => ({ value: String(year), label: String(year) })),
    }
  }, [sessions])
  const matches = useMemo(() => filterSessions(sessions, filters).sort((a, b) => sort === 'oldest' ? a.date.getTime() - b.date.getTime() : sort === 'longest' ? b.duration - a.duration || b.date.getTime() - a.date.getTime() : b.date.getTime() - a.date.getTime()), [sessions, filters, sort])
  const activeCount = Object.values(filters).filter(value => value.trim()).length
  const select = (field: keyof Omit<SessionFilters, 'query'>, label: string, allLabel: string, choices: { value: string; label: string }[]) => <label className="session-filter"><span>{label}</span><select value={filters[field]} onChange={event => setFilters(current => ({ ...current, [field]: event.target.value }))}><option value="">{allLabel}</option>{choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>

  return <section className="panel all-sessions-panel session-browser">
    <div className="panel-heading sessions-heading"><div><h2>All sessions</h2><p>Your training history, all in one place</p></div><div className="session-total"><strong>{matches.length}</strong> of {sessions.length} sessions</div></div>
    <div className="session-search-row"><label className="search-field"><Search size={16} /><input aria-label="Search training sessions" value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder="Search classes, coaches, or gyms..." /></label><button className="button button-outline session-clear" disabled={!activeCount && sort === 'newest'} onClick={() => { setFilters({ ...emptySessionFilters }); setSort('newest') }}><RotateCcw size={14} /> Clear filters{activeCount > 0 ? ` (${activeCount})` : ''}</button></div>
    <div className="session-filter-grid">
      {select('style', 'Training style', 'All styles', [{ value: 'Gi', label: 'Gi' }, { value: 'NoGi', label: 'No-Gi' }, ...(sessions.some(session => session.style === 'Other') ? [{ value: 'Other', label: 'Other' }] : [])])}
      {select('weekday', 'Weekday', 'Every day', [1, 2, 3, 4, 5, 6, 0].map(day => ({ value: String(day), label: weekdays[day] })))}
      {select('classType', 'Session type', 'All sessions', options.classType)}
      {select('timeOfDay', 'Time of day', 'Any time', timeOptions)}
      {select('instructor', 'Coach', 'All coaches', options.instructor)}
      {select('venue', 'Gym / venue', 'All venues', options.venue)}
      {select('year', 'Year', 'All years', options.year)}
      <label className="session-filter"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="longest">Longest sessions</option></select></label>
    </div>
    <p className="session-filter-hint">Filters work together across your full history. Time of day uses each session’s start time in your browser’s local time.</p>
    {renderTable(matches)}
    <div className="table-footer"><span>Showing {matches.length} of {sessions.length} sessions</span><span>{Math.round(matches.reduce((sum, session) => sum + session.duration, 0) / 60 * 10) / 10} hours on mat</span></div>
  </section>
}
