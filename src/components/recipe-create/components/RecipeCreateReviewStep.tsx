import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RecipeCreateFooterActions } from './RecipeCreateFooterActions'
import { RecipeLowConfidenceSummary } from './RecipeLowConfidenceSummary'
import { RecipeTitleField } from './RecipeTitleField'
import { RecipeIngredientsEditor } from './RecipeIngredientsEditor'
import { RecipeStepsEditor } from './RecipeStepsEditor'
import { RecipeMetaEditor } from './RecipeMetaEditor'
import type { LowConfidenceIssueVM, RecipeCreateValidationErrorsVM, RecipeDraftVM } from '../types'

type RecipeCreateReviewStepProps = {
  draft: RecipeDraftVM
  errors: RecipeCreateValidationErrorsVM | null
  lowConfidenceIssues: LowConfidenceIssueVM[]
  apiError?: { message: string } | null
  onBack: () => void
  onChangeTitle: (value: string) => void
  onChangeIngredient: (id: string, patch: Partial<RecipeDraftVM['ingredients'][number]['value']>) => void
  onAddIngredient: () => void
  onRemoveIngredient: (id: string) => void
  onChangeStep: (id: string, patch: Partial<RecipeDraftVM['steps'][number]['value']>) => void
  onAddStep: () => void
  onRemoveStep: (id: string) => void
  onChangeMeta: (patch: Partial<RecipeDraftVM['meta']>) => void
  onSave: () => void
  isSaving: boolean
  canSave: boolean
}

export const RecipeCreateReviewStep: React.FC<RecipeCreateReviewStepProps> = ({
  draft,
  errors,
  lowConfidenceIssues,
  apiError,
  onBack,
  onChangeTitle,
  onChangeIngredient,
  onAddIngredient,
  onRemoveIngredient,
  onChangeStep,
  onAddStep,
  onRemoveStep,
  onChangeMeta,
  onSave,
  isSaving,
  canSave,
}) => {
  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6" data-testid="recipe-review-step">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Podgląd i edycja</h2>
        {draft.raw.trim() && (
          <p className="text-xs text-muted-foreground">
            Wklejono {draft.raw.trim().length} znaków surowego przepisu.
          </p>
        )}
      </div>

      <div className="mt-4">
        <RecipeLowConfidenceSummary issues={lowConfidenceIssues} threshold={0.9} />
      </div>

      {apiError && (
        <div className="mt-4">
          <Alert variant="destructive">
            <AlertTitle>Nie udało się zapisać przepisu</AlertTitle>
            <AlertDescription>{apiError.message}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <RecipeTitleField
          value={draft.title.value}
          confidence={draft.title.confidence}
          onChange={onChangeTitle}
          error={errors?.title}
        />

        <RecipeIngredientsEditor
          items={draft.ingredients.map((item) => item.value)}
          onChange={onChangeIngredient}
          onAdd={onAddIngredient}
          onRemove={onRemoveIngredient}
          errorsById={errors?.ingredientsById}
          error={errors?.ingredients}
        />

        <RecipeStepsEditor
          items={draft.steps.map((item) => item.value)}
          onChange={onChangeStep}
          onAdd={onAddStep}
          onRemove={onRemoveStep}
          errorsById={errors?.stepsById}
          error={errors?.steps}
        />

        <RecipeMetaEditor meta={draft.meta} onChange={onChangeMeta} errors={{ servings: errors?.servings }} />
      </div>

      <div className="mt-6">
        <RecipeCreateFooterActions
          onBack={onBack}
          onSave={onSave}
          isSaving={isSaving}
          isSaveDisabled={!canSave}
        />
      </div>
    </section>
  )
}
