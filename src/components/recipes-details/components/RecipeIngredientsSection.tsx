import type { ScaledIngredientVM } from '../types'
import { Separator } from '@/components/ui/separator'

type RecipeIngredientsSectionProps = {
  items: ScaledIngredientVM[]
}

export function RecipeIngredientsSection({ items }: RecipeIngredientsSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Składniki</h2>
      <Separator className="my-3" />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak składników.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.key} className="flex justify-between gap-3">
              <span>{item.text}</span>
              <span className="text-muted-foreground">
                {item.amountDisplay ?? item.amountScaled ?? item.amountRaw ?? ''}
                {item.unit ? ` ${item.unit}` : ''}
                {item.noScale ? ' • bez skalowania' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

