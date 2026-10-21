import { LoaderCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { errorMessage } from '@/lib/utils'
import { Button } from './button'
import { Dialog } from './dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  confirmDisabled?: boolean
  /** May be async; the dialog shows a spinner and stays open with the error if it throws. */
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  destructive = false,
  confirmDisabled = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) setError(null)
    onOpenChange(next)
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" className="flex-1 md:flex-none" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            className="flex-1 md:ml-auto md:flex-none"
            onClick={confirm}
            disabled={busy || confirmDisabled}
          >
            {busy && <LoaderCircle className="animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-expense">
          {error}
        </p>
      )}
    </Dialog>
  )
}
