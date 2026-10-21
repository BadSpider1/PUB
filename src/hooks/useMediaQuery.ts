import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Matches Tailwind's `md` breakpoint – sidebar + tables instead of bottom nav + lists. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}
