import type { RankPromotion } from './rankHistory'

export type ImportedSession = {
  id: number
  cloudId?: string
  cloudRevision?: number
  training: string
  date: Date
  duration: number
  style: 'Gi' | 'NoGi' | 'Other'
  classType: string
  venue: string
  instructor: string
  styleEstimated?: boolean
  durationEstimated?: boolean
  timeRecorded?: boolean
}
export type CsvImport = { fileName: string; sessions: ImportedSession[]; ranks?: RankPromotion[] }
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const IMPORT_STORAGE_KEY = 'matmetrics-imported-csv-v1'

export function loadCsvImport(storage?: BrowserStorage): CsvImport | null {
  try {
    const value = (storage ?? window.localStorage).getItem(IMPORT_STORAGE_KEY)
    if (!value) return null
    const saved = JSON.parse(value)
    if (saved.version !== 1 || typeof saved.fileName !== 'string' || !saved.fileName || !Array.isArray(saved.sessions) || (!saved.sessions.length && !saved.ranks?.length)) return null
    const sessions: ImportedSession[] = saved.sessions.map((row: Record<string, unknown>) => {
      if (!row || !Number.isInteger(row.id) || typeof row.date !== 'string' || typeof row.duration !== 'number' || !Number.isFinite(row.duration) || row.duration < 0
        || !['Gi', 'NoGi', 'Other'].includes(String(row.style))
        || !['training', 'classType', 'venue', 'instructor'].every(key => typeof row[key] === 'string')) throw new Error('Invalid saved session')
      const date = new Date(row.date)
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid saved date')
      return { ...row, date } as ImportedSession
    })
    if (saved.ranks !== undefined && !Array.isArray(saved.ranks)) return null
    const ranks: RankPromotion[] | undefined = saved.ranks?.map((row: Record<string, unknown>) => {
      if (!row || !Number.isInteger(row.id) || typeof row.date !== 'string' || !['rank', 'discipline', 'status', 'details'].every(key => typeof row[key] === 'string')
        || (row.stripes !== null && (!Number.isInteger(row.stripes) || Number(row.stripes) < 0))) throw new Error('Invalid saved rank')
      const date = new Date(row.date)
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid saved rank date')
      return { ...row, date } as RankPromotion
    })
    return { fileName: saved.fileName, sessions, ...(ranks ? { ranks } : {}) }
  } catch { return null }
}

export function saveCsvImport(data: CsvImport, storage?: BrowserStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(IMPORT_STORAGE_KEY, JSON.stringify({ version: 1, ...data }))
    return true
  } catch { return false }
}

export function removeCsvImport(storage?: BrowserStorage): boolean {
  try {
    (storage ?? window.localStorage).removeItem(IMPORT_STORAGE_KEY)
    return true
  } catch { return false }
}
