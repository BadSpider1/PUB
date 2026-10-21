import { repository } from '@/db/repository'
import { errorMessage } from '@/lib/utils'
import { toast } from '@/store/useUiStore'
import type { Transaction } from '@/types/finance'

/** Delete immediately and offer an Undo toast instead of a confirmation prompt. */
export async function deleteTransactionWithUndo(transaction: Transaction): Promise<void> {
  try {
    await repository.deleteTransaction(transaction.id)
    toast({
      title: 'Transaction deleted',
      durationMs: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          repository.restoreTransaction(transaction).catch((error: unknown) =>
            toast({ title: 'Could not restore the transaction', description: errorMessage(error), variant: 'error' }),
          )
        },
      },
    })
  } catch (error) {
    toast({ title: 'Could not delete the transaction', description: errorMessage(error), variant: 'error' })
  }
}
