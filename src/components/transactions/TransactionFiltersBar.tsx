import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { currentMonth, monthName } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Category, Transaction, TransactionType } from '@/types/finance'
import { SORT_OPTIONS, type SortKey, type TransactionFilters } from './useTransactionFilters'

interface TransactionFiltersBarProps {
  filters: TransactionFilters
  update: (patch: Partial<TransactionFilters>) => void
  reset: () => void
  activeCount: number
  categories: Category[]
  transactions: Transaction[]
}

type TypeOption = 'all' | TransactionType

export function TransactionFiltersBar({
  filters,
  update,
  reset,
  activeCount,
  categories,
  transactions,
}: TransactionFiltersBarProps) {
  const [panelOpen, setPanelOpen] = useState(false)

  const years = useMemo(() => {
    const set = new Set<number>([currentMonth().year])
    for (const t of transactions) set.add(new Date(t.date).getFullYear())
    if (filters.year) set.add(filters.year)
    return [...set].sort((a, b) => b - a)
  }, [transactions, filters.year])

  const visibleCategories = filters.type ? categories.filter((c) => c.type === filters.type) : categories
  const expenseCategories = visibleCategories.filter((c) => c.type === 'expense')
  const incomeCategories = visibleCategories.filter((c) => c.type === 'income')

  const changeType = (value: TypeOption) => {
    const type = value === 'all' ? null : value
    const category = categories.find((c) => c.id === filters.categoryId)
    update({ type, categoryId: type && category && category.type !== type ? null : filters.categoryId })
  }

  // The search query does not count towards the badge on the (separate) Filters button.
  const panelCount = activeCount - (filters.query ? 1 : 0)

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search notes or categories"
            aria-label="Search transactions"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          className="md:hidden"
          aria-expanded={panelOpen}
          aria-controls="transaction-filters"
          onClick={() => setPanelOpen((open) => !open)}
        >
          <SlidersHorizontal /> Filters
          {panelCount > 0 && <Badge className="px-1.5">{panelCount}</Badge>}
        </Button>
      </div>

      <div
        id="transaction-filters"
        className={cn(
          'grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 md:flex md:flex-wrap md:items-center md:border-0 md:bg-transparent md:p-0',
          !panelOpen && 'hidden md:flex',
        )}
      >
        <SegmentedControl<TypeOption>
          label="Type"
          className="col-span-2 md:w-auto"
          value={filters.type ?? 'all'}
          onChange={changeType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Expenses', activeClassName: 'text-expense' },
            { value: 'income', label: 'Income', activeClassName: 'text-income' },
          ]}
        />
        <Select
          aria-label="Month"
          className="md:w-36"
          value={filters.month ?? ''}
          onChange={(e) => update({ month: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {monthName(i)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Year"
          className="md:w-28"
          value={filters.year ?? ''}
          onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">All years</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Category"
          className="md:w-48"
          value={filters.categoryId ?? ''}
          onChange={(e) => update({ categoryId: e.target.value || null })}
        >
          <option value="">All categories</option>
          {expenseCategories.length > 0 && (
            <optgroup label="Expenses">
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          {incomeCategories.length > 0 && (
            <optgroup label="Income">
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
        <Select
          aria-label="Sort by"
          className="md:w-40"
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as SortKey })}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {activeCount > 0 && (
          <Button variant="ghost" className="col-span-2 md:col-span-1" onClick={reset}>
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
