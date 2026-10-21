import { useEffect } from 'react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useMediaQuery } from './useMediaQuery'

export type ResolvedTheme = 'dark' | 'light'

const THEME_COLORS: Record<ResolvedTheme, string> = { dark: '#0d0d0d', light: '#f6f6f3' }

export function useResolvedTheme(): ResolvedTheme {
  const preference = useSettingsStore((s) => s.theme)
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

export function useIsDark(): boolean {
  return useResolvedTheme() === 'dark'
}

/** Keeps `html.dark` and the browser UI colour in sync with the chosen theme. */
export function useApplyTheme(): void {
  const theme = useResolvedTheme()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  }, [theme])
}
