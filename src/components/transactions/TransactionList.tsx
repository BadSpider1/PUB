import { dayKey, formatDayHeading } from '@/lib/dates'
import { computeTotals, formatMoney } from '@/lib/money'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { Category, Transaction } from '@/types/finance'
import { TransactionRow } from './TransactionRow'

interface TransactionListProps {
  transactions: Transaction[]
  categoryById: Map<string, Category>
  /** Group under day headings (only meaningful when sorted by date). */
  grouped: boolean
}

/** Phone layout: compact rows, grouped by day with the day's net total. */
export function TransactionList({ transactions, categoryById, grouped }: TransactionListProps) {
  const currency = useSettingsStore((s) => s.currency)

  if (!grouped) {
    return (
      <ul className="flex flex-col rounded-2xl border bg-card p-1.5">
        {transactions.map((t) => (
          <li key={t.id}>
            <TransactionRow transaction={t} category={categoryById.get(t.categoryId)} />
          </li>
        ))}
      </ul>
    )
  }

  const groups: { key: string; items: Transaction[] }[] = []
  for (const t of transactions) {
    const key = dayKey(t.date)
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(t)
    else groups.push({ key, items: [t] })
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const net = computeTotals(group.items).net
        return (
          <section key={group.key} aria-label={formatDayHeading(group.items[0].date)}>
            <div className="mb-1.5 flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
              <h2>{formatDayHeading(group.items[0].date)}</h2>
              <span className="tabular">{formatMoney(net, currency, { signDisplay: 'exceptZero' })}</span>
            </div>
            <ul className="flex flex-col rounded-2xl border bg-card p-1.5">
              {group.items.map((t) => (
                <li key={t.id}>
                  <TransactionRow transaction={t} category={categoryById.get(t.categoryId)} showDate={false} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
