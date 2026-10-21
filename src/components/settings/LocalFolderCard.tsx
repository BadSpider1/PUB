import { FolderOpen, FolderSync, KeyRound, LoaderCircle, RefreshCw, Unplug } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatRelativeTime } from '@/lib/dates'
import { storageManager } from '@/sync/storageManager'
import { useSyncStore } from '@/store/useSyncStore'
import { VAULT_FILE_NAME } from '@/types/vault'
import { InfoRow, Notice, TargetStateBadge } from './shared'

/** Tier 1 – File System Access API. */
export function LocalFolderCard() {
  const status = useSyncStore((s) => s.folder)
  const { busy, run } = useAsyncAction()
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const connected = ['idle', 'syncing', 'error', 'offline'].includes(status.state)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="size-5 text-muted-foreground" /> Local folder vault
          </CardTitle>
          <TargetStateBadge state={status.state} />
        </div>
        <CardDescription>
          Keeps <code className="text-foreground">{VAULT_FILE_NAME}</code> in a folder on this computer – pick one inside
          iCloud Drive, Dropbox or Google Drive for desktop and their apps sync it to your other devices. Best on Chrome,
          Edge and Android.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {status.state === 'unsupported' && (
          <Notice>
            This browser cannot open local folders (Safari, Firefox and all iOS browsers). Use Google Drive sync or
            manual backups instead.
          </Notice>
        )}

        {status.state === 'needs-permission' && (
          <Notice tone="warning">
            The browser needs your permission again to edit <strong>{status.label}</strong>. Changes are saved locally
            in the meantime.
          </Notice>
        )}

        {status.state === 'error' && status.error && <Notice tone="error">{status.error}</Notice>}

        {(connected || status.state === 'needs-permission') && (
          <dl className="divide-y">
            <InfoRow label="Folder">{status.label}</InfoRow>
            <InfoRow label="File">{VAULT_FILE_NAME}</InfoRow>
            <InfoRow label="Last synced">{status.lastSyncAt ? formatRelativeTime(status.lastSyncAt) : 'Never'}</InfoRow>
          </dl>
        )}
      </CardContent>

      {status.state !== 'unsupported' && (
        <CardFooter className="flex-wrap">
          {status.state === 'disconnected' && (
            <Button onClick={() => run('connect', () => storageManager.connectFolder())} disabled={busy !== null}>
              {busy === 'connect' ? <LoaderCircle className="animate-spin" /> : <FolderOpen />}
              Select Local Folder (Vault)
            </Button>
          )}

          {status.state === 'needs-permission' && (
            <Button onClick={() => run('grant', () => storageManager.reconnectFolder())} disabled={busy !== null}>
              <KeyRound /> Grant access
            </Button>
          )}

          {connected && (
            <>
              <Button
                variant="secondary"
                onClick={() => run('sync', () => storageManager.syncNow('folder'))}
                disabled={busy !== null || status.state === 'syncing'}
              >
                <RefreshCw className={status.state === 'syncing' ? 'animate-spin' : undefined} /> Sync now
              </Button>
              <Button variant="outline" onClick={() => run('connect', () => storageManager.connectFolder())} disabled={busy !== null}>
                <FolderSync /> Change folder
              </Button>
              {status.canOverwriteRemote && (
                <Button variant="outline" onClick={() => setConfirmOverwrite(true)}>
                  Overwrite file
                </Button>
              )}
            </>
          )}

          {(connected || status.state === 'needs-permission') && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => run('disconnect', () => storageManager.disconnectFolder())}
              disabled={busy !== null}
            >
              <Unplug /> Disconnect
            </Button>
          )}
        </CardFooter>
      )}

      <ConfirmDialog
        open={confirmOverwrite}
        onOpenChange={setConfirmOverwrite}
        title={`Overwrite ${VAULT_FILE_NAME}?`}
        description="The file in the folder could not be read. Replace it with the data from this device? The current file content will be lost."
        confirmLabel="Overwrite"
        destructive
        onConfirm={() => storageManager.overwriteRemote('folder')}
      />
    </Card>
  )
}
