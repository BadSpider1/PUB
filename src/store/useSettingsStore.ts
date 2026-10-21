import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'dark' | 'light' | 'system'

interface SettingsState {
  theme: ThemePreference
  currency: string
  setTheme: (theme: ThemePreference) => void
  setCurrency: (currency: string) => void
}

/** Device preferences (not synced). The persist key is also read by the inline script in index.html. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      currency: 'USD',
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
    }),
    { name: 'pfv-settings', version: 1 },
  ),
)
