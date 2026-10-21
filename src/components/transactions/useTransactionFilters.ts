import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { Category, Transaction, TransactionType } from '@/types/finance'

export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Highest amount' },
  { value: 'amount-asc', label: 'Lowest amount' },
]

export interface TransactionFilters {
  year: number | null
  /** 1–12 */
  month: number | null
  type: TransactionType | null
  categoryId: string | null
  query: string
  sort: SortKey
}

function parse(params: URLSearchParams): TransactionFilters {
  const year = Number(params.get('year'))
  const month = Number(params.get('month'))
  const type = params.get('type')
  const sort = params.get('sort') as SortKey | null
  return {
    year: Number.isInteger(year) && year > 1900 ? year : null,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    type: type === 'expense' || type === 'income' ? type : null,
    categoryId: params.get('category') || null,
    query: params.get('q') ?? '',
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort! : 'date-desc',
  }
}

function serialize(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.year) params.set('year', String(filters.year))
  if (filters.month) params.set('month', String(filters.month))
  if (filters.type) params.set('type', filters.type)
  if (filters.categoryId) params.set('category', filters.categoryId)
  if (filters.query) params.set('q', filters.query)
  if (filters.sort !== 'date-desc') params.set('sort', filters.sort)
  return params
}

/** Filter state lives in the URL, so it survives reloads and back/forward navigation. */
export function useTransactionFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parse(params), [params])

  const update = useCallback(
    (patch: Partial<TransactionFilters>) => setParams(serialize({ ...parse(params), ...patch }), { replace: true }),
    [params, setParams],
  )
  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  const activeCount = [filters.year, filters.month, filters.type, filters.categoryId, filters.query].filter(Boolean).length

  return { filters, update, reset, activeCount }
}

export function applyTransactionFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
  categoryById: Map<string, Category>,
): Transaction[] {
  const query = filters.query.trim().toLowerCase()
  const result = transactions.filter((t) => {
    if (filters.type && t.type !== filters.type) return false
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false
    if (filters.year || filters.month) {
      const d = new Date(t.date)
      if (filters.year && d.getFullYear() !== filters.year) return false
      if (filters.month && d.getMonth() + 1 !== filters.month) return false
    }
    if (query) {
      const categoryName = categoryById.get(t.categoryId)?.name ?? ''
      if (!t.note.toLowerCase().includes(query) && !categoryName.toLowerCase().includes(query)) return false
    }
    return true
  })

  const byDate = (a: Transaction, b: Transaction) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  switch (filters.sort) {
    case 'date-asc':
      return result.sort(byDate)
    case 'amount-desc':
      return result.sort((a, b) => b.amount - a.amount || byDate(b, a))
    case 'amount-asc':
      return result.sort((a, b) => a.amount - b.amount || byDate(b, a))
    default:
      return result.sort((a, b) => byDate(b, a))
  }
}
