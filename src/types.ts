// Shared DTO and Command Model types derived from DB entities in `src/db/database.types.ts`
// Notes:
// - We map JSON columns to strongly typed DTO fields (e.g., string[] or structured objects)
// - Response envelopes follow the API plan conventions

import type {
  Tables,
} from './db/database.types.ts'

// -----------------------------------------------------------------------------
// Shared primitives and envelopes
// -----------------------------------------------------------------------------

export type UUID = string
export type ISODateString = string

export type ApiListMeta = {
  page: number
  page_size: number
  total?: number
  has_next: boolean
}

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
export type ApiListSuccess<T> = { data: T[]; meta: ApiListMeta }
export type ApiError = {
  error: {
    code: string
    message: string
    details?: unknown
    fieldErrors?: Record<string, string[]>
  }
}

// -----------------------------------------------------------------------------
// DB entity aliases (Rows)
// -----------------------------------------------------------------------------

export type UserRow = Tables<'users'>
export type UserPreferencesRow = Tables<'user_preferences'>
export type RecipeRow = Tables<'recipes'>
export type RecipeRatingRow = Tables<'recipe_ratings'>
export type RecipeFavoriteRow = Tables<'recipe_favorites'>
export type AIAdjustmentRow = Tables<'ai_adjustments'>
export type PresetRow = Tables<'presets'>
export type AllergenDictionaryRow = Tables<'allergen_dictionary'>
export type AllergenDictionaryAuditRow = Tables<'allergen_dictionary_audit'>
export type AnalyticsLogRow = Tables<'analytics_logs'>
export type SystemConfigRow = Tables<'system_config'>
export type LoginAttemptRow = Tables<'login_attempts'>
export type UserSessionRow = Tables<'user_sessions'>

// -----------------------------------------------------------------------------
// Auth and Identity: GET /api/me
// -----------------------------------------------------------------------------

export type UserSummaryDTO = Pick<
  UserRow,
  'id' | 'email' | 'last_login_at' | 'timezone'
>

export type ProfileSummaryDTO = {
  has_preferences: boolean
  is_complete: boolean
  diet: string | null
  allergens_count: number
  exclusions_count: number
}

export type MeResponseData = {
  user: UserSummaryDTO
  profile: ProfileSummaryDTO
}

// -----------------------------------------------------------------------------
// User Preferences: GET/POST/PUT /api/user/preferences
// - Map JSON arrays to string[] for allergens/exclusions
// -----------------------------------------------------------------------------

export type UserPreferencesDTO = Omit<
  UserPreferencesRow,
  'allergens' | 'exclusions'
> & {
  allergens: string[]
  exclusions: string[]
}

export type CreateUserPreferencesCommand = {
  allergens: string[]
  exclusions: string[]
  diet: string | null
  target_calories: number | null
  target_servings: number | null
}

export type UpsertUserPreferencesCommand = CreateUserPreferencesCommand

// -----------------------------------------------------------------------------
// Recipes: DTOs and Commands
// - Map JSON fields to structured DTOs
// -----------------------------------------------------------------------------

export type RecipeIngredientDTO = {
  text: string
  unit?: string
  amount?: number
  no_scale?: boolean
}

export type RecipeTags = Record<string, string>

export type RecipeDTO = Omit<RecipeRow, 'ingredients' | 'steps' | 'tags'> & {
  ingredients: RecipeIngredientDTO[]
  steps: string[]
  tags: RecipeTags
  // Computed/user-specific fields on some endpoints
  rating?: number | null
  is_favorite?: boolean
}

export type CreateRecipeCommand = {
  title: string
  ingredients: RecipeIngredientDTO[]
  steps: string[]
  tags: RecipeTags
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  calories_per_serving?: number
  servings: number
}

// PATCH semantics: arrays are full-replace; objects merge server-side; null clears
export type PatchRecipeCommand = {
  title?: string | null
  ingredients?: RecipeIngredientDTO[] | null
  steps?: string[] | null
  tags?: RecipeTags | null
  prep_time_minutes?: number | null
  cook_time_minutes?: number | null
  total_time_minutes?: number | null
  calories_per_serving?: number | null
  servings?: number | null
}

// Helper: /api/recipes/structure
export type ExtractedValue<T> = { value: T; confidence: number }
export type ExtractedIngredient = RecipeIngredientDTO & { confidence?: number }
export type ExtractedStep = { text: string; confidence?: number }

export type RecipeStructureRequest = {
  raw: string
  normalize_units: boolean
}

export type RecipeStructureResponseData = {
  title?: ExtractedValue<string>
  ingredients?: ExtractedIngredient[]
  steps?: ExtractedStep[]
  warnings?: string[]
}

// -----------------------------------------------------------------------------
// Ratings and Favorites
// -----------------------------------------------------------------------------

export type PutRecipeRatingCommand = { rating: number }
export type RecipeRatingDTO = { recipe_id: UUID; rating: number }

export type PutRecipeFavoriteCommand = { favorite: boolean }
export type RecipeFavoriteDTO = { recipe_id: UUID; favorite: boolean }

// -----------------------------------------------------------------------------
// AI Adjustments (Jobs)
// -----------------------------------------------------------------------------

export type AIAdjustmentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'invalid-json'
  | 'validation-fail'
  | 'limit-exceeded'

export type AIAdjustmentJobDTO = Omit<
  AIAdjustmentRow,
  'parameters' | 'status'
> & {
  parameters: Record<string, unknown>
  status: AIAdjustmentStatus
}

export type StartAIAdjustmentCommand = {
  parameters: {
    avoid_allergens?: boolean
    use_exclusions?: boolean
    target_calories?: number
    presets?: string[]
  }
  model: string
}

export type StartAIAdjustmentResponse = {
  job_id: UUID
  status: Extract<'pending', AIAdjustmentStatus>
}

// -----------------------------------------------------------------------------
// Chat (LLM) - OpenRouter-backed
// -----------------------------------------------------------------------------

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatModelParams = {
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
  stop?: string | string[]
}

export type ChatResponseFormatJsonSchema = {
  type: 'json_schema'
  json_schema: {
    name: string
    strict: true
    schema: Record<string, unknown>
  }
}

export type ChatCompletionRequest = {
  systemMessage?: string
  history?: ChatMessage[]
  userMessage: string
  model?: string
  params?: ChatModelParams
  response_format?: ChatResponseFormatJsonSchema
}

export type ChatCompletionResponseData = {
  text: string
  structured?: unknown
  requestId?: string
}

// -----------------------------------------------------------------------------
// Presets
// -----------------------------------------------------------------------------

export type PresetAccessLevel = 'global' | 'persona' | 'user'

export type PresetDTO = Omit<
  PresetRow,
  'parameters' | 'access_level'
> & {
  parameters: Record<string, unknown>
  access_level: PresetAccessLevel
}

export type CreatePresetCommand = {
  name: string
  description?: string | null
  parameters: Record<string, unknown>
  access_level: PresetAccessLevel
  persona?: string | null
  is_pinned?: boolean
}

export type PatchPresetCommand = Partial<CreatePresetCommand>

// -----------------------------------------------------------------------------
// Allergen Dictionary (Admin)
// -----------------------------------------------------------------------------

export type AllergenDictionaryDTO = Omit<
  AllergenDictionaryRow,
  'synonyms'
> & {
  synonyms: string[]
}

export type CreateAllergenCommand = {
  allergen_name: string
  synonyms: string[]
  is_active: boolean
}

export type PatchAllergenCommand = Partial<
  Pick<CreateAllergenCommand, 'allergen_name' | 'synonyms' | 'is_active'>
>

export type AllergenDictionaryAuditDTO = Omit<
  AllergenDictionaryAuditRow,
  'old_values' | 'new_values'
> & {
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

// -----------------------------------------------------------------------------
// Analytics
// -----------------------------------------------------------------------------

export type AnalyticsLogAction =
  | 'AIAdjustRequested'
  | 'AIAdjustSucceeded'
  | 'AIAdjustFailed'
  | 'ProfileCompleted'

export type AppendAnalyticsLogCommand = {
  action: AnalyticsLogAction
  status?: string | null
  recipe_id?: UUID | null
  metadata: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// System Config (Admin)
// -----------------------------------------------------------------------------

export type SystemConfigDTO = Omit<SystemConfigRow, 'config_value'> & {
  config_value: unknown
}

export type UpsertSystemConfigCommand = {
  config_value: unknown
  description?: string | null
}

// -----------------------------------------------------------------------------
// Internal/Operational
// -----------------------------------------------------------------------------

export type RecordLoginAttemptCommand = {
  email: string
  success: boolean
  failure_reason?: string | null
}


