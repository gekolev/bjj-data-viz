export type RankPromotion = {
  id: number
  date: Date
  rank: string
  stripes: number | null
  discipline: string
  status: string
  details: string
}

const rankCodePattern = /\b(W|B|P|BR|BK|BL|BLACK|BROWN)-(\d+)\b/i
const dayNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

export function normalizeRankHistory(ranks: RankPromotion[]): RankPromotion[] {
  const unique = new Map<string, RankPromotion>()
  ranks.forEach(original => {
    const match = original.rank.match(rankCodePattern)
    const rank = match ? `${match[1].toUpperCase()}-${match[2]}` : original.rank
    let rawCells = ''
    try { rawCells = JSON.parse(original.details).cells?.join(' ') ?? '' } catch { /* Raw details are optional. */ }
    const disciplineText = [original.discipline, original.rank, rawCells].join(' ')
    const discipline = /\bBJJ\b|Brazilian Jiu[- ]?Jitsu/i.test(disciplineText) ? 'BJJ' : original.discipline
    const status = original.status || rawCells.match(/\b(Promoted|Demoted|Assigned|Awarded)\b/i)?.[1] || ''
    const stripes = original.stripes ?? (match ? Number(match[2]) : null)
    const record = { ...original, rank, stripes, discipline, status }
    unique.set(JSON.stringify([dayNumber(record.date), rank, stripes, discipline]), record)
  })
  return [...unique.values()].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id)
}

export function bjjRankHistory(ranks: RankPromotion[]): RankPromotion[] {
  return normalizeRankHistory(ranks).filter(rank => rank.discipline === 'BJJ' || (!rank.discipline && rankCodePattern.test(rank.rank)))
}

/** A promotion applies from its calendar day; earlier sessions remain unknown. */
export function rankAtDate(date: Date, history: RankPromotion[]): RankPromotion | null {
  let current: RankPromotion | null = null
  const day = dayNumber(date)
  for (const rank of history) {
    if (dayNumber(rank.date) <= day && (!current || dayNumber(rank.date) >= dayNumber(current.date))) current = rank
  }
  return current
}

export function promotionsOnDate(date: Date, history: RankPromotion[]): RankPromotion[] {
  return history.filter(rank => dayNumber(rank.date) === dayNumber(date))
}

export function parseRankDate(value: string): Date | null {
  const dmy = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/)
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dmy || iso) {
    const year = Number(dmy ? dmy[3] : iso![1])
    const month = Number(dmy ? dmy[2] : iso![2]) - 1
    const day = Number(dmy ? dmy[1] : iso![3])
    const date = new Date(year, month, day)
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null
  }
  // Only accept named-month dates; ambiguous numeric dates must not be guessed.
  if (!/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i.test(value)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function ranksFromCsvRows(rows: Record<string, string>[]): { ranks: RankPromotion[]; skipped: number } {
  const unique = new Map<string, RankPromotion>()
  let skipped = 0
  rows.forEach((original, id) => {
    const row = Object.fromEntries(Object.entries(original).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? '').trim()]))
    if (row['record type']?.toLowerCase() !== 'rank') return
    const date = parseRankDate(row['promotion date'] ?? '')
    const rank = row.rank ?? ''
    if (!date || !rank) { skipped++; return }
    const stripeText = row.stripes || rank.match(/-(\d+)\b/)?.[1] || rank.match(/(\d+)\s*stripes?/i)?.[1] || ''
    const stripes = /^\d+$/.test(stripeText) ? Number(stripeText) : null
    const record = { id, date, rank, stripes, discipline: row.discipline ?? '', status: row['rank status'] ?? '', details: row['rank details'] ?? '' }
    unique.set(JSON.stringify([date.getTime(), rank, stripes, record.discipline]), record)
  })
  return { ranks: normalizeRankHistory([...unique.values()]), skipped }
}

export function describeRank(rank: RankPromotion): { label: string; color: string } {
  const code = rank.rank.match(rankCodePattern)?.[1].toUpperCase()
  const belts: Record<string, [string, string]> = {
    W: ['White', '#f4f3ed'], B: ['Blue', '#497ec6'], P: ['Purple', '#9670bd'],
    BR: ['Brown', '#936c4e'], BROWN: ['Brown', '#936c4e'], BK: ['Black', '#262b31'], BL: ['Black', '#262b31'], BLACK: ['Black', '#262b31'],
  }
  const belt = code ? belts[code] : undefined
  const stripes = rank.stripes === null ? '' : ` · ${rank.stripes} ${rank.stripes === 1 ? 'stripe' : 'stripes'}`
  return { label: belt ? `${belt[0]} belt${stripes}` : `${rank.rank}${stripes}`, color: belt?.[1] ?? '#91a66d' }
}
