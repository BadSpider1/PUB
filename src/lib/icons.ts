import {
  Baby,
  BadgeDollarSign,
  Banknote,
  Beer,
  Bike,
  Book,
  Briefcase,
  Building,
  Bus,
  Car,
  CircleQuestionMark,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Lightbulb,
  type LucideIcon,
  Palette,
  PawPrint,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sprout,
  Stethoscope,
  Store,
  Tag,
  Ticket,
  TrainFront,
  TrendingUp,
  Trophy,
  Tv,
  Umbrella,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  Wrench,
  Zap,
} from 'lucide-react'

/**
 * Icons selectable for categories. The key is the Lucide component name and is what gets
 * persisted in `Category.icon`, so keys must never be renamed (only added).
 */
export const CATEGORY_ICONS = {
  ShoppingCart,
  Utensils,
  Coffee,
  Pizza,
  Beer,
  Wine,
  Car,
  Fuel,
  Bus,
  TrainFront,
  Bike,
  Plane,
  House,
  Building,
  Zap,
  Lightbulb,
  Wifi,
  Smartphone,
  Tv,
  HeartPulse,
  Stethoscope,
  Pill,
  Dumbbell,
  Shirt,
  ShoppingBag,
  Store,
  Gem,
  Scissors,
  Clapperboard,
  Gamepad2,
  Ticket,
  Palette,
  Book,
  GraduationCap,
  Baby,
  Dog,
  PawPrint,
  Gift,
  Umbrella,
  Shield,
  Wrench,
  Sprout,
  Receipt,
  CreditCard,
  Landmark,
  Briefcase,
  Laptop,
  TrendingUp,
  PiggyBank,
  Wallet,
  Banknote,
  Coins,
  HandCoins,
  BadgeDollarSign,
  Trophy,
  Tag,
  Ellipsis,
} satisfies Record<string, LucideIcon>

export type CategoryIconName = keyof typeof CATEGORY_ICONS

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as CategoryIconName[]

export const FALLBACK_ICON: LucideIcon = Tag
/** Shown for transactions whose category was deleted on another device. */
export const UNKNOWN_CATEGORY_ICON: LucideIcon = CircleQuestionMark

export function isCategoryIconName(name: string): name is CategoryIconName {
  return Object.hasOwn(CATEGORY_ICONS, name)
}

export function getCategoryIcon(name: string | undefined): LucideIcon {
  return name && isCategoryIconName(name) ? CATEGORY_ICONS[name] : FALLBACK_ICON
}

/** "ShoppingCart" → "Shopping cart" (used for accessible labels in the icon picker). */
export function humanizeIconName(name: string): string {
  const words = name.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
