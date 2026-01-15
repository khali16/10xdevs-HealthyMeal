import type { RecipeIngredientDTO } from '@/types'

export type RecipeDetailsViewState =
  | { status: 'loading' }
  | { status: 'ready'; data: RecipeDetailsVM }
  | { status: 'error'; error: { code?: string; message: string } }
  | { status: 'not_found' }

export type RecipeDetailsVM = {
  id: string
  title: string
  tags: RecipeTagsVM
  ingredients: RecipeIngredientDTO[]
  steps: string[]
  meta: RecipeMetaVM
  rating: number | null
  isFavorite: boolean
  isAiAdjusted?: boolean
  originalRecipeId?: string | null
}

export type RecipeTagsVM = {
  diet?: string | null
  other: Array<{ key: string; value: string }>
}

export type RecipeMetaVM = {
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  totalTimeMinutes: number | null
  caloriesPerServing: number | null
  baseServings: number
}

export type ScaledIngredientVM = {
  key: string
  text: string
  amountRaw?: number
  amountScaled?: number
  amountDisplay?: string
  unit?: string
  noScale: boolean
}

