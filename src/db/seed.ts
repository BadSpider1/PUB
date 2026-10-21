import type { CategoryIconName } from '@/lib/icons'
import type { Category, TransactionType } from '@/types/finance'

/**
 * Default categories use fixed ids and a fixed, old timestamp. Two devices that are set up
 * independently therefore seed *identical* records, so merging their vaults never creates
 * duplicates, and any user edit (newer `updatedAt`) always wins over the seed.
 */
const SEED_TIMESTAMP = '2024-01-01T00:00:00.000Z'

function seed(id: string, name: string, type: TransactionType, color: string, icon: CategoryIconName): Category {
  return { id, name, type, color, icon, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP }
}

export const DEFAULT_CATEGORIES: readonly Category[] = [
  // Expenses. Colours follow the validated categorical slot order along the typical
  // spending magnitude, so slices that usually sit next to each other in the doughnut
  // are pairs that were checked for colour-blind separation.
  seed('seed-housing', 'Housing', 'expense', '#2a78d6', 'House'),
  seed('seed-food', 'Food & Groceries', 'expense', '#eb6834', 'ShoppingCart'),
  seed('seed-transport', 'Transport', 'expense', '#1baf7a', 'Car'),
  seed('seed-utilities', 'Utilities', 'expense', '#eda100', 'Zap'),
  seed('seed-dining', 'Dining Out', 'expense', '#e87ba4', 'Utensils'),
  seed('seed-shopping', 'Shopping', 'expense', '#008300', 'ShoppingBag'),
  seed('seed-entertainment', 'Entertainment', 'expense', '#6250d6', 'Clapperboard'),
  seed('seed-health', 'Health', 'expense', '#e34948', 'HeartPulse'),
  seed('seed-other-expense', 'Other', 'expense', '#898781', 'Ellipsis'),
  // Income
  seed('seed-salary', 'Salary', 'income', '#008300', 'Briefcase'),
  seed('seed-freelance', 'Freelance', 'income', '#2a78d6', 'Laptop'),
  seed('seed-investments', 'Investments', 'income', '#6250d6', 'TrendingUp'),
  seed('seed-gifts', 'Gifts', 'income', '#e87ba4', 'Gift'),
  seed('seed-other-income', 'Other Income', 'income', '#898781', 'Coins'),
]
