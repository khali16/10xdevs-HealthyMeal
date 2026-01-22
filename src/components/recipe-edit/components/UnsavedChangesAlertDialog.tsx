import * as React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type UnsavedChangesAlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmLeave: () => void
}

export const UnsavedChangesAlertDialog: React.FC<UnsavedChangesAlertDialogProps> = ({
  open,
  onOpenChange,
  onConfirmLeave,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Masz niezapisane zmiany</AlertDialogTitle>
          <AlertDialogDescription>
            Jeśli wyjdziesz teraz, zmiany w przepisie zostaną utracone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zostań</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmLeave}>Wyjdź bez zapisu</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
