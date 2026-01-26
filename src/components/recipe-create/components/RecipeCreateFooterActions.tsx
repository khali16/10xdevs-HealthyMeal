import * as React from 'react'
import { Button } from '@/components/ui/button'

type RecipeCreateFooterActionsProps = {
  onBack: () => void
  onSave: () => void
  isSaving: boolean
  isSaveDisabled?: boolean
}

export const RecipeCreateFooterActions: React.FC<RecipeCreateFooterActionsProps> = ({
  onBack,
  onSave,
  isSaving,
  isSaveDisabled = false,
}) => {
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" onClick={onBack} disabled={isSaving} data-testid="recipe-back-button">
        Wstecz
      </Button>
      <Button type="button" onClick={onSave} disabled={isSaving || isSaveDisabled} data-testid="recipe-save-button">
        {isSaving ? 'Zapisywanie...' : 'Zapisz'}
      </Button>
    </div>
  )
}
