import { RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'
import { toast } from '@/store/useUiStore'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Registers the service worker and asks before activating a new version. */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    toast({ title: 'Ready to work offline', variant: 'success' })
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex animate-toast-in items-center gap-3 rounded-xl border bg-card p-3 shadow-lg md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm"
    >
      <RefreshCw className="size-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm">A new version is available.</p>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  )
}
