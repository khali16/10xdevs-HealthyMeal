import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { RecipeIngredientDTO } from '@/types'

type RecipeServingsScalerProps = {
  baseServings: number
  ingredients: RecipeIngredientDTO[]
  targetServings: number
  noScaleOverrides: Record<string, boolean>
  onTargetServingsChange: (next: number) => void
  onNoScaleOverridesChange: (next: Record<string, boolean>) => void
}

export function RecipeServingsScaler({
  baseServings,
  ingredients,
  targetServings,
  noScaleOverrides,
  onTargetServingsChange,
  onNoScaleOverridesChange,
}: RecipeServingsScalerProps) {
  const scalingDisabled = !Number.isFinite(baseServings) || baseServings <= 0
  const [showNoScale, setShowNoScale] = React.useState(false)
  const noScalePanelId = React.useId()
  const clampTarget = React.useCallback((value: number) => {
    if (!Number.isFinite(value)) return 1
    return Math.min(10000, Math.max(1, Math.round(value)))
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = clampTarget(Number(event.target.value))
    onTargetServingsChange(next)
  }

  const handleSliderChange = (value: number[]) => {
    const next = clampTarget(value[0] ?? 1)
    onTargetServingsChange(next)
  }

  const toggleNoScale = (key: string, next: boolean) => {
    onNoScaleOverridesChange({ ...noScaleOverrides, [key]: next })
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Skalowanie porcji</h2>
          <p className="text-sm text-muted-foreground">
            Bazowe porcje: {baseServings}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="servings-input">Docelowe porcje</Label>
          <Input
            id="servings-input"
            type="number"
            min={1}
            max={10000}
            value={targetServings}
            onChange={handleInputChange}
            className="w-24"
            disabled={scalingDisabled}
          />
        </div>
      </header>
      {scalingDisabled ? (
        <p className="mt-2 text-sm text-destructive">
          Nie można skalować, gdy bazowa liczba porcji jest niepoprawna.
        </p>
      ) : null}
      <div className="mt-4">
        <Slider
          value={[targetServings]}
          min={1}
          max={100}
          step={1}
          onValueChange={handleSliderChange}
          disabled={scalingDisabled}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Ilości są zaokrąglane, a przy wypiekach precyzja może mieć znaczenie.
      </p>
      <div className="mt-6 space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          aria-expanded={showNoScale}
          aria-controls={noScalePanelId}
          onClick={() => setShowNoScale((prev) => !prev)}
          disabled={scalingDisabled}
        >
          <span>Dostosuj skalowanie</span>
          <span
            aria-hidden="true"
            className={`text-xs transition-transform ${
              showNoScale ? 'rotate-180' : 'rotate-0'
            }`}
          >
            ▼
          </span>
        </button>
        {showNoScale ? (
          <div id={noScalePanelId} className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">
              Wybierz składniki, które chcesz pominąć przy skalowaniu.
            </p>
            <div className="space-y-2">
              {ingredients.map((ingredient, index) => {
                const key = `${index}:${ingredient.text}`
                const checked = noScaleOverrides[key] ?? ingredient.no_scale ?? false
                return (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {ingredient.text}
                    </span>
                    <Switch
                      checked={checked}
                      onCheckedChange={(next) => toggleNoScale(key, next)}
                      aria-label={`Nie skaluj: ${ingredient.text}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

