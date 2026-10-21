import { describe, expect, it } from 'vitest'
import type { FinanceData } from '@/types/finance'
import { buildVaultFile, fingerprint, parseVaultFile, parseVaultText, serializeVaultFile } from './vaultFormat'

const sample: FinanceData = {
  categories: [
    {
      id: 'c1',
      name: 'Food',
      type: 'expense',
      color: '#eb6834',
      icon: 'ShoppingCart',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  transactions: [
    {
      id: 't1',
      amount: 12.5,
      type: 'expense',
      categoryId: 'c1',
      date: '2026-10-20T08:30:00.000Z',
      note: 'Lunch',
      createdAt: '2026-10-20T08:30:00.000Z',
      updatedAt: '2026-10-20T08:30:00.000Z',
    },
  ],
  tombstones: [{ id: 't0', entity: 'transaction', deletedAt: '2026-10-19T00:00:00.000Z' }],
}

describe('vault file round-trip', () => {
  it('serializes and parses back to the same data', () => {
    const text = serializeVaultFile(buildVaultFile(sample))
    const parsed = parseVaultText(text)
    expect(fingerprint(parsed.data)).toBe(fingerprint(sample))
    expect(parsed.app).toBe('personal-finance-vault')
  })

  it('produces the same fingerprint regardless of array order', () => {
    const shuffled: FinanceData = {
      ...sample,
      transactions: [...sample.transactions, { ...sample.transactions[0], id: 't2' }].reverse(),
    }
    const ordered: FinanceData = { ...sample, transactions: [...shuffled.transactions].reverse() }
    expect(fingerprint(shuffled)).toBe(fingerprint(ordered))
  })
})

describe('parseVaultFile', () => {
  it('accepts hand-written files with missing timestamps, string amounts and negative values', () => {
    const vault = parseVaultFile({
      categories: [{ id: 'c1', name: ' Food ', type: 'expense', color: 'EB6834' }],
      transactions: [{ id: 7, amount: '-12.345', type: 'expense', categoryId: 'c1', date: '2026-10-20 10:00' }],
    })
    expect(vault.data.categories[0]).toMatchObject({ name: 'Food', color: '#eb6834', icon: 'Tag' })
    expect(vault.data.transactions[0]).toMatchObject({ id: '7', amount: 12.35, note: '' })
    expect(vault.data.tombstones).toEqual([])
  })

  it('rejects files from other apps or newer schema versions', () => {
    expect(() => parseVaultFile({ app: 'other', data: { categories: [] } })).toThrow(/different app/)
    expect(() => parseVaultFile({ schemaVersion: 99, data: { categories: [] } })).toThrow(/newer version/)
  })

  it('rejects invalid records with a precise path', () => {
    expect(() =>
      parseVaultFile({ data: { transactions: [{ id: 'a', amount: 1, type: 'gift', categoryId: 'c', date: '2026-10-20' }] } }),
    ).toThrow('transactions[0].type must be "expense" or "income".')
    expect(() => parseVaultFile({ data: { categories: [], transactions: [{ id: 'a', amount: 1, type: 'expense', categoryId: 'c', date: 'nope' }] } })).toThrow(
      /transactions\[0\]\.date is not a valid date/,
    )
  })

  it('rejects duplicate ids and non-JSON input', () => {
    const c = { id: 'c1', name: 'A', type: 'income', color: '#000000' }
    expect(() => parseVaultFile({ categories: [c, c] })).toThrow(/Duplicate id/)
    expect(() => parseVaultText('{oops')).toThrow(/not valid JSON/)
  })
})
