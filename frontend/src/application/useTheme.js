import { useEffect, useState } from 'react'

const STORAGE_KEY = 'audio-countdown-theme'
const THEMES = new Set(['system', 'light', 'dark'])

function initialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.has(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  }, [theme])

  return { theme, setTheme }
}
