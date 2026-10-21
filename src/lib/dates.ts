/** Calendar month in local time. `month` is 0-based like Date#getMonth. */
export interface MonthRef {
  year: number
  month: number
}

export function currentMonth(): MonthRef {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function isSameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month
}

export function isInMonth(iso: string, { year, month }: MonthRef): boolean {
  const d = new Date(iso)
  return d.getFullYear() === year && d.getMonth() === month
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO string → value for <input type="datetime-local"> in local time ("2026-10-21T14:05"). */
export function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Inverse of toDateTimeLocalValue. Strings without an offset are parsed as local time. */
export function fromDateTimeLocalValue(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

/** Local calendar-day key used for grouping ("2026-10-21"). */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatMonthYear({ year, month }: MonthRef, style: 'long' | 'short' = 'long'): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: style, year: 'numeric' })
}

export function monthName(month: number, style: 'long' | 'short' = 'long'): string {
  return new Date(2000, month, 1).toLocaleDateString(undefined, { month: style })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** "Today", "Yesterday" or e.g. "Mon, 19 Oct 2026". */
export function formatDayHeading(iso: string): string {
  const key = dayKey(iso)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (key === dayKey(today.toISOString())) return 'Today'
  if (key === dayKey(yesterday.toISOString())) return 'Yesterday'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export function formatRelativeTime(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}
