import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  hint?: ReactNode
  tone?: 'default' | 'income' | 'expense' | 'primary'
  className?: string
}

const ICON_TONES = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  income: 'bg-income/15 text-income',
  expense: 'bg-expense/15 text-expense',
}

/** KPI tile. Values use proportional figures – tabular numerals are for aligned columns only. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'default', className }: StatCardProps) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-1 p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', ICON_TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight break-all sm:text-2xl lg:text-3xl">{value}</p>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}
