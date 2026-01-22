import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RecipeConfidenceBadge } from './RecipeConfidenceBadge'
import type { RecipeIngredientDraftVM } from '../types'

type RecipeIngredientRowProps = {
  index: number
  item: RecipeIngredientDraftVM
  onChange: (patch: Partial<RecipeIngredientDraftVM>) => void
  onRemove: () => void
  errors?: { text?: string; amount?: string; unit?: string }
}

export const RecipeIngredientRow: React.FC<RecipeIngredientRowProps> = ({
  index,
  item,
  onChange,
  onRemove,
  errors,
}) => {
  const handleAmountChange = (value: string) => {
    if (!value.trim()) {
      onChange({ amount: undefined })
      return
    }
    const parsed = Number(value.replace(',', '.'))
    onChange({ amount: Number.isFinite(parsed) ? parsed : undefined })
  }

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Składnik {index + 1}</p>
        <RecipeConfidenceBadge confidence={item.confidence ?? null} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
        <Input
          value={item.text}
          onChange={(event) => onChange({ text: event.target.value })}
          placeholder="np. mąka pszenna"
          aria-invalid={Boolean(errors?.text)}
        />
        <Input
          type="number"
          inputMode="decimal"
          value={item.amount ?? ''}
          onChange={(event) => handleAmountChange(event.target.value)}
          placeholder="Ilość"
          aria-invalid={Boolean(errors?.amount)}
        />
        <Input
          value={item.unit ?? ''}
          onChange={(event) => onChange({ unit: event.target.value })}
          placeholder="g / ml / szt"
          aria-invalid={Boolean(errors?.unit)}
        />
        <Button type="button" variant="outline" onClick={onRemove}>
          Usuń
        </Button>
      </div>
      {(errors?.text || errors?.amount || errors?.unit) && (
        <p className="mt-2 text-sm text-destructive">
          {errors?.text || errors?.amount || errors?.unit}
        </p>
      )}
    </div>
  )
}
