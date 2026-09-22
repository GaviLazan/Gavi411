import { useEffect, useState } from 'react'

const STORAGE_KEY = 'gavi411-theme'
const ORDER = ['light', 'dark']

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return ORDER.includes(stored) ? stored : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    // Always set data-theme (light or dark), never remove it
    root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage unavailable (private mode, blocked) — theme still
      // applies for this page load, just won't persist. Not worth a UI
      // error for a cosmetic preference.
    }
  }, [theme])

  function cycleTheme() {
    setTheme((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])
  }

  return { theme, cycleTheme }
}
