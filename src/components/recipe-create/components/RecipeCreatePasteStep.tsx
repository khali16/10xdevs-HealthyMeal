import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RecipePasteFormattingHints } from './RecipePasteFormattingHints'
import { RecipeCreateStepActions } from './RecipeCreateStepActions'

type RecipeCreatePasteStepProps = {
  raw: string
  canNext: boolean
  onRawChange: (next: string) => void
  onNext: () => void
}

export const RecipeCreatePasteStep: React.FC<RecipeCreatePasteStepProps> = ({
  raw,
  canNext,
  onRawChange,
  onNext,
}) => {
  const hintId = React.useId()

  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="recipe-raw">Wklej przepis</Label>
          <Textarea
            id="recipe-raw"
            value={raw}
            onChange={(event) => onRawChange(event.target.value)}
            placeholder="Wklej tutaj pełny tekst przepisu..."
            rows={10}
            aria-describedby={hintId}
          />
          <p id={hintId} className="text-sm text-muted-foreground">
            Wklej pełny przepis, a w kolejnym kroku uzupełnisz tytuł, składniki i kroki.
          </p>
        </div>

        <RecipePasteFormattingHints />

        {!canNext && (
          <p className="text-sm text-muted-foreground">
            Aby przejść dalej, wklej przynajmniej kilka linijek przepisu.
          </p>
        )}

        <RecipeCreateStepActions onNext={onNext} canNext={canNext} />
      </div>
    </section>
  )
}
