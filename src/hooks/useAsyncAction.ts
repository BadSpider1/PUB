import { useCallback, useState } from 'react'
import { errorMessage } from '@/lib/utils'
import { toast } from '@/store/useUiStore'

/**
 * Runs an async action with a busy flag and an error toast.
 * The action is invoked synchronously, so popups opened inside it keep the click's user activation.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = useCallback((key: string, action: () => Promise<unknown>) => {
    setBusy(key)
    let promise: Promise<unknown>
    try {
      promise = action()
    } catch (error) {
      promise = Promise.reject(error)
    }
    promise
      .catch((error: unknown) => toast({ title: 'Something went wrong', description: errorMessage(error), variant: 'error' }))
      .finally(() => setBusy(null))
  }, [])
  return { busy, run }
}
