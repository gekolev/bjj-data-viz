export type ImportedSession = {
  id: number
  training: string
  date: Date
  duration: number
  style: 'Gi' | 'NoGi' | 'Other'
  classType: string
  venue: string
  instructor: string
  styleEstimated?: boolean
}
export type CsvImport = { fileName: string; sessions: ImportedSession[] }
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export const IMPORT_STORAGE_KEY = 'matmetrics-imported-csv-v1'

export function loadCsvImport(storage?: BrowserStorage): CsvImport | null {
  try {
    const value = (storage ?? window.localStorage).getItem(IMPORT_STORAGE_KEY)
    if (!value) return null
    const saved = JSON.parse(value)
    if (saved.version !== 1 || typeof saved.fileName !== 'string' || !saved.fileName || !Array.isArray(saved.sessions) || !saved.sessions.length) return null
    const sessions: ImportedSession[] = saved.sessions.map((row: Record<string, unknown>) => {
      if (!row || !Number.isInteger(row.id) || typeof row.date !== 'string' || typeof row.duration !== 'number' || !Number.isFinite(row.duration) || row.duration < 0
        || !['Gi', 'NoGi', 'Other'].includes(String(row.style))
        || !['training', 'classType', 'venue', 'instructor'].every(key => typeof row[key] === 'string')) throw new Error('Invalid saved session')
      const date = new Date(row.date)
      if (!Number.isFinite(date.getTime())) throw new Error('Invalid saved date')
      return { ...row, date } as ImportedSession
    })
    return { fileName: saved.fileName, sessions }
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
