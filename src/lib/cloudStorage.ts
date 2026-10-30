import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import { auth, db } from './firebase'
import { decodeRecord, type Change, type CloudRecords } from './cloudModel'

const diagnostics = { listenerStarts: 0, listenerStops: 0, serverSnapshots: 0, documentsDelivered: 0, transactionAttempts: 0, writesAttempted: 0, cacheWrites: 0 }
function count(key: keyof typeof diagnostics, amount = 1) {
  if (import.meta.env?.DEV) diagnostics[key] += amount
}
/** Local development counters only; contains no account IDs or training data. */
export const getCloudDiagnostics = () => ({ ...diagnostics })

const cacheKey = (uid: string) => 'matmetrics-account-v1-' + uid
export function loadCloudCache(uid: string): CloudRecords {
  try {
    const raw = localStorage.getItem(cacheKey(uid))
    if (!raw) return {}
    const saved = JSON.parse(raw)
    if (saved.version !== 1 || !saved.records || typeof saved.records !== 'object' || Array.isArray(saved.records)) return {}
    return Object.fromEntries(Object.entries(saved.records).map(([id, value]) => [id, decodeRecord(value)]))
  } catch { return {} }
}
export function saveCloudCache(uid: string, records: CloudRecords): boolean {
  count('cacheWrites')
  try { localStorage.setItem(cacheKey(uid), JSON.stringify({ version: 1, records })); return true } catch { return false }
}
export function subscribeRecords(uid: string, cached: CloudRecords, next: (records: CloudRecords, fromCache: boolean, changed: boolean) => void, fail: (error: unknown) => void) {
  const latest = Object.values(cached).reduce<CloudRecords[string]['updatedAt'] | null>((latest, record) => {
    const timestamp = record.updatedAt
    return !latest || timestamp.seconds > latest.seconds || (timestamp.seconds === latest.seconds && timestamp.nanoseconds > latest.nanoseconds) ? timestamp : latest
  }, null)
  const records = collection(db, 'users', uid, 'records')
  // Inclusive cursor safely replays rows sharing the most recent commit timestamp.
  const source = latest ? query(records, where('updatedAt', '>=', new Timestamp(latest.seconds, latest.nanoseconds))) : records
  let merged = { ...cached }
  count('listenerStarts')
  const stop = onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
    try {
      if (snapshot.metadata.hasPendingWrites) return
      const changes = snapshot.docChanges()
      if (!snapshot.metadata.fromCache) { count('serverSnapshots'); count('documentsDelivered', changes.length) }
      let changed = false
      for (const change of changes) {
        // Soft deletion records stay in the query and carry deletion to other devices.
        if (change.type === 'removed') continue
        const record = decodeRecord(change.doc.data())
        // A cached SDK snapshot must not roll back the durable account snapshot.
        if (record.revision <= (merged[change.doc.id]?.revision ?? 0)) continue
        if (!changed) merged = { ...merged }
        merged[change.doc.id] = record
        changed = true
      }
      next(merged, snapshot.metadata.fromCache, changed)
    } catch (error) { fail(error) }
  }, fail)
  let stopped = false
  return () => { if (!stopped) { stopped = true; count('listenerStops'); stop() } }
}
/** Coalesce import snapshots; the records and their timestamp cursor stay atomic. */
export function createCloudCacheWriter(uid: string, warning: (failed: boolean) => void) {
  let pending: CloudRecords | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer); timer = undefined
    if (!pending) return
    const next = pending
    pending = null
    warning(!saveCloudCache(uid, next))
  }
  return {
    schedule(records: CloudRecords) {
      pending = records
      // Do not reset the timer: continuous imports still flush every 250 ms.
      timer ??= setTimeout(flush, 250)
    },
    flush,
  }
}
export async function commitChanges(uid: string, changes: Change[]) {
  // Keep each transaction well below Firestore's request-size limit.
  for (let offset = 0; offset < changes.length; offset += 100) {
    if (auth.currentUser?.uid !== uid || !auth.currentUser.emailVerified) throw new Error('Account changed during save')
    const group = changes.slice(offset, offset + 100)
    await runTransaction(db, async transaction => {
      count('transactionAttempts')
      const refs = group.map(change => doc(db, 'users', uid, 'records', change.id))
      const current = await Promise.all(refs.map(ref => transaction.get(ref)))
      // Firestore transactions require all reads before any writes.
      group.forEach((change, index) => {
        const snapshot = current[index]
        if (change.onlyIfMissing && snapshot.exists()) return
        const existing = snapshot.exists() ? decodeRecord(snapshot.data()) : null
        if ((existing?.revision ?? 0) !== change.expectedRevision) throw new Error('Conflict: this record changed on another device. Your change was not saved. Review the latest data and try again.')
        count('writesAttempted')
        transaction.set(refs[index], { kind: change.kind, data: change.data, fileName: change.fileName, deleted: change.deleted, revision: change.expectedRevision + 1, updatedAt: serverTimestamp() })
      })
    })
  }
}
