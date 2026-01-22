export type RecipeCreateWizardStep = 'paste' | 'review'

export type RecipeFieldConfidenceVM = {
  title: number | null
  ingredients: number | null
  steps: number | null
}

export type RecipeIngredientDraftVM = {
  id: string
  text: string
  amount?: number
  unit?: string
  no_scale?: boolean
  confidence?: number
}

export type RecipeStepDraftVM = {
  id: string
  text: string
  confidence?: number
}

export type RecipeMetaDraftVM = {
  servings: number
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  calories_per_serving?: number
  tags: Record<string, string>
}

export type RecipeDraftVM = {
  raw: string
  title: { value: string; confidence: number | null; source: 'parsed' | 'manual' }
  ingredients: Array<{ value: RecipeIngredientDraftVM; source: 'parsed' | 'manual' }>
  steps: Array<{ value: RecipeStepDraftVM; source: 'parsed' | 'manual' }>
  meta: RecipeMetaDraftVM
  warnings: string[]
}

export type RecipeCreateValidationErrorsVM = {
  title?: string
  ingredients?: string
  steps?: string
  servings?: string
  ingredientsById?: Record<string, { text?: string; amount?: string; unit?: string }>
  stepsById?: Record<string, { text?: string }>
}

export type LowConfidenceIssueVM = {
  field: 'title' | 'ingredients' | 'steps'
  confidence: number
  label: string
}

export type RecipeCreateWizardState = {
  step: RecipeCreateWizardStep
  draft: RecipeDraftVM
  validationErrors: RecipeCreateValidationErrorsVM | null
  isSaving: boolean
  apiError: { code?: string; message: string } | null
}
