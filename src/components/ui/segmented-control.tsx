import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Classes applied when this option is selected (e.g. income/expense colours). */
  activeClassName?: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
  size?: 'sm' | 'default'
}

/** A row of mutually exclusive toggle buttons (radio group semantics). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'default',
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg bg-muted p-1', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap transition-colors [&_svg]:size-4',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
              selected
                ? cn('bg-card text-foreground shadow-sm dark:bg-accent', option.activeClassName)
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
