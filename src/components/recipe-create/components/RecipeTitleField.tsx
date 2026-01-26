import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecipeConfidenceBadge } from './RecipeConfidenceBadge'

type RecipeTitleFieldProps = {
  value: string
  confidence: number | null
  onChange: (value: string) => void
  error?: string
}

export const RecipeTitleField: React.FC<RecipeTitleFieldProps> = ({
  value,
  confidence,
  onChange,
  error,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="recipe-title">Tytuł przepisu</Label>
        <RecipeConfidenceBadge confidence={confidence} />
      </div>
      <Input
        id="recipe-title"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="np. Klasyczne naleśniki"
        aria-invalid={Boolean(error)}
        data-testid="recipe-title-input"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
