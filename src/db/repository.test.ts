import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/finance'
import { FinanceDatabase } from './database'
import { createRepository, stampAfter } from './repository'
import { DEFAULT_CATEGORIES } from './seed'

let database: FinanceDatabase
let repo: ReturnType<typeof createRepository>

beforeEach(async () => {
  database = new FinanceDatabase(`test-${Math.random()}`)
  await database.open()
  repo = createRepository(database)
})

afterEach(async () => {
  await database.delete()
})

const input = { amount: 25, type: 'expense' as const, categoryId: 'seed-food', date: '2026-10-21T10:00:00Z', note: ' Lunch ' }

describe('repository', () => {
  it('seeds default categories on first open', async () => {
    expect(await database.categories.count()).toBe(DEFAULT_CATEGORIES.length)
  })

  it('adds, updates and deletes transactions, leaving a tombstone', async () => {
    const created = await repo.addTransaction(input)
    expect(created.note).toBe('Lunch')
    expect(created.date).toBe('2026-10-21T10:00:00.000Z')

    await repo.updateTransaction(created.id, { ...input, amount: 30 })
    const updated = await database.transactions.get(created.id)
    expect(updated?.amount).toBe(30)
    expect(updated!.updatedAt > created.updatedAt).toBe(true)

    await repo.deleteTransaction(created.id)
    expect(await database.transactions.get(created.id)).toBeUndefined()
    expect(await database.tombstones.get(created.id)).toMatchObject({ entity: 'transaction' })
  })

  it('rejects invalid transactions', async () => {
    await expect(repo.addTransaction({ ...input, amount: 0 })).rejects.toThrow(/greater than zero/)
    await expect(repo.addTransaction({ ...input, categoryId: '' })).rejects.toThrow(/category/)
  })

  it('requires a same-type replacement when deleting a used category', async () => {
    const t = await repo.addTransaction(input)
    await expect(repo.deleteCategory('seed-food')).rejects.toThrow(/Choose another category/)
    await expect(repo.deleteCategory('seed-food', 'seed-salary')).rejects.toThrow(/same type/)

    await repo.deleteCategory('seed-food', 'seed-dining')
    expect((await database.transactions.get(t.id))?.categoryId).toBe('seed-dining')
    expect(await database.categories.get('seed-food')).toBeUndefined()
    expect(await database.tombstones.get('seed-food')).toMatchObject({ entity: 'category' })
  })

  it('stamps changes after a record that was written with a future clock', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(stampAfter(future) > future).toBe(true)
  })

  it('merges remote data into the local database', async () => {
    const local = await repo.addTransaction(input)
    const snapshot = await repo.getSnapshot()
    const remote: FinanceData = {
      ...snapshot,
      transactions: [
        { ...local, amount: 99, updatedAt: stampAfter(local.updatedAt) },
        { ...local, id: 'remote-only', updatedAt: local.updatedAt },
      ],
      tombstones: [{ id: 'seed-gifts', entity: 'category', deletedAt: new Date().toISOString() }],
    }
    const changed = await repo.mergeIntoLocal(remote)
    expect(changed).toBe(3)
    expect((await database.transactions.get(local.id))?.amount).toBe(99)
    expect(await database.transactions.get('remote-only')).toBeDefined()
    expect(await database.categories.get('seed-gifts')).toBeUndefined()

    expect(await repo.mergeIntoLocal(remote)).toBe(0)
  })

  it('replaces all data and tombstones what is not in the backup', async () => {
    const existing = await repo.addTransaction(input)
    const backup: FinanceData = {
      categories: DEFAULT_CATEGORIES.filter((c) => c.id === 'seed-food').map((c) => ({ ...c })),
      transactions: [{ ...existing, id: 'from-backup' }],
      tombstones: [],
    }
    await repo.replaceAll(backup)
    const after = await repo.getSnapshot()
    expect(after.categories.map((c) => c.id)).toEqual(['seed-food'])
    expect(after.transactions.map((t) => t.id)).toEqual(['from-backup'])
    expect(after.tombstones.map((t) => t.id)).toContain(existing.id)
  })
})
