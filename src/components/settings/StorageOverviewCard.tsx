import { Cloud, Database, FileJson, FolderOpen, type LucideIcon, ShieldCheck } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useFinanceStore } from '@/store/useFinanceStore'
import { describeStorageMode, type TargetStatus, useSyncStore } from '@/store/useSyncStore'
import { TargetStateBadge } from './shared'

function TierRow({
  icon: Icon,
  tier,
  title,
  detail,
  status,
}: {
  icon: LucideIcon
  tier: number
  title: string
  detail: string
  status: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className="text-muted-foreground">Tier {tier} · </span>
          {title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {status}
    </li>
  )
}

function targetDetail(status: TargetStatus, fallback: string): string {
  return status.label ?? fallback
}

/** Overview of the storage tiers and which ones are active. */
export function StorageOverviewCard() {
  const folder = useSyncStore((s) => s.folder)
  const drive = useSyncStore((s) => s.drive)
  const transactionCount = useFinanceStore((s) => s.transactions.length)
  const categoryCount = useFinanceStore((s) => s.categories.length)
  const mode = describeStorageMode(folder, drive)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  const requestPersistence = async () => {
    const granted = (await navigator.storage?.persist?.()) ?? false
    setPersisted(granted)
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Current storage mode</CardDescription>
        <CardTitle className={cn('text-xl', mode === 'Browser Only' ? 'text-foreground' : 'text-success')}>{mode}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          <TierRow
            icon={Database}
            tier={0}
            title="This browser (IndexedDB)"
            detail={`${transactionCount} transactions · ${categoryCount} categories · works offline`}
            status={<Badge variant="success">Active</Badge>}
          />
          <TierRow
            icon={FolderOpen}
            tier={1}
            title="Local folder"
            detail={targetDetail(folder, 'finance_vault.json in a folder you pick')}
            status={<TargetStateBadge state={folder.state} />}
          />
          <TierRow
            icon={Cloud}
            tier={2}
            title="Google Drive"
            detail={targetDetail(drive, 'Personal Finance Vault/finance_vault.json')}
            status={<TargetStateBadge state={drive.state} />}
          />
          <TierRow
            icon={FileJson}
            tier={3}
            title="Manual backup"
            detail="Export / import a JSON file"
            status={<Badge variant="outline">Available</Badge>}
          />
        </ul>
        {persisted === false && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              The browser may clear local data when storage runs low. Ask it to keep your data permanently.
            </span>
            <Button size="sm" variant="outline" onClick={() => void requestPersistence()}>
              Keep data
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
