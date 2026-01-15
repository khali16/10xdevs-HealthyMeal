import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAbortableFetch } from '@/components/recipes/hooks/useAbortableFetch'
import {
  deleteRecipe,
  deleteRecipeRating,
  getRecipeById,
  putRecipeFavorite,
  putRecipeRating,
} from '@/lib/api/recipes'
import type { ApiMappedError } from '@/lib/api/recipes'
import {
  RecipeDetailsErrorState,
  RecipeDetailsNotFoundState,
  RecipeDetailsSkeleton,
} from './components/RecipeDetailsStates'
import { RecipeDetailsHeader } from './components/RecipeDetailsHeader'
import { RecipeInlineActions } from './components/RecipeInlineActions'
import { RecipeIngredientsSection } from './components/RecipeIngredientsSection'
import { RecipeMetaSection } from './components/RecipeMetaSection'
import { RecipeServingsScaler } from './components/RecipeServingsScaler'
import { RecipeStepsSection } from './components/RecipeStepsSection'
import { mapRecipeDtoToDetailsVM } from './mappers'
import type { RecipeDetailsViewState, ScaledIngredientVM } from './types'

type RecipeDetailsPageProps = {
  recipeId: string
}

export default function RecipeDetailsPage({ recipeId }: RecipeDetailsPageProps) {
  const [viewState, setViewState] = React.useState<RecipeDetailsViewState>(() =>
    recipeId ? { status: 'loading' } : { status: 'not_found' },
  )
  const [targetServings, setTargetServings] = React.useState(1)
  const [noScaleOverrides, setNoScaleOverrides] = React.useState<Record<string, boolean>>(
    {},
  )
  const [ratingPending, setRatingPending] = React.useState(false)
  const [favoritePending, setFavoritePending] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)
  const [adjustOpen, setAdjustOpen] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const { fetchWithAbort } = useAbortableFetch()

  const updateRecipe = React.useCallback(
    (
      updater: (
        current: NonNullable<
          Extract<RecipeDetailsViewState, { status: 'ready' }>['data']
        >
      ) => void,
    ) => {
      setViewState((prev) => {
        if (prev.status !== 'ready' || !prev.data) return prev
        const next = { ...prev.data }
        updater(next)
        return { status: 'ready', data: next }
      })
    },
    [],
  )

  React.useEffect(() => {
    if (!recipeId) {
      setViewState({ status: 'not_found' })
      return
    }

    setViewState({ status: 'loading' })
    const run = async () => {
      setViewState({ status: 'loading' })
      try {
        const response = await fetchWithAbort((signal) =>
          getRecipeById(recipeId, signal),
        )
        const vm = mapRecipeDtoToDetailsVM(response.data)
        setViewState({ status: 'ready', data: vm })
        setTargetServings(vm.meta.baseServings)
      } catch (error) {
        const mapped = error as ApiMappedError
        if (mapped?.code === 'NOT_FOUND') {
          setViewState({ status: 'not_found' })
        } else {
          console.error(error)
          setViewState({ status: 'error', error: { code: mapped?.code, message: mapped?.message ?? 'Wystąpił błąd podczas pobierania.' } })
        }
      }
    }

    run()
  }, [fetchWithAbort, recipeId])

  const recipe = viewState.status === 'ready' ? viewState.data : null

  const ingredientsForScaling = recipe?.ingredients ?? []
  const handleSetRating = React.useCallback(
    async (next: number) => {
      if (!recipe || ratingPending || next < 1 || next > 5) return
      setActionError(null)
      setRatingPending(true)
      const prevRating = recipe.rating
      updateRecipe((current) => {
        current.rating = next
      })
      try {
        await putRecipeRating(recipe.id, { rating: next })
      } catch (error) {
        const mapped = error as ApiMappedError
        updateRecipe((current) => {
          current.rating = prevRating
        })
        setActionError(
          mapped?.message ?? 'Nie udało się zapisać oceny. Spróbuj ponownie.',
        )
      } finally {
        setRatingPending(false)
      }
    },
    [ratingPending, recipe, updateRecipe],
  )

  const handleClearRating = React.useCallback(async () => {
    if (!recipe || ratingPending) return
    setActionError(null)
    setRatingPending(true)
    const prevRating = recipe.rating
    updateRecipe((current) => {
      current.rating = null
    })
    try {
      await deleteRecipeRating(recipe.id)
    } catch (error) {
      const mapped = error as ApiMappedError
      updateRecipe((current) => {
        current.rating = prevRating
      })
      setActionError(
        mapped?.message ?? 'Nie udało się usunąć oceny. Spróbuj ponownie.',
      )
    } finally {
      setRatingPending(false)
    }
  }, [ratingPending, recipe, updateRecipe])

  const handleToggleFavorite = React.useCallback(
    async (next: boolean) => {
      if (!recipe || favoritePending) return
      setActionError(null)
      setFavoritePending(true)
      const prevFavorite = recipe.isFavorite
      updateRecipe((current) => {
        current.isFavorite = next
      })
      try {
        await putRecipeFavorite(recipe.id, { favorite: next })
      } catch (error) {
        const mapped = error as ApiMappedError
        updateRecipe((current) => {
          current.isFavorite = prevFavorite
        })
        setActionError(
          mapped?.message ?? 'Nie udało się zaktualizować ulubionych.',
        )
      } finally {
        setFavoritePending(false)
      }
    },
    [favoritePending, recipe, updateRecipe],
  )

  const handleDeleteRecipe = React.useCallback(async () => {
    if (!recipe || deletePending) return
    setActionError(null)
    setDeletePending(true)
    try {
      await deleteRecipe(recipe.id)
      window.location.assign('/recipes')
    } catch (error) {
      const mapped = error as ApiMappedError
      if (mapped?.code === 'METHOD_NOT_ALLOWED') {
        setActionError('Funkcja w przygotowaniu.')
      } else {
        setActionError(mapped?.message ?? 'Nie udało się usunąć przepisu.')
      }
    } finally {
      setDeletePending(false)
    }
  }, [deletePending, recipe])

  const handleEdit = React.useCallback(() => {
    if (!recipe) return
    window.location.assign(`/recipes/${recipe.id}/edit`)
  }, [recipe])

  const scaledIngredients = React.useMemo<ScaledIngredientVM[]>(() => {
    if (!recipe) return []
    if (!recipe.meta.baseServings || recipe.meta.baseServings <= 0) {
      return ingredientsForScaling.map((ingredient, index) => ({
        key: `${index}:${ingredient.text}`,
        text: ingredient.text,
        amountRaw: ingredient.amount,
        amountScaled: ingredient.amount,
        amountDisplay:
          ingredient.amount != null
            ? formatAmount(ingredient.amount, ingredient.unit)
            : undefined,
        unit: ingredient.unit,
        noScale: ingredient.no_scale ?? false,
      }))
    }

    const ratio = targetServings / recipe.meta.baseServings
    return ingredientsForScaling.map((ingredient, index) => {
      const key = `${index}:${ingredient.text}`
      const noScale = noScaleOverrides[key] ?? ingredient.no_scale ?? false
      const rawAmount = ingredient.amount
      const scaledAmount =
        rawAmount != null && !noScale ? rawAmount * ratio : rawAmount
      const amountDisplay =
        scaledAmount != null ? formatAmount(scaledAmount, ingredient.unit) : undefined
      return {
        key,
        text: ingredient.text,
        amountRaw: rawAmount,
        amountScaled: scaledAmount,
        amountDisplay,
        unit: ingredient.unit,
        noScale,
      }
    })
  }, [
    ingredientsForScaling,
    noScaleOverrides,
    recipe,
    targetServings,
  ])

  // React.useEffect(() => {
  //   void loadRecipe()
  // }, [loadRecipe])

  // const handleRetry = React.useCallback(() => {
  //   void loadRecipe()
  // }, [loadRecipe])

  if (viewState.status === 'loading') {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <RecipeDetailsSkeleton />
      </section>
    )
  }

  if (viewState.status === 'not_found') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RecipeDetailsNotFoundState />
      </section>
    )
  }

  if (viewState.status === 'error') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RecipeDetailsErrorState
          message={viewState.error.message}
          onRetry={() => { }}
        />
      </section>
    )
  }

  if (!recipe) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RecipeDetailsErrorState onRetry={() => { }} />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <RecipeDetailsHeader
        title={recipe.title}
        tags={recipe.tags}
        meta={recipe.meta}
        rating={recipe.rating}
        onEdit={handleEdit}
        onDelete={handleDeleteRecipe}
        isDeleting={deletePending}
      />
      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Akcja nieudana</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <RecipeInlineActions
        rating={recipe.rating}
        isFavorite={recipe.isFavorite}
        ratingPending={ratingPending}
        favoritePending={favoritePending}
        adjustOpen={adjustOpen}
        onSetRating={handleSetRating}
        onClearRating={handleClearRating}
        onToggleFavorite={handleToggleFavorite}
        onAdjustOpenChange={setAdjustOpen}
      />
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <RecipeServingsScaler
            baseServings={recipe.meta.baseServings}
            ingredients={ingredientsForScaling}
            targetServings={targetServings}
            noScaleOverrides={noScaleOverrides}
            onTargetServingsChange={setTargetServings}
            onNoScaleOverridesChange={setNoScaleOverrides}
          />
          <RecipeIngredientsSection items={scaledIngredients} />
          <RecipeStepsSection steps={recipe.steps} />
        </div>
        <div className="space-y-6">
          <RecipeMetaSection meta={recipe.meta} />
        </div>
      </div>
    </section>
  )
}

function formatAmount(value: number, unit?: string): string {
  if (!Number.isFinite(value)) return ''

  const normalizedUnit = unit?.toLowerCase() ?? ''
  const isWeightOrVolume = ['g', 'gram', 'ml'].some((token) =>
    normalizedUnit.includes(token),
  )
  const isTeaspoon = ['łyżecz', 'lyzecz', 'tsp'].some((token) =>
    normalizedUnit.includes(token),
  )

  if (isWeightOrVolume) {
    return String(Math.round(value))
  }

  if (isTeaspoon) {
    const rounded = Math.round(value * 4) / 4
    const fraction = formatFraction(rounded)
    return fraction ?? String(rounded).replace(/\.?0+$/, '')
  }

  const rounded = Math.round(value * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded.toFixed(2)).replace(/\.?0+$/, '')
}

function formatFraction(value: number): string | null {
  const whole = Math.trunc(value)
  const frac = value - whole
  const fractions: Array<[number, string]> = [
    [0, ''],
    [1 / 4, '1/4'],
    [1 / 3, '1/3'],
    [1 / 2, '1/2'],
    [2 / 3, '2/3'],
    [3 / 4, '3/4'],
  ]

  const match = fractions.find(([f]) => Math.abs(frac - f) < 0.001)
  if (!match) return null
  const suffix = match[1]
  if (!suffix) return String(whole)
  if (whole === 0) return suffix
  return `${whole} ${suffix}`
}

