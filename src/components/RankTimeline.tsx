import ChartFrame from './ChartFrame'
import { describeRank, type RankPromotion } from '../lib/rankHistory'

const dateLabel = (date: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const daysBetween = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)

export default function RankTimeline({ ranks }: { ranks: RankPromotion[] }) {
  const disciplines = [...new Set(ranks.map(rank => rank.discipline || 'Rank history'))]
  return <ChartFrame title="Belts & stripes"><section className="panel rank-timeline">
    <div className="panel-heading"><div><h2>Belts & stripes</h2><p>Your recorded rank milestones, in date order.</p></div><span className="chart-type-label">ALL TIME</span></div>
    {!ranks.length ? <p className="rank-empty">Import a CSV from the updated Gymdesk script to see when you received each belt or stripe.</p> : disciplines.map(discipline => {
      const records = ranks.filter(rank => (rank.discipline || 'Rank history') === discipline).sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id)
      return <div key={discipline} className="rank-discipline"><h3>{discipline}</h3><ol className="rank-milestones">{records.map((record, index) => {
        const { label, color } = describeRank(record)
        const previous = records[index - 1]
        const elapsed = previous ? daysBetween(previous.date, record.date) : null
        return <li key={record.id}>
          <div className="rank-belt" style={{ background: color }} aria-hidden="true"><span>{Array.from({ length: Math.min(record.stripes ?? 0, 4) }, (_, stripe) => <i key={stripe} />)}</span></div>
          <div className="rank-milestone-info"><time dateTime={dateKey(record.date)}>{dateLabel(record.date)}</time><h4>{label}</h4><p><code>{record.rank}</code>{record.status && <span>{record.status}</span>}</p>{elapsed !== null ? <small>{elapsed.toLocaleString()} {elapsed === 1 ? 'day' : 'days'} since the previous recorded rank</small> : <small>First recorded rank</small>}</div>
        </li>
      })}</ol></div>
    })}
    {ranks.length > 0 && <p className="rank-source-note">Uses dates recorded in Gymdesk. Time between milestones follows the imported history; missing promotions are not inferred.</p>}
  </section></ChartFrame>
}
