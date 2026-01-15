import { Button } from '@/components/ui/button'

type RecipeRatingControlProps = {
  value: number | null
  isPending: boolean
  onChange: (next: number) => void
  onClear: () => void
}

export function RecipeRatingControl({
  value,
  isPending,
  onChange,
  onClear,
}: RecipeRatingControlProps) {
  const handleSelect = (next: number) => {
    if (next < 1 || next > 5 || isPending) return
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Oceń przepis</div>
      <div role="radiogroup" aria-label="Ocena przepisu" className="flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating
          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isPending}
              onClick={() => handleSelect(rating)}
              className={`h-9 w-9 rounded-full border text-sm transition ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:border-primary'
              }`}
            >
              {rating}
            </button>
          )
        })}
      </div>
      {value != null ? (
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isPending}>
          Usuń ocenę
        </Button>
      ) : null}
    </div>
  )
}

