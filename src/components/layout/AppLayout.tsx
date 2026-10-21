import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router'
import { TransactionFormDialog } from '@/components/transactions/TransactionFormDialog'
import { Toaster } from '@/components/ui/toaster'
import { useFinanceStore } from '@/store/useFinanceStore'
import { closeTransactionSheet, openNewTransaction, useUiStore } from '@/store/useUiStore'
import { BottomNav, Fab, MobileTopBar } from './MobileNav'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'
import { Sidebar } from './Sidebar'

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

function PageLoading() {
  return (
    <div className="flex justify-center py-24" aria-busy="true" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export function AppLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const ready = useFinanceStore((s) => s.ready)
  const { pathname } = useLocation()

  // The quick-entry sheet belongs to the page it was opened on.
  useEffect(() => closeTransactionSheet(), [pathname])

  // `?new=1` opens the quick-entry sheet (used by the PWA "Add transaction" shortcut).
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    openNewTransaction()
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Keyboard shortcut: "n" adds a transaction.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      if (useUiStore.getState().transactionSheet.open || document.querySelector('dialog[open]')) return
      event.preventDefault()
      openNewTransaction()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="min-h-dvh md:pl-64">
      <Sidebar />
      <MobileTopBar />
      <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:pt-8 md:pb-10">
        {ready ? (
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        ) : (
          <PageLoading />
        )}
      </main>
      <BottomNav />
      <Fab />
      <TransactionFormDialog />
      <PwaUpdatePrompt />
      <Toaster />
    </div>
  )
}
