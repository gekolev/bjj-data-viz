import { loadCsvImport, type CsvImport, type ImportedSession } from './importStorage'
import { loadManualSessions, type ManualSession } from './manualStorage'
import type { RankPromotion } from './rankHistory'

export type RecordKind = 'imported' | 'manual' | 'rank'
export type CloudRecord = { kind: RecordKind; data: Record<string, unknown>; revision: number; deleted: boolean; fileName: string; updatedAt: { seconds: number; nanoseconds: number } }
export type CloudRecords = Record<string, CloudRecord>
export type Change = { id: string; kind: RecordKind; data: Record<string, unknown>; fileName: string; deleted: boolean; expectedRevision: number; onlyIfMissing?: boolean }
export type Workspace = { csvImport: CsvImport | null; manualData: ReturnType<typeof loadManualSessions> }

export function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => JSON.stringify(key) + ':' + canonical(v)).join(',') + '}'
  return JSON.stringify(value)
}
export function serializeRecord(row: ImportedSession | RankPromotion): Record<string, unknown> {
  const { cloudId: _cloudId, cloudRevision: _cloudRevision, ...data } = row
  return JSON.parse(JSON.stringify(data))
}
export async function contentId(kind: RecordKind, row: ImportedSession | RankPromotion): Promise<string> {
  const { id: _id, cloudId: _cloudId, cloudRevision: _cloudRevision, ...data } = row
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(data)))
  return kind + '-' + [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export function decodeRecord(value: unknown): CloudRecord {
  const r = value as CloudRecord
  if (!r || !['manual', 'imported', 'rank'].includes(r.kind) || !Number.isInteger(r.revision) || r.revision < 1 || typeof r.deleted !== 'boolean' || typeof r.fileName !== 'string'
    || !Number.isInteger(r.updatedAt?.seconds) || !Number.isInteger(r.updatedAt?.nanoseconds) || !r.data) throw new Error('Invalid cloud record')
  // Reuse the browser-storage validators before rendering any remote data.
  const raw = JSON.stringify(r.kind === 'manual' ? { version: 1, sessions: [r.data] } : { version: 1, fileName: 'Cloud', sessions: r.kind === 'rank' ? [] : [r.data], ranks: r.kind === 'rank' ? [r.data] : [] })
  const storage = { getItem: () => raw, setItem: () => {}, removeItem: () => {} }
  if (r.kind === 'manual' ? !!loadManualSessions(storage).error : !loadCsvImport(storage)) throw new Error('Invalid cloud training data')
  return r
}
export function workspaceFromRecords(records: CloudRecords): Workspace {
  const sessions: ImportedSession[] = [], ranks: RankPromotion[] = [], manual: ManualSession[] = []
  for (const [cloudId, record] of Object.entries(records).sort(([a], [b]) => a.localeCompare(b))) {
    if (record.deleted) continue
    const data = { ...record.data, date: new Date(String(record.data.date)), cloudId, cloudRevision: record.revision }
    if (record.kind === 'manual') manual.push(data as ManualSession)
    else if (record.kind === 'rank') ranks.push({ ...data, id: ranks.length } as RankPromotion)
    else sessions.push({ ...data, id: sessions.length } as ImportedSession)
  }
  // Legacy numeric manual IDs can collide between devices. Give each cloud row a stable UI ID for this snapshot.
  const ids = new Set<number>()
  for (const row of manual) { while (ids.has(row.id)) row.id++; ids.add(row.id) }
  const names = [...new Set(Object.values(records).filter(r => !r.deleted && r.kind !== 'manual').map(r => r.fileName).filter(Boolean))]
  return { csvImport: sessions.length || ranks.length ? { fileName: names.length === 1 ? names[0] : 'Saved training', sessions, ranks } : null, manualData: { sessions: manual, initialized: true, error: '' } }
}
export function manualChanges(previous: ManualSession[], next: ManualSession[], records: CloudRecords): Change[] {
  const changes: Change[] = []
  const kept = new Set<string>()
  for (const row of next) {
    const cloudId = row.cloudId ?? previous.find(item => item.id === row.id)?.cloudId ?? 'manual-' + crypto.randomUUID()
    kept.add(cloudId)
    const data = serializeRecord(row)
    const existing = records[cloudId]
    // UI collision resolution must not rewrite the original stored numeric ID.
    if (existing) data.id = existing.data.id
    if (!existing || existing.deleted || canonical(existing.data) !== canonical(data)) changes.push({ id: cloudId, kind: 'manual', data, fileName: '', deleted: false, expectedRevision: row.cloudRevision ?? existing?.revision ?? 0 })
  }
  for (const row of previous) if (row.cloudId && !kept.has(row.cloudId)) {
    const existing = records[row.cloudId]
    changes.push({ id: row.cloudId, kind: 'manual', data: existing.data, fileName: '', deleted: true, expectedRevision: existing.revision })
  }
  return changes
}
export async function importChanges(csv: CsvImport | null, manual: ManualSession[], records: CloudRecords, restoreDeleted = false): Promise<Change[]> {
  const changes: Change[] = []
  const candidates: [RecordKind, (ImportedSession | RankPromotion)[], string][] = [['imported', csv?.sessions ?? [], csv?.fileName ?? ''], ['rank', csv?.ranks ?? [], csv?.fileName ?? ''], ['manual', manual, '']]
  const seen = new Set<string>()
  // Also recognize manual entries originally created with UUIDs on another device.
  for (const record of Object.values(records)) if (!record.deleted) seen.add(await contentId(record.kind, record.data as unknown as ImportedSession))
  for (const [kind, rows, fileName] of candidates) for (const row of rows) {
    const id = await contentId(kind, row)
    const existing = records[id]
    if (seen.has(id) || (existing && (!existing.deleted || !restoreDeleted))) continue
    seen.add(id)
    changes.push({ id, kind, data: serializeRecord(row), fileName, deleted: false, expectedRevision: existing?.revision ?? 0, onlyIfMissing: !existing })
  }
  return changes
}
