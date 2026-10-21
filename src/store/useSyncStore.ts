import { create } from 'zustand'

export type TargetId = 'folder' | 'drive'

export type TargetState =
  /** The browser cannot use this tier (e.g. no File System Access API on iOS). */
  | 'unsupported'
  /** Google Drive: no VITE_GOOGLE_CLIENT_ID configured. */
  | 'not-configured'
  | 'disconnected'
  /** Folder: the browser forgot the permission; needs a click to re-grant. */
  | 'needs-permission'
  /** Drive: access token expired; needs a click to reconnect. */
  | 'expired'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'

export interface TargetStatus {
  state: TargetState
  /** Folder name or Google account. */
  label?: string
  lastSyncAt?: string
  error?: string
  /** The remote file could not be read; offer to overwrite it with this device's data. */
  canOverwriteRemote?: boolean
  /** Drive only: real Google Drive or the local simulation. */
  mode?: 'google' | 'mock'
}

interface SyncStore {
  folder: TargetStatus
  drive: TargetStatus
}

export const useSyncStore = create<SyncStore>(() => ({
  folder: { state: 'disconnected' },
  drive: { state: 'disconnected' },
}))

export function setTargetStatus(id: TargetId, patch: Partial<TargetStatus>, replace = false): void {
  useSyncStore.setState((s) => ({ [id]: replace ? ({ state: 'disconnected', ...patch } as TargetStatus) : { ...s[id], ...patch } }))
}

const CONNECTED_STATES: TargetState[] = ['idle', 'syncing', 'offline', 'error', 'needs-permission', 'expired']

export function isTargetConnected(status: TargetStatus): boolean {
  return CONNECTED_STATES.includes(status.state)
}

/** One-word summary for the storage mode badge: which tiers are active right now. */
export function describeStorageMode(folder: TargetStatus, drive: TargetStatus): string {
  const parts: string[] = []
  if (isTargetConnected(folder)) parts.push('Local Folder')
  if (isTargetConnected(drive)) parts.push(drive.mode === 'mock' ? 'Drive (demo)' : 'Google Drive')
  return parts.length ? parts.join(' + ') : 'Browser Only'
}
