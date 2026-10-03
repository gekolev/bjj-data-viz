import { useContext, useMemo, useState } from 'react'
import ChartFrame from './ChartFrame'
import { ChartModalContext } from './ChartModalContext'

type Session = { id: number; date: Date; duration: number; style: 'Gi' | 'NoGi' | 'Other'; classType: string; instructor: string; venue: string }
const colors = { Gi: '#7eaa38', NoGi: '#a38dd7', Other: '#de9275' }
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function TrainingTimeline(props: { sessions: Session[]; styleFilter: string; query: string }) {
  return <ChartFrame title="Your complete training journey"><TimelinePlot {...props} /></ChartFrame>
}

function TimelinePlot({ sessions, styleFilter, query }: { sessions: Session[]; styleFilter: string; query: string }) {
  const expanded = Boolean(useContext(ChartModalContext))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const data = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id)
    const firstYear = sorted[0]?.date.getFullYear()
    const lastYear = sorted.at(-1)?.date.getFullYear()
    const years = firstYear === undefined || lastYear === undefined ? [] : Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)
    const visible = sorted.filter(session => (styleFilter === 'All styles' || session.style === styleFilter)
      && `${session.classType} ${session.instructor} ${session.venue}`.toLowerCase().includes(query.toLowerCase()))
    const rows = years.map(year => {
      const laneEnds: number[] = []
      const points = visible.filter(session => session.date.getFullYear() === year).map(session => {
        const daysInMonth = new Date(year, session.date.getMonth() + 1, 0).getDate()
        const fraction = (session.date.getDate() - 1 + (session.date.getHours() * 60 + session.date.getMinutes()) / 1440) / daysInMonth
        const x = 80 + (session.date.getMonth() + fraction) * 80
        // Separate nearby sessions without changing their calendar position.
        let lane = laneEnds.findIndex(end => x - end >= 10)
        if (lane < 0) lane = laneEnds.length
        laneEnds[lane] = x
        return { session, x, lane }
      })
      return { year, points, height: Math.max(90, laneEnds.length * 12 + 42) }
    })
    let top = 42
    const positionedRows = rows.map(row => {
      const result = { ...row, top }
      top += row.height
      return result
    })
    return { rows: positionedRows, height: top + 16, visible, sorted }
  }, [sessions, styleFilter, query])
  const selected = data.visible.find(session => session.id === selectedId)
  const fontSize = expanded ? 18 : 13
  const totalHours = Math.round(data.visible.reduce((sum, session) => sum + session.duration, 0) / 60 * 10) / 10

  return <section className="panel training-timeline-panel">
    <div className="panel-heading"><div><h2>Your complete training journey</h2><p>Every session, across every year of your training.</p><p className="chart-explanation">Each dot is one training session. Months align across years; nearby sessions stack vertically to keep each dot visible. Hover, focus, or click a dot for details.</p></div><span className="chart-type-label">FULL HISTORY</span></div>
    <div className="chart-legend timeline-legend">{Object.entries(colors).map(([style, color]) => <span key={style}><i className="legend-swatch" style={{ background: color }} />{style === 'NoGi' ? 'No-Gi' : style}</span>)}<span className="timeline-count">{data.visible.length} of {sessions.length} sessions</span></div>
    {data.rows.length ? <div className="training-timeline-chart"><svg viewBox={`0 0 1060 ${data.height}`} role="group" aria-label="Training sessions by year and month" className="training-timeline-svg">
      {months.map((month, index) => <text key={month} x={120 + index * 80} y={24} textAnchor="middle" fill="#737b67" fontSize={fontSize}>{month}</text>)}
      {data.rows.map(row => <g key={row.year}>
        <rect x={72} y={row.top} width={976} height={row.height - 8} rx={8} fill={row.year % 2 ? '#f8faf4' : '#f0f4e9'} />
        <text x={12} y={row.top + row.height / 2} fill="#4a5939" fontWeight={650} fontSize={expanded ? 22 : 17}>{row.year}</text>
        {months.map((month, index) => <line key={month} x1={80 + index * 80} x2={80 + index * 80} y1={row.top + 8} y2={row.top + row.height - 16} stroke="#dfe6d5" strokeDasharray="3 5" />)}
        {!row.points.length && <text x={560} y={row.top + row.height / 2} textAnchor="middle" fill="#8d9681" fontSize={fontSize}>No sessions logged{sessions.some(session => session.date.getFullYear() === row.year) ? ' matching your filters' : ''}</text>}
        {row.points.map(({ session, x, lane }) => <circle key={session.id} cx={x} cy={row.top + 24 + lane * 12} r={selectedId === session.id ? 5 : 4} fill={colors[session.style]} stroke={selectedId === session.id ? '#344626' : '#fff'} strokeWidth={selectedId === session.id ? 2 : 1} tabIndex={0} role="button" aria-label={`${dateFormat.format(session.date)}, ${session.classType}, ${session.style === 'NoGi' ? 'No-Gi' : session.style}, ${session.duration} minutes, ${session.instructor}`} aria-pressed={selectedId === session.id} onMouseEnter={() => setSelectedId(session.id)} onFocus={() => setSelectedId(session.id)} onClick={() => setSelectedId(session.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(session.id) } }}><title>{`${dateFormat.format(session.date)} • ${session.classType} • ${session.duration} min`}</title></circle>)}
      </g>)}
    </svg></div> : <div className="timeline-empty">Import your CSV to see your complete training journey.</div>}
    <div className="timeline-session-detail" aria-live="polite">{selected ? <><strong>{dateFormat.format(selected.date)} · {selected.classType}</strong><span>{selected.style === 'NoGi' ? 'No-Gi' : selected.style} · {selected.duration} min · {selected.instructor} · {selected.venue}</span></> : <><strong>{data.visible.length ? 'Explore your sessions' : 'No sessions match your filters'}</strong><span>{data.visible.length ? 'Hover or select any dot to see its date, class, duration, coach, and venue.' : 'Try another style or clear the session search.'}</span></>}</div>
    <div className="history-summary"><span>{data.rows.length} calendar years · {totalHours} hours on mat</span><span>Full history · independent of the period and annual year selectors</span></div>
  </section>
}
