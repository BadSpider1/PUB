import { ArrowLeftRight, LayoutDashboard, type LucideIcon, Settings, Tags } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Hidden from the phone bottom bar (reachable from Settings instead). */
  desktopOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/categories', label: 'Categories', icon: Tags, desktopOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]
