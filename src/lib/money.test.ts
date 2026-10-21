import { describe, expect, it } from 'vitest'
import { computeTotals, parseAmount, sumAmounts } from './money'

describe('parseAmount', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['0,99', 0.99],
    ['1 234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1,234', 1234],
    ['1,234,567', 1234567],
    ['10.005', 10.01],
  ])('parses %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it.each(['', 'abc', '-5', '1e3', '12.3.4x'])('rejects %s', (input) => {
    expect(parseAmount(input)).toBeNaN()
  })
})

describe('sums', () => {
  it('avoids floating point drift', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3)
    expect(sumAmounts(Array.from({ length: 1000 }, () => 0.01))).toBe(10)
  })

  it('computes income, expense and net', () => {
    expect(
      computeTotals([
        { amount: 100.1, type: 'income' },
        { amount: 40.05, type: 'expense' },
        { amount: 0.05, type: 'expense' },
      ]),
    ).toEqual({ income: 100.1, expense: 40.1, net: 60 })
  })
})
