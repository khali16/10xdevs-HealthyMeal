import * as React from 'react'
import { Button } from '@/components/ui/button'

type RecipeEditFooterActionsProps = {
  isDirty: boolean
  isSaving: boolean
  onCancel: () => void
  onSave: () => void
}

export const RecipeEditFooterActions: React.FC<RecipeEditFooterActionsProps> = ({
  isDirty,
  isSaving,
  onCancel,
  onSave,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
      <div className="text-sm text-muted-foreground">
        {isDirty ? 'Masz niezapisane zmiany.' : 'Wszystkie zmiany są zapisane.'}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Anuluj
        </Button>
        <Button type="button" onClick={onSave} disabled={isSaving || !isDirty}>
          {isSaving ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
      </div>
    </div>
  )
}
