import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  RecipeDetailsErrorState,
  RecipeDetailsNotFoundState,
  RecipeDetailsSkeleton,
} from '@/components/recipes-details/components/RecipeDetailsStates'
import { useAbortableFetch } from '@/components/recipes/hooks/useAbortableFetch'
import { getRecipeById, patchRecipe } from '@/lib/api/recipes'
import type { ApiMappedError } from '@/lib/api/recipes'
import type { PatchRecipeCommand, RecipeTags } from '@/types'
import { RecipeEditFooterActions } from './components/RecipeEditFooterActions'
import { RecipeEditForm } from './components/RecipeEditForm'
import { RecipeEditHeader } from './components/RecipeEditHeader'
import { UnsavedChangesAlertDialog } from './components/UnsavedChangesAlertDialog'
import { mapRecipeDtoToEditDraftVM } from './mappers'
import type {
  RecipeEditDraftVM,
  RecipeEditValidationErrorsVM,
  RecipeEditViewState,
  RecipeIngredientDraftVM,
  RecipeMetaDraftVM,
  RecipeStepDraftVM,
} from './types'
import { validateDraft } from './validation'

type RecipeEditPageProps = {
  recipeId: string
}

const RecipeEditPage: React.FC<RecipeEditPageProps> = ({ recipeId }) => {
  const [viewState, setViewState] = React.useState<RecipeEditViewState>(() =>
    recipeId ? { status: 'loading' } : { status: 'not_found' },
  )
  const [validationErrors, setValidationErrors] =
    React.useState<RecipeEditValidationErrorsVM | null>(null)
  const [apiError, setApiError] = React.useState<{ code?: string; message: string } | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = React.useState(false)
  const [pendingNavigationTarget, setPendingNavigationTarget] = React.useState<string | null>(null)
  const { fetchWithAbort } = useAbortableFetch()

  const loadRecipe = React.useCallback(async () => {
    if (!recipeId) {
      setViewState({ status: 'not_found' })
      return
    }
    setViewState({ status: 'loading' })
    try {
      const response = await fetchWithAbort((signal) => getRecipeById(recipeId, signal))
      const draft = mapRecipeDtoToEditDraftVM(response.data)
      setValidationErrors(null)
      setApiError(null)
      setViewState({
        status: 'ready',
        data: { recipeId, initial: draft, draft },
      })
    } catch (error) {
      const mapped = error as ApiMappedError
      if (mapped?.code === 'NOT_FOUND') {
        setViewState({ status: 'not_found' })
        return
      }
      console.error(error)
      setViewState({
        status: 'error',
        error: {
          code: mapped?.code,
          message: mapped?.message ?? 'Wystąpił błąd podczas pobierania.',
        },
      })
    }
  }, [fetchWithAbort, recipeId])

  React.useEffect(() => {
    void loadRecipe()
  }, [loadRecipe])

  const updateDraft = React.useCallback(
    (updater: (current: RecipeEditDraftVM) => RecipeEditDraftVM) => {
      setViewState((prev) => {
        if (prev.status !== 'ready') return prev
        const nextDraft = updater(prev.data.draft)
        return { status: 'ready', data: { ...prev.data, draft: nextDraft } }
      })
      setValidationErrors(null)
      setApiError(null)
    },
    [],
  )

  const createLocalId = () => {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID()
    }
    return `local_${Math.random().toString(36).slice(2, 10)}`
  }

  const handleChangeTitle = React.useCallback(
    (value: string) => {
      updateDraft((draft) => ({ ...draft, title: value }))
    },
    [updateDraft],
  )

  const handleAddIngredient = React.useCallback(() => {
    updateDraft((draft) => ({
      ...draft,
      ingredients: [
        ...draft.ingredients,
        { id: createLocalId(), text: '', amount: undefined, unit: undefined, no_scale: false },
      ],
    }))
  }, [updateDraft])

  const handleChangeIngredient = React.useCallback(
    (id: string, patch: Partial<RecipeIngredientDraftVM>) => {
      updateDraft((draft) => ({
        ...draft,
        ingredients: draft.ingredients.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }))
    },
    [updateDraft],
  )

  const handleRemoveIngredient = React.useCallback(
    (id: string) => {
      updateDraft((draft) => ({
        ...draft,
        ingredients: draft.ingredients.filter((item) => item.id !== id),
      }))
    },
    [updateDraft],
  )

  const handleAddStep = React.useCallback(() => {
    updateDraft((draft) => ({
      ...draft,
      steps: [...draft.steps, { id: createLocalId(), text: '' }],
    }))
  }, [updateDraft])

  const handleChangeStep = React.useCallback(
    (id: string, patch: Partial<RecipeStepDraftVM>) => {
      updateDraft((draft) => ({
        ...draft,
        steps: draft.steps.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }))
    },
    [updateDraft],
  )

  const handleRemoveStep = React.useCallback(
    (id: string) => {
      updateDraft((draft) => ({
        ...draft,
        steps: draft.steps.filter((item) => item.id !== id),
      }))
    },
    [updateDraft],
  )

  const handleChangeMeta = React.useCallback(
    (patch: Partial<RecipeMetaDraftVM>) => {
      updateDraft((draft) => {
        const nextMeta = { ...draft.meta, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'total_time_minutes')) {
          nextMeta.total_time_minutes_mode = 'manual'
        }
        return { ...draft, meta: nextMeta }
      })
    },
    [updateDraft],
  )

  const normalizedInitial = React.useMemo(() => {
    if (viewState.status !== 'ready') return null
    return normalizeDraft(viewState.data.initial)
  }, [viewState])

  const normalizedDraft = React.useMemo(() => {
    if (viewState.status !== 'ready') return null
    return normalizeDraft(viewState.data.draft)
  }, [viewState])

  const isDirty = React.useMemo(() => {
    if (!normalizedInitial || !normalizedDraft) return false
    return JSON.stringify(normalizedInitial) !== JSON.stringify(normalizedDraft)
  }, [normalizedDraft, normalizedInitial])

  const requestNavigation = React.useCallback(
    (target: string) => {
      if (!target) return
      if (isDirty) {
        setPendingNavigationTarget(target)
        setShowUnsavedDialog(true)
        return
      }
      window.location.assign(target)
    },
    [isDirty],
  )

  const handleCancel = React.useCallback(() => {
    if (!recipeId) return
    requestNavigation(`/recipes/${recipeId}`)
  }, [recipeId, requestNavigation])

  const handleConfirmLeave = React.useCallback(() => {
    if (!pendingNavigationTarget) return
    window.location.assign(pendingNavigationTarget)
  }, [pendingNavigationTarget])

  const handleUnsavedOpenChange = React.useCallback((open: boolean) => {
    setShowUnsavedDialog(open)
    if (!open) {
      setPendingNavigationTarget(null)
    }
  }, [])

  const handleSave = React.useCallback(async () => {
    if (viewState.status !== 'ready' || isSaving) return
    const errors = validateDraft(viewState.data.draft)
    const hasErrors = Object.keys(errors).length > 0
    if (hasErrors) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors(null)
    setApiError(null)
    setIsSaving(true)

    const payload = buildPatchCommand(viewState.data.draft)
    try {
      await patchRecipe(viewState.data.recipeId, payload)
      window.location.assign(`/recipes/${viewState.data.recipeId}`)
    } catch (error) {
      const mapped = error as ApiMappedError
      if (mapped?.fieldErrors) {
        setValidationErrors(mapFieldErrors(mapped.fieldErrors))
      }
      setApiError({
        code: mapped?.code,
        message: mapped?.message ?? 'Nie udało się zapisać zmian.',
      })
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, viewState])

  React.useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  if (viewState.status === 'loading') {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8">
        <RecipeDetailsSkeleton />
      </section>
    )
  }

  if (viewState.status === 'not_found') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <RecipeDetailsNotFoundState />
      </section>
    )
  }

  if (viewState.status === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <RecipeDetailsErrorState message={viewState.error.message} onRetry={loadRecipe} />
      </section>
    )
  }

  const { draft } = viewState.data

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <RecipeEditHeader
        recipeTitle={draft.title}
        onBack={handleCancel}
        showPrivacyNotice
      />
      <RecipeEditForm
        draft={draft}
        errors={validationErrors}
        disabled={isSaving}
        onChangeTitle={handleChangeTitle}
        onAddIngredient={handleAddIngredient}
        onChangeIngredient={handleChangeIngredient}
        onRemoveIngredient={handleRemoveIngredient}
        onAddStep={handleAddStep}
        onChangeStep={handleChangeStep}
        onRemoveStep={handleRemoveStep}
        onChangeMeta={handleChangeMeta}
      />
      {apiError ? (
        <Alert variant="destructive">
          <AlertTitle>Nie udało się zapisać</AlertTitle>
          <AlertDescription>{apiError.message}</AlertDescription>
        </Alert>
      ) : null}
      <RecipeEditFooterActions
        isDirty={isDirty}
        isSaving={isSaving}
        onCancel={handleCancel}
        onSave={handleSave}
      />
      <UnsavedChangesAlertDialog
        open={showUnsavedDialog}
        onOpenChange={handleUnsavedOpenChange}
        onConfirmLeave={handleConfirmLeave}
      />
    </section>
  )
}

export default RecipeEditPage

const normalizeTags = (tags: RecipeTags): RecipeTags => {
  const entries = Object.entries(tags ?? {})
    .map(([key, value]) => [key, value?.trim()] as const)
    .filter(([, value]) => Boolean(value))
    .sort(([a], [b]) => a.localeCompare(b))

  return entries.reduce<RecipeTags>((acc, [key, value]) => {
    acc[key] = value
    return acc
  }, {})
}

const normalizeNumber = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return null
  return value
}

const normalizeDraft = (draft: RecipeEditDraftVM) => ({
  title: draft.title.trim(),
  ingredients: draft.ingredients.map((ingredient) => ({
    text: ingredient.text.trim(),
    amount: normalizeNumber(ingredient.amount),
    unit: ingredient.unit?.trim() || null,
    no_scale: Boolean(ingredient.no_scale),
  })),
  steps: draft.steps.map((step) => step.text.trim()),
  meta: {
    servings: Math.max(1, Math.floor(draft.meta.servings)),
    prep_time_minutes: normalizeNumber(draft.meta.prep_time_minutes),
    cook_time_minutes: normalizeNumber(draft.meta.cook_time_minutes),
    total_time_minutes: normalizeNumber(draft.meta.total_time_minutes),
    calories_per_serving: normalizeNumber(draft.meta.calories_per_serving),
    tags: normalizeTags(draft.meta.tags),
    total_time_minutes_mode: draft.meta.total_time_minutes_mode ?? 'auto',
  },
})

const buildTagsPayload = (tags: RecipeTags): RecipeTags => {
  const normalized: RecipeTags = {}
  Object.entries(tags ?? {}).forEach(([key, value]) => {
    const trimmed = value?.trim()
    if (trimmed) {
      normalized[key] = trimmed
    }
  })
  return normalized
}

const buildPatchCommand = (draft: RecipeEditDraftVM): PatchRecipeCommand => {
  const totalTime =
    draft.meta.total_time_minutes_mode === 'auto' && draft.meta.total_time_minutes == null
      ? undefined
      : draft.meta.total_time_minutes ?? null

  return {
    title: draft.title.trim(),
    ingredients: draft.ingredients.map((item) => ({
      text: item.text.trim(),
      amount: item.amount,
      unit: item.unit?.trim() || undefined,
      no_scale: item.no_scale,
    })),
    steps: draft.steps.map((step) => step.text.trim()),
    tags: buildTagsPayload(draft.meta.tags),
    prep_time_minutes: draft.meta.prep_time_minutes ?? null,
    cook_time_minutes: draft.meta.cook_time_minutes ?? null,
    total_time_minutes: totalTime,
    calories_per_serving: draft.meta.calories_per_serving ?? null,
    servings: Math.max(1, Math.floor(draft.meta.servings)),
  }
}

const mapFieldErrors = (
  fieldErrors: Record<string, string[]>,
): RecipeEditValidationErrorsVM => ({
  title: fieldErrors.title?.[0],
  servings: fieldErrors.servings?.[0],
  ingredients: fieldErrors.ingredients?.[0],
  steps: fieldErrors.steps?.[0],
  prep_time_minutes: fieldErrors.prep_time_minutes?.[0],
  cook_time_minutes: fieldErrors.cook_time_minutes?.[0],
  total_time_minutes: fieldErrors.total_time_minutes?.[0],
  calories_per_serving: fieldErrors.calories_per_serving?.[0],
})
