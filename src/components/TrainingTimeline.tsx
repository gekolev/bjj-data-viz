import { useContext, useMemo, useState } from 'react'
import ChartFrame from './ChartFrame'
import { ChartModalContext } from './ChartModalContext'
import { bjjRankHistory, describeRank, rankAtDate, type RankPromotion } from '../lib/rankHistory'
import { RankBadge } from './RankContext'

type Session = { id: number; date: Date; duration: number; style: 'Gi' | 'NoGi' | 'Other'; classType: string; instructor: string; venue: string }
const colors = { Gi: '#dc2626', NoGi: '#52525b', Other: '#d97706' }
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const calendarX = (date: Date) => 80 + (date.getMonth() + (date.getDate() - 1) / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) * 80

export default function TrainingTimeline(props: { sessions: Session[]; styleFilter: string; query: string; ranks?: RankPromotion[] }) {
  return <ChartFrame title="Your complete training journey"><TimelinePlot {...props} /></ChartFrame>
}

function TimelinePlot({ sessions, styleFilter, query, ranks = [] }: { sessions: Session[]; styleFilter: string; query: string; ranks?: RankPromotion[] }) {
  const history = useMemo(() => bjjRankHistory(ranks), [ranks])
  const expanded = Boolean(useContext(ChartModalContext))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedRank, setSelectedRank] = useState<RankPromotion | null>(null)
  const data = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id)
    const allDates = [...sorted.map(s => s.date), ...history.map(rank => rank.date)].sort((a, b) => a.getTime() - b.getTime())
    const firstYear = allDates[0]?.getFullYear()
    const lastYear = allDates.at(-1)?.getFullYear()
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
      return { year, points, height: Math.max(history.length ? 120 : 90, laneEnds.length * 12 + (history.length ? 74 : 42)) }
    })
    let top = 42
    const positionedRows = rows.map(row => {
      const result = { ...row, top }
      top += row.height
      return result
    })
    return { rows: positionedRows, height: top + 16, visible, sorted }
  }, [sessions, styleFilter, query, history])
  const selected = data.visible.find(session => session.id === selectedId)
  const fontSize = expanded ? 18 : 13
  const totalHours = Math.round(data.visible.reduce((sum, session) => sum + session.duration, 0) / 60 * 10) / 10

  return <section className="panel training-timeline-panel">
    <div className="panel-heading"><div><h2>Your complete training journey</h2><p>Every session, across every year of your training.</p><p className="chart-explanation">Each dot is one training session. Months align across years; nearby sessions stack vertically to keep each dot visible. Hover, focus, or click a dot for details.</p></div><span className="chart-type-label">FULL HISTORY</span></div>
    <div className="chart-legend timeline-legend">{Object.entries(colors).map(([style, color]) => <span key={style}><i className="legend-swatch" style={{ background: color }} />{style === 'NoGi' ? 'No-Gi' : style}</span>)}<span className="timeline-count">{data.visible.length} of {sessions.length} sessions</span></div>
    {history.length > 0 && <p className="rank-chart-note">The belt-colored track below each year shows your recorded rank at that time. Diamonds mark belt or stripe promotions; select one for details. Session dots keep their training-style colors.</p>}
    {data.rows.length ? <div className="training-timeline-chart"><svg viewBox={`0 0 1060 ${data.height}`} role="group" aria-label="Training sessions by year and month" className="training-timeline-svg">
      {months.map((month, index) => <text key={month} x={120 + index * 80} y={24} textAnchor="middle" fill="#717171" fontSize={fontSize}>{month}</text>)}
      {data.rows.map(row => <g key={row.year}>
        <rect x={72} y={row.top} width={976} height={row.height - 8} rx={8} fill={row.year % 2 ? '#f7f7f7' : '#eeeeee'} />
        <text x={12} y={row.top + row.height / 2} fill="#494949" fontWeight={650} fontSize={expanded ? 22 : 17}>{row.year}</text>
        {history.map((rank, index) => {
          const start = new Date(Math.max(new Date(row.year, 0, 1).getTime(), rank.date.getTime()))
          const end = new Date(Math.min(new Date(row.year + 1, 0, 1).getTime(), history[index + 1]?.date.getTime() ?? new Date(row.year + 1, 0, 1).getTime()))
          if (end <= start) return null
          const x = start.getFullYear() > row.year ? 1040 : calendarX(start)
          const right = end.getFullYear() > row.year ? 1040 : calendarX(end)
          const description = describeRank(rank)
          return <g key={`belt-${rank.id}`}><rect x={x} y={row.top + row.height - 30} width={Math.max(0, right - x)} height={16} fill={description.color} stroke="#888888" strokeWidth={0.5}><title>{description.label}</title></rect>{right - x > 45 && <text x={x + 7} y={row.top + row.height - 18} fontSize={11} fill={description.color === '#f4f3ed' ? '#363636' : '#fff'}>{rank.rank}</text>}</g>
        })}
        {history.filter(rank => rank.date.getFullYear() === row.year).map(rank => {
          const x = calendarX(rank.date)
          const y = row.top + row.height - 22
          const select = () => { setSelectedRank(rank); setSelectedId(null) }
          return <path key={`promotion-${rank.id}`} d={`M ${x} ${y - 8} l 8 8 l -8 8 l -8 -8 Z`} fill={describeRank(rank).color} stroke="#373737" strokeWidth={2} tabIndex={0} role="button" aria-label={`Promotion ${rank.rank}, ${describeRank(rank).label}, ${rank.date.toLocaleDateString('en-GB')}`} onMouseEnter={select} onFocus={select} onClick={select} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() } }}><title>{`${rank.date.toLocaleDateString('en-GB')}: ${describeRank(rank).label}`}</title></path>
        })}
        {months.map((month, index) => <line key={month} x1={80 + index * 80} x2={80 + index * 80} y1={row.top + 8} y2={row.top + row.height - 16} stroke="#dedede" strokeDasharray="3 5" />)}
        {!row.points.length && <text x={560} y={row.top + row.height / 2} textAnchor="middle" fill="#8c8c8c" fontSize={fontSize}>No sessions logged{sessions.some(session => session.date.getFullYear() === row.year) ? ' matching your filters' : ''}</text>}
        {row.points.map(({ session, x, lane }) => <circle key={session.id} cx={x} cy={row.top + 24 + lane * 12} r={selectedId === session.id ? 5 : 4} fill={colors[session.style]} stroke={selectedId === session.id ? '#363636' : '#fff'} strokeWidth={selectedId === session.id ? 2 : 1} tabIndex={0} role="button" aria-label={`${dateFormat.format(session.date)}, ${session.classType}, ${session.style === 'NoGi' ? 'No-Gi' : session.style}, ${session.duration} minutes, ${session.instructor}`} aria-pressed={selectedId === session.id} onMouseEnter={() => { setSelectedId(session.id); setSelectedRank(null) }} onFocus={() => { setSelectedId(session.id); setSelectedRank(null) }} onClick={() => { setSelectedId(session.id); setSelectedRank(null) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(session.id); setSelectedRank(null) } }}><title>{`${dateFormat.format(session.date)} • ${session.classType} • ${session.duration} min`}</title></circle>)}
      </g>)}
    </svg></div> : <div className="timeline-empty">Import your CSV to see your complete training journey.</div>}
    <div className="timeline-session-detail" aria-live="polite">{selectedRank ? <><strong>{selectedRank.date.toLocaleDateString('en-GB')} · Recorded rank milestone</strong><RankBadge rank={selectedRank} promotion /><span>{selectedRank.status || 'Rank recorded'}</span></> : selected ? <><strong>{dateFormat.format(selected.date)} · {selected.classType}</strong><span>{selected.style === 'NoGi' ? 'No-Gi' : selected.style} · {selected.duration} min · {selected.instructor} · {selected.venue}</span><RankBadge rank={rankAtDate(selected.date, history)} /></> : <><strong>{data.visible.length ? 'Explore your sessions' : 'No sessions match your filters'}</strong><span>{data.visible.length ? 'Hover or select any dot to see its date, class, duration, coach, and venue.' : 'Try another style or clear the session search.'}</span></>}</div>
    <div className="history-summary"><span>{data.rows.length} calendar years · {totalHours} hours on mat</span><span>Full history · independent of the period and annual year selectors</span></div>
  </section>
}
