import { useEffect, useRef, useState } from 'react'
import { useAccount } from '../components/AccountContext'
import { auth } from './firebase'
import { authError } from './authErrors'
import { loadCsvImport, removeCsvImport, saveCsvImport, type CsvImport } from './importStorage'
import { loadManualSessions, saveManualSessions, type ManualSession } from './manualStorage'
import { canonical, deleteAllRecordChanges, importChanges, manualChanges, replaceCsvChanges, workspaceFromRecords, type Change, type CloudRecords } from './cloudModel'
import { commitChanges, createCloudCacheWriter, loadCloudCache, subscribeRecords } from './cloudStorage'

const guestSignature = () => canonical({ csv: loadCsvImport(), manual: loadManualSessions().sessions })
const guestImportKey = (uid: string) => 'matmetrics-guest-import-v1-' + uid

export function useTrainingWorkspace() {
  const { user } = useAccount()
  const uid = user?.emailVerified ? user.uid : null
  const [data, setData] = useState(() => uid ? workspaceFromRecords(loadCloudCache(uid)) : { csvImport: loadCsvImport(), manualData: loadManualSessions() })
  const { csvImport, manualData } = data
  const setCsvImport = (csvImport: CsvImport | null) => setData(previous => ({ ...previous, csvImport }))
  const setManualData = (manualData: typeof data.manualData) => setData(previous => ({ ...previous, manualData }))
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
  const fullResync = useRef(false)
  useEffect(() => {
    if (!uid) return
    setReady(false); setError(''); setStatus('Connecting to cloud…')
    const resetCache = fullResync.current
    const cached = resetCache ? {} : loadCloudCache(uid)
    fullResync.current = false
    records.current = cached
    setData(workspaceFromRecords(cached))
    let confirmed = cached
    let active = true
    let generation = 0
    let stop = () => {}
    let dirty = resetCache
    let needsRebase = false
    let hiddenAt: number | null = document.hidden ? Date.now() : null
    let offlineAt: number | null = navigator.onLine ? null : Date.now()
    let rebaseTimer: ReturnType<typeof setTimeout> | undefined
    const cache = createCloudCacheWriter(uid, failed => {
      if (active) setCacheWarning(failed ? 'Cloud data is saved, but browser caching is unavailable. Reloading may download your full history again.' : '')
    })
    const connect = (base: CloudRecords) => {
      const current = ++generation
      stop()
      setReady(false)
      setStatus('Connecting to cloud…')
      stop = subscribeRecords(uid, base, (next, fromCache, changed) => {
        if (!active || current !== generation) return
        records.current = next
        if (changed) {
          dirty = true
          setData(workspaceFromRecords(next))
        }
        if (!fromCache) {
          confirmed = next
          setReady(true); setError('')
          if (dirty) { cache.schedule(next); dirty = false }
          if (!busyRef.current) setStatus('Saved to account')
        } else {
          setReady(false)
          if (!busyRef.current) setStatus('Connecting to cloud…')
        }
      }, cause => {
        if (active && current === generation) { setError(authError(cause)); setReady(false); setStatus('Couldn’t connect') }
      })
    }
    // Rebase only after a long absence, never after every snapshot or write.
    const rebase = () => {
      if (!active || document.hidden || !navigator.onLine) return
      if (busyRef.current) { rebaseTimer = setTimeout(rebase, 1000); return }
      needsRebase = false
      cache.flush()
      // Never advance the cursor using unconfirmed SDK-cache data.
      records.current = confirmed
      setData(workspaceFromRecords(confirmed))
      connect(confirmed)
    }
    const requestRebase = () => { needsRebase = true; clearTimeout(rebaseTimer); rebase() }
    const visibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); cache.flush() }
      else { if (needsRebase || (hiddenAt !== null && Date.now() - hiddenAt >= 5 * 60_000)) requestRebase(); hiddenAt = null }
    }
    const offline = () => { offlineAt = Date.now(); setReady(false) }
    const online = () => {
      // Even a brief offline interval needs a fresh authoritative readiness signal.
      if (offlineAt !== null) requestRebase()
      offlineAt = null
    }
    connect(cached)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', cache.flush)
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      active = false; generation++; clearTimeout(rebaseTimer); stop(); cache.flush()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', cache.flush)
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
    }
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
    if (!changes.length) { setError(''); return true }
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
    if (uid) return write(await replaceCsvChanges(next, records.current))
    if (!saveCsvImport(next)) { setError('Browser storage is full or unavailable. Your CSV was not saved.'); return false }
    setCsvImport(next); setHasGuestData(true); setError(''); return true
  }
  const removeImport = async () => {
    if (user || auth.currentUser) return false
    if (!removeCsvImport()) { setError('The saved CSV could not be removed. Allow browser storage access and try again.'); return false }
    setCsvImport(null); setHasGuestData(manualData.sessions.length > 0); setError(''); return true
  }
  const deleteAllRecords = async () => {
    if (!uid || !ready || busyRef.current) return false
    return write(deleteAllRecordChanges(records.current))
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
  return { deleteAllRecords, csvImport, manualData, updateManual, deleteManual, importCsv, removeImport, importGuest, hasGuestData, dismissGuest: () => setHasGuestData(false), cloud: !!uid, ready, busy, error, cacheWarning, status, retry: () => { if (!busyRef.current) setRetry(n => n + 1) }, resync: () => { if (!busyRef.current) { fullResync.current = true; setRetry(n => n + 1) } } }
}
