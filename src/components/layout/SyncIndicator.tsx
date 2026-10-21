import { CloudAlert, CloudCheck, CloudOff, HardDrive, type LucideIcon, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { describeStorageMode, type TargetStatus, useSyncStore } from '@/store/useSyncStore'

interface Summary {
  icon: LucideIcon
  label: string
  tone: 'muted' | 'ok' | 'warn' | 'busy'
}

function summarize(folder: TargetStatus, drive: TargetStatus): Summary {
  const states = [folder.state, drive.state]
  if (states.includes('syncing')) return { icon: RefreshCw, label: 'Syncing…', tone: 'busy' }
  if (states.some((s) => s === 'error' || s === 'needs-permission' || s === 'expired')) {
    return { icon: CloudAlert, label: 'Sync needs attention', tone: 'warn' }
  }
  if (states.includes('offline')) return { icon: CloudOff, label: 'Offline – saved locally', tone: 'muted' }
  if (states.includes('idle')) return { icon: CloudCheck, label: `Synced · ${describeStorageMode(folder, drive)}`, tone: 'ok' }
  return { icon: HardDrive, label: 'Browser only', tone: 'muted' }
}

const TONES = {
  muted: 'text-muted-foreground',
  ok: 'text-success',
  warn: 'text-warning',
  busy: 'text-primary',
}

/** Compact storage status; links to the storage settings. */
export function SyncIndicator({ compact = false, className }: { compact?: boolean; className?: string }) {
  const folder = useSyncStore((s) => s.folder)
  const drive = useSyncStore((s) => s.drive)
  const { icon: Icon, label, tone } = summarize(folder, drive)

  return (
    <Link
      to="/settings"
      title={label}
      aria-label={`Storage status: ${label}`}
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-lg text-xs font-medium transition-colors hover:bg-accent',
        compact ? 'p-2' : 'px-2.5 py-2',
        className,
      )}
    >
      <Icon className={cn('size-4 shrink-0', TONES[tone], tone === 'busy' && 'animate-spin')} />
      {!compact && <span className="truncate text-muted-foreground">{label}</span>}
    </Link>
  )
}
