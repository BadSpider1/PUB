import { normalizeHexColor } from '@/lib/colors'
import { roundMoney } from '@/lib/money'
import type { Category, EntityKind, FinanceData, Tombstone, Transaction, TransactionType } from '@/types/finance'
import { VAULT_APP_ID, VAULT_SCHEMA_VERSION, type VaultFile } from '@/types/vault'

export class VaultFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VaultFormatError'
  }
}

// ---------------------------------------------------------------------------
// Canonical forms: fixed key order, no unknown keys. Used for comparisons,
// fingerprints and for writing the file.
// ---------------------------------------------------------------------------

export function canonicalCategory(c: Category): Category {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
    icon: c.icon,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export function canonicalTransaction(t: Transaction): Transaction {
  return {
    id: t.id,
    amount: t.amount,
    type: t.type,
    categoryId: t.categoryId,
    date: t.date,
    note: t.note,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

export function canonicalTombstone(t: Tombstone): Tombstone {
  return { id: t.id, entity: t.entity, deletedAt: t.deletedAt }
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Stable content hash of the data, independent of array order. Two copies with the same
 * fingerprint are identical, which lets the sync engine skip redundant reads and writes.
 */
export function fingerprint(data: FinanceData): string {
  const canonical = JSON.stringify({
    c: [...data.categories].sort(byId).map(canonicalCategory),
    t: [...data.transactions].sort(byId).map(canonicalTransaction),
    d: [...data.tombstones].sort(byId).map(canonicalTombstone),
  })
  return cyrb53(canonical)
}

/** Fast 53-bit string hash (public domain, by bryc). Not cryptographic – change detection only. */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + `:${str.length}`
}

// ---------------------------------------------------------------------------
// Building / serializing
// ---------------------------------------------------------------------------

export function buildVaultFile(data: FinanceData, exportedAt = new Date().toISOString()): VaultFile {
  return {
    app: VAULT_APP_ID,
    schemaVersion: VAULT_SCHEMA_VERSION,
    exportedAt,
    data: {
      // Ordered for human readability: categories grouped by type, newest transactions first.
      categories: [...data.categories]
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name) || byId(a, b))
        .map(canonicalCategory),
      transactions: [...data.transactions]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : byId(a, b)))
        .map(canonicalTransaction),
      tombstones: [...data.tombstones]
        .sort((a, b) => a.deletedAt.localeCompare(b.deletedAt) || byId(a, b))
        .map(canonicalTombstone),
    },
  }
}

export function serializeVaultFile(vault: VaultFile): string {
  return `${JSON.stringify(vault, null, 2)}\n`
}

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

/** Parse raw JSON text of a vault file. Throws VaultFormatError with a readable message. */
export function parseVaultText(text: string): VaultFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new VaultFormatError('The file is not valid JSON.')
  }
  return parseVaultFile(raw)
}

/**
 * Validate and normalize an unknown value into a VaultFile.
 *
 * The vault is meant to be human-editable, so parsing is lenient where it is safe
 * (missing timestamps, numeric strings, negative amounts, a bare `{categories, transactions}`
 * object) and strict where guessing could corrupt data (ids, types, dates).
 */
export function parseVaultFile(raw: unknown): VaultFile {
  if (!isObject(raw)) throw new VaultFormatError('Expected a JSON object at the top level.')

  if (raw.app !== undefined && raw.app !== VAULT_APP_ID) {
    throw new VaultFormatError(`This file belongs to a different app ("${String(raw.app)}").`)
  }
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > VAULT_SCHEMA_VERSION) {
    throw new VaultFormatError(
      `The vault was written by a newer version of the app (schema v${raw.schemaVersion}). Please update this app first.`,
    )
  }

  const container = isObject(raw.data) ? raw.data : raw
  if (!Array.isArray(container.categories) && !Array.isArray(container.transactions)) {
    throw new VaultFormatError('No "categories" or "transactions" found in the file.')
  }

  const categories = parseList(container.categories, 'categories', parseCategory)
  const transactions = parseList(container.transactions, 'transactions', parseTransaction)
  const tombstones = parseList(container.tombstones, 'tombstones', parseTombstone)

  assertUniqueIds(categories, 'categories')
  assertUniqueIds(transactions, 'transactions')

  return {
    app: VAULT_APP_ID,
    schemaVersion: VAULT_SCHEMA_VERSION,
    exportedAt: optionalTimestamp(raw.exportedAt) ?? new Date(0).toISOString(),
    data: { categories, transactions, tombstones },
  }
}

const EPOCH = new Date(0).toISOString()

function parseList<T>(value: unknown, field: string, parseItem: (item: unknown, path: string) => T): T[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new VaultFormatError(`"${field}" must be an array.`)
  return value.map((item, index) => parseItem(item, `${field}[${index}]`))
}

function parseCategory(raw: unknown, path: string): Category {
  if (!isObject(raw)) throw new VaultFormatError(`${path} must be an object.`)
  const updatedAt = optionalTimestamp(raw.updatedAt, `${path}.updatedAt`) ?? EPOCH
  const name = requireString(raw.name, `${path}.name`).trim()
  if (!name) throw new VaultFormatError(`${path}.name must not be empty.`)
  const color = normalizeHexColor(requireString(raw.color, `${path}.color`))
  if (!color) throw new VaultFormatError(`${path}.color must be a hex colour like "#2a78d6".`)
  return {
    id: requireId(raw.id, `${path}.id`),
    name,
    type: requireType(raw.type, `${path}.type`),
    color,
    icon: typeof raw.icon === 'string' && raw.icon ? raw.icon : 'Tag',
    createdAt: optionalTimestamp(raw.createdAt, `${path}.createdAt`) ?? updatedAt,
    updatedAt,
  }
}

function parseTransaction(raw: unknown, path: string): Transaction {
  if (!isObject(raw)) throw new VaultFormatError(`${path} must be an object.`)
  const updatedAt = optionalTimestamp(raw.updatedAt, `${path}.updatedAt`) ?? EPOCH
  const amount = typeof raw.amount === 'string' ? Number(raw.amount) : raw.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new VaultFormatError(`${path}.amount must be a number.`)
  }
  const date = optionalTimestamp(raw.date, `${path}.date`)
  if (!date) throw new VaultFormatError(`${path}.date is required.`)
  return {
    id: requireId(raw.id, `${path}.id`),
    amount: roundMoney(Math.abs(amount)),
    type: requireType(raw.type, `${path}.type`),
    categoryId: requireId(raw.categoryId, `${path}.categoryId`),
    date,
    note: typeof raw.note === 'string' ? raw.note : '',
    createdAt: optionalTimestamp(raw.createdAt, `${path}.createdAt`) ?? updatedAt,
    updatedAt,
  }
}

function parseTombstone(raw: unknown, path: string): Tombstone {
  if (!isObject(raw)) throw new VaultFormatError(`${path} must be an object.`)
  const entity = raw.entity
  if (entity !== 'category' && entity !== 'transaction') {
    throw new VaultFormatError(`${path}.entity must be "category" or "transaction".`)
  }
  const deletedAt = optionalTimestamp(raw.deletedAt, `${path}.deletedAt`)
  if (!deletedAt) throw new VaultFormatError(`${path}.deletedAt is required.`)
  return { id: requireId(raw.id, `${path}.id`), entity: entity satisfies EntityKind, deletedAt }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new VaultFormatError(`${path} must be a string.`)
  return value
}

function requireId(value: unknown, path: string): string {
  if (typeof value === 'number') return String(value)
  const id = requireString(value, path).trim()
  if (!id) throw new VaultFormatError(`${path} must not be empty.`)
  return id
}

function requireType(value: unknown, path: string): TransactionType {
  if (value === 'expense' || value === 'income') return value
  throw new VaultFormatError(`${path} must be "expense" or "income".`)
}

/** Accepts any string `Date` understands and normalizes it to ISO-8601 UTC. */
function optionalTimestamp(value: unknown, path?: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' && typeof value !== 'number') {
    if (path) throw new VaultFormatError(`${path} must be a date string.`)
    return undefined
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    if (path) throw new VaultFormatError(`${path} is not a valid date ("${value}").`)
    return undefined
  }
  return date.toISOString()
}

function assertUniqueIds(records: { id: string }[], field: string): void {
  const seen = new Set<string>()
  for (const record of records) {
    if (seen.has(record.id)) throw new VaultFormatError(`Duplicate id "${record.id}" in ${field}.`)
    seen.add(record.id)
  }
}
