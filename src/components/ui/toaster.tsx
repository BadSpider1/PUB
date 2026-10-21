import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dismissToast, useUiStore } from '@/store/useUiStore'

const ICONS = { default: Info, success: CircleCheck, error: CircleAlert }
const ICON_COLORS = { default: 'text-primary', success: 'text-success', error: 'text-expense' }

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-center gap-2 px-4 md:top-auto md:right-6 md:bottom-6 md:left-auto md:items-end md:px-0"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant]
        return (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border bg-card p-3 pr-2 text-card-foreground shadow-lg"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_COLORS[t.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm break-words text-muted-foreground">{t.description}</p>}
              {t.action && (
                <button
                  type="button"
                  className="mt-1.5 text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    t.action?.onClick()
                    dismissToast(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
