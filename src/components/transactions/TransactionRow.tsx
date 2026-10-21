import { CategoryIcon } from '@/components/categories/CategoryIcon'
import { formatShortDate, formatTime } from '@/lib/dates'
import { openEditTransaction } from '@/store/useUiStore'
import type { Category, Transaction } from '@/types/finance'
import { AmountText } from './AmountText'

interface TransactionRowProps {
  transaction: Transaction
  category: Category | undefined
  /** Show the date (dashboard) or only the time (lists already grouped by day). */
  showDate?: boolean
}

export function TransactionRow({ transaction, category, showDate = true }: TransactionRowProps) {
  const when = showDate ? `${formatShortDate(transaction.date)}, ${formatTime(transaction.date)}` : formatTime(transaction.date)
  return (
    <button
      type="button"
      onClick={() => openEditTransaction(transaction)}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent"
    >
      <CategoryIcon category={category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{category?.name ?? 'Uncategorized'}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {transaction.note ? `${when} · ${transaction.note}` : when}
        </span>
      </span>
      <AmountText amount={transaction.amount} type={transaction.type} className="text-sm" />
    </button>
  )
}
