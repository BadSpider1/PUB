import { CircleCheck, Download, Share, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isIosSafari, promptPwaInstall, usePwaInstall } from '@/hooks/usePwaInstall'

export function InstallCard() {
  const { promptEvent, installed } = usePwaInstall()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-muted-foreground" /> Install the app
        </CardTitle>
        <CardDescription>Runs full-screen, starts instantly and works without a connection.</CardDescription>
      </CardHeader>
      <CardContent>
        {installed ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CircleCheck className="size-4" /> Installed on this device.
          </p>
        ) : promptEvent ? (
          <Button onClick={() => void promptPwaInstall()}>
            <Download /> Install Finance Vault
          </Button>
        ) : isIosSafari() ? (
          <p className="text-sm text-muted-foreground">
            In Safari, tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> Share and then{' '}
            <strong className="text-foreground">Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use your browser’s menu and choose <strong className="text-foreground">Install app</strong> or{' '}
            <strong className="text-foreground">Add to Home screen</strong>.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
