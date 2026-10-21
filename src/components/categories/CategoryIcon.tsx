import { createElement } from 'react'
import { displayColor, NEUTRAL_COLOR, withAlpha } from '@/lib/colors'
import { getCategoryIcon, UNKNOWN_CATEGORY_ICON } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useIsDark } from '@/hooks/useTheme'
import type { Category } from '@/types/finance'

const SIZES = {
  sm: 'size-8 [&_svg]:size-4',
  md: 'size-10 [&_svg]:size-5',
  lg: 'size-12 [&_svg]:size-6',
}

interface CategoryIconProps {
  /** Undefined renders the "unknown category" placeholder (category deleted on another device). */
  category?: Pick<Category, 'color' | 'icon'>
  /** Override the icon/color without a category (previews in the category form). */
  color?: string
  icon?: string
  size?: keyof typeof SIZES
  className?: string
}

/** Category glyph on a tinted circle; the tint keeps the icon legible in both themes. */
export function CategoryIcon({ category, color, icon, size = 'md', className }: CategoryIconProps) {
  const dark = useIsDark()
  const resolvedColor = displayColor(color ?? category?.color ?? NEUTRAL_COLOR, dark)
  const Icon = category || icon ? getCategoryIcon(icon ?? category?.icon) : UNKNOWN_CATEGORY_ICON
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full', SIZES[size], className)}
      style={{ backgroundColor: withAlpha(resolvedColor, dark ? 0.22 : 0.14), color: resolvedColor }}
    >
      {createElement(Icon, { strokeWidth: 2.25 })}
    </span>
  )
}
