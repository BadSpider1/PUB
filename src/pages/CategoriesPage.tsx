import { Pencil, Plus, Tags, Trash } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CategoryFormDialog } from '@/components/categories/CategoryFormDialog'
import { CategoryIcon } from '@/components/categories/CategoryIcon'
import { DeleteCategoryDialog } from '@/components/categories/DeleteCategoryDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { formatMoney } from '@/lib/money'
import { useFinanceStore } from '@/store/useFinanceStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { Category, TransactionType } from '@/types/finance'

interface Usage {
  count: number
  total: number
}

export function CategoriesPage() {
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const currency = useSettingsStore((s) => s.currency)
  const [type, setType] = useState<TransactionType>('expense')
  const [editing, setEditing] = useState<Category | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const usage = useMemo(() => {
    const map = new Map<string, Usage>()
    for (const t of transactions) {
      const entry = map.get(t.categoryId) ?? { count: 0, total: 0 }
      entry.count += 1
      entry.total = Math.round((entry.total + t.amount) * 100) / 100
      map.set(t.categoryId, entry)
    }
    return map
  }, [transactions])

  const visible = categories.filter((c) => c.type === type)
  const counts = { expense: 0, income: 0 }
  for (const c of categories) counts[c.type] += 1

  const openForm = (category: Category | null) => {
    setEditing(category)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise transactions with your own names, colours and icons."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus /> New category
          </Button>
        }
      />

      <SegmentedControl
        label="Category type"
        value={type}
        onChange={setType}
        className="mb-4 w-full sm:w-auto"
        options={[
          { value: 'expense', label: `Expenses (${counts.expense})` },
          { value: 'income', label: `Income (${counts.income})` },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`No ${type} categories`}
          description="Create one to start categorising transactions."
          action={<Button onClick={() => openForm(null)}>New category</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((category) => {
            const stats = usage.get(category.id)
            return (
              <li key={category.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <CategoryIcon category={category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{category.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {stats
                      ? `${stats.count} transaction${stats.count === 1 ? '' : 's'} · ${formatMoney(stats.total, currency)}`
                      : 'Not used yet'}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} onClick={() => openForm(category)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${category.name}`}
                  className="hover:text-expense"
                  onClick={() => setDeleting(category)}
                >
                  <Trash />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        defaultType={type}
        usageCount={editing ? (usage.get(editing.id)?.count ?? 0) : 0}
      />
      <DeleteCategoryDialog
        category={deleting}
        categories={categories}
        usageCount={deleting ? (usage.get(deleting.id)?.count ?? 0) : 0}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </>
  )
}
