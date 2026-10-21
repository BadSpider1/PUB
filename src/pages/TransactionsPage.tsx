import { Plus, ReceiptText, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TransactionFiltersBar } from '@/components/transactions/TransactionFiltersBar'
import { TransactionList } from '@/components/transactions/TransactionList'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { applyTransactionFilters, useTransactionFilters } from '@/components/transactions/useTransactionFilters'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { computeTotals, formatMoney } from '@/lib/money'
import { useFinanceStore } from '@/store/useFinanceStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { openNewTransaction } from '@/store/useUiStore'

const PAGE_SIZE = 100

export function TransactionsPage() {
  const transactions = useFinanceStore((s) => s.transactions)
  const categories = useFinanceStore((s) => s.categories)
  const categoryById = useFinanceStore((s) => s.categoryById)
  const currency = useSettingsStore((s) => s.currency)
  const isDesktop = useIsDesktop()
  const { filters, update, reset, activeCount } = useTransactionFilters()
  const [limit, setLimit] = useState(PAGE_SIZE)

  const filtered = useMemo(
    () => applyTransactionFilters(transactions, filters, categoryById),
    [transactions, filters, categoryById],
  )
  const totals = useMemo(() => computeTotals(filtered), [filtered])
  const visible = filtered.slice(0, limit)

  return (
    <>
      <PageHeader
        title="Transactions"
        actions={
          <Button className="hidden md:inline-flex" onClick={() => openNewTransaction({ type: filters.type ?? 'expense' })}>
            <Plus /> Add transaction
          </Button>
        }
      />

      <TransactionFiltersBar
        filters={filters}
        update={(patch) => {
          setLimit(PAGE_SIZE)
          update(patch)
        }}
        reset={reset}
        activeCount={activeCount}
        categories={categories}
        transactions={transactions}
      />

      {transactions.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No transactions yet"
          description="Use the + button to add your first expense or income."
          action={
            <Button onClick={() => openNewTransaction()}>
              <Plus /> Add transaction
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching transactions"
          description="Try a different month, category or search term."
          action={
            <Button variant="outline" onClick={reset}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-1 px-1 text-sm text-muted-foreground">
            <div className="flex gap-1.5">
              <dt className="sr-only">Count</dt>
              <dd>
                {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Income</dt>
              <dd className="font-medium text-income tabular">{formatMoney(totals.income, currency)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Expenses</dt>
              <dd className="font-medium text-expense tabular">{formatMoney(totals.expense, currency)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Net</dt>
              <dd className="font-medium text-foreground tabular">
                {formatMoney(totals.net, currency, { signDisplay: 'exceptZero' })}
              </dd>
            </div>
          </dl>

          {isDesktop ? (
            <TransactionTable
              transactions={visible}
              categoryById={categoryById}
              sort={filters.sort}
              onSortChange={(sort) => update({ sort })}
            />
          ) : (
            <TransactionList
              transactions={visible}
              categoryById={categoryById}
              grouped={filters.sort.startsWith('date')}
            />
          )}

          {filtered.length > limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                Show more ({filtered.length - limit} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
