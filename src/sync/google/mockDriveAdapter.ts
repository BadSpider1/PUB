import type { VaultFile } from '@/types/vault'
import type { VaultAdapter } from '../adapters/types'
import { parseVaultText, serializeVaultFile } from '../vaultFormat'

/**
 * Stand-in for Google Drive used when VITE_GOOGLE_CLIENT_ID is not configured.
 * Stores the vault in localStorage with artificial latency so the complete sync flow
 * (status changes, merge, conflict handling) can be tried without Google credentials.
 * Data stays in this browser – it is a demo, not a backup.
 */
const STORAGE_KEY = 'pfv-mock-drive:finance_vault.json'
const REVISION_KEY = 'pfv-mock-drive:revision'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createMockDriveAdapter(latencyMs = 350): VaultAdapter {
  return {
    async getRevision() {
      await delay(latencyMs / 3)
      return localStorage.getItem(STORAGE_KEY) === null ? null : localStorage.getItem(REVISION_KEY)
    },

    async read() {
      await delay(latencyMs)
      const text = localStorage.getItem(STORAGE_KEY)
      if (text === null) return null
      return { vault: parseVaultText(text), revision: localStorage.getItem(REVISION_KEY) }
    },

    async write(vault: VaultFile) {
      await delay(latencyMs)
      const revision = String(Number(localStorage.getItem(REVISION_KEY) ?? '0') + 1)
      localStorage.setItem(STORAGE_KEY, serializeVaultFile(vault))
      localStorage.setItem(REVISION_KEY, revision)
      return revision
    },
  }
}
