import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { auth, db } from './firebase'
import { decodeRecord, type Change, type CloudRecords } from './cloudModel'

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
  try { localStorage.setItem(cacheKey(uid), JSON.stringify({ version: 1, records })); return true } catch { return false }
}
export function subscribeRecords(uid: string, cached: CloudRecords, next: (records: CloudRecords, fromCache: boolean) => void, fail: (error: unknown) => void) {
  const timestamps = Object.values(cached).map(r => r.updatedAt).sort((a, b) => b.seconds - a.seconds || b.nanoseconds - a.nanoseconds)
  const records = collection(db, 'users', uid, 'records')
  // Inclusive cursor safely replays rows sharing the most recent commit timestamp.
  const source = timestamps.length ? query(records, where('updatedAt', '>=', new Timestamp(timestamps[0].seconds, timestamps[0].nanoseconds))) : records
  let merged = { ...cached }
  return onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
    try {
      if (snapshot.metadata.hasPendingWrites) return
      for (const change of snapshot.docChanges()) {
        // Soft deletion records stay in the query and carry deletion to other devices.
        if (change.type !== 'removed') merged[change.doc.id] = decodeRecord(change.doc.data())
      }
      next({ ...merged }, snapshot.metadata.fromCache)
    } catch (error) { fail(error) }
  }, fail)
}
export async function saveProfile(user: User) {
  await setDoc(doc(db, 'users', user.uid), { displayName: (user.displayName ?? '').slice(0, 80), updatedAt: serverTimestamp() }, { merge: true })
}
export async function commitChanges(uid: string, changes: Change[]) {
  // Keep each transaction well below Firestore's request-size limit.
  for (let offset = 0; offset < changes.length; offset += 100) {
    if (auth.currentUser?.uid !== uid || !auth.currentUser.emailVerified) throw new Error('Account changed during save')
    const group = changes.slice(offset, offset + 100)
    await runTransaction(db, async transaction => {
      const refs = group.map(change => doc(db, 'users', uid, 'records', change.id))
      const current = await Promise.all(refs.map(ref => transaction.get(ref)))
      // Firestore transactions require all reads before any writes.
      group.forEach((change, index) => {
        const snapshot = current[index]
        if (change.onlyIfMissing && snapshot.exists()) return
        const existing = snapshot.exists() ? decodeRecord(snapshot.data()) : null
        if ((existing?.revision ?? 0) !== change.expectedRevision) throw new Error('Conflict: this record changed on another device. Your change was not saved. Review the latest data and try again.')
        transaction.set(refs[index], { kind: change.kind, data: change.data, fileName: change.fileName, deleted: change.deleted, revision: change.expectedRevision + 1, updatedAt: serverTimestamp() })
      })
    })
  }
}
