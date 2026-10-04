import { bjjRankHistory, describeRank, type RankPromotion } from '../lib/rankHistory'

export function RankBadge({ rank, promotion = false }: { rank: RankPromotion | null; promotion?: boolean }) {
  if (!rank) return <span className="rank-context-unknown">Rank not recorded yet</span>
  const { label, color } = describeRank(rank)
  return <span className={`rank-context-badge ${promotion ? 'rank-context-promotion' : ''}`}>
    <span className="rank-context-belt" style={{ background: color }} aria-hidden="true"><span>{Array.from({ length: Math.min(rank.stripes ?? 0, 4) }, (_, i) => <i key={i} />)}</span></span>
    <span>{promotion ? 'Promotion: ' : ''}{label}</span>
  </span>
}

export function RankColorControls({ belt, onChange }: { belt: boolean; onChange: (belt: boolean) => void }) {
  return <div className="rank-color-controls" role="group" aria-label="Color points by"><span>Color by</span><button aria-pressed={!belt} className={!belt ? 'active' : ''} onClick={() => onChange(false)}>Style</button><button aria-pressed={belt} className={belt ? 'active' : ''} onClick={() => onChange(true)}>Belt</button></div>
}

export function RankColorLegend({ history }: { history: RankPromotion[] }) {
  const belts = new Map(history.map(rank => { const item = describeRank(rank); return [item.color, item.label.split(' · ')[0]] }))
  return <div className="rank-color-legend">{[...belts].map(([color, name]) => <span key={color}><i style={{ background: color }} />{name}</span>)}<span><i style={{ background: '#a1a1aa' }} />Rank not recorded</span><small>Stripes appear in session details.</small></div>
}

export function PromotionSummary({ ranks, year }: { ranks: RankPromotion[]; year: number }) {
  const records = bjjRankHistory(ranks).filter(rank => rank.date.getFullYear() === year)
  if (!records.length) return null
  return <div className="rank-monthly-summary"><span>Rank milestones in {year}</span>{records.map(rank => <div key={rank.id}><time>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(rank.date)}</time><RankBadge rank={rank} /></div>)}</div>
}
