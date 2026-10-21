import type { Transaction } from '@/types/finance'

/**
 * Round to cents. `toPrecision(15)` first strips binary floating point noise
 * (10.005 * 100 === 1000.4999999999999) so halves round up as a person expects.
 */
export function roundMoney(value: number): number {
  return Math.round(Number((value * 100).toPrecision(15))) / 100
}

/** Sum amounts in integer cents so long lists do not accumulate float drift. */
export function sumAmounts(amounts: Iterable<number>): number {
  let cents = 0
  for (const amount of amounts) cents += Math.round(amount * 100)
  return cents / 100
}

/**
 * Parse user input like "1234.5", "1 234,50", "1,234.50" or "1.234,50".
 * The right-most separator is treated as the decimal separator when both are present.
 * Returns NaN for anything that is not a plain positive decimal number.
 */
export function parseAmount(input: string): number {
  let value = input.trim().replace(/[\s  ']/g, '')
  if (!value) return Number.NaN

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    value = value.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma !== -1) {
    // "12,5" → decimal comma; "1,234,567" → thousands separators.
    const parts = value.split(',')
    const looksLikeThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0] !== '0')
    value = looksLikeThousands ? parts.join('') : value.replace(',', '.')
  }

  if (!/^\d+(\.\d+)?$/.test(value)) return Number.NaN
  return roundMoney(Number(value))
}

/** Signed value of a transaction: income is positive, expense negative. */
export function signedAmount(tx: Pick<Transaction, 'amount' | 'type'>): number {
  return tx.type === 'income' ? tx.amount : -tx.amount
}

export interface Totals {
  income: number
  expense: number
  net: number
}

export function computeTotals(transactions: Iterable<Pick<Transaction, 'amount' | 'type'>>): Totals {
  let incomeCents = 0
  let expenseCents = 0
  for (const tx of transactions) {
    const cents = Math.round(tx.amount * 100)
    if (tx.type === 'income') incomeCents += cents
    else expenseCents += cents
  }
  return { income: incomeCents / 100, expense: expenseCents / 100, net: (incomeCents - expenseCents) / 100 }
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(currency: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${currency}|${JSON.stringify(options)}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency, ...options })
    } catch {
      // Unknown currency code → plain number with the code appended by the caller.
      formatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...options })
    }
    formatterCache.set(key, formatter)
  }
  return formatter
}

export function formatMoney(
  value: number,
  currency: string,
  options: { signDisplay?: Intl.NumberFormatOptions['signDisplay']; compact?: boolean } = {},
): string {
  const intlOptions: Intl.NumberFormatOptions = { signDisplay: options.signDisplay ?? 'auto' }
  if (options.compact) {
    intlOptions.notation = 'compact'
    intlOptions.maximumFractionDigits = 1
  }
  return getFormatter(currency, intlOptions).format(value)
}

/** Commonly used ISO 4217 codes offered in Settings. */
export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CZK',
  'PLN',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'HUF',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
  'INR',
  'BRL',
  'UAH',
] as const
