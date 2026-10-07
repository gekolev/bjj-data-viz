function durationFrom(value: string) {
  const hours = value.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?(?=\b|\d)/i)
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?\b/i)
  if (hours || minutes) return { duration: Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0), durationEstimated: false }
  return { duration: 60, durationEstimated: true }
}

export function parseSession(training: string, dateText: string, id: number, durationText = '') {
  if (/-\s*\d+(?:\.\d+)?\s*[hm]/i.test(durationText || dateText) || /^-\d/.test(durationText.trim())) return null
  const namedDate = dateText.match(/([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s*[AP]M)?)?)/i)
  const numericDate = dateText.trim().match(/^(?:(\d{1,2})\/(\d{1,2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2}))(?:\s+(\d{1,2}):(\d{2})(?:\s*([AP]M))?)?(?=\s|$)/i)
  let date: Date
  if (numericDate) {
    const year = Number(numericDate[3] ?? numericDate[4]), month = Number(numericDate[2] ?? numericDate[5]) - 1, day = Number(numericDate[1] ?? numericDate[6])
    let hour = Number(numericDate[7] ?? 0)
    const minute = Number(numericDate[8] ?? 0), meridiem = numericDate[9]?.toUpperCase()
    if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return null
    if (meridiem) hour = hour % 12 + (meridiem === 'PM' ? 12 : 0)
    date = new Date(year, month, day, hour, minute)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  } else date = new Date(namedDate?.[1] ?? dateText)
  if (Number.isNaN(date.getTime())) return null
  if (namedDate) {
    const parts = namedDate[1].match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/)
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(parts![1].slice(0, 3).toLowerCase())
    if (date.getMonth() !== month || date.getDate() !== Number(parts![2]) || date.getFullYear() !== Number(parts![3])) return null
  }
  const timeRecorded = /\d{1,2}:\d{2}/.test(dateText)
  const [details, instructorText = ''] = training.split('|')
  const parts = details.replace(/\bno\s*-\s*gi\b/gi, 'NoGi').split('-').map(part => part.trim()).filter(Boolean)
  const classType = parts[0] ?? 'Training'
  const styleText = parts.find(part => /^(no\s*-?\s*gi|gi)$/i.test(part)) ?? ''
  const style: 'Gi' | 'NoGi' | 'Other' = /nogi|no\s*-?\s*gi/i.test(styleText) ? 'NoGi' : /^gi$/i.test(styleText) ? 'Gi' : 'Other'
  const venue = parts.slice(styleText ? parts.indexOf(styleText) + 1 : 1).join(' - ').trim() || 'Venue not listed'
  const instructor = instructorText.trim().replace(/\s*\([^)]*\)/, '') || 'Instructor not listed'
  const parsedDuration = /^\d+(?:\.\d+)?$/.test(durationText.trim()) ? { duration: Number(durationText), durationEstimated: false } : durationFrom(durationText || dateText)
  return { id, training: classType, date, ...parsedDuration, timeRecorded, style, classType, venue, instructor }
}
