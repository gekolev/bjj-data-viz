import { useMemo, useState } from 'react'
import ChartFrame from './ChartFrame'
import { describeRank, type RankPromotion } from '../lib/rankHistory'
import { RankBadge } from './RankContext'
import { buildTrainingJourney, sessionHasRecordedTime, journeyStyles as styles, type JourneySession as Session } from '../lib/trainingJourney'

const colors = { Gi: '#dc2626', NoGi: '#52525b', Other: '#d97706' }
const monthLabel = (date: Date) => date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 })
function breakdown(sessions: Session[], field: 'classType' | 'instructor' | 'venue') {
  const counts = new Map<string, number>()
  sessions.forEach(session => counts.set(session[field], (counts.get(session[field]) ?? 0) + 1))
  return [...counts].sort((a, b) => b[1] - a[1])
}

export default function TrainingJourney({ sessions, ranks }: { sessions: Session[]; ranks: RankPromotion[] }) {
  const [metric, setMetric] = useState<'hours' | 'sessions'>('hours')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const data = useMemo(() => buildTrainingJourney(sessions, ranks, metric), [sessions, ranks, metric])
  const selected = data.find(month => month.key === selectedKey) ?? data.findLast(month => month.records.length) ?? data.at(-1)
  const width = Math.max(900, data.length * 32 + 100), height = 290, left = 52, right = width - 55, top = 30, bottom = 226
  const monthlyMax = Math.max(1, ...data.map(month => month.total)), cumulativeMax = Math.max(1, data.at(-1)?.cumulative ?? 0)
  const slot = (right - left) / Math.max(1, data.length)
  const x = (index: number) => left + slot * (index + .5)
  const cumulativeY = (value: number) => bottom - value / cumulativeMax * (bottom - top)
  const line = data.map((month, index) => `${index ? 'L' : 'M'} ${x(index)} ${cumulativeY(month.cumulative)}`).join(' ')
  const hours = (selected?.records.reduce((sum, session) => sum + session.duration, 0) ?? 0) / 60
  const activeDays = new Set(selected?.records.map(session => session.date.toDateString())).size
  const estimatedStyles = sessions.filter(session => session.styleEstimated).length
  const estimatedDurations = sessions.filter(session => session.durationEstimated).length
  const legacyMetadata = sessions.some(session => session.timeRecorded === undefined || session.durationEstimated === undefined)

  return <ChartFrame title="Time on the mat"><section className="panel journey-panel">
    <div className="panel-heading"><div><h2>Time on the mat</h2><p>See how each month builds your complete training journey.</p><p className="chart-explanation">Stacked bars show monthly {metric} by style (left axis). The gold line tracks your running total (right axis); each diamond marks a month with rank records. Select a month to explore exact promotion dates.</p><p className="journey-data-note">Hours weights the style split by duration; Sessions weights every session equally. Dates use the browser’s local calendar. {estimatedStyles > 0 && `${estimatedStyles} unlabeled sessions have estimated styles, allocated using the full-history known Gi/No-Gi session ratio. `}{estimatedDurations > 0 && `${estimatedDurations} sessions have no recorded duration and use the app’s 60-minute estimate. `}{legacyMetadata && 'Reimport your CSV to identify missing durations and training times in older saved records.'}</p></div><span className="chart-type-label">FULL HISTORY</span></div>
    <div className="journey-toolbar"><div className="rank-color-controls" role="group" aria-label="Journey measurement">{(['hours', 'sessions'] as const).map(value => <button key={value} className={metric === value ? 'active' : ''} aria-pressed={metric === value} onClick={() => setMetric(value)}>{value === 'hours' ? 'Hours' : 'Sessions'}</button>)}</div><div className="chart-legend">{styles.map(style => <span key={style}><i className="legend-swatch" style={{ background: colors[style] }} />{style === 'NoGi' ? 'No-Gi' : style}</span>)}<span><i className="legend-swatch" style={{ background: '#b88716' }} />Cumulative</span><span>◇ Rank milestone</span></div></div>
    {data.length ? <div className="journey-scroll"><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Monthly and cumulative training ${metric}`}>
      <text x={left} y={16} fontSize={11} fill="#71717a">Monthly {metric}</text><text x={right} y={16} textAnchor="end" fontSize={11} fill="#926a0d">Total {metric}</text>
      {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1={left} x2={right} y1={bottom - fraction * (bottom - top)} y2={bottom - fraction * (bottom - top)} stroke="#e7e7e7" strokeDasharray="3 5" /><text x={left - 8} y={bottom - fraction * (bottom - top) + 4} textAnchor="end" fontSize={10} fill="#71717a">{number(monthlyMax * fraction)}</text><text x={right + 8} y={bottom - fraction * (bottom - top) + 4} fontSize={10} fill="#926a0d">{number(cumulativeMax * fraction)}</text></g>)}
      {data.map((month, index) => {
        let base = bottom
        const select = () => setSelectedKey(month.key)
        return <g key={month.key} tabIndex={0} role="button" aria-label={`${monthLabel(month.date)}: ${number(month.total)} ${metric}, ${month.records.length} sessions, ${month.ranks.length} rank milestones`} aria-pressed={selected?.key === month.key} onMouseEnter={select} onFocus={select} onClick={select} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() } }} className="journey-month">
          <rect x={left + index * slot} y={top} width={slot} height={bottom - top} fill={selected?.key === month.key ? '#f1f1f1' : 'transparent'} />
          {month.values.map((value, styleIndex) => { const barHeight = value / monthlyMax * (bottom - top); base -= barHeight; return <rect key={styles[styleIndex]} x={x(index) - slot * .3} y={base} width={slot * .6} height={barHeight} fill={colors[styles[styleIndex]]} /> })}
          {(data.length < 20 || index % 3 === 0) && <text x={x(index)} y={247} textAnchor="middle" fontSize={10} fill="#71717a">{month.date.toLocaleDateString('en-GB', { month: 'short' })}</text>}
          {(index === 0 || month.date.getMonth() === 0) && <text x={x(index)} y={269} textAnchor="middle" fontSize={12} fontWeight={650} fill="#3f3f46">{month.date.getFullYear()}</text>}
          <title>{`${monthLabel(month.date)}: ${number(month.total)} ${metric}; running total ${number(month.cumulative)} ${metric}`}</title>
        </g>
      })}
      <path d={line} fill="none" stroke="#b88716" strokeWidth={2.5} pointerEvents="none" />
      {data.map((month, index) => <circle key={`total-${month.key}`} cx={x(index)} cy={cumulativeY(month.cumulative)} r={selected?.key === month.key ? 4 : 2} fill="#b88716" pointerEvents="none" />)}
      {data.map((month, index) => month.ranks.length > 0 && <path key={month.key} d={`M ${x(index)} ${cumulativeY(month.cumulative) - 6} l 6 6 l -6 6 l -6 -6 Z`} fill={describeRank(month.ranks[month.ranks.length - 1]).color} stroke="#926a0d" strokeWidth={2} pointerEvents="none" />)}
    </svg></div> : <p className="timeline-empty">Import your CSV to explore your journey.</p>}
    {selected && <div className="journey-detail" aria-live="polite"><div className="journey-detail-heading"><strong>{monthLabel(selected.date)}</strong><span>{selected.records.length} sessions · {number(hours)} hours · {activeDays} training days · {number(selected.cumulative)} {metric} to date</span></div><div className="journey-breakdowns">{(['classType', 'instructor', 'venue'] as const).map((field, index) => <div key={field}><h3>{['Classes', 'Coaches', 'Venues'][index]}</h3>{breakdown(selected.records, field).map(([name, count]) => <p key={name}><span>{name}</span><strong>{count}</strong></p>)}{!selected.records.length && <p>No sessions recorded</p>}</div>)}<div><h3>Training times</h3>{['Morning', 'Afternoon', 'Evening'].map((label, index) => <p key={label}><span>{label} {['(before 12)', '(12–17)', '(17 onwards)'][index]}</span><strong>{selected.records.filter(sessionHasRecordedTime).filter(session => index === 0 ? session.date.getHours() < 12 : index === 1 ? session.date.getHours() >= 12 && session.date.getHours() < 17 : session.date.getHours() >= 17).length}</strong></p>)}<p><span>Time not recorded / unverified</span><strong>{selected.records.filter(session => !sessionHasRecordedTime(session)).length}</strong></p></div></div>{selected.ranks.length > 0 && <div className="journey-promotions">{selected.ranks.map(rank => <div key={rank.id}><time>{rank.date.toLocaleDateString('en-GB')}</time><RankBadge rank={rank} /><span>{rank.discipline}{rank.status ? ` · ${rank.status}` : ''}</span></div>)}</div>}{selected.records.some(session => session.styleEstimated) && <p className="journey-data-note">Some training styles in this month were estimated from the imported history.</p>}</div>}
    <div className="history-summary"><span>{sessions.length} sessions · {number(sessions.reduce((sum, session) => sum + session.duration, 0) / 60)} hours across {data.length} months</span><span>Entire imported history · months without records show zero logged training</span></div>
  </section></ChartFrame>
}
