import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { TransactionType } from '@/types/finance'

interface AmountTextProps {
  amount: number
  type: TransactionType
  className?: string
}

/** Signed, coloured amount. The +/− sign carries the meaning; colour only reinforces it. */
export function AmountText({ amount, type, className }: AmountTextProps) {
  const currency = useSettingsStore((s) => s.currency)
  const signed = type === 'income' ? amount : -amount
  return (
    <span className={cn('font-semibold whitespace-nowrap tabular', type === 'income' ? 'text-income' : 'text-expense', className)}>
      {formatMoney(signed, currency, { signDisplay: 'always' })}
    </span>
  )
}
