export type RecipeIngredientDraftVM = {
  id: string
  text: string
  amount?: number
  unit?: string
  no_scale?: boolean
}

export type RecipeStepDraftVM = {
  id: string
  text: string
}

export type RecipeMetaDraftVM = {
  servings: number
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  calories_per_serving?: number
  tags: Record<string, string>
  total_time_minutes_mode?: 'auto' | 'manual'
}

export type RecipeEditDraftVM = {
  title: string
  ingredients: RecipeIngredientDraftVM[]
  steps: RecipeStepDraftVM[]
  meta: RecipeMetaDraftVM
}

export type RecipeEditValidationErrorsVM = {
  title?: string
  ingredients?: string
  steps?: string
  servings?: string
  ingredientsById?: Record<string, { text?: string; amount?: string; unit?: string }>
  stepsById?: Record<string, { text?: string }>
  prep_time_minutes?: string
  cook_time_minutes?: string
  total_time_minutes?: string
  calories_per_serving?: string
  tags?: string
}

export type RecipeEditViewState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; error: { code?: string; message: string } }
  | {
      status: 'ready'
      data: {
        recipeId: string
        initial: RecipeEditDraftVM
        draft: RecipeEditDraftVM
      }
    }
