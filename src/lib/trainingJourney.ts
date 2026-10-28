import type { RankPromotion } from './rankHistory'

export type JourneySession = { id: number; date: Date; duration: number; style: 'Gi' | 'NoGi' | 'Other'; styleEstimated?: boolean; durationEstimated?: boolean; timeRecorded?: boolean; classType: string; instructor: string; venue: string }
export const journeyStyles = ['Gi', 'NoGi', 'Other'] as const
export const journeyMonthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`

/** Older imports retain the time in Date, but predate the explicit metadata flag. */
export function sessionHasRecordedTime(session: Pick<JourneySession, 'date' | 'timeRecorded'>) {
  if (session.timeRecorded !== undefined) return session.timeRecorded
  // A non-midnight timestamp proves a recorded time. Legacy midnight remains ambiguous.
  return session.date.getHours() !== 0 || session.date.getMinutes() !== 0 || session.date.getSeconds() !== 0 || session.date.getMilliseconds() !== 0
}

const classStartTimes = [
  { minutes: 450, label: '07:30' },
  { minutes: 540, label: '09:00' },
  { minutes: 720, label: '12:00' },
  { minutes: 1080, label: '18:00' },
  { minutes: 1150, label: '19:10' },
] as const

function nearestClassStart(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  // Prefer the upcoming class if a check-in is equally close to two starts.
  return classStartTimes.reduce((best, slot) =>
    Math.abs(slot.minutes - minutes) <= Math.abs(best.minutes - minutes) ? slot : best)
}

/** Signed mean: negative means early, positive means late; unknown times are excluded. */
export function buildArrivalSummary(sessions: Pick<JourneySession, 'date' | 'timeRecorded'>[]) {
  let totalMinutes = 0, recorded = 0
  sessions.forEach(session => {
    if (!sessionHasRecordedTime(session)) return
    const start = nearestClassStart(session.date)
    totalMinutes += session.date.getHours() * 60 + session.date.getMinutes() - start.minutes
    recorded++
  })
  return { averageMinutes: recorded ? totalMinutes / recorded : null, recorded, unknown: sessions.length - recorded }
}

/** Map local check-in timestamps to the nearest supplied class start time. */
export function buildTrainingTimeDistribution(sessions: Pick<JourneySession, 'date' | 'timeRecorded'>[]) {
  const bins = classStartTimes.map(slot => ({ label: slot.label, sessions: 0 }))
  let unknown = 0
  sessions.forEach(session => {
    if (!sessionHasRecordedTime(session)) { unknown++; return }
    const nearest = classStartTimes.indexOf(nearestClassStart(session.date))
    bins[nearest].sessions++
  })
  return { bins, unknown, recorded: sessions.length - unknown }
}

/** Calendar months use the same local dates as the imported attendance records. */
export function buildTrainingJourney(sessions: JourneySession[], ranks: RankPromotion[], metric: 'hours' | 'sessions') {
  const dates = [...sessions.map(session => session.date), ...ranks.map(rank => rank.date)].sort((a, b) => a.getTime() - b.getTime())
  if (!dates.length) return []
  const grouped = new Map<string, JourneySession[]>()
  sessions.forEach(session => { const key = journeyMonthKey(session.date); const group = grouped.get(key) ?? []; group.push(session); grouped.set(key, group) })
  const promotions = new Map<string, RankPromotion[]>()
  ranks.forEach(rank => { const key = journeyMonthKey(rank.date); const group = promotions.get(key) ?? []; group.push(rank); promotions.set(key, group) })
  const first = dates[0], last = dates[dates.length - 1]
  const count = (last.getFullYear() - first.getFullYear()) * 12 + last.getMonth() - first.getMonth() + 1
  let cumulativeUnits = 0
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth() + index, 1)
    const key = journeyMonthKey(date), records = grouped.get(key) ?? []
    // Sum minutes before converting to hours; session mode gives each record equal weight.
    const units = journeyStyles.map(style => records.filter(session => session.style === style).reduce((sum, session) => sum + (metric === 'hours' ? session.duration : 1), 0))
    const totalUnits = units.reduce((sum, value) => sum + value, 0)
    cumulativeUnits += totalUnits
    const divisor = metric === 'hours' ? 60 : 1
    return { date, key, records, values: units.map(value => value / divisor), total: totalUnits / divisor, cumulative: cumulativeUnits / divisor, ranks: [...(promotions.get(key) ?? [])].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id) }
  })
}
