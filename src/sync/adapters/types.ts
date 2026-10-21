import type { VaultFile } from '@/types/vault'

export interface RemoteVault {
  vault: VaultFile
  /** Opaque marker of the remote file version (mtime, Drive version…). */
  revision: string | null
}

/**
 * A place where `finance_vault.json` lives. The sync engine only needs these three
 * operations, which keeps each storage tier small and independently testable.
 */
export interface VaultAdapter {
  /** Cheap check used to detect changes made by other devices. `null` if the file does not exist. */
  getRevision(): Promise<string | null>
  /** Read and validate the vault. `null` if the file does not exist yet. */
  read(): Promise<RemoteVault | null>
  /** Create or overwrite the vault. Returns the new revision. */
  write(vault: VaultFile): Promise<string | null>
}
