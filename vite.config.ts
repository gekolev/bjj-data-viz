import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')
    if (!env.VITE_FIREBASE_API_KEY?.trim() || env.VITE_FIREBASE_API_KEY === 'your_firebase_browser_api_key') {
      throw new Error('Set VITE_FIREBASE_API_KEY in .env.local or Cloudflare build variables before building. Worker runtime secrets are not frontend build variables.')
    }
  }
  return { plugins: [react()] }
})
