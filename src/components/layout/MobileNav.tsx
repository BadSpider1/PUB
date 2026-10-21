import { Plus } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { openNewTransaction } from '@/store/useUiStore'
import { Logo } from './Logo'
import { NAV_ITEMS } from './navigation'
import { SyncIndicator } from './SyncIndicator'

/** Phone top bar: brand + storage status. Respects the iOS status bar safe area. */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo className="text-[15px]" />
        <SyncIndicator compact />
      </div>
    </header>
  )
}

/** Phone bottom navigation bar (Dashboard, Transactions, Settings). */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-stretch">
        {NAV_ITEMS.filter((item) => !item.desktopOnly).map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Floating action button for quick transaction entry on phones. */
export function Fab() {
  return (
    <button
      type="button"
      onClick={() => openNewTransaction()}
      aria-label="Add transaction"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-7" strokeWidth={2.5} />
    </button>
  )
}
