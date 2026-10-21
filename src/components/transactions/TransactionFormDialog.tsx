import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Trash } from 'lucide-react'
import { type FormEvent, useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '@/components/categories/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Textarea } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { repository } from '@/db/repository'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/dates'
import { parseAmount } from '@/lib/money'
import { cn, errorMessage } from '@/lib/utils'
import { useFinanceStore } from '@/store/useFinanceStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { closeTransactionSheet, toast, useUiStore } from '@/store/useUiStore'
import type { TransactionType } from '@/types/finance'
import { deleteTransactionWithUndo } from './actions'

/** Global add/edit sheet, opened from the FAB, the sidebar or any transaction row. */
export function TransactionFormDialog() {
  const sheet = useUiStore((s) => s.transactionSheet)
  return (
    <Dialog
      open={sheet.open}
      onOpenChange={(open) => !open && closeTransactionSheet()}
      title={sheet.editing ? 'Edit transaction' : 'New transaction'}
    >
      <TransactionForm />
    </Dialog>
  )
}

function TransactionForm() {
  const { editing, defaultType, defaultCategoryId } = useUiStore((s) => s.transactionSheet)
  const categories = useFinanceStore((s) => s.categories)
  const transactions = useFinanceStore((s) => s.transactions)
  const currency = useSettingsStore((s) => s.currency)
  const formId = useId()

  // Usage counts sort the category chips by how often they are used (fast entry).
  const usage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of transactions) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1)
    return counts
  }, [transactions])

  const lastUsedCategory = (type: TransactionType) => transactions.find((t) => t.type === type)?.categoryId

  const [type, setType] = useState<TransactionType>(editing?.type ?? defaultType)
  const [amountText, setAmountText] = useState(editing ? String(editing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | undefined>(
    editing?.categoryId ?? defaultCategoryId ?? lastUsedCategory(editing?.type ?? defaultType),
  )
  const [dateValue, setDateValue] = useState(() => toDateTimeLocalValue(editing?.date ?? new Date().toISOString()))
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const typeCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === type)
        .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name)),
    [categories, type, usage],
  )
  const categoryMissing = !!editing && !!categoryId && !categories.some((c) => c.id === categoryId)

  const changeType = (next: TransactionType) => {
    setType(next)
    const current = categories.find((c) => c.id === categoryId)
    if (current?.type !== next) setCategoryId(lastUsedCategory(next))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const amount = parseAmount(amountText)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter an amount greater than zero.')
    if (!categoryId || categoryMissing) return setError('Choose a category.')

    setBusy(true)
    setError(null)
    try {
      const input = { amount, type, categoryId, date: fromDateTimeLocalValue(dateValue), note }
      if (editing) {
        await repository.updateTransaction(editing.id, input)
        toast({ title: 'Transaction updated', variant: 'success' })
      } else {
        await repository.addTransaction(input)
        toast({ title: type === 'income' ? 'Income added' : 'Expense added', variant: 'success' })
      }
      closeTransactionSheet()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <SegmentedControl
        label="Transaction type"
        value={type}
        onChange={changeType}
        className="w-full"
        options={[
          {
            value: 'expense',
            label: (
              <>
                <ArrowUpRight /> Expense
              </>
            ),
            activeClassName: 'text-expense',
          },
          {
            value: 'income',
            label: (
              <>
                <ArrowDownLeft /> Income
              </>
            ),
            activeClassName: 'text-income',
          },
        ]}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-amount`}>Amount</Label>
        <div className="relative">
          <Input
            id={`${formId}-amount`}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0.00"
            autoFocus={!editing}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className={cn(
              'h-14 pr-16 text-3xl font-semibold tabular md:text-3xl',
              type === 'income' ? 'text-income' : 'text-expense',
            )}
            aria-invalid={!!error && !(parseAmount(amountText) > 0)}
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            {currency}
          </span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Category</legend>
        {typeCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {type} categories yet.{' '}
            <Link to="/categories" className="text-primary underline" onClick={closeTransactionSheet}>
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {typeCategories.map((category) => {
              const selected = category.id === categoryId
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-center text-xs leading-tight transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-transparent bg-muted/60 hover:bg-accent',
                  )}
                >
                  <CategoryIcon category={category} size="sm" />
                  <span className="line-clamp-2 break-words">{category.name}</span>
                </button>
              )
            })}
          </div>
        )}
        {categoryMissing && (
          <p className="text-sm text-warning">The original category was deleted on another device. Pick a new one.</p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-date`}>Date &amp; time</Label>
          <Input
            id={`${formId}-date`}
            type="datetime-local"
            required
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:row-span-2">
          <Label htmlFor={`${formId}-note`}>Note</Label>
          <Textarea
            id={`${formId}-note`}
            placeholder="Optional comment"
            maxLength={500}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="sm:h-full"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-expense">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-4 flex gap-2 border-t bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
        {editing && (
          <Button
            variant="ghost"
            className="text-expense hover:text-expense"
            onClick={() => {
              closeTransactionSheet()
              void deleteTransactionWithUndo(editing)
            }}
          >
            <Trash /> Delete
          </Button>
        )}
        <Button type="submit" className="ml-auto min-w-32 flex-1 sm:flex-none" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" />}
          {editing ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  )
}
