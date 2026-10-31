import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Vite embeds this public browser key in the bundle; environment configuration
// keeps it out of committed source. Firestore rules protect user data.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'bjj-data-viz-fb.firebaseapp.com',
  projectId: 'bjj-data-viz-fb',
  storageBucket: 'bjj-data-viz-fb.firebasestorage.app',
  messagingSenderId: '522335453394',
  appId: '1:522335453394:web:b647efebca5ebfed5bed0b',
  measurementId: 'G-HVPBPWNFHH',
}

if (!firebaseConfig.apiKey) {
  throw new Error('Missing VITE_FIREBASE_API_KEY. Set it in .env.local or your hosting build environment, then restart or rebuild the app.')
}

// Reuse the default app during development hot reloads.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

// Never initialize the SDK on dev servers or locally previewed production builds.
const analyticsEnabled = () => import.meta.env.PROD && typeof window !== 'undefined'
  && !['localhost', '::1', '[::1]', '0.0.0.0'].includes(window.location.hostname)
  && !window.location.hostname.endsWith('.localhost')
  && !/^127\./.test(window.location.hostname)

// Share initialization so early events wait for Analytics to become available.
let analyticsReady: Promise<import('firebase/analytics').Analytics | null> | undefined
const analytics = () => analyticsReady ??= (async () => {
  if (!analyticsEnabled()) return null
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    return await isSupported() ? getAnalytics(firebaseApp) : null
  } catch {
    return null
  }
})()

export async function initializeAnalytics(): Promise<void> {
  const instance = await analytics()
  if (!instance) return
  try {
    const { logEvent } = await import('firebase/analytics')
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    logEvent(instance, 'client_context', {
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      pixel_ratio: Math.round(window.devicePixelRatio * 100) / 100,
      orientation: window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape',
      color_scheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      input_type: coarsePointer ? 'touch' : 'pointer',
      display_mode: standalone ? 'standalone' : 'browser',
    })
  } catch { /* Analytics must never interrupt app startup. */ }
}

/** Associate signed-in activity across devices without sending email or other PII. */
export function setAnalyticsUser(userId: string | null): void {
  if (!analyticsEnabled()) return
  void (async () => {
    try {
      const instance = await analytics()
      if (!instance) return
      const { setUserId, setUserProperties } = await import('firebase/analytics')
      setUserId(instance, userId)
      setUserProperties(instance, { account_state: userId ? 'signed_in' : 'guest' })
    } catch { /* Analytics must never interrupt authentication. */ }
  })()
}

/** Set low-cardinality product state only; never pass user-entered content. */
export function setAnalyticsUserProperties(properties: Record<string, string>): void {
  if (!analyticsEnabled()) return
  void (async () => {
    try {
      const instance = await analytics()
      if (!instance) return
      const { setUserProperties } = await import('firebase/analytics')
      setUserProperties(instance, properties)
    } catch { /* Analytics must never interrupt the app. */ }
  })()
}

/** Send only curated metadata; never pass user text, filenames, or CSV contents. */
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (!analyticsEnabled()) return
  void (async () => {
    try {
      const instance = await analytics()
      if (!instance) return
      const { logEvent } = await import('firebase/analytics')
      logEvent(instance, name, params)
    } catch { /* Analytics must never interrupt a user action. */ }
  })()
}
