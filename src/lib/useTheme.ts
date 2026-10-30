import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const storageKey = 'mat-metrics-theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      let saved: string | null = null
      try { saved = localStorage.getItem(storageKey) } catch { /* Storage may be disabled. */ }
      const next = saved === 'light' || saved === 'dark' ? saved : media.matches ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      setTheme(next)
    }
    media.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    sync()
    return () => {
      media.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Keep the toggle usable without storage. */ }
  }
  return { theme, toggleTheme }
}
