import { roundMoney } from '@/lib/money'
import { createId, nowIso } from '@/lib/utils'
import { countRecordChanges, diffLocal, isEmptyChangeSet, mergeFinanceData } from '@/sync/merge'
import type {
  Category,
  CategoryInput,
  FinanceData,
  Tombstone,
  Transaction,
  TransactionInput,
} from '@/types/finance'
import { db, type FinanceDatabase } from './database'

/**
 * All writes to the finance tables go through this module so that every change bumps
 * `updatedAt` and every deletion leaves a tombstone – both are required for correct
 * merging with the vault file. UI code never touches Dexie tables directly.
 */
export function createRepository(database: FinanceDatabase) {
  const dataTables = [database.categories, database.transactions, database.tombstones] as const

  async function getSnapshot(): Promise<FinanceData> {
    return database.transaction('r', dataTables, async () => {
      const [categories, transactions, tombstones] = await Promise.all([
        database.categories.toArray(),
        database.transactions.toArray(),
        database.tombstones.toArray(),
      ])
      return { categories, transactions, tombstones }
    })
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  async function addTransaction(input: TransactionInput): Promise<Transaction> {
    const now = nowIso()
    const transaction: Transaction = {
      id: createId(),
      ...sanitizeTransactionInput(input),
      createdAt: now,
      updatedAt: now,
    }
    await database.transactions.add(transaction)
    return transaction
  }

  async function updateTransaction(id: string, input: TransactionInput): Promise<void> {
    const next = sanitizeTransactionInput(input)
    await database.transaction('rw', database.transactions, async () => {
      const existing = await database.transactions.get(id)
      if (!existing) throw new Error('Transaction not found – it may have been deleted on another device.')
      await database.transactions.put({ ...existing, ...next, updatedAt: stampAfter(existing.updatedAt) })
    })
  }

  async function deleteTransaction(id: string): Promise<void> {
    await database.transaction('rw', database.transactions, database.tombstones, async () => {
      const existing = await database.transactions.get(id)
      if (!existing) return
      await database.transactions.delete(id)
      await database.tombstones.put({ id, entity: 'transaction', deletedAt: stampAfter(existing.updatedAt) })
    })
  }

  /** Undo a deletion: re-insert the record, stamped after its tombstone so merges keep it. */
  async function restoreTransaction(transaction: Transaction): Promise<void> {
    await database.transaction('rw', database.transactions, database.tombstones, async () => {
      const tombstone = await database.tombstones.get(transaction.id)
      await database.transactions.put({
        ...transaction,
        updatedAt: stampAfter(tombstone?.deletedAt ?? transaction.updatedAt),
      })
      await database.tombstones.delete(transaction.id)
    })
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  async function addCategory(input: CategoryInput): Promise<Category> {
    const now = nowIso()
    const category: Category = { id: createId(), ...sanitizeCategoryInput(input), createdAt: now, updatedAt: now }
    await database.categories.add(category)
    return category
  }

  async function updateCategory(id: string, input: CategoryInput): Promise<void> {
    await database.transaction('rw', database.categories, database.transactions, async () => {
      const existing = await database.categories.get(id)
      if (!existing) throw new Error('Category not found – it may have been deleted on another device.')
      const next = sanitizeCategoryInput(input)
      if (next.type !== existing.type && (await database.transactions.where('categoryId').equals(id).count()) > 0) {
        throw new Error('Cannot change the type of a category that already has transactions.')
      }
      await database.categories.put({ ...existing, ...next, updatedAt: stampAfter(existing.updatedAt) })
    })
  }

  /**
   * Delete a category. Transactions that use it are moved to `reassignToId`, which is
   * required (and must be of the same type) when the category is in use.
   */
  async function deleteCategory(id: string, reassignToId?: string): Promise<void> {
    await database.transaction('rw', dataTables, async () => {
      const category = await database.categories.get(id)
      if (!category) return
      const used = await database.transactions.where('categoryId').equals(id).toArray()
      if (used.length > 0) {
        const target = reassignToId ? await database.categories.get(reassignToId) : undefined
        if (!target || target.id === id) throw new Error('Choose another category for the existing transactions.')
        if (target.type !== category.type) throw new Error('The replacement category must be of the same type.')
        await database.transactions.bulkPut(
          used.map((t) => ({ ...t, categoryId: target.id, updatedAt: stampAfter(t.updatedAt) })),
        )
      }
      await database.categories.delete(id)
      await database.tombstones.put({ id, entity: 'category', deletedAt: stampAfter(category.updatedAt) })
    })
  }

  // -------------------------------------------------------------------------
  // Sync & import
  // -------------------------------------------------------------------------

  /**
   * Merge another copy of the data (vault file, backup) into the local database.
   * Runs as one read-write transaction against the *current* local state, so edits made
   * while a sync request was in flight are never overwritten by a stale snapshot.
   * Returns the number of categories/transactions that changed locally.
   */
  async function mergeIntoLocal(remote: FinanceData): Promise<number> {
    return database.transaction('rw', dataTables, async () => {
      const local = await getSnapshot()
      const changes = diffLocal(local, mergeFinanceData(local, remote))
      if (isEmptyChangeSet(changes)) return 0
      await Promise.all([
        database.categories.bulkPut(changes.putCategories),
        database.categories.bulkDelete(changes.deleteCategoryIds),
        database.transactions.bulkPut(changes.putTransactions),
        database.transactions.bulkDelete(changes.deleteTransactionIds),
        database.tombstones.bulkPut(changes.putTombstones),
      ])
      return countRecordChanges(changes)
    })
  }

  /**
   * Make the local data exactly equal to `incoming` (restore a backup). Imported records
   * are re-stamped and everything else is tombstoned, so the restore also wins over
   * older data when this device next syncs with a vault.
   */
  async function replaceAll(incoming: FinanceData): Promise<void> {
    await database.transaction('rw', dataTables, async () => {
      const now = nowIso()
      const local = await getSnapshot()
      const keepIds = new Set([...incoming.categories, ...incoming.transactions].map((r) => r.id))
      const tombstones: Tombstone[] = [
        ...local.categories
          .filter((c) => !keepIds.has(c.id))
          .map((c): Tombstone => ({ id: c.id, entity: 'category', deletedAt: now })),
        ...local.transactions
          .filter((t) => !keepIds.has(t.id))
          .map((t): Tombstone => ({ id: t.id, entity: 'transaction', deletedAt: now })),
      ]
      await database.categories.clear()
      await database.transactions.clear()
      await database.categories.bulkPut(incoming.categories.map((c) => ({ ...c, updatedAt: now })))
      await database.transactions.bulkPut(incoming.transactions.map((t) => ({ ...t, updatedAt: now })))
      await database.tombstones.bulkDelete([...keepIds])
      await database.tombstones.bulkPut(tombstones)
    })
  }

  return {
    getSnapshot,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    mergeIntoLocal,
    replaceAll,
  }
}

/**
 * Timestamp for a change to a record last modified at `previous`. Normally "now", but never
 * earlier than `previous` + 1 ms: if another device's clock ran ahead, a later local edit or
 * deletion must still win the last-writer-wins merge.
 */
export function stampAfter(previous: string): string {
  const now = Date.now()
  const prev = Date.parse(previous)
  return new Date(Number.isNaN(prev) ? now : Math.max(now, prev + 1)).toISOString()
}

function sanitizeTransactionInput(input: TransactionInput): TransactionInput {
  const amount = roundMoney(Math.abs(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.')
  if (!input.categoryId) throw new Error('Please choose a category.')
  return {
    amount,
    type: input.type,
    categoryId: input.categoryId,
    date: new Date(input.date).toISOString(),
    note: input.note.trim(),
  }
}

function sanitizeCategoryInput(input: CategoryInput): CategoryInput {
  const name = input.name.trim()
  if (!name) throw new Error('Category name is required.')
  return { name: name.slice(0, 60), type: input.type, color: input.color.toLowerCase(), icon: input.icon }
}

export type FinanceRepository = ReturnType<typeof createRepository>

export const repository = createRepository(db)
