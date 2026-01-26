import * as React from 'react'
import { RecipeCreateWizardHeader } from './components/RecipeCreateWizardHeader'
import { RecipeCreatePasteStep } from './components/RecipeCreatePasteStep'
import { RecipeCreateReviewStep } from './components/RecipeCreateReviewStep'
import { parseRawRecipeToDraft } from './parser'
import { useRecipeCreateWizardState } from './hooks/useRecipeCreateWizardState'
import type { LowConfidenceIssueVM, RecipeDraftVM, RecipeCreateValidationErrorsVM } from './types'
import { createRecipe } from '@/lib/api/recipes'
import type { CreateRecipeCommand } from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const CONFIDENCE_THRESHOLD = 0.9

const getSectionConfidence = (items: RecipeDraftVM['ingredients'] | RecipeDraftVM['steps']) => {
  const confidences = items
    .map((item) => item.value.confidence)
    .filter((value): value is number => typeof value === 'number')
  if (!confidences.length) return null
  return Math.min(...confidences)
}

const buildTagsPayload = (tags: Record<string, string>) => {
  const normalized: Record<string, string> = {}
  Object.entries(tags).forEach(([key, value]) => {
    const trimmed = value?.trim()
    if (trimmed) {
      normalized[key] = trimmed
    }
  })
  return normalized
}

const getValidationErrors = (draft: RecipeDraftVM): RecipeCreateValidationErrorsVM => {
  const errors: RecipeCreateValidationErrorsVM = {}
  const ingredientsById: Record<string, { text?: string; amount?: string; unit?: string }> = {}
  const stepsById: Record<string, { text?: string }> = {}

  if (!draft.title.value.trim()) {
    errors.title = 'Podaj tytuł przepisu.'
  }

  if (!draft.ingredients.length) {
    errors.ingredients = 'Dodaj co najmniej jeden składnik.'
  }

  draft.ingredients.forEach((item) => {
    const ingredientErrors: { text?: string; amount?: string; unit?: string } = {}
    if (!item.value.text.trim()) {
      ingredientErrors.text = 'Uzupełnij nazwę składnika.'
    }
    if (typeof item.value.amount === 'number' && item.value.amount <= 0) {
      ingredientErrors.amount = 'Ilość musi być większa od zera.'
    }
    if (item.value.unit && !item.value.unit.trim()) {
      ingredientErrors.unit = 'Podaj jednostkę.'
    }
    if (Object.keys(ingredientErrors).length) {
      ingredientsById[item.value.id] = ingredientErrors
    }
  })

  if (!draft.steps.length) {
    errors.steps = 'Dodaj co najmniej jeden krok.'
  }

  draft.steps.forEach((item) => {
    if (!item.value.text.trim()) {
      stepsById[item.value.id] = { text: 'Uzupełnij opis kroku.' }
    }
  })

  if (!Number.isFinite(draft.meta.servings) || draft.meta.servings < 1) {
    errors.servings = 'Liczba porcji musi być większa od zera.'
  }

  if (Object.keys(ingredientsById).length) {
    errors.ingredientsById = ingredientsById
  }
  if (Object.keys(stepsById).length) {
    errors.stepsById = stepsById
  }

  return errors
}

const hasValidationErrors = (errors: Record<string, unknown>) => Object.keys(errors).length > 0

const RecipeCreateWizardPage: React.FC = () => {
  const { state, actions } = useRecipeCreateWizardState()
  const [showLowConfidenceDialog, setShowLowConfidenceDialog] = React.useState(false)
  const canNext = state.draft.raw.trim().length > 0
  const ingredientsConfidence = getSectionConfidence(state.draft.ingredients)
  const stepsConfidence = getSectionConfidence(state.draft.steps)
  const lowConfidenceIssues: LowConfidenceIssueVM[] = [
    state.draft.title.confidence !== null && state.draft.title.confidence < CONFIDENCE_THRESHOLD
      ? { field: 'title', confidence: state.draft.title.confidence, label: 'Tytuł' }
      : null,
    typeof ingredientsConfidence === 'number' && ingredientsConfidence < CONFIDENCE_THRESHOLD
      ? { field: 'ingredients', confidence: ingredientsConfidence, label: 'Składniki' }
      : null,
    typeof stepsConfidence === 'number' && stepsConfidence < CONFIDENCE_THRESHOLD
      ? { field: 'steps', confidence: stepsConfidence, label: 'Kroki' }
      : null,
  ].filter((issue): issue is LowConfidenceIssueVM => Boolean(issue))

  const handleNext = () => {
    const parsed = parseRawRecipeToDraft(state.draft.raw)
    actions.applyParse(parsed.draftPatch)
    actions.goNext()
  }

  const handleSave = async () => {
    const errors = getValidationErrors(state.draft)
    if (hasValidationErrors(errors)) {
      actions.setValidationErrors(errors)
      return
    }

    if (lowConfidenceIssues.length) {
      setShowLowConfidenceDialog(true)
      return
    }

    await performSave()
  }

  const performSave = async () => {
    const payload: CreateRecipeCommand = {
      title: state.draft.title.value.trim(),
      ingredients: state.draft.ingredients.map((item) => ({
        text: item.value.text.trim(),
        amount: item.value.amount,
        unit: item.value.unit?.trim() || undefined,
        no_scale: item.value.no_scale,
      })),
      steps: state.draft.steps.map((item) => item.value.text.trim()).filter(Boolean),
      tags: buildTagsPayload(state.draft.meta.tags),
      prep_time_minutes: state.draft.meta.prep_time_minutes,
      cook_time_minutes: state.draft.meta.cook_time_minutes,
      total_time_minutes: state.draft.meta.total_time_minutes,
      calories_per_serving: state.draft.meta.calories_per_serving,
      servings: Math.max(1, Math.floor(state.draft.meta.servings)),
    }

    actions.setSaving(true)
    actions.setApiError(null)
    try {
      const res = await createRecipe(payload)
      window.location.assign(`/recipes/${res.data.id}`)
    } catch (error: any) {
      if (error?.fieldErrors) {
        actions.setValidationErrors({
          title: error.fieldErrors.title?.[0],
          servings: error.fieldErrors.servings?.[0],
          ingredients: error.fieldErrors.ingredients?.[0],
          steps: error.fieldErrors.steps?.[0],
        })
      }
      const message = error?.message ?? 'Nie udało się zapisać przepisu.'
      actions.setApiError({ message, code: error?.code })
    } finally {
      actions.setSaving(false)
    }
  }

  return (
    <section className="min-h-screen bg-background" data-testid="recipe-create-wizard-page">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <RecipeCreateWizardHeader step={state.step} />

        {state.step === 'paste' ? (
          <RecipeCreatePasteStep
            raw={state.draft.raw}
            onRawChange={actions.setRaw}
            onNext={handleNext}
            canNext={canNext}
          />
        ) : (
          <RecipeCreateReviewStep
            draft={state.draft}
            errors={state.validationErrors}
            lowConfidenceIssues={lowConfidenceIssues}
            apiError={state.apiError}
            onBack={actions.goBack}
            onChangeTitle={actions.updateTitle}
            onChangeIngredient={actions.updateIngredient}
            onAddIngredient={actions.addIngredient}
            onRemoveIngredient={actions.removeIngredient}
            onChangeStep={actions.updateStep}
            onAddStep={actions.addStep}
            onRemoveStep={actions.removeStep}
            onChangeMeta={actions.updateMeta}
            onSave={handleSave}
            isSaving={state.isSaving}
            canSave={!state.isSaving}
          />
        )}
      </div>

      <AlertDialog open={showLowConfidenceDialog} onOpenChange={setShowLowConfidenceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Niska pewność wykrytych danych</AlertDialogTitle>
            <AlertDialogDescription>
              Niektóre pola mają niską pewność. Możesz wrócić do edycji albo zapisać przepis mimo to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowLowConfidenceDialog(false)
                await performSave()
              }}
            >
              Zapisz mimo to
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

export default RecipeCreateWizardPage
