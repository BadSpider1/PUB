import { create } from 'zustand'
import type { Transaction, TransactionType } from '@/types/finance'
import { currentMonth, type MonthRef } from '@/lib/dates'
import { createId } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'error'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  action?: { label: string; onClick: () => void }
  durationMs: number
}

interface TransactionSheetState {
  open: boolean
  /** Transaction being edited, or null for a new one. */
  editing: Transaction | null
  defaultType: TransactionType
  defaultCategoryId?: string
}

interface UiState {
  transactionSheet: TransactionSheetState
  toasts: Toast[]
  /** Month shown on the dashboard; kept while navigating between pages. */
  dashboardMonth: MonthRef
}

export const useUiStore = create<UiState>(() => ({
  transactionSheet: { open: false, editing: null, defaultType: 'expense' },
  toasts: [],
  dashboardMonth: currentMonth(),
}))

export function setDashboardMonth(month: MonthRef): void {
  useUiStore.setState({ dashboardMonth: month })
}

export function openNewTransaction(defaults: { type?: TransactionType; categoryId?: string } = {}): void {
  useUiStore.setState({
    transactionSheet: {
      open: true,
      editing: null,
      defaultType: defaults.type ?? 'expense',
      defaultCategoryId: defaults.categoryId,
    },
  })
}

export function openEditTransaction(transaction: Transaction): void {
  useUiStore.setState({
    transactionSheet: { open: true, editing: transaction, defaultType: transaction.type },
  })
}

export function closeTransactionSheet(): void {
  useUiStore.setState((s) => ({ transactionSheet: { ...s.transactionSheet, open: false } }))
}

/** Show a notification. At most three are visible; older ones are dropped. */
export function toast(input: Omit<Toast, 'id' | 'variant' | 'durationMs'> & Partial<Pick<Toast, 'variant' | 'durationMs'>>): string {
  const id = createId()
  const item: Toast = { variant: 'default', durationMs: input.variant === 'error' ? 7000 : 4000, ...input, id }
  useUiStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), item] }))
  if (item.durationMs > 0) setTimeout(() => dismissToast(id), item.durationMs)
  return id
}

export function dismissToast(id: string): void {
  useUiStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}
