import type { ImportedSession } from './importStorage'

export type ManualSession = ImportedSession & { notes: string; rounds?: number; effort?: string; focus?: string[] }
export const MANUAL_STORAGE_KEY = 'matmetrics-manual-sessions-v1'
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

export function loadManualSessions(storage?: BrowserStorage): { sessions: ManualSession[]; error: string; initialized: boolean } {
  try {
    const raw = (storage ?? window.localStorage).getItem(MANUAL_STORAGE_KEY)
    if (!raw) return { sessions: [], error: '', initialized: false }
    const saved = JSON.parse(raw)
    if (saved.version !== 1 || !Array.isArray(saved.sessions)) throw new Error('Invalid log')
    const sessions = saved.sessions.map((row: ManualSession & { date: string }) => {
      if (!row || !Number.isSafeInteger(row.id) || typeof row.date !== 'string' || !Number.isFinite(new Date(row.date).getTime())
        || !Number.isInteger(row.duration) || row.duration < 1 || row.duration > 1440
        || !['Gi', 'NoGi'].includes(row.style)
        || !['training', 'classType', 'venue', 'instructor', 'notes'].every(key => typeof (row as unknown as Record<string, unknown>)[key] === 'string')) throw new Error('Invalid session')
      if (row.rounds !== undefined && (!Number.isInteger(row.rounds) || row.rounds < 0 || row.rounds > 100)) throw new Error('Invalid rounds')
      if (row.effort !== undefined && !['', 'Light', 'Moderate', 'Hard'].includes(row.effort)) throw new Error('Invalid effort')
      if (row.focus !== undefined && (!Array.isArray(row.focus) || !row.focus.every(value => typeof value === 'string'))) throw new Error('Invalid focus')
      return { ...row, date: new Date(row.date) }
    })
    if (new Set(sessions.map((row: ManualSession) => row.id)).size !== sessions.length) throw new Error('Duplicate IDs')
    return { sessions, error: '', initialized: true }
  } catch { return { sessions: [], initialized: true, error: 'Your saved training log could not be read. No saved records have been overwritten. Check browser storage before logging another session.' } }
}

export function saveManualSessions(sessions: ManualSession[], storage?: BrowserStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(MANUAL_STORAGE_KEY, JSON.stringify({ version: 1, sessions }))
    return true
  } catch { return false }
}
