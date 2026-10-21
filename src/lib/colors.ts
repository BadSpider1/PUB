/**
 * Category color presets. The first eight are a categorical palette validated for
 * colour-vision-deficiency separation on both the light and dark surfaces, in this order;
 * default categories use them so the dashboard doughnut stays readable out of the box.
 */
export const CATEGORY_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#6250d6', // violet
  '#e34948', // red
  '#0e9fb3', // cyan
  '#9a6b3f', // brown
  '#64748b', // slate
  '#898781', // neutral gray
] as const

/**
 * The validated palette has dedicated steps for dark surfaces. Categories store one hex,
 * so presets are swapped for their dark step at render time; custom colours render as-is.
 */
const DARK_STEPS: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#eb6834': '#d95926',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#e87ba4': '#d55181',
  '#008300': '#008300',
  '#6250d6': '#9085e9',
  '#e34948': '#e66767',
}

export function displayColor(hex: string, dark: boolean): string {
  const normalized = hex.toLowerCase()
  return dark ? (DARK_STEPS[normalized] ?? normalized) : normalized
}

/** Colour of the "Other" slice and of transactions whose category no longer exists. */
export const NEUTRAL_COLOR = '#898781'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

/** Accepts "#abc", "abc", "#AABBCC" → "#aabbcc"; returns null for anything else. */
export function normalizeHexColor(value: string): string | null {
  let hex = value.trim().toLowerCase()
  if (!hex.startsWith('#')) hex = `#${hex}`
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
  }
  return HEX_COLOR.test(hex) ? hex : null
}

/** `#rrggbb` + alpha → `rgb(r g b / a)` for tinted backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = normalizeHexColor(hex) ?? NEUTRAL_COLOR
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
