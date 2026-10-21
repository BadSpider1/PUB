import { ChartPie, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { CategoryIcon } from '@/components/categories/CategoryIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useIsDark } from '@/hooks/useTheme'
import { displayColor, NEUTRAL_COLOR } from '@/lib/colors'
import { formatMonthYear, isInMonth, type MonthRef } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/useSettingsStore'
import { openNewTransaction } from '@/store/useUiStore'
import type { Category, Transaction } from '@/types/finance'

/** A doughnut reads well up to ~6 segments; smaller categories fold into "Other". */
const MAX_SLICES = 6
const OTHER_KEY = '__other__'

interface Slice {
  key: string
  name: string
  value: number
  color: string
  category?: Category
}

function buildSlices(
  transactions: Transaction[],
  categoryById: Map<string, Category>,
  month: MonthRef,
  dark: boolean,
): Slice[] {
  const cents = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || !isInMonth(t.date, month)) continue
    cents.set(t.categoryId, (cents.get(t.categoryId) ?? 0) + Math.round(t.amount * 100))
  }
  const entries = [...cents.entries()].sort((a, b) => b[1] - a[1])
  const head = entries.length > MAX_SLICES ? entries.slice(0, MAX_SLICES - 1) : entries
  const tail = entries.slice(head.length)

  // Colour follows the category (entity), never its rank.
  const slices: Slice[] = head.map(([id, value]) => {
    const category = categoryById.get(id)
    return {
      key: id,
      name: category?.name ?? 'Uncategorized',
      value: value / 100,
      color: displayColor(category?.color ?? NEUTRAL_COLOR, dark),
      category,
    }
  })
  if (tail.length > 0) {
    slices.push({
      key: OTHER_KEY,
      name: `${tail.length} more categories`,
      value: tail.reduce((sum, [, value]) => sum + value, 0) / 100,
      color: dark ? '#5f5e59' : '#b3b1a9',
    })
  }
  return slices
}

interface ExpenseDoughnutProps {
  transactions: Transaction[]
  categoryById: Map<string, Category>
  month: MonthRef
}

export function ExpenseDoughnut({ transactions, categoryById, month }: ExpenseDoughnutProps) {
  const dark = useIsDark()
  const currency = useSettingsStore((s) => s.currency)
  const navigate = useNavigate()
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const slices = useMemo(
    () => buildSlices(transactions, categoryById, month, dark),
    [transactions, categoryById, month, dark],
  )
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const active = slices.find((s) => s.key === activeKey) ?? null
  const percent = (value: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0)

  const openTransactions = (slice: Slice) => {
    const params = new URLSearchParams({ year: String(month.year), month: String(month.month + 1), type: 'expense' })
    if (slice.key !== OTHER_KEY) params.set('category', slice.key)
    navigate(`/transactions?${params}`)
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
        <CardDescription>{formatMonthYear(month)}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {slices.length === 0 ? (
          <EmptyState
            icon={ChartPie}
            title="No expenses this month"
            description="Expenses you add for this month will show up here, grouped by category."
            action={
              <Button size="sm" onClick={() => openNewTransaction({ type: 'expense' })}>
                Add expense
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div
              className="relative aspect-square w-full max-w-[240px] shrink-0 lg:max-w-[220px]"
              role="img"
              aria-label={`Expenses for ${formatMonthYear(month)}: ${slices
                .map((s) => `${s.name} ${formatMoney(s.value, currency)}`)
                .join(', ')}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="68%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    // 2px surface-coloured gap between segments instead of borders.
                    stroke={dark ? '#1a1a19' : '#ffffff'}
                    strokeWidth={2}
                    rootTabIndex={-1}
                    isAnimationActive={false}
                    onMouseEnter={(_, index) => setActiveKey(slices[index]?.key ?? null)}
                    onMouseLeave={() => setActiveKey(null)}
                    onClick={(_, index) => {
                      const key = slices[index]?.key ?? null
                      setActiveKey((current) => (current === key ? null : key))
                    }}
                  >
                    {slices.map((slice) => (
                      <Cell
                        key={slice.key}
                        fill={slice.color}
                        fillOpacity={activeKey === null || activeKey === slice.key ? 1 : 0.3}
                        className="cursor-pointer outline-none"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Centre read-out doubles as the hover/focus layer. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                <span className="line-clamp-2 text-xs text-muted-foreground">{active ? active.name : 'Total spent'}</span>
                <span className="mt-0.5 text-lg font-semibold tracking-tight">
                  {formatMoney(active ? active.value : total, currency)}
                </span>
                {active && <span className="text-xs text-muted-foreground">{percent(active.value)}%</span>}
              </div>
            </div>

            {/* Legend + table view: every value is readable without hovering. */}
            <ul className="flex w-full min-w-0 flex-col gap-0.5" aria-label="Spending by category">
              {slices.map((slice) => (
                <li key={slice.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveKey(slice.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onFocus={() => setActiveKey(slice.key)}
                    onBlur={() => setActiveKey(null)}
                    onClick={() => openTransactions(slice)}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent',
                      activeKey !== null && activeKey !== slice.key && 'opacity-60',
                    )}
                  >
                    {slice.category ? (
                      <CategoryIcon category={slice.category} size="sm" />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center">
                        <span className="size-3 rounded-full" style={{ backgroundColor: slice.color }} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                    <span className="w-11 shrink-0 text-right text-xs text-muted-foreground tabular">{percent(slice.value)}%</span>
                    <span className="shrink-0 text-right font-medium tabular">{formatMoney(slice.value, currency)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
