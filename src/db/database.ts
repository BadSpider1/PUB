import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Category, Tombstone, Transaction } from '@/types/finance'
import { DEFAULT_CATEGORIES } from './seed'

/** Small key/value table for non-synced, device-local state (sync config, folder handle…). */
export interface MetaRecord {
  key: string
  value: unknown
}

/**
 * Tier 0 storage: everything is read from and written to IndexedDB first, so the app
 * works instantly and fully offline. Sync tiers mirror this database to a vault file.
 */
export class FinanceDatabase extends Dexie {
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  tombstones!: EntityTable<Tombstone, 'id'>
  meta!: Table<MetaRecord, string>

  constructor(name = 'personal-finance-vault') {
    super(name)
    this.version(1).stores({
      categories: 'id, type, name, updatedAt',
      transactions: 'id, date, type, categoryId, updatedAt',
      tombstones: 'id, entity, deletedAt',
      meta: 'key',
    })
    // Runs exactly once, when the database is first created on this device.
    this.on('populate', (tx) => {
      void tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c })))
    })
  }
}

export const db = new FinanceDatabase()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const record = await db.meta.get(key)
  return record?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export async function deleteMeta(...keys: string[]): Promise<void> {
  await db.meta.bulkDelete(keys)
}
