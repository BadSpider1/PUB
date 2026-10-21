import { deleteMeta, getMeta, setMeta } from '@/db/database'
import { repository } from '@/db/repository'
import { errorMessage, isAbortError, nowIso } from '@/lib/utils'
import { setTargetStatus, type TargetId, useSyncStore } from '@/store/useSyncStore'
import { toast } from '@/store/useUiStore'
import type { FinanceData } from '@/types/finance'
import { VAULT_FILE_NAME, type VaultFile } from '@/types/vault'
import {
  createFolderAdapter,
  ensureFolderPermission,
  isFolderSyncSupported,
  pickVaultDirectory,
} from './adapters/folderAdapter'
import type { VaultAdapter } from './adapters/types'
import { SyncAuthError, SyncOfflineError } from './errors'
import {
  type GoogleToken,
  isGoogleDriveConfigured,
  loadGapiClient,
  preloadGoogle,
  requestGoogleToken,
  revokeGoogleToken,
  setGapiToken,
} from './google/googleAuth'
import { createGoogleDriveAdapter, type DriveIds, fetchDriveAccount } from './google/googleDriveAdapter'
import { createMockDriveAdapter } from './google/mockDriveAdapter'
import { buildVaultFile, fingerprint, parseVaultText, serializeVaultFile, VaultFormatError } from './vaultFormat'

/** Wait this long after the last local change before writing, to batch quick edits. */
const WRITE_DEBOUNCE_MS = 1200
/** Minimum gap between "did another device change the vault?" checks. */
const REMOTE_CHECK_THROTTLE_MS = 15_000
const REMOTE_POLL_INTERVAL_MS = 60_000

const META = {
  folderHandle: 'folder.handle',
  folderLastSync: 'folder.lastSyncAt',
  driveConfig: 'drive.config',
  driveToken: 'drive.token',
  driveLastSync: 'drive.lastSyncAt',
} as const

interface DriveConfig extends DriveIds {
  mode: 'google' | 'mock'
  account?: string
}

interface TargetRuntime {
  adapter: VaultAdapter | null
  /** Fingerprint of the local data at the end of the last successful sync with this target. */
  syncedFingerprint: string | null
  /** Remote revision at the end of the last successful sync. */
  remoteRevision: string | null
  timer: ReturnType<typeof setTimeout> | null
}

export type ImportMode = 'merge' | 'replace'

/** Drive roots and some virtual folders report an empty name. */
const folderLabel = (handle: FileSystemDirectoryHandle) => handle.name || 'Selected folder'

const TARGET_LABEL: Record<TargetId, string> = { folder: 'the local vault folder', drive: 'Google Drive' }

/**
 * Orchestrates the storage tiers:
 *
 * - Tier 0 – IndexedDB (Dexie) is always the working copy. Nothing here blocks the UI.
 * - Tier 1 – a local folder chosen via the File System Access API.
 * - Tier 2 – Google Drive (or its local simulation when no client id is configured).
 * - Tier 3 – manual JSON export/import.
 *
 * Every sync is "pull → merge → push": read the vault file, merge it into IndexedDB
 * (last-writer-wins per record, tombstones for deletes), then write the merged result back
 * if the file differs. Syncs run one at a time through a queue.
 */
class StorageManager {
  private runtimes: Record<TargetId, TargetRuntime> = {
    folder: { adapter: null, syncedFingerprint: null, remoteRevision: null, timer: null },
    drive: { adapter: null, syncedFingerprint: null, remoteRevision: null, timer: null },
  }
  private queue: Promise<void> = Promise.resolve()
  private queued = new Set<TargetId>()
  private localFingerprint: string | null = null
  private lastRemoteCheck = 0
  private initialized = false
  /** Folder handle restored from IndexedDB whose permission must be re-granted by a click. */
  private pendingFolderHandle: FileSystemDirectoryHandle | null = null
  private driveConfig: DriveConfig | null = null
  private googleToken: GoogleToken | null = null

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    await Promise.allSettled([this.restoreFolder(), this.restoreDrive()])

    const check = () => {
      if (document.visibilityState === 'visible') void this.checkRemoteChanges()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('online', () => this.requestSync('drive', 0))
    setInterval(check, REMOTE_POLL_INTERVAL_MS)
  }

  /**
   * Called with a fresh snapshot after every committed IndexedDB write (see main.tsx).
   * Schedules a debounced sync for each connected target that has not seen this data yet.
   */
  handleLocalChange(data: FinanceData): void {
    this.localFingerprint = fingerprint(data)
    for (const id of ['folder', 'drive'] as const) {
      const runtime = this.runtimes[id]
      if (runtime.adapter && runtime.syncedFingerprint !== this.localFingerprint) this.requestSync(id)
    }
  }

  /** Run a sync for one or all connected targets right away. */
  syncNow(id?: TargetId): Promise<void> {
    const ids = id ? [id] : (['folder', 'drive'] as const).filter((t) => this.runtimes[t].adapter)
    return Promise.all(ids.map((t) => this.enqueueSync(t, { notify: true }))).then(() => undefined)
  }

  // ---------------------------------------------------------------------------
  // Sync engine
  // ---------------------------------------------------------------------------

  private requestSync(id: TargetId, delayMs = WRITE_DEBOUNCE_MS): void {
    const runtime = this.runtimes[id]
    if (!runtime.adapter) return
    if (runtime.timer) clearTimeout(runtime.timer)
    runtime.timer = setTimeout(() => {
      runtime.timer = null
      // Skip if an earlier sync already covered the current local data and nothing remote changed.
      if (delayMs > 0 && runtime.syncedFingerprint === this.localFingerprint) return
      void this.enqueueSync(id)
    }, delayMs)
  }

  private enqueueSync(id: TargetId, options: { notify?: boolean } = {}): Promise<void> {
    if (this.queued.has(id) && !options.notify) return this.queue
    this.queued.add(id)
    this.queue = this.queue.then(async () => {
      this.queued.delete(id)
      await this.runSync(id, options)
    })
    return this.queue
  }

  private async runSync(id: TargetId, { notify = false }: { notify?: boolean }): Promise<void> {
    const runtime = this.runtimes[id]
    const adapter = runtime.adapter
    if (!adapter) return

    setTargetStatus(id, { state: 'syncing' })
    try {
      const remote = await adapter.read()
      const pulled = remote ? await repository.mergeIntoLocal(remote.vault.data) : 0

      const snapshot = await repository.getSnapshot()
      const localFingerprint = fingerprint(snapshot)
      let revision = remote?.revision ?? null
      const pushed = !remote || fingerprint(remote.vault.data) !== localFingerprint
      if (pushed) revision = await adapter.write(buildVaultFile(snapshot))

      // The adapter may have been swapped (disconnect/reconnect) while we were awaiting.
      if (runtime.adapter !== adapter) return
      runtime.syncedFingerprint = localFingerprint
      runtime.remoteRevision = revision
      const lastSyncAt = nowIso()
      await setMeta(id === 'folder' ? META.folderLastSync : META.driveLastSync, lastSyncAt)
      setTargetStatus(id, { state: 'idle', lastSyncAt, error: undefined, canOverwriteRemote: false })

      if (pulled > 0) {
        toast({ title: `Updated ${pulled} item${pulled === 1 ? '' : 's'} from ${TARGET_LABEL[id]}`, variant: 'success' })
      } else if (notify) {
        toast({ title: pushed ? `Saved to ${TARGET_LABEL[id]}` : 'Everything is up to date', variant: 'success' })
      }
    } catch (error) {
      if (runtime.adapter === adapter) this.handleSyncError(id, error, notify)
    }
  }

  private handleSyncError(id: TargetId, error: unknown, notify: boolean): void {
    if (error instanceof SyncAuthError) {
      setTargetStatus(id, { state: id === 'folder' ? 'needs-permission' : 'expired', error: error.message })
    } else if (error instanceof SyncOfflineError) {
      setTargetStatus(id, { state: 'offline', error: error.message })
    } else if (error instanceof VaultFormatError) {
      // Never overwrite a file we cannot understand – the user decides.
      setTargetStatus(id, {
        state: 'error',
        error: `${VAULT_FILE_NAME} could not be read: ${error.message}`,
        canOverwriteRemote: true,
      })
    } else {
      console.error(`Sync with ${id} failed`, error)
      setTargetStatus(id, { state: 'error', error: errorMessage(error) })
    }
    if (notify) toast({ title: 'Sync failed', description: errorMessage(error), variant: 'error' })
  }

  /** Detect edits made by other devices (cloud-synced folder, Drive) without reading the whole file. */
  async checkRemoteChanges(force = false): Promise<void> {
    if (!force && Date.now() - this.lastRemoteCheck < REMOTE_CHECK_THROTTLE_MS) return
    this.lastRemoteCheck = Date.now()
    for (const id of ['folder', 'drive'] as const) {
      const runtime = this.runtimes[id]
      const { state, canOverwriteRemote } = useSyncStore.getState()[id]
      // Transient failures are retried; an unreadable vault file waits for the user's decision.
      const retry = state === 'offline' || (state === 'error' && !canOverwriteRemote)
      if (!runtime.adapter || (state !== 'idle' && !retry)) continue
      try {
        const revision = await runtime.adapter.getRevision()
        if (revision !== runtime.remoteRevision || retry) this.requestSync(id, 0)
      } catch (error) {
        if (runtime.adapter) this.handleSyncError(id, error, false)
      }
    }
  }

  /** Recovery for an unreadable vault file: replace it with this device's data. */
  async overwriteRemote(id: TargetId): Promise<void> {
    const adapter = this.runtimes[id].adapter
    if (!adapter) return
    this.queue = this.queue.then(async () => {
      try {
        setTargetStatus(id, { state: 'syncing' })
        const snapshot = await repository.getSnapshot()
        const revision = await adapter.write(buildVaultFile(snapshot))
        const runtime = this.runtimes[id]
        runtime.syncedFingerprint = fingerprint(snapshot)
        runtime.remoteRevision = revision
        setTargetStatus(id, { state: 'idle', lastSyncAt: nowIso(), error: undefined, canOverwriteRemote: false })
        toast({ title: `Replaced ${VAULT_FILE_NAME} with this device's data`, variant: 'success' })
      } catch (error) {
        this.handleSyncError(id, error, true)
      }
    })
    return this.queue
  }

  private attach(id: TargetId, adapter: VaultAdapter | null): void {
    const runtime = this.runtimes[id]
    if (runtime.timer) clearTimeout(runtime.timer)
    this.runtimes[id] = { adapter, syncedFingerprint: null, remoteRevision: null, timer: null }
  }

  // ---------------------------------------------------------------------------
  // Tier 1 – local folder (File System Access API)
  // ---------------------------------------------------------------------------

  private async restoreFolder(): Promise<void> {
    if (!isFolderSyncSupported()) {
      setTargetStatus('folder', { state: 'unsupported' }, true)
      return
    }
    const handle = await getMeta<FileSystemDirectoryHandle>(META.folderHandle)
    if (!handle) {
      setTargetStatus('folder', { state: 'disconnected' }, true)
      return
    }
    const lastSyncAt = await getMeta<string>(META.folderLastSync)
    if (await ensureFolderPermission(handle, false)) {
      this.attach('folder', createFolderAdapter(handle))
      setTargetStatus('folder', { state: 'idle', label: folderLabel(handle), lastSyncAt }, true)
      this.requestSync('folder', 0)
    } else {
      this.pendingFolderHandle = handle
      setTargetStatus('folder', { state: 'needs-permission', label: folderLabel(handle), lastSyncAt }, true)
    }
  }

  /** "Select Local Folder (Vault)" – opens the directory picker. Call from a click handler. */
  async connectFolder(): Promise<void> {
    let handle: FileSystemDirectoryHandle
    try {
      handle = await pickVaultDirectory()
    } catch (error) {
      if (isAbortError(error)) return // user cancelled the picker
      throw error
    }
    if (!(await ensureFolderPermission(handle, true))) {
      throw new Error('Write access to the folder was not granted.')
    }
    await this.useFolder(handle)
  }

  /** Re-grant access to the remembered folder after a browser restart. Call from a click handler. */
  async reconnectFolder(): Promise<void> {
    const handle = this.pendingFolderHandle ?? (await getMeta<FileSystemDirectoryHandle>(META.folderHandle))
    if (!handle) return this.connectFolder()
    if (!(await ensureFolderPermission(handle, true))) {
      throw new Error('Write access to the folder was not granted.')
    }
    await this.useFolder(handle)
  }

  private async useFolder(handle: FileSystemDirectoryHandle): Promise<void> {
    this.pendingFolderHandle = null
    await setMeta(META.folderHandle, handle)
    this.attach('folder', createFolderAdapter(handle))
    setTargetStatus('folder', { state: 'idle', label: folderLabel(handle), error: undefined, canOverwriteRemote: false })
    await this.enqueueSync('folder', { notify: true })
  }

  async disconnectFolder(): Promise<void> {
    this.attach('folder', null)
    this.pendingFolderHandle = null
    await deleteMeta(META.folderHandle, META.folderLastSync)
    setTargetStatus('folder', { state: isFolderSyncSupported() ? 'disconnected' : 'unsupported' }, true)
  }

  // ---------------------------------------------------------------------------
  // Tier 2 – Google Drive
  // ---------------------------------------------------------------------------

  private driveIdleState(): 'disconnected' | 'not-configured' {
    return isGoogleDriveConfigured ? 'disconnected' : 'not-configured'
  }

  private async restoreDrive(): Promise<void> {
    const config = await getMeta<DriveConfig>(META.driveConfig)
    const lastSyncAt = await getMeta<string>(META.driveLastSync)
    this.driveConfig = config ?? null

    if (!config) {
      setTargetStatus('drive', { state: this.driveIdleState() }, true)
      return
    }
    if (config.mode === 'mock') {
      this.attach('drive', createMockDriveAdapter())
      setTargetStatus('drive', { state: 'idle', mode: 'mock', label: config.account, lastSyncAt }, true)
      this.requestSync('drive', 0)
      return
    }
    if (!isGoogleDriveConfigured) {
      setTargetStatus('drive', { state: 'not-configured' }, true)
      return
    }

    const base = { mode: 'google' as const, label: config.account, lastSyncAt }
    const token = await getMeta<GoogleToken>(META.driveToken)
    if (!token || token.expiresAt <= Date.now() + 60_000) {
      setTargetStatus('drive', { ...base, state: 'expired' }, true)
      this.preloadGoogleQuietly()
      return
    }
    this.googleToken = token
    this.attach('drive', this.createGoogleAdapter(config))
    setTargetStatus('drive', { ...base, state: 'idle' }, true)
    try {
      await loadGapiClient()
      setGapiToken(token.accessToken)
      this.requestSync('drive', 0)
    } catch (error) {
      setTargetStatus('drive', { state: navigator.onLine ? 'error' : 'offline', error: errorMessage(error) })
    }
    this.preloadGoogleQuietly()
  }

  private preloadGoogleQuietly(): void {
    if (isGoogleDriveConfigured && navigator.onLine) void preloadGoogle().catch(() => undefined)
  }

  private createGoogleAdapter(config: DriveConfig): VaultAdapter {
    return createGoogleDriveAdapter({
      getToken: () => this.googleToken,
      ids: { folderId: config.folderId, fileId: config.fileId },
      onIdsChange: (ids) => {
        if (!this.driveConfig) return
        this.driveConfig = { ...this.driveConfig, ...ids }
        void setMeta(META.driveConfig, this.driveConfig)
      },
    })
  }

  /**
   * "Sync with Google Drive" / "Reconnect". Opens the Google popup, so it MUST be invoked
   * synchronously from a click handler – there is deliberately no `await` before the popup.
   */
  connectGoogleDrive(): Promise<void> {
    const tokenPromise = requestGoogleToken(this.driveConfig?.mode === 'google' ? this.driveConfig.account : undefined)
    return tokenPromise.then(async (token) => {
      setTargetStatus('drive', { state: 'syncing', mode: 'google', error: undefined })
      try {
        this.googleToken = token
        await setMeta(META.driveToken, token)
        setGapiToken(token.accessToken)
        const account = await fetchDriveAccount(token)
        const previous = this.driveConfig?.mode === 'google' && this.driveConfig.account === account ? this.driveConfig : null
        this.driveConfig = { mode: 'google', account, folderId: previous?.folderId, fileId: previous?.fileId }
        await setMeta(META.driveConfig, this.driveConfig)
        this.attach('drive', this.createGoogleAdapter(this.driveConfig))
        setTargetStatus('drive', { state: 'idle', mode: 'google', label: account, canOverwriteRemote: false })
      } catch (error) {
        setTargetStatus('drive', { state: 'error', error: errorMessage(error) })
        throw error
      }
      await this.enqueueSync('drive', { notify: true })
    })
  }

  /** Use the localStorage-backed Drive simulation (no Google credentials needed). */
  async connectMockDrive(): Promise<void> {
    this.driveConfig = { mode: 'mock', account: 'Simulated Drive (this browser)' }
    await setMeta(META.driveConfig, this.driveConfig)
    this.attach('drive', createMockDriveAdapter())
    setTargetStatus('drive', { state: 'idle', mode: 'mock', label: this.driveConfig.account, error: undefined }, true)
    await this.enqueueSync('drive', { notify: true })
  }

  async disconnectDrive(): Promise<void> {
    if (this.googleToken) revokeGoogleToken(this.googleToken.accessToken)
    this.googleToken = null
    this.driveConfig = null
    setGapiToken(null)
    this.attach('drive', null)
    await deleteMeta(META.driveConfig, META.driveToken, META.driveLastSync)
    setTargetStatus('drive', { state: this.driveIdleState() }, true)
  }

  // ---------------------------------------------------------------------------
  // Tier 3 – manual backup
  // ---------------------------------------------------------------------------

  async exportJson(): Promise<void> {
    const vault = buildVaultFile(await repository.getSnapshot())
    const blob = new Blob([serializeVaultFile(vault)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `finance_vault_backup_${vault.exportedAt.slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  /** Parse and validate a backup file so the UI can show a summary before importing. */
  async readBackup(file: File): Promise<VaultFile> {
    return parseVaultText(await file.text())
  }

  /**
   * - `merge`: combine with existing data (newer version of each record wins).
   * - `replace`: make local data exactly equal to the backup; propagates to connected vaults.
   * Returns the number of records that changed.
   */
  async importBackup(vault: VaultFile, mode: ImportMode): Promise<number> {
    if (mode === 'merge') return repository.mergeIntoLocal(vault.data)
    await repository.replaceAll(vault.data)
    return vault.data.categories.length + vault.data.transactions.length
  }
}

export const storageManager = new StorageManager()
