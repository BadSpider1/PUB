import { ArrowDownLeft, ArrowUpRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { ExpenseDoughnut } from '@/components/dashboard/ExpenseDoughnut'
import { MonthSwitcher } from '@/components/dashboard/MonthSwitcher'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { StatCard } from '@/components/dashboard/StatCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { isInMonth, monthName, shiftMonth } from '@/lib/dates'
import { computeTotals, formatMoney } from '@/lib/money'
import { useFinanceStore } from '@/store/useFinanceStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { setDashboardMonth, useUiStore } from '@/store/useUiStore'

/** "↑ 12% vs Sep" – direction is carried by icon and text, not colour. */
function Comparison({ current, previous, previousLabel }: { current: number; previous: number; previousLabel: string }) {
  if (previous === 0) return <span>No data for {previousLabel}</span>
  const change = Math.round(((current - previous) / previous) * 100)
  const Icon = change >= 0 ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5" aria-hidden />
      {change >= 0 ? '+' : ''}
      {change}% vs {previousLabel}
    </span>
  )
}

export function DashboardPage() {
  const transactions = useFinanceStore((s) => s.transactions)
  const categoryById = useFinanceStore((s) => s.categoryById)
  const currency = useSettingsStore((s) => s.currency)
  const month = useUiStore((s) => s.dashboardMonth)

  const stats = useMemo(() => {
    const previousMonth = shiftMonth(month, -1)
    return {
      balance: computeTotals(transactions).net,
      current: computeTotals(transactions.filter((t) => isInMonth(t.date, month))),
      previous: computeTotals(transactions.filter((t) => isInMonth(t.date, previousMonth))),
      previousLabel: monthName(previousMonth.month, 'short'),
    }
  }, [transactions, month])

  const money = (value: number, signDisplay: 'auto' | 'exceptZero' = 'auto') => formatMoney(value, currency, { signDisplay })

  return (
    <>
      <PageHeader title="Dashboard" actions={<MonthSwitcher value={month} onChange={setDashboardMonth} />} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard
          className="col-span-2 md:col-span-1"
          label="Total balance"
          value={money(stats.balance)}
          icon={Wallet}
          tone="primary"
          hint={`Net in ${monthName(month.month)}: ${money(stats.current.net, 'exceptZero')}`}
        />
        <StatCard
          label="Income"
          value={money(stats.current.income)}
          icon={ArrowDownLeft}
          tone="income"
          hint={<Comparison current={stats.current.income} previous={stats.previous.income} previousLabel={stats.previousLabel} />}
        />
        <StatCard
          label="Expenses"
          value={money(stats.current.expense)}
          icon={ArrowUpRight}
          tone="expense"
          hint={<Comparison current={stats.current.expense} previous={stats.previous.expense} previousLabel={stats.previousLabel} />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <ExpenseDoughnut transactions={transactions} categoryById={categoryById} month={month} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <RecentTransactions transactions={transactions} categoryById={categoryById} />
        </div>
      </div>
    </>
  )
}
