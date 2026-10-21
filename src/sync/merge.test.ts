import { describe, expect, it } from 'vitest'
import type { Category, FinanceData, Transaction } from '@/types/finance'
import { diffLocal, isEmptyChangeSet, mergeFinanceData } from './merge'
import { fingerprint } from './vaultFormat'

const T0 = '2026-01-01T00:00:00.000Z'
const T1 = '2026-01-02T00:00:00.000Z'
const T2 = '2026-01-03T00:00:00.000Z'

function tx(id: string, amount: number, updatedAt = T0, extra: Partial<Transaction> = {}): Transaction {
  return {
    id,
    amount,
    type: 'expense',
    categoryId: 'cat',
    date: T0,
    note: '',
    createdAt: T0,
    updatedAt,
    ...extra,
  }
}

const category: Category = {
  id: 'cat',
  name: 'Food',
  type: 'expense',
  color: '#eb6834',
  icon: 'ShoppingCart',
  createdAt: T0,
  updatedAt: T0,
}

function data(partial: Partial<FinanceData>): FinanceData {
  return { categories: [category], transactions: [], tombstones: [], ...partial }
}

describe('mergeFinanceData', () => {
  it('unions records that exist on only one side', () => {
    const merged = mergeFinanceData(data({ transactions: [tx('a', 1)] }), data({ transactions: [tx('b', 2)] }))
    expect(merged.transactions.map((t) => t.id).sort()).toEqual(['a', 'b'])
    expect(merged.categories).toHaveLength(1)
  })

  it('keeps the most recently updated version of a record', () => {
    const local = data({ transactions: [tx('a', 10, T2)] })
    const remote = data({ transactions: [tx('a', 99, T1)] })
    expect(mergeFinanceData(local, remote).transactions[0].amount).toBe(10)
    expect(mergeFinanceData(remote, local).transactions[0].amount).toBe(10)
  })

  it('applies tombstones newer than the record', () => {
    const local = data({ transactions: [tx('a', 1, T1)] })
    const remote = data({ tombstones: [{ id: 'a', entity: 'transaction', deletedAt: T2 }] })
    const merged = mergeFinanceData(local, remote)
    expect(merged.transactions).toHaveLength(0)
    expect(merged.tombstones).toHaveLength(1)
  })

  it('keeps a record edited after it was deleted elsewhere', () => {
    const local = data({ transactions: [tx('a', 1, T2)] })
    const remote = data({ tombstones: [{ id: 'a', entity: 'transaction', deletedAt: T1 }] })
    expect(mergeFinanceData(local, remote).transactions).toHaveLength(1)
  })

  it('resolves exact timestamp ties identically regardless of argument order', () => {
    const a = data({ transactions: [tx('x', 5, T1)] })
    const b = data({ transactions: [tx('x', 7, T1)] })
    expect(fingerprint(mergeFinanceData(a, b))).toBe(fingerprint(mergeFinanceData(b, a)))
  })

  it('is idempotent', () => {
    const a = data({ transactions: [tx('a', 1, T1), tx('b', 2, T0)] })
    const b = data({
      transactions: [tx('b', 3, T2)],
      tombstones: [{ id: 'a', entity: 'transaction', deletedAt: T2 }],
    })
    const once = mergeFinanceData(a, b)
    expect(fingerprint(mergeFinanceData(once, b))).toBe(fingerprint(once))
  })
})

describe('diffLocal', () => {
  it('reports no changes when the merge result equals local data', () => {
    const local = data({ transactions: [tx('a', 1)] })
    expect(isEmptyChangeSet(diffLocal(local, mergeFinanceData(local, local)))).toBe(true)
  })

  it('lists puts and deletes needed to reach the merged state', () => {
    const local = data({ transactions: [tx('a', 1, T0), tx('b', 1, T0)] })
    const remote = data({
      transactions: [tx('a', 2, T1), tx('c', 3, T1)],
      tombstones: [{ id: 'b', entity: 'transaction', deletedAt: T1 }],
    })
    const changes = diffLocal(local, mergeFinanceData(local, remote))
    expect(changes.putTransactions.map((t) => t.id).sort()).toEqual(['a', 'c'])
    expect(changes.deleteTransactionIds).toEqual(['b'])
    expect(changes.putTombstones).toHaveLength(1)
  })
})
