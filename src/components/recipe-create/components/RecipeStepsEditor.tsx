import * as React from 'react'
import { Button } from '@/components/ui/button'
import { RecipeStepRow } from './RecipeStepRow'
import type { RecipeStepDraftVM } from '../types'

type RecipeStepsEditorProps = {
  items: RecipeStepDraftVM[]
  onChange: (id: string, patch: Partial<RecipeStepDraftVM>) => void
  onAdd: () => void
  onRemove: (id: string) => void
  errorsById?: Record<string, { text?: string }>
  error?: string
}

export const RecipeStepsEditor: React.FC<RecipeStepsEditorProps> = ({
  items,
  onAdd,
  onChange,
  onRemove,
  errorsById,
  error,
}) => {
  return (
    <fieldset className="rounded-lg border border-dashed p-4" data-testid="recipe-steps-editor">
      <legend className="px-2 text-sm font-medium">Kroki</legend>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex flex-col gap-4">
        {items.length ? (
          items.map((item, index) => (
            <RecipeStepRow
              key={item.id}
              index={index}
              item={item}
              onChange={(patch) => onChange(item.id, patch)}
              onRemove={() => onRemove(item.id)}
              error={errorsById?.[item.id]?.text}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Brak kroków. Dodaj pierwszy krok.</p>
        )}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            Dodaj krok
          </Button>
        </div>
      </div>
    </fieldset>
  )
}
