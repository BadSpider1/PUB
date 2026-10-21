import { liveQuery } from 'dexie'
import { create } from 'zustand'
import { repository } from '@/db/repository'
import type { Category, FinanceData, Transaction } from '@/types/finance'

interface FinanceState {
  ready: boolean
  error: string | null
  categories: Category[]
  /** Sorted newest first. */
  transactions: Transaction[]
  categoryById: Map<string, Category>
}

/**
 * Reactive in-memory mirror of the Dexie tables. Dexie stays the source of truth:
 * components read from here, mutations go through `repository`, and `watchFinanceData`
 * pushes every committed change (from this tab, other tabs or a sync) back into the store.
 */
export const useFinanceStore = create<FinanceState>(() => ({
  ready: false,
  error: null,
  categories: [],
  transactions: [],
  categoryById: new Map(),
}))

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
}

function hydrate({ categories, transactions }: FinanceData): void {
  const sorted = sortCategories(categories)
  useFinanceStore.setState({
    ready: true,
    error: null,
    categories: sorted,
    transactions: [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    categoryById: new Map(sorted.map((c) => [c.id, c])),
  })
}

/**
 * Observe all synced tables. `onChange` receives the full snapshot after every committed
 * write – used to refresh the UI store and to trigger vault syncing.
 */
export function watchFinanceData(onChange?: (data: FinanceData) => void): () => void {
  // getSnapshot reads all tables in one read transaction, so a snapshot never straddles a write.
  const subscription = liveQuery(() => repository.getSnapshot()).subscribe({
    next: (data) => {
      hydrate(data)
      onChange?.(data)
    },
    error: (error: unknown) => {
      console.error('Failed to read the local database', error)
      useFinanceStore.setState({
        ready: true,
        error: 'Could not open the local database. Private browsing modes may block IndexedDB.',
      })
    },
  })
  return () => subscription.unsubscribe()
}
