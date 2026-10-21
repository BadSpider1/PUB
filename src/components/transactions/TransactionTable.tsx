import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash } from 'lucide-react'
import { CategoryIcon } from '@/components/categories/CategoryIcon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatShortDate, formatTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { openEditTransaction } from '@/store/useUiStore'
import type { Category, Transaction } from '@/types/finance'
import { deleteTransactionWithUndo } from './actions'
import { AmountText } from './AmountText'
import type { SortKey } from './useTransactionFilters'

interface TransactionTableProps {
  transactions: Transaction[]
  categoryById: Map<string, Category>
  sort: SortKey
  onSortChange: (sort: SortKey) => void
}

function SortHeader({
  label,
  field,
  sort,
  onSortChange,
  align = 'left',
}: {
  label: string
  field: 'date' | 'amount'
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sort.startsWith(field)
  const descending = sort.endsWith('desc')
  const Icon = !active ? ArrowUpDown : descending ? ArrowDown : ArrowUp
  return (
    <th
      scope="col"
      aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}
      className={cn('px-3 py-2.5 font-medium', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSortChange(`${field}-${active && descending ? 'asc' : 'desc'}`)}
        className={cn(
          'inline-flex items-center gap-1 rounded hover:text-foreground',
          active && 'text-foreground',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </th>
  )
}

/** Desktop/tablet layout: full data table with sortable columns and row actions. */
export function TransactionTable({ transactions, categoryById, sort, onSortChange }: TransactionTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <SortHeader label="Date" field="date" sort={sort} onSortChange={onSortChange} />
            <th scope="col" className="px-3 py-2.5 font-medium">
              Category
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Note
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Type
            </th>
            <SortHeader label="Amount" field="amount" sort={sort} onSortChange={onSortChange} align="right" />
            <th scope="col" className="w-24 px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map((t) => {
            const category = categoryById.get(t.categoryId)
            return (
              <tr
                key={t.id}
                onClick={() => openEditTransaction(t)}
                className="group cursor-pointer transition-colors hover:bg-accent/60"
              >
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-medium tabular">{formatShortDate(t.date)}</div>
                  <div className="text-xs text-muted-foreground tabular">
                    {new Date(t.date).getFullYear()} · {formatTime(t.date)}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon category={category} size="sm" />
                    <span className="truncate font-medium">{category?.name ?? 'Uncategorized'}</span>
                  </div>
                </td>
                <td className="max-w-xs px-3 py-2.5">
                  <span className="line-clamp-2 text-muted-foreground">{t.note || '—'}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={t.type === 'income' ? 'success' : 'destructive'}>
                    {t.type === 'income' ? 'Income' : 'Expense'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <AmountText amount={t.amount} type={t.type} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit transaction"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditTransaction(t)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete transaction"
                      className="hover:text-expense"
                      onClick={(e) => {
                        e.stopPropagation()
                        void deleteTransactionWithUndo(t)
                      }}
                    >
                      <Trash />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
