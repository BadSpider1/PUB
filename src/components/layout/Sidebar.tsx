import { Download, Plus } from 'lucide-react'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import { promptPwaInstall, usePwaInstall } from '@/hooks/usePwaInstall'
import { cn } from '@/lib/utils'
import { openNewTransaction } from '@/store/useUiStore'
import { Logo } from './Logo'
import { NAV_ITEMS } from './navigation'
import { SyncIndicator } from './SyncIndicator'

/** Desktop/tablet navigation (md and up). */
export function Sidebar() {
  const canInstall = usePwaInstall((s) => s.promptEvent !== null)

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card/60 px-3 py-5 backdrop-blur md:flex">
      <div className="px-3">
        <Logo />
      </div>

      <Button className="mx-1 mt-6" onClick={() => openNewTransaction()}>
        <Plus /> Add transaction
        <kbd className="ml-auto hidden rounded border border-primary-foreground/30 px-1.5 text-[10px] font-medium opacity-80 lg:inline">
          N
        </kbd>
      </Button>

      <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {canInstall && (
          <Button variant="outline" size="sm" className="mx-1" onClick={() => void promptPwaInstall()}>
            <Download /> Install app
          </Button>
        )}
        <SyncIndicator />
      </div>
    </aside>
  )
}
