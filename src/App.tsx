import { TriangleAlert } from 'lucide-react'
import { lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { useApplyTheme } from '@/hooks/useTheme'
import { useFinanceStore } from '@/store/useFinanceStore'

// Route-level code splitting; the service worker precaches every chunk, so pages still open offline.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage').then((m) => ({ default: m.TransactionsPage })))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

/**
 * Hash-based routing (`/#/transactions`) works on any static host – GitHub Pages, a sub-path,
 * or `file://`-like environments – without server rewrite rules.
 */
export function App() {
  useApplyTheme()
  const error = useFinanceStore((s) => s.error)

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <TriangleAlert className="size-10 text-warning" />
        <h1 className="text-lg font-semibold">Storage unavailable</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
