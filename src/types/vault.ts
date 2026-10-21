import type { Category, Tombstone, Transaction } from './finance'

export const VAULT_FILE_NAME = 'finance_vault.json'
export const VAULT_APP_ID = 'personal-finance-vault'
export const VAULT_SCHEMA_VERSION = 1

/**
 * Shape of `finance_vault.json` – the single, human-readable file that is written
 * to the local vault folder, to Google Drive and to manual backups.
 *
 * ```json
 * {
 *   "app": "personal-finance-vault",
 *   "schemaVersion": 1,
 *   "exportedAt": "2026-10-21T10:00:00.000Z",
 *   "data": { "categories": [...], "transactions": [...], "tombstones": [...] }
 * }
 * ```
 */
export interface VaultFile {
  app: typeof VAULT_APP_ID
  schemaVersion: typeof VAULT_SCHEMA_VERSION
  /** When this file was written. Informational only – merging uses per-record timestamps. */
  exportedAt: string
  data: {
    categories: Category[]
    transactions: Transaction[]
    tombstones: Tombstone[]
  }
}
