import { Check, LoaderCircle } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { repository } from '@/db/repository'
import { CATEGORY_COLORS, normalizeHexColor } from '@/lib/colors'
import { CATEGORY_ICON_NAMES, CATEGORY_ICONS, humanizeIconName, isCategoryIconName } from '@/lib/icons'
import { cn, errorMessage } from '@/lib/utils'
import { toast } from '@/store/useUiStore'
import type { Category, TransactionType } from '@/types/finance'
import { CategoryIcon } from './CategoryIcon'

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Category to edit, or null to create one. */
  category: Category | null
  defaultType: TransactionType
  /** Number of transactions using the category; a used category cannot change type. */
  usageCount: number
}

export function CategoryFormDialog({ open, onOpenChange, category, defaultType, usageCount }: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={category ? 'Edit category' : 'New category'}>
      <CategoryForm
        category={category}
        defaultType={defaultType}
        usageCount={usageCount}
        onDone={() => onOpenChange(false)}
      />
    </Dialog>
  )
}

function CategoryForm({
  category,
  defaultType,
  usageCount,
  onDone,
}: Omit<CategoryFormDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const id = useId()
  const [name, setName] = useState(category?.name ?? '')
  const [type, setType] = useState<TransactionType>(category?.type ?? defaultType)
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0])
  const [hexText, setHexText] = useState(category?.color ?? CATEGORY_COLORS[0])
  const [icon, setIcon] = useState(category && isCategoryIconName(category.icon) ? category.icon : 'Tag')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const typeLocked = !!category && usageCount > 0

  const pickColor = (value: string) => {
    setColor(value)
    setHexText(value)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return setError('Please enter a name.')
    setBusy(true)
    setError(null)
    try {
      const input = { name, type, color, icon }
      if (category) await repository.updateCategory(category.id, input)
      else await repository.addCategory(input)
      toast({ title: category ? 'Category updated' : 'Category created', variant: 'success' })
      onDone()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
        <CategoryIcon color={color} icon={icon} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{name.trim() || 'Category name'}</p>
          <p className="text-xs text-muted-foreground capitalize">{type}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={60}
          autoFocus={!category}
          autoComplete="off"
          placeholder="e.g. Groceries"
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error && !name.trim()}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Type</span>
        <SegmentedControl
          label="Category type"
          value={type}
          onChange={(value) => !typeLocked && setType(value)}
          className={cn('w-full', typeLocked && 'pointer-events-none opacity-60')}
          options={[
            { value: 'expense', label: 'Expense', activeClassName: 'text-expense' },
            { value: 'income', label: 'Income', activeClassName: 'text-income' },
          ]}
        />
        {typeLocked && (
          <p className="text-xs text-muted-foreground">
            Used by {usageCount} transaction{usageCount === 1 ? '' : 's'}, so the type cannot change.
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Colour ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => pickColor(swatch)}
              className="flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-foreground"
              style={{ backgroundColor: swatch }}
            >
              {color === swatch && <Check className="size-4 text-white drop-shadow" />}
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            aria-label="Custom colour"
            value={color}
            onChange={(e) => pickColor(e.target.value)}
            className="size-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
          />
          <Input
            aria-label="Hex colour"
            value={hexText}
            maxLength={7}
            className="w-32 font-mono uppercase"
            onChange={(e) => {
              setHexText(e.target.value)
              const normalized = normalizeHexColor(e.target.value)
              if (normalized) setColor(normalized)
            }}
            onBlur={() => setHexText(color)}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Icon</legend>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {CATEGORY_ICON_NAMES.map((iconName) => {
            const Icon = CATEGORY_ICONS[iconName]
            const selected = icon === iconName
            return (
              <button
                key={iconName}
                type="button"
                title={humanizeIconName(iconName)}
                aria-label={humanizeIconName(iconName)}
                aria-pressed={selected}
                onClick={() => setIcon(iconName)}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-lg transition-colors',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
              </button>
            )
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-expense">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy} className="min-w-28">
          {busy && <LoaderCircle className="animate-spin" />}
          {category ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
