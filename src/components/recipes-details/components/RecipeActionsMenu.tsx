import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type RecipeActionsMenuProps = {
  onEdit: () => void
  onConfirmDelete: () => Promise<void> | void
  isDeleting: boolean
}

export function RecipeActionsMenu({
  onEdit,
  onConfirmDelete,
  isDeleting,
}: RecipeActionsMenuProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const handleConfirmDelete = React.useCallback(async () => {
    await onConfirmDelete()
    setDialogOpen(false)
  }, [onConfirmDelete])

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Więcej akcji">
            <span className="text-lg leading-none">⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>Edytuj</DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive">
              Usuń
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć przepis?</AlertDialogTitle>
          <AlertDialogDescription>
            Ta akcja przeniesie przepis do archiwum. Możesz go później przywrócić.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction disabled={isDeleting} onClick={handleConfirmDelete}>
            Usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

