import type { Category, FinanceData, SyncedRecord, Tombstone, Transaction } from '@/types/finance'
import { canonicalCategory, canonicalTransaction } from './vaultFormat'

/**
 * Conflict resolution between two copies of the data (this device vs. the vault file).
 *
 * - Records are merged per id with last-writer-wins on `updatedAt`.
 * - Exact timestamp ties are broken by comparing the canonical JSON, so every device
 *   picks the same winner and the result is independent of argument order.
 * - A tombstone removes a record unless the record was edited *after* the deletion.
 *
 * The function is pure, commutative and idempotent: merge(a, b) == merge(b, a) and
 * merge(merge(a, b), b) == merge(a, b).
 */
export function mergeFinanceData(a: FinanceData, b: FinanceData): FinanceData {
  const tombstones = mergeTombstones(a.tombstones, b.tombstones)
  return {
    categories: mergeRecords(a.categories, b.categories, tombstones, canonicalCategory),
    transactions: mergeRecords(a.transactions, b.transactions, tombstones, canonicalTransaction),
    tombstones: [...tombstones.values()],
  }
}

function mergeTombstones(a: Tombstone[], b: Tombstone[]): Map<string, Tombstone> {
  const result = new Map<string, Tombstone>()
  for (const tombstone of [...a, ...b]) {
    const existing = result.get(tombstone.id)
    if (!existing || tombstone.deletedAt > existing.deletedAt) result.set(tombstone.id, tombstone)
  }
  return result
}

function mergeRecords<T extends SyncedRecord>(
  a: T[],
  b: T[],
  tombstones: Map<string, Tombstone>,
  canonical: (record: T) => T,
): T[] {
  const winners = new Map<string, T>()
  for (const record of [...a, ...b]) {
    const existing = winners.get(record.id)
    winners.set(record.id, existing ? pickWinner(existing, record, canonical) : record)
  }
  const result: T[] = []
  for (const record of winners.values()) {
    const tombstone = tombstones.get(record.id)
    if (tombstone && tombstone.deletedAt >= record.updatedAt) continue
    result.push(record)
  }
  return result
}

function pickWinner<T extends SyncedRecord>(x: T, y: T, canonical: (record: T) => T): T {
  if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt ? x : y
  const jx = JSON.stringify(canonical(x))
  const jy = JSON.stringify(canonical(y))
  return jx >= jy ? x : y
}

export interface LocalChangeSet {
  putCategories: Category[]
  deleteCategoryIds: string[]
  putTransactions: Transaction[]
  deleteTransactionIds: string[]
  putTombstones: Tombstone[]
}

/** What has to be written to the local database to turn `local` into `merged`. */
export function diffLocal(local: FinanceData, merged: FinanceData): LocalChangeSet {
  const [putCategories, deleteCategoryIds] = diffRecords(local.categories, merged.categories, canonicalCategory)
  const [putTransactions, deleteTransactionIds] = diffRecords(
    local.transactions,
    merged.transactions,
    canonicalTransaction,
  )
  const localTombstones = new Map(local.tombstones.map((t) => [t.id, t]))
  const putTombstones = merged.tombstones.filter((t) => {
    const existing = localTombstones.get(t.id)
    return !existing || existing.deletedAt !== t.deletedAt || existing.entity !== t.entity
  })
  return { putCategories, deleteCategoryIds, putTransactions, deleteTransactionIds, putTombstones }
}

export function isEmptyChangeSet(changes: LocalChangeSet): boolean {
  return (
    changes.putCategories.length === 0 &&
    changes.deleteCategoryIds.length === 0 &&
    changes.putTransactions.length === 0 &&
    changes.deleteTransactionIds.length === 0 &&
    changes.putTombstones.length === 0
  )
}

export function countRecordChanges(changes: LocalChangeSet): number {
  return (
    changes.putCategories.length +
    changes.deleteCategoryIds.length +
    changes.putTransactions.length +
    changes.deleteTransactionIds.length
  )
}

function diffRecords<T extends SyncedRecord>(local: T[], merged: T[], canonical: (r: T) => T): [T[], string[]] {
  const localById = new Map(local.map((r) => [r.id, r]))
  const mergedIds = new Set<string>()
  const puts: T[] = []
  for (const record of merged) {
    mergedIds.add(record.id)
    const existing = localById.get(record.id)
    if (!existing || JSON.stringify(canonical(existing)) !== JSON.stringify(canonical(record))) puts.push(record)
  }
  const deletes = local.filter((r) => !mergedIds.has(r.id)).map((r) => r.id)
  return [puts, deletes]
}
