import { Download, FileJson, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { type ImportMode, storageManager } from '@/sync/storageManager'
import { toast } from '@/store/useUiStore'
import type { VaultFile } from '@/types/vault'

const MODES: { value: ImportMode; title: string; description: string }[] = [
  {
    value: 'merge',
    title: 'Merge',
    description: 'Add what is missing and keep the newer version of anything that exists in both.',
  },
  {
    value: 'replace',
    title: 'Replace everything',
    description: 'Make this device (and connected vaults) exactly match the backup. Other data is deleted.',
  },
]

/** Tier 3 – manual JSON export/import. */
export function BackupCard() {
  const { busy, run } = useAsyncAction()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; vault: VaultFile } | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')

  const chooseFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPending({ name: file.name, vault: await storageManager.readBackup(file) })
      setMode('merge')
    } catch (error) {
      toast({
        title: 'This file cannot be imported',
        description: error instanceof Error ? error.message : String(error),
        variant: 'error',
      })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const summary = pending?.vault.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="size-5 text-muted-foreground" /> Manual backup
        </CardTitle>
        <CardDescription>
          Download a copy of all data as JSON, or restore one. Works everywhere – a good habit even with sync enabled.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-wrap">
        <Button variant="secondary" onClick={() => run('export', () => storageManager.exportJson())} disabled={busy !== null}>
          <Download /> Export to JSON
        </Button>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload /> Import from JSON
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void chooseFile(e.target.files?.[0])}
        />
      </CardFooter>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Import backup"
        description={
          summary && (
            <>
              <strong className="text-foreground">{pending?.name}</strong> · {summary.transactions.length} transactions,{' '}
              {summary.categories.length} categories
              {pending && pending.vault.exportedAt !== new Date(0).toISOString() && (
                <> · exported {formatDateTime(pending.vault.exportedAt)}</>
              )}
            </>
          )
        }
        confirmLabel={mode === 'replace' ? 'Replace data' : 'Merge data'}
        destructive={mode === 'replace'}
        onConfirm={async () => {
          if (!pending) return
          const changed = await storageManager.importBackup(pending.vault, mode)
          toast({
            title: mode === 'replace' ? 'Backup restored' : 'Backup merged',
            description: `${changed} item${changed === 1 ? '' : 's'} updated.`,
            variant: 'success',
          })
        }}
      >
        <div>
          <div role="radiogroup" aria-label="Import mode" className="flex flex-col gap-2">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  mode === option.value ? 'border-primary bg-primary/10' : 'hover:bg-accent',
                )}
              >
                <p className="text-sm font-medium">{option.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  )
}
