type TrainingRecord = {
  id: number
  date: Date
  style: 'Gi' | 'NoGi' | 'Other'
  styleEstimated?: boolean
}

/** Use the full source dataset, so filtering never changes an estimated style. */
export function allocateTrainingStyles<T extends TrainingRecord>(records: T[]) {
  const gi = records.filter(record => record.style === 'Gi').length
  const noGi = records.filter(record => record.style === 'NoGi').length
  const unknown = records.filter(record => record.style === 'Other')
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id)
  const known = gi + noGi
  if (!known || !unknown.length) return { sessions: records, estimatedCount: 0, unknownCount: unknown.length, giShare: known ? gi / known : null }

  const giShare = gi / known
  const assignments = new Map<T, 'Gi' | 'NoGi'>()
  // Cumulative rounding spreads the allocation through time, with exact total conservation.
  unknown.forEach((record, index) => {
    const style = Math.round((index + 1) * giShare) > Math.round(index * giShare) ? 'Gi' : 'NoGi'
    assignments.set(record, style)
  })
  const sessions = records.map(record => {
    const style = assignments.get(record)
    return style ? { ...record, style, styleEstimated: true } : record
  })
  return { sessions, estimatedCount: unknown.length, unknownCount: 0, giShare }
}
