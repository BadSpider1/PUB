import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label, Select } from '@/components/ui/input'
import { repository } from '@/db/repository'
import { toast } from '@/store/useUiStore'
import type { Category } from '@/types/finance'

interface DeleteCategoryDialogProps {
  category: Category | null
  categories: Category[]
  usageCount: number
  onOpenChange: (open: boolean) => void
}

/** Deleting a used category requires moving its transactions to another category of the same type. */
export function DeleteCategoryDialog({ category, categories, usageCount, onOpenChange }: DeleteCategoryDialogProps) {
  const [replacementId, setReplacementId] = useState('')
  const replacements = categories.filter((c) => c.type === category?.type && c.id !== category?.id)
  const needsReplacement = usageCount > 0

  return (
    <ConfirmDialog
      open={category !== null}
      onOpenChange={(open) => {
        if (!open) setReplacementId('')
        onOpenChange(open)
      }}
      title={`Delete “${category?.name ?? ''}”?`}
      description={
        needsReplacement
          ? `${usageCount} transaction${usageCount === 1 ? ' uses' : 's use'} this category. Choose where to move ${usageCount === 1 ? 'it' : 'them'}.`
          : 'This category is not used by any transaction.'
      }
      confirmLabel="Delete category"
      destructive
      confirmDisabled={needsReplacement && !replacementId}
      onConfirm={async () => {
        if (!category) return
        await repository.deleteCategory(category.id, needsReplacement ? replacementId : undefined)
        setReplacementId('')
        toast({ title: 'Category deleted', variant: 'success' })
      }}
    >
      {needsReplacement &&
        (replacements.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="replacement-category">Move transactions to</Label>
            <Select id="replacement-category" value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
              <option value="" disabled>
                Select a category…
              </option>
              {replacements.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <p className="text-sm text-warning">Create another {category?.type} category first, then delete this one.</p>
        ))}
    </ConfirmDialog>
  )
}
