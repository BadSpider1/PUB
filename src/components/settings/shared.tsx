import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { TargetState } from '@/store/useSyncStore'

const STATE_BADGES: Record<TargetState, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' }> = {
  unsupported: { label: 'Not supported here', variant: 'outline' },
  'not-configured': { label: 'Not configured', variant: 'outline' },
  disconnected: { label: 'Not connected', variant: 'outline' },
  'needs-permission': { label: 'Permission needed', variant: 'warning' },
  expired: { label: 'Session expired', variant: 'warning' },
  idle: { label: 'Connected', variant: 'success' },
  syncing: { label: 'Syncing…', variant: 'default' },
  offline: { label: 'Offline', variant: 'secondary' },
  error: { label: 'Error', variant: 'destructive' },
}

export function TargetStateBadge({ state }: { state: TargetState }) {
  const { label, variant } = STATE_BADGES[state]
  return <Badge variant={variant}>{label}</Badge>
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const tones = {
    info: 'bg-muted text-muted-foreground',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-destructive/10 text-expense',
  }
  return <div className={`rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>
}
