import { createId } from '@/lib/utils'
import { VAULT_FILE_NAME, type VaultFile } from '@/types/vault'
import type { VaultAdapter } from '../adapters/types'
import { SyncAuthError, SyncOfflineError } from '../errors'
import { parseVaultText, serializeVaultFile } from '../vaultFormat'
import { type GoogleToken, loadGapiClient } from './googleAuth'

/**
 * Tier 2 – Google Drive (works everywhere, including Safari on iOS/iPadOS).
 *
 * Layout in the user's Drive:  My Drive / Personal Finance Vault / finance_vault.json
 * Uses the Drive v3 REST API through `gapi.client.request`.
 */
export const DRIVE_FOLDER_NAME = 'Personal Finance Vault'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about'

export interface DriveIds {
  folderId?: string
  fileId?: string
}

interface DriveFileMeta {
  id: string
  version?: string
  trashed?: boolean
}

export class DriveApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
  }
}

interface GapiErrorShape {
  status?: number
  result?: { error?: { message?: string } }
}

async function driveRequest<T>(token: GoogleToken | null, args: gapi.client.RequestOptions) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SyncOfflineError()
  if (!token || token.expiresAt <= Date.now()) {
    throw new SyncAuthError('Your Google session expired. Reconnect Google Drive to keep syncing.')
  }
  // The client may not be loaded yet (e.g. the app started offline with a still-valid token).
  if (typeof gapi === 'undefined' || !gapi.client?.request) await loadGapiClient()
  gapi.client.setToken({ access_token: token.accessToken })
  try {
    const response = await gapi.client.request(args)
    return { result: response.result as T, body: response.body }
  } catch (error) {
    const { status = 0, result } = (error ?? {}) as GapiErrorShape
    if (status === 401) throw new SyncAuthError('Your Google session expired. Reconnect Google Drive to keep syncing.')
    if (status === 403 && /insufficient|scope/i.test(result?.error?.message ?? '')) {
      throw new SyncAuthError('Google Drive access was not granted. Reconnect and allow access.')
    }
    if (status === 0) throw new SyncOfflineError('Google Drive is unreachable right now. Will retry later.')
    throw new DriveApiError(status, result?.error?.message ?? `Google Drive request failed (HTTP ${status}).`)
  }
}

/** Email of the signed-in Google account – shown in Settings and used as the sign-in hint. */
export async function fetchDriveAccount(token: GoogleToken): Promise<string | undefined> {
  const { result } = await driveRequest<{ user?: { emailAddress?: string; displayName?: string } }>(token, {
    path: ABOUT_URL,
    params: { fields: 'user(displayName,emailAddress)' },
  })
  return result.user?.emailAddress ?? result.user?.displayName
}

export function createGoogleDriveAdapter(options: {
  getToken: () => GoogleToken | null
  ids: DriveIds
  onIdsChange: (ids: DriveIds) => void
}): VaultAdapter {
  const ids: DriveIds = { ...options.ids }
  const request = <T>(args: gapi.client.RequestOptions) => driveRequest<T>(options.getToken(), args)

  function remember(next: DriveIds) {
    const merged = { ...ids, ...next }
    if (merged.folderId === ids.folderId && merged.fileId === ids.fileId) return
    Object.assign(ids, merged)
    options.onIdsChange({ ...ids })
  }

  async function list(q: string, fields: string): Promise<DriveFileMeta[]> {
    const { result } = await request<{ files?: DriveFileMeta[] }>({
      path: FILES_URL,
      params: { q, fields: `files(${fields})`, spaces: 'drive', orderBy: 'createdTime', pageSize: 10 },
    })
    return result.files ?? []
  }

  let folderVerified = false

  /** Returns the app folder id, re-validating a cached id once per session (it may be deleted or trashed). */
  async function ensureFolder(): Promise<string> {
    if (ids.folderId && !folderVerified) {
      try {
        const { result } = await request<DriveFileMeta>({
          path: `${FILES_URL}/${ids.folderId}`,
          params: { fields: 'id,trashed' },
        })
        if (result.trashed) remember({ folderId: undefined, fileId: undefined })
      } catch (error) {
        if (!(error instanceof DriveApiError && error.status === 404)) throw error
        remember({ folderId: undefined, fileId: undefined })
      }
      folderVerified = true
    }
    if (ids.folderId) return ids.folderId

    const [existing] = await list(
      `name = '${DRIVE_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
      'id',
    )
    let folderId = existing?.id
    if (!folderId) {
      const { result } = await request<{ id: string }>({
        path: FILES_URL,
        method: 'POST',
        params: { fields: 'id' },
        body: { name: DRIVE_FOLDER_NAME, mimeType: FOLDER_MIME, parents: ['root'] },
      })
      folderId = result.id
    }
    folderVerified = true
    remember({ folderId })
    return folderId
  }

  /** Find the vault file, validating any cached id (the user may have deleted or trashed it). */
  async function locateFile(): Promise<DriveFileMeta | null> {
    if (ids.fileId) {
      try {
        const { result } = await request<DriveFileMeta>({
          path: `${FILES_URL}/${ids.fileId}`,
          params: { fields: 'id,version,trashed' },
        })
        if (!result.trashed) return result
      } catch (error) {
        if (!(error instanceof DriveApiError && error.status === 404)) throw error
      }
      remember({ fileId: undefined })
    }
    const folderId = await ensureFolder()
    const [file] = await list(`name = '${VAULT_FILE_NAME}' and '${folderId}' in parents and trashed = false`, 'id,version')
    if (file) remember({ fileId: file.id })
    return file ?? null
  }

  return {
    async getRevision() {
      const file = await locateFile()
      return file?.version ?? null
    },

    async read() {
      const file = await locateFile()
      if (!file) return null
      const { body } = await request<unknown>({ path: `${FILES_URL}/${file.id}`, params: { alt: 'media' } })
      if (!body.trim()) return null
      return { vault: parseVaultText(body), revision: file.version ?? null }
    },

    async write(vault: VaultFile) {
      const content = serializeVaultFile(vault)
      const file = await locateFile()
      if (file) {
        const { result } = await request<DriveFileMeta>({
          path: `${UPLOAD_URL}/${file.id}`,
          method: 'PATCH',
          params: { uploadType: 'media', fields: 'id,version' },
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: content,
        })
        return result.version ?? null
      }

      const folderId = await ensureFolder()
      const boundary = `pfv-${createId()}`
      const metadata = { name: VAULT_FILE_NAME, parents: [folderId], mimeType: 'application/json' }
      const multipart =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`
      const { result } = await request<DriveFileMeta>({
        path: UPLOAD_URL,
        method: 'POST',
        params: { uploadType: 'multipart', fields: 'id,version' },
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
      remember({ fileId: result.id })
      return result.version ?? null
    },
  }
}
