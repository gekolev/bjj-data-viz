export type TimeOfDay = '' | 'morning' | 'lunch' | 'afternoon' | 'evening' | 'night'
export type SessionFilters = { query: string; style: string; weekday: string; classType: string; timeOfDay: TimeOfDay; instructor: string; venue: string; year: string }
export const emptySessionFilters: SessionFilters = { query: '', style: '', weekday: '', classType: '', timeOfDay: '', instructor: '', venue: '', year: '' }

export function sessionTimeOfDay(date: Date): Exclude<TimeOfDay, ''> {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

export function filterSessions<T extends { date: Date; style: string; classType: string; instructor: string; venue: string }>(sessions: T[], filters: SessionFilters): T[] {
  const query = filters.query.trim().toLowerCase()
  return sessions.filter(session => (!filters.style || session.style === filters.style)
    && (!filters.weekday || session.date.getDay() === Number(filters.weekday))
    && (!filters.classType || session.classType === filters.classType)
    && (!filters.timeOfDay || sessionTimeOfDay(session.date) === filters.timeOfDay)
    && (!filters.instructor || session.instructor === filters.instructor)
    && (!filters.venue || session.venue === filters.venue)
    && (!filters.year || session.date.getFullYear() === Number(filters.year))
    && (!query || `${session.classType} ${session.instructor} ${session.venue} ${session.style}`.toLowerCase().includes(query)))
}
