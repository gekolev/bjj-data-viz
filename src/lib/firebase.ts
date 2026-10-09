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
