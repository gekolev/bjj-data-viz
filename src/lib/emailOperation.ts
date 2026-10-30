type Operation = { digest: string; key: string; createdAt: number }
const storageKey = 'matmetrics-email-operation-v1'
const lifetime = 24 * 60 * 60_000
let pending: Operation | null = null

/** Persist only a digest and random ID, never the recipient or image payload. */
export async function emailOperation(body: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
  if (!pending) {
    try { pending = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') } catch { /* Memory fallback. */ }
  }
  if (!pending || pending.digest !== digest || !/^[0-9a-f-]{36}$/i.test(pending.key)
    || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt >= lifetime || pending.createdAt > Date.now()) {
    pending = { digest, key: crypto.randomUUID(), createdAt: Date.now() }
  }
  try { sessionStorage.setItem(storageKey, JSON.stringify(pending)) } catch { /* Memory fallback. */ }
  return pending.key
}

export function completeEmailOperation(key: string) {
  if (pending?.key !== key) return
  pending = null
  try { sessionStorage.removeItem(storageKey) } catch { /* Memory fallback. */ }
}
