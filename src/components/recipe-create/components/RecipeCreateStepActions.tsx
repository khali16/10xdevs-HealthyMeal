import * as React from 'react'
import { Button } from '@/components/ui/button'

type RecipeCreateStepActionsProps = {
  canNext: boolean
  onNext: () => void
}

export const RecipeCreateStepActions: React.FC<RecipeCreateStepActionsProps> = ({ canNext, onNext }) => {
  return (
    <div className="flex justify-end">
      <Button type="button" onClick={onNext} disabled={!canNext}>
        Dalej
      </Button>
    </div>
  )
}
