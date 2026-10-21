import { VAULT_FILE_NAME, type VaultFile } from '@/types/vault'
import { SyncAuthError } from '../errors'
import { parseVaultText, serializeVaultFile } from '../vaultFormat'
import type { VaultAdapter } from './types'

/**
 * Tier 1 – File System Access API (Chrome/Edge/Opera on desktop, Chrome on Android).
 * The user picks a directory once (e.g. inside a local iCloud Drive, Dropbox or Google Drive
 * folder); the handle is stored in IndexedDB and `finance_vault.json` in it is kept in sync.
 */
export function isFolderSyncSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function' && window.isSecureContext
}

export function pickVaultDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('This browser cannot open local folders.')
  return window.showDirectoryPicker({ id: 'finance-vault', mode: 'readwrite', startIn: 'documents' })
}

/**
 * Check (and optionally request) read/write access. Browsers usually forget the grant when
 * the tab closes, so after a restart `request` must be called from a user gesture.
 */
export async function ensureFolderPermission(handle: FileSystemDirectoryHandle, request: boolean): Promise<boolean> {
  const descriptor = { mode: 'readwrite' } as const
  if ((await handle.queryPermission(descriptor)) === 'granted') return true
  if (!request) return false
  return (await handle.requestPermission(descriptor)) === 'granted'
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'NotFoundErr')
}

function rethrow(error: unknown): never {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    throw new SyncAuthError('Access to the vault folder was revoked. Grant access again to keep syncing.')
  }
  throw error
}

function revisionOf(file: File): string {
  return `${file.lastModified}:${file.size}`
}

export function createFolderAdapter(directory: FileSystemDirectoryHandle): VaultAdapter {
  async function getFile(): Promise<File | null> {
    try {
      const handle = await directory.getFileHandle(VAULT_FILE_NAME)
      return await handle.getFile()
    } catch (error) {
      if (isNotFound(error)) return null
      return rethrow(error)
    }
  }

  return {
    async getRevision() {
      const file = await getFile()
      return file ? revisionOf(file) : null
    },

    async read() {
      const file = await getFile()
      if (!file) return null
      const text = await file.text()
      // An empty file (e.g. created by hand or a cloud client placeholder) is treated as missing.
      if (!text.trim()) return null
      return { vault: parseVaultText(text), revision: revisionOf(file) }
    },

    async write(vault: VaultFile) {
      try {
        const handle = await directory.getFileHandle(VAULT_FILE_NAME, { create: true })
        const writable = await handle.createWritable()
        try {
          await writable.write(serializeVaultFile(vault))
          await writable.close()
        } catch (error) {
          await writable.abort().catch(() => undefined)
          throw error
        }
        return revisionOf(await handle.getFile())
      } catch (error) {
        return rethrow(error)
      }
    },
  }
}
