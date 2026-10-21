import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** Sticky action row at the bottom (stays visible while the body scrolls). */
  footer?: ReactNode
  className?: string
}

/**
 * Responsive modal built on the native <dialog> element (focus trap, Esc, top layer and
 * inert background for free). Renders as a bottom sheet on phones and a centred dialog
 * from the `md` breakpoint. Content mounts only while open, so forms start fresh each time.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Prevent the page behind the sheet from scrolling (iOS rubber-banding in particular).
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault()
        onOpenChange(false)
      }}
      onClose={() => {
        if (open) onOpenChange(false)
      }}
      onClick={(event) => {
        // Clicks on the ::backdrop are reported on the <dialog> element itself.
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
      className={cn(
        'overflow-hidden bg-card p-0 text-card-foreground shadow-2xl open:flex open:flex-col',
        // Phone: bottom sheet
        'mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-full rounded-t-3xl border-t open:animate-sheet-in',
        // Tablet/desktop: centred dialog
        'md:m-auto md:max-h-[85dvh] md:w-[calc(100%-2rem)] md:max-w-lg md:rounded-2xl md:border md:open:animate-dialog-in',
        className,
      )}
    >
      {open && (
        <>
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" />
          <header className="flex shrink-0 items-start gap-3 px-5 pt-3 pb-2 md:pt-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg leading-tight font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="-mt-1 -mr-2 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-4">{children}</div>
          {footer && (
            <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  )
}
