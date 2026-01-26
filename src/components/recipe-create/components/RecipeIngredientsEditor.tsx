import * as React from 'react'
import { Button } from '@/components/ui/button'
import { RecipeIngredientRow } from './RecipeIngredientRow'
import type { RecipeIngredientDraftVM } from '../types'

type RecipeIngredientsEditorProps = {
  items: RecipeIngredientDraftVM[]
  onChange: (id: string, patch: Partial<RecipeIngredientDraftVM>) => void
  onAdd: () => void
  onRemove: (id: string) => void
  errorsById?: Record<string, { text?: string; amount?: string; unit?: string }>
  error?: string
}

export const RecipeIngredientsEditor: React.FC<RecipeIngredientsEditorProps> = ({
  items,
  onAdd,
  onChange,
  onRemove,
  errorsById,
  error,
}) => {
  return (
    <fieldset className="rounded-lg border border-dashed p-4" data-testid="recipe-ingredients-editor">
      <legend className="px-2 text-sm font-medium">Składniki</legend>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="mt-3 flex flex-col gap-4">
        {items.length ? (
          items.map((item, index) => (
            <RecipeIngredientRow
              key={item.id}
              index={index}
              item={item}
              onChange={(patch) => onChange(item.id, patch)}
              onRemove={() => onRemove(item.id)}
              errors={errorsById?.[item.id]}
            />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Brak składników. Dodaj pierwszy składnik.</p>
        )}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            Dodaj składnik
          </Button>
        </div>
      </div>
    </fieldset>
  )
}
