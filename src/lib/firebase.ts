import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase web configuration is public. Firestore rules control access to user data.
const firebaseConfig = {
  apiKey: 'AIzaSyCPOwyZTtrwivrMN6yFyGFV_GbF0MJ1ZKg',
  authDomain: 'bjj-data-viz-fb.firebaseapp.com',
  projectId: 'bjj-data-viz-fb',
  storageBucket: 'bjj-data-viz-fb.firebasestorage.app',
  messagingSenderId: '522335453394',
  appId: '1:522335453394:web:b647efebca5ebfed5bed0b',
  measurementId: 'G-HVPBPWNFHH',
}

// Reuse the default app during development hot reloads.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
