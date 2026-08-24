import { useEffect, useState } from 'react'

// Manual light/dark override (G411-73), layered on top of G411-17's
// existing @media (prefers-color-scheme: dark) tokens in index.css.
// Three states, cycling: 'system' (follows OS, the original behavior,
// default) -> 'light' -> 'dark' -> back to 'system'. Persisted so a
// friend's choice survives a reload.
const STORAGE_KEY = 'gavi411-theme'
const ORDER = ['system', 'light', 'dark']

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return ORDER.includes(stored) ? stored : 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
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
