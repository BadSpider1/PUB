import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { currentMonth, formatMonthYear, isSameMonth, type MonthRef, shiftMonth } from '@/lib/dates'

interface MonthSwitcherProps {
  value: MonthRef
  onChange: (value: MonthRef) => void
}

export function MonthSwitcher({ value, onChange }: MonthSwitcherProps) {
  const isCurrent = isSameMonth(value, currentMonth())
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
      <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft />
      </Button>
      <button
        type="button"
        onClick={() => onChange(currentMonth())}
        disabled={isCurrent}
        title={isCurrent ? undefined : 'Back to the current month'}
        className="min-w-36 rounded-md px-2 py-1 text-center text-sm font-medium disabled:cursor-default enabled:hover:bg-accent"
        aria-live="polite"
      >
        {formatMonthYear(value)}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => onChange(shiftMonth(value, 1))}>
        <ChevronRight />
      </Button>
    </div>
  )
}
