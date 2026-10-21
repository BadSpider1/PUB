import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinanceData } from '@/types/finance'
import { SyncAuthError } from '../errors'
import { buildVaultFile } from '../vaultFormat'
import { createGoogleDriveAdapter, type DriveIds, DRIVE_FOLDER_NAME } from './googleDriveAdapter'

/** Minimal in-memory imitation of the Drive v3 endpoints the adapter uses. */
interface FakeFile {
  id: string
  name: string
  mimeType: string
  parents: string[]
  content: string
  version: number
  trashed: boolean
}

let files: Map<string, FakeFile>
let nextId: number
let requests: { method: string; path: string }[]
let failNextWith: number | null

function fail(status: number) {
  return Promise.reject({ status, result: { error: { message: `HTTP ${status}` } } })
}

function respond(result: unknown, body = JSON.stringify(result)) {
  return Promise.resolve({ result, body, status: 200 })
}

function fakeRequest(args: gapi.client.RequestOptions) {
  const method = args.method ?? 'GET'
  const params = (args.params ?? {}) as Record<string, string>
  requests.push({ method, path: args.path })
  if (failNextWith) {
    const status = failNextWith
    failNextWith = null
    return fail(status)
  }

  const fileMatch = args.path.match(/\/files\/([^/?]+)$/)
  const file = fileMatch ? files.get(fileMatch[1]) : undefined

  const isUpload = args.path.includes('/upload/')
  if (!isUpload && args.path.endsWith('/drive/v3/files') && method === 'GET') {
    const q = params.q
    const name = q.match(/name = '([^']+)'/)?.[1]
    const parent = q.match(/'([^']+)' in parents/)?.[1]
    const matches = [...files.values()].filter(
      (f) => f.name === name && !f.trashed && (parent === 'root' ? f.parents.includes('root') : f.parents.includes(parent!)),
    )
    return respond({ files: matches.map((f) => ({ id: f.id, version: String(f.version) })) })
  }
  if (!isUpload && args.path.endsWith('/drive/v3/files') && method === 'POST') {
    const meta = args.body as { name: string; mimeType: string; parents: string[] }
    const created: FakeFile = { id: `id${nextId++}`, ...meta, content: '', version: 1, trashed: false }
    files.set(created.id, created)
    return respond({ id: created.id })
  }
  if (isUpload && args.path.endsWith('/drive/v3/files') && method === 'POST') {
    const boundary = (args.headers as Record<string, string>)['Content-Type'].split('boundary=')[1]
    const [metaPart, contentPart] = (args.body as string).split(`--${boundary}`).slice(1, 3)
    const meta = JSON.parse(metaPart.split('\r\n\r\n')[1])
    if (!meta.parents.every((id: string) => files.has(id))) return fail(404)
    const content = contentPart.split('\r\n\r\n')[1].replace(/\r\n$/, '')
    const created: FakeFile = { id: `id${nextId++}`, ...meta, content, version: 1, trashed: false }
    files.set(created.id, created)
    return respond({ id: created.id, version: '1' })
  }
  if (!file) return fail(404)
  if (isUpload && method === 'PATCH') {
    file.content = args.body as string
    file.version += 1
    return respond({ id: file.id, version: String(file.version) })
  }
  if (params.alt === 'media') return respond(JSON.parse(file.content), file.content)
  return respond({ id: file.id, version: String(file.version), trashed: file.trashed })
}

const data: FinanceData = {
  categories: [],
  transactions: [
    {
      id: 't1',
      amount: 10,
      type: 'expense',
      categoryId: 'seed-food',
      date: '2026-10-01T10:00:00.000Z',
      note: '',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
  ],
  tombstones: [],
}

const validToken = () => ({ accessToken: 'token', expiresAt: Date.now() + 3_600_000 })

function makeAdapter(ids: DriveIds = {}, token: () => ReturnType<typeof validToken> | null = validToken) {
  const onIdsChange = vi.fn()
  return { adapter: createGoogleDriveAdapter({ getToken: token, ids, onIdsChange }), onIdsChange }
}

beforeEach(() => {
  files = new Map()
  nextId = 1
  requests = []
  failNextWith = null
  vi.stubGlobal('gapi', { client: { request: fakeRequest, setToken: vi.fn() } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Google Drive adapter', () => {
  it('creates the folder and vault file on first write, then reads it back', async () => {
    const { adapter, onIdsChange } = makeAdapter()
    expect(await adapter.read()).toBeNull()

    await adapter.write(buildVaultFile(data))
    const folder = [...files.values()].find((f) => f.name === DRIVE_FOLDER_NAME)
    const vaultFile = [...files.values()].find((f) => f.name === 'finance_vault.json')
    expect(folder?.parents).toEqual(['root'])
    expect(vaultFile?.parents).toEqual([folder?.id])
    expect(onIdsChange).toHaveBeenLastCalledWith({ folderId: folder?.id, fileId: vaultFile?.id })

    const remote = await adapter.read()
    expect(remote?.vault.data.transactions).toHaveLength(1)
    expect(remote?.revision).toBe('1')
  })

  it('updates the same file in place on later writes', async () => {
    const { adapter } = makeAdapter()
    await adapter.write(buildVaultFile(data))
    const revision = await adapter.write(buildVaultFile({ ...data, transactions: [] }))
    expect([...files.values()].filter((f) => f.name === 'finance_vault.json')).toHaveLength(1)
    expect(revision).toBe('2')
    expect((await adapter.read())?.vault.data.transactions).toHaveLength(0)
  })

  it('finds a vault created by another device instead of creating a duplicate', async () => {
    await makeAdapter().adapter.write(buildVaultFile(data))
    const { adapter } = makeAdapter() // fresh device: no cached ids
    expect((await adapter.read())?.vault.data.transactions).toHaveLength(1)
    await adapter.write(buildVaultFile(data))
    expect(files.size).toBe(2) // one folder + one file
  })

  it('recovers when the cached file was deleted in Drive', async () => {
    const { adapter, onIdsChange } = makeAdapter({ folderId: 'gone-folder', fileId: 'gone-file' })
    await adapter.write(buildVaultFile(data))
    const vaultFile = [...files.values()].find((f) => f.name === 'finance_vault.json')
    expect(onIdsChange).toHaveBeenLastCalledWith(expect.objectContaining({ fileId: vaultFile?.id }))
    expect((await adapter.read())?.vault.data.transactions).toHaveLength(1)
  })

  it('does not keep using a folder that was moved to the trash', async () => {
    const first = makeAdapter()
    await first.adapter.write(buildVaultFile(data))
    const ids = first.onIdsChange.mock.lastCall![0] as DriveIds
    for (const f of files.values()) f.trashed = true

    const { adapter } = makeAdapter(ids) // next app start with the cached ids
    await adapter.write(buildVaultFile(data))
    const live = [...files.values()].filter((f) => !f.trashed)
    expect(live.map((f) => f.name).sort()).toEqual([DRIVE_FOLDER_NAME, 'finance_vault.json'])
    expect(live.find((f) => f.name === 'finance_vault.json')?.parents).toEqual([live.find((f) => f.name === DRIVE_FOLDER_NAME)?.id])
  })

  it('reports expired sessions as SyncAuthError', async () => {
    const expired = makeAdapter({}, () => ({ accessToken: 'old', expiresAt: Date.now() - 1 })).adapter
    await expect(expired.read()).rejects.toBeInstanceOf(SyncAuthError)
    expect(requests).toHaveLength(0)

    failNextWith = 401
    await expect(makeAdapter().adapter.read()).rejects.toBeInstanceOf(SyncAuthError)
  })
})
