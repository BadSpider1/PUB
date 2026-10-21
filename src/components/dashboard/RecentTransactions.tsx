import { ArrowRight, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { openNewTransaction } from '@/store/useUiStore'
import type { Category, Transaction } from '@/types/finance'

const RECENT_COUNT = 12

interface RecentTransactionsProps {
  /** Newest first. */
  transactions: Transaction[]
  categoryById: Map<string, Category>
}

export function RecentTransactions({ transactions, categoryById }: RecentTransactionsProps) {
  const recent = transactions.slice(0, RECENT_COUNT)
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent transactions</CardTitle>
        {transactions.length > 0 && (
          <Link
            to="/transactions"
            className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="size-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1 px-2 sm:px-3">
        {recent.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            description="Track your first expense or income – it is stored on this device right away."
            action={<Button onClick={() => openNewTransaction()}>Add transaction</Button>}
          />
        ) : (
          <ul className="flex flex-col">
            {recent.map((t) => (
              <li key={t.id}>
                <TransactionRow transaction={t} category={categoryById.get(t.categoryId)} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
