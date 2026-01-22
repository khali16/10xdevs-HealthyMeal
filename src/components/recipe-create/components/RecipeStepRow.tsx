import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RecipeConfidenceBadge } from './RecipeConfidenceBadge'
import type { RecipeStepDraftVM } from '../types'

type RecipeStepRowProps = {
  index: number
  item: RecipeStepDraftVM
  onChange: (patch: Partial<RecipeStepDraftVM>) => void
  onRemove: () => void
  error?: string
}

export const RecipeStepRow: React.FC<RecipeStepRowProps> = ({
  index,
  item,
  onChange,
  onRemove,
  error,
}) => {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Krok {index + 1}</p>
        <RecipeConfidenceBadge confidence={item.confidence ?? null} />
      </div>
      <Textarea
        className="mt-3"
        value={item.text}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder="Opisz krok przygotowania..."
        rows={2}
        aria-invalid={Boolean(error)}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : <span />}
        <Button type="button" variant="outline" onClick={onRemove}>
          Usuń
        </Button>
      </div>
    </div>
  )
}
