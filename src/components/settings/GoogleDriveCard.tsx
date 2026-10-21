import { Cloud, FlaskConical, LoaderCircle, LogIn, RefreshCw, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatRelativeTime } from '@/lib/dates'
import { isGoogleDriveConfigured, isGoogleSignInReady, preloadGoogle } from '@/sync/google/googleAuth'
import { DRIVE_FOLDER_NAME } from '@/sync/google/googleDriveAdapter'
import { storageManager } from '@/sync/storageManager'
import { useSyncStore } from '@/store/useSyncStore'
import { VAULT_FILE_NAME } from '@/types/vault'
import { InfoRow, Notice, TargetStateBadge } from './shared'

/** Tier 2 – Google Drive via OAuth (or a local simulation when no client id is configured). */
export function GoogleDriveCard() {
  const status = useSyncStore((s) => s.drive)
  const { busy, run } = useAsyncAction()
  const [googleReady, setGoogleReady] = useState(isGoogleSignInReady())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const connected = ['idle', 'syncing', 'error', 'offline'].includes(status.state)
  const isMock = status.mode === 'mock'

  // Load Google's scripts up front so the sign-in popup can open synchronously on click (iOS Safari).
  useEffect(() => {
    if (!isGoogleDriveConfigured || googleReady) return
    let cancelled = false
    preloadGoogle().then(
      () => !cancelled && setGoogleReady(true),
      (error: unknown) => !cancelled && setLoadError(error instanceof Error ? error.message : String(error)),
    )
    return () => {
      cancelled = true
    }
  }, [googleReady, loadAttempt])

  const retryLoad = () => {
    setLoadError(null)
    setLoadAttempt((n) => n + 1)
  }

  // Must stay synchronous up to requestAccessToken – see connectGoogleDrive().
  const signIn = () => run('connect', () => storageManager.connectGoogleDrive())

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="size-5 text-muted-foreground" /> Google Drive
          </CardTitle>
          <TargetStateBadge state={status.state} />
        </div>
        <CardDescription>
          Works on every device, including iPhone and iPad. Saves to{' '}
          <code className="text-foreground">
            {DRIVE_FOLDER_NAME}/{VAULT_FILE_NAME}
          </code>{' '}
          in your Drive. The app can only see files it created.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {status.state === 'not-configured' && (
          <Notice>
            Google sign-in is not configured for this installation. Set <code>VITE_GOOGLE_CLIENT_ID</code> in{' '}
            <code>.env.local</code> (see README), or try the sync flow with a simulated Drive stored in this browser.
          </Notice>
        )}
        {isMock && connected && (
          <Notice>Demo mode: the “Drive” file is kept in this browser’s localStorage. It is not a real backup.</Notice>
        )}
        {status.state === 'expired' && (
          <Notice tone="warning">
            Google sessions last about an hour. Reconnect to continue syncing – your changes are kept locally until then.
          </Notice>
        )}
        {status.state === 'offline' && <Notice>Offline. Changes will be uploaded when you are back online.</Notice>}
        {status.state === 'error' && status.error && <Notice tone="error">{status.error}</Notice>}
        {loadError && status.state !== 'not-configured' && !connected && <Notice tone="error">{loadError}</Notice>}

        {(connected || status.state === 'expired') && (
          <dl className="divide-y">
            <InfoRow label="Account">{status.label ?? '—'}</InfoRow>
            <InfoRow label="Last synced">{status.lastSyncAt ? formatRelativeTime(status.lastSyncAt) : 'Never'}</InfoRow>
          </dl>
        )}
      </CardContent>

      <CardFooter className="flex-wrap">
        {status.state === 'not-configured' && (
          <Button variant="secondary" onClick={() => run('mock', () => storageManager.connectMockDrive())} disabled={busy !== null}>
            {busy === 'mock' ? <LoaderCircle className="animate-spin" /> : <FlaskConical />}
            Try simulated Drive
          </Button>
        )}

        {(status.state === 'disconnected' || status.state === 'expired') &&
          (loadError ? (
            <Button variant="outline" onClick={retryLoad}>
              <RefreshCw /> Retry loading Google
            </Button>
          ) : (
            <Button onClick={signIn} disabled={busy !== null || !googleReady}>
              {busy === 'connect' || !googleReady ? <LoaderCircle className="animate-spin" /> : <LogIn />}
              {!googleReady ? 'Loading Google…' : status.state === 'expired' ? 'Reconnect' : 'Sync with Google Drive'}
            </Button>
          ))}

        {connected && (
          <>
            <Button
              variant="secondary"
              onClick={() => run('sync', () => storageManager.syncNow('drive'))}
              disabled={busy !== null || status.state === 'syncing'}
            >
              <RefreshCw className={status.state === 'syncing' ? 'animate-spin' : undefined} /> Sync now
            </Button>
            {status.canOverwriteRemote && (
              <Button variant="outline" onClick={() => setConfirmOverwrite(true)}>
                Overwrite file
              </Button>
            )}
          </>
        )}

        {(connected || status.state === 'expired') && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => run('disconnect', () => storageManager.disconnectDrive())}
            disabled={busy !== null}
          >
            <Unplug /> Disconnect
          </Button>
        )}
      </CardFooter>

      <ConfirmDialog
        open={confirmOverwrite}
        onOpenChange={setConfirmOverwrite}
        title={`Overwrite ${VAULT_FILE_NAME} in Drive?`}
        description="The file in Google Drive could not be read. Replace it with the data from this device?"
        confirmLabel="Overwrite"
        destructive
        onConfirm={() => storageManager.overwriteRemote('drive')}
      />
    </Card>
  )
}
