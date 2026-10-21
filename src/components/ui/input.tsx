import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const fieldClasses =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm'

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(fieldClasses, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClasses, 'min-h-20 resize-y py-2', className)} {...props} />
}

/** Native <select> – best accessibility and the platform picker on mobile. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        fieldClasses,
        'h-10 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23898781%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-8 [&>option]:bg-card [&>option]:text-card-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-sm leading-none font-medium select-none', className)} {...props} />
}
