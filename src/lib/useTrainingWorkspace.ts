import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../components/AccountContext'
import { auth } from './firebase'
import { authError } from './authErrors'
import { loadCsvImport, removeCsvImport, saveCsvImport, type CsvImport } from './importStorage'
import { loadManualSessions, saveManualSessions, type ManualSession } from './manualStorage'
import { canonical, importChanges, manualChanges, workspaceFromRecords, type Change, type CloudRecords } from './cloudModel'
import { commitChanges, loadCloudCache, saveCloudCache, saveProfile, subscribeRecords } from './cloudStorage'

const guestSignature = () => canonical({ csv: loadCsvImport(), manual: loadManualSessions().sessions })
const guestImportKey = (uid: string) => 'matmetrics-guest-import-v1-' + uid

export function useTrainingWorkspace() {
  const { user } = useAccount()
  const uid = user?.emailVerified ? user.uid : null
  const [csvImport, setCsvImport] = useState<CsvImport | null>(() => uid ? null : loadCsvImport())
  const [manualData, setManualData] = useState(() => uid ? { sessions: [], error: '', initialized: true } : loadManualSessions())
  const [ready, setReady] = useState(!uid)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cacheWarning, setCacheWarning] = useState('')
  const [status, setStatus] = useState(uid ? 'Loading account…' : 'Saved in this browser')
  const [retry, setRetry] = useState(0)
  const [hasGuestData, setHasGuestData] = useState(() => {
    if (!loadCsvImport() && !loadManualSessions().sessions.length) return false
    try { return !uid || localStorage.getItem(guestImportKey(uid)) !== guestSignature() } catch { return true }
  })
  const records = useRef<CloudRecords>({})
  const busyRef = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!uid || !user) return
    setReady(false); setError(''); setStatus('Loading account…')
    const cached = loadCloudCache(uid)
    records.current = cached
    let active = true
    const stop = subscribeRecords(uid, cached, (next, fromCache) => {
      if (!active) return
      records.current = next
      const workspace = workspaceFromRecords(next)
      setCsvImport(workspace.csvImport); setManualData(workspace.manualData)
      if (!fromCache) {
        setReady(true)
        if (!saveCloudCache(uid, next)) setCacheWarning('Cloud data is saved, but browser caching is unavailable. Reloading may download your full history again.')
        if (!busyRef.current) setStatus('Saved to account')
      } else if (!busyRef.current) setStatus('Connecting to cloud…')
    }, cause => { if (active) { setError(authError(cause)); setReady(false); setStatus('Couldn’t connect') } })
    void saveProfile(user).catch(cause => { if (active) setError(authError(cause)) })
    return () => { active = false; stop() }
  }, [uid, retry])
  useEffect(() => {
    if (!uid) return
    const update = () => setStatus(navigator.onLine ? ready ? 'Saved to account' : 'Connecting to cloud…' : 'Offline · reconnect to save')
    window.addEventListener('offline', update); window.addEventListener('online', update)
    return () => { window.removeEventListener('offline', update); window.removeEventListener('online', update) }
  }, [uid, ready])
  const write = async (changes: Change[]): Promise<boolean> => {
    if (!uid || !ready || busyRef.current) return false
    if (!navigator.onLine) { setError('You’re offline. Reconnect before saving to your account. Your form has been kept.'); return false }
    busyRef.current = true; setBusy(true); setError(''); setStatus('Saving…')
    try {
      await commitChanges(uid, changes)
      if (alive.current) setStatus('Saved to account')
      return true
    } catch (cause) {
      if (alive.current) { setError(authError(cause)); setStatus('Couldn’t save') }
      return false
    } finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  const updateManual = async (next: ManualSession[]) => {
    if (uid) return write(manualChanges(manualData.sessions, next, records.current))
    if (manualData.error) return false
    if (!saveManualSessions(next)) { setError('Browser storage is full or unavailable. Your training was not saved.'); return false }
    setManualData({ sessions: next, initialized: true, error: '' }); setHasGuestData(next.length > 0 || !!csvImport); setError('')
    return true
  }
  const deleteManual = async (row: ManualSession) => {
    if (!uid) return updateManual(manualData.sessions.filter(item => item.id !== row.id))
    const existing = row.cloudId ? records.current[row.cloudId] : null
    if (!existing || !row.cloudId) { setError('This session is no longer available.'); return false }
    return write([{ id: row.cloudId, kind: 'manual', data: existing.data, fileName: '', deleted: true, expectedRevision: row.cloudRevision ?? existing.revision }])
  }
  const importCsv = async (next: CsvImport) => {
    if (uid) return write(await importChanges(next, [], records.current, true))
    if (!saveCsvImport(next)) { setError('Browser storage is full or unavailable. Your CSV was not saved.'); return false }
    setCsvImport(next); setHasGuestData(true); setError(''); return true
  }
  const removeImport = async () => {
    if (user || auth.currentUser) return false
    if (!removeCsvImport()) { setError('The saved CSV could not be removed. Allow browser storage access and try again.'); return false }
    setCsvImport(null); setHasGuestData(manualData.sessions.length > 0); setError(''); return true
  }
  const importGuest = async () => {
    const guestManual = loadManualSessions()
    if (guestManual.error) { setError(guestManual.error); return }
    const changes = await importChanges(loadCsvImport(), guestManual.sessions, records.current)
    if (await write(changes)) {
      setHasGuestData(false)
      if (uid) try { localStorage.setItem(guestImportKey(uid), guestSignature()) } catch { /* Import succeeded; only the local reminder is unavailable. */ }
    }
  }
  return { csvImport, manualData, updateManual, deleteManual, importCsv, removeImport, importGuest, hasGuestData, dismissGuest: () => setHasGuestData(false), cloud: !!uid, ready, busy, error, cacheWarning, status, retry: () => setRetry(n => n + 1) }
}
