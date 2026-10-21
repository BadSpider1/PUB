/** Direction of money flow. A category and its transactions always share the same type. */
export type TransactionType = 'expense' | 'income'

export const TRANSACTION_TYPES: readonly TransactionType[] = ['expense', 'income']

/** Fields shared by every synced record. Timestamps are ISO-8601 UTC strings. */
export interface SyncedRecord {
  id: string
  createdAt: string
  /** Bumped on every change; drives last-writer-wins merging between devices. */
  updatedAt: string
}

export interface Category extends SyncedRecord {
  name: string
  type: TransactionType
  /** #RRGGBB */
  color: string
  /** Key of CATEGORY_ICONS (Lucide icon name). Unknown names fall back to a default icon. */
  icon: string
}

export interface Transaction extends SyncedRecord {
  /** Always positive, in major currency units, rounded to 2 decimals. The sign comes from `type`. */
  amount: number
  type: TransactionType
  categoryId: string
  /** Moment of the transaction, ISO-8601 UTC. */
  date: string
  note: string
}

export type EntityKind = 'category' | 'transaction'

/**
 * Deletion marker. Kept so that a record deleted on one device is not resurrected
 * when another device that still has it syncs with the vault.
 */
export interface Tombstone {
  id: string
  entity: EntityKind
  deletedAt: string
}

/** Everything that is persisted and synced. */
export interface FinanceData {
  categories: Category[]
  transactions: Transaction[]
  tombstones: Tombstone[]
}

export type CategoryInput = Pick<Category, 'name' | 'type' | 'color' | 'icon'>
export type TransactionInput = Pick<Transaction, 'amount' | 'type' | 'categoryId' | 'date' | 'note'>
