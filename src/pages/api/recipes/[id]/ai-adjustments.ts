import type { APIRoute } from 'astro'
import { z } from 'zod'
import { supabaseClient } from '@/db/supabase.client'
import { getRecipeById } from '@/lib/services/recipes.service'
import { getByUserId } from '@/lib/services/user-preferences.service'
import { OpenRouterService } from '@/lib/openrouter/OpenRouterService'
import { isOpenRouterError } from '@/lib/openrouter/errors'
import { startAIAdjustmentCommandSchema } from '@/lib/validation/ai-adjustments'
import type { ApiError, RecipeDTO, RecipeIngredientDTO, RecipeTags } from '@/types'

export const prerender = false

const jsonHeaders = { 'Content-Type': 'application/json' }

export const POST: APIRoute = async ({ params, locals, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  let supabase = locals.supabase
  let userId: string | null = locals.user?.id ?? null

  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)

    if (!error && user) {
      userId = user.id
      supabase = supabaseClient
    } else {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } } as ApiError),
        { status: 401, headers: jsonHeaders },
      )
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } as ApiError),
      { status: 401, headers: jsonHeaders },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  const parsed = startAIAdjustmentCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 422, headers: jsonHeaders },
    )
  }

  const startedAt = Date.now()
  let jobId: string | null = null

  try {
    const recipe = await getRecipeById(supabase, userId, id)
    if (!recipe) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: jsonHeaders },
      )
    }

    const { data: job, error: jobError } = await supabase
      .from('ai_adjustments')
      .insert({
        user_id: userId,
        original_recipe_id: id,
        parameters: parsed.data.parameters,
        status: 'processing',
        model_used: parsed.data.model,
      })
      .select('id')
      .single()

    if (jobError) throw jobError
    jobId = job?.id ?? null

    const preferences = await getByUserId(supabase, userId)
    const _includeAllergens = parsed.data.parameters.avoid_allergens === true
    const _includeExclusions = parsed.data.parameters.use_exclusions === true

    const service = new OpenRouterService(
      {
        apiKey: import.meta.env.OPENROUTER_API_KEY,
        baseUrl: import.meta.env.OPENROUTER_BASE_URL,
        appUrl: import.meta.env.OPENROUTER_APP_URL,
        appName: import.meta.env.OPENROUTER_APP_NAME ?? 'HealthyMeal',
        defaultModel: parsed.data.model,
        allowedModels: [parsed.data.model],
      },
      {
        logger: {
          debug: (msg) => console.debug(msg),
          info: (msg) => console.info(msg),
          warn: (msg) => console.warn(msg),
          error: (msg) => console.error(msg),
        },
      },
    )

    const rawText = await service.createChatCompletionText({
      systemMessage: buildSystemMessage(),
      userMessage: buildUserMessage(recipe, parsed.data.parameters, preferences),
      model: parsed.data.model,
      params: { temperature: 0.2, max_tokens: 1200 },
    })

    let structured: AdjustedRecipeOutput
    try {
      structured = parseAdjustedRecipe(rawText)
    } catch (parseError) {
      console.warn('AI adjustment parse failed', {
        length: rawText?.length ?? 0,
        preview: rawText?.slice(0, 200),
      })
      throw parseError
    }

    const adjustedRecipe = mergeAdjustedRecipe(recipe, structured)
    const { data: created, error: createError } = await supabase
      .from('recipes')
      .insert({
        user_id: userId,
        title: adjustedRecipe.title,
        ingredients: adjustedRecipe.ingredients,
        steps: adjustedRecipe.steps,
        tags: adjustedRecipe.tags,
        prep_time_minutes: adjustedRecipe.prep_time_minutes,
        cook_time_minutes: adjustedRecipe.cook_time_minutes,
        total_time_minutes: adjustedRecipe.total_time_minutes,
        calories_per_serving: adjustedRecipe.calories_per_serving,
        servings: adjustedRecipe.servings,
        is_ai_adjusted: true,
        original_recipe_id: id,
      })
      .select('id')
      .single()

    if (createError || !created?.id) {
      throw createError ?? new Error('Failed to create adjusted recipe')
    }

    const durationMs = Date.now() - startedAt
    await supabase
      .from('ai_adjustments')
      .update({
        status: 'completed',
        adjusted_recipe_id: created.id,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('user_id', userId)

    const adjustedDto = await getRecipeById(supabase, userId, created.id)
    return new Response(
      JSON.stringify({
        data: {
          job_id: jobId,
          status: 'completed',
          adjusted_recipe_id: created.id,
          adjusted_recipe: adjustedDto ?? null,
        },
      }),
      { status: 200, headers: jsonHeaders },
    )
  } catch (error) {
    console.error('Start AI adjustment failed', {
      error: safeErrorMessage(error),
      userId,
      recipeId: id,
      operation: 'POST',
    })

    if (jobId) {
      const durationMs = Date.now() - startedAt
      const failure = mapAdjustmentFailure(error)
      try {
        await supabase
          .from('ai_adjustments')
          .update({
            status: failure.status,
            error_message: failure.message,
            duration_ms: durationMs,
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
          .eq('user_id', userId)
      } catch (updateError) {
        console.error('AI adjustment status update failed', {
          error: safeErrorMessage(updateError),
          jobId,
          userId,
        })
      }
    }

    if (isOpenRouterError(error)) {
      const status = error.status ?? 502
      return new Response(
        JSON.stringify({ error: { code: error.code, message: error.message } } as ApiError),
        { status, headers: jsonHeaders },
      )
    }

    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: jsonHeaders },
    )
  }
}

const adjustedRecipeSchema = z.object({
  title: z.string().trim().min(1),
  ingredients: z
    .array(
      z.object({
        text: z.string().trim().min(1),
        unit: z.string().trim().min(1).optional(),
        amount: z.number().finite().optional(),
        no_scale: z.boolean().optional(),
      }),
    )
    .min(1),
  steps: z.array(z.string().trim().min(1)).min(1),
  calories_per_serving: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  tags: z.record(z.string().trim().min(1)).optional(),
})

type AdjustedRecipeOutput = z.infer<typeof adjustedRecipeSchema>
type AdjustmentParameters = z.infer<typeof startAIAdjustmentCommandSchema>['parameters']
type UserPreferencesShape = Awaited<ReturnType<typeof getByUserId>>

function buildSystemMessage(): string {
  return [
    'Jesteś asystentem kulinarnym, który dostosowuje przepisy.',
    'Zwróć WYŁĄCZNIE poprawny JSON zgodny ze schematem.',
    'Nie dodawaj komentarzy ani markdown.',
    'Zachowuj klarowność, jednostki i rozsądne porcje.',
    'Wszystkie teksty w polach tekstowych mają być po polsku.',
  ].join(' ')
}

function buildUserMessage(
  recipe: RecipeDTO,
  parameters: AdjustmentParameters,
  preferences: UserPreferencesShape,
): string {
  const payload = {
    recipe: {
      title: recipe.title,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tags: recipe.tags,
      servings: recipe.servings,
      calories_per_serving: recipe.calories_per_serving ?? null,
      prep_time_minutes: recipe.prep_time_minutes ?? null,
      cook_time_minutes: recipe.cook_time_minutes ?? null,
      total_time_minutes: recipe.total_time_minutes ?? null,
    },
    parameters: {
      avoid_allergens: parameters.avoid_allergens ?? false,
      use_exclusions: parameters.use_exclusions ?? false,
      target_calories: parameters.target_calories ?? null,
      presets: parameters.presets ?? [],
    },
    preferences: {
      allergens: parameters.avoid_allergens ? preferences?.allergens ?? [] : [],
      exclusions: parameters.use_exclusions ? preferences?.exclusions ?? [] : [],
      diet: preferences?.diet ?? null,
      target_calories: preferences?.target_calories ?? null,
    },
  }

  return [
    'Dostosuj przepis do parametrów i preferencji.',
    'Jeśli podano target_calories, celuj w tę wartość na porcję.',
    'Jeśli podano alergeny/wykluczenia, unikaj ich.',
    'Nie wymyślaj alergenów ani wykluczeń spoza listy.',
    'Zachowaj spójność i wykonalność przepisu.',
    'Odpowiedz JSON-em zgodnym z tym schematem:',
    JSON.stringify(adjustedRecipeJsonSchema),
    `Input JSON: ${JSON.stringify(payload)}`,
  ].join('\n')
}

function mergeAdjustedRecipe(
  original: RecipeDTO,
  adjusted: AdjustedRecipeOutput,
): {
  title: string
  ingredients: RecipeIngredientDTO[]
  steps: string[]
  tags: RecipeTags
  servings: number
  calories_per_serving: number | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
} {
  return {
    title: adjusted.title,
    ingredients: adjusted.ingredients,
    steps: adjusted.steps,
    tags: adjusted.tags ?? original.tags,
    servings: adjusted.servings ?? original.servings,
    calories_per_serving:
      adjusted.calories_per_serving ?? original.calories_per_serving ?? null,
    prep_time_minutes: original.prep_time_minutes ?? null,
    cook_time_minutes: original.cook_time_minutes ?? null,
    total_time_minutes: original.total_time_minutes ?? null,
  }
}

function mapAdjustmentFailure(error: unknown): { status: string; message: string } {
  if (error instanceof AIAdjustmentParseError || error instanceof z.ZodError) {
    return { status: 'invalid-json', message: error.message }
  }
  if (isOpenRouterError(error)) {
    if (error.code === 'OPENROUTER_TIMEOUT') {
      return { status: 'timeout', message: error.message }
    }
    if (error.code === 'OPENROUTER_HTTP' && error.status === 429) {
      return { status: 'limit-exceeded', message: error.message }
    }
    if (
      error.code === 'OPENROUTER_INVALID_JSON' ||
      error.code === 'OPENROUTER_STRUCTURED_INVALID' ||
      error.code === 'OPENROUTER_STRUCTURED_NOT_SUPPORTED'
    ) {
      return { status: 'invalid-json', message: error.message }
    }
    return { status: 'failed', message: error.message }
  }
  if (error instanceof Error) {
    return { status: 'failed', message: error.message }
  }
  return { status: 'failed', message: 'Unknown error' }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

class AIAdjustmentParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIAdjustmentParseError'
  }
}

function parseAdjustedRecipe(text: string): AdjustedRecipeOutput {
  const candidate = stripMarkdownFence((text ?? '').trim())
  if (!candidate) {
    throw new AIAdjustmentParseError('AI response was empty')
  }

  try {
    return adjustedRecipeSchema.parse(JSON.parse(candidate))
  } catch {
    const objStart = candidate.indexOf('{')
    const objEnd = candidate.lastIndexOf('}')
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
      try {
        return adjustedRecipeSchema.parse(JSON.parse(candidate.slice(objStart, objEnd + 1)))
      } catch (inner) {
        if (inner instanceof z.ZodError) throw inner
      }
    }
  }

  throw new AIAdjustmentParseError('AI response is not valid JSON')
}

function stripMarkdownFence(value: string): string {
  if (!value.startsWith('```')) return value
  const firstLineEnd = value.indexOf('\n')
  if (firstLineEnd === -1) return value
  const lastFence = value.lastIndexOf('```')
  if (lastFence <= firstLineEnd) return value
  return value.slice(firstLineEnd + 1, lastFence).trim()
}

const adjustedRecipeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'ingredients', 'steps'],
  properties: {
    title: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          unit: { type: 'string' },
          amount: { type: 'number' },
          no_scale: { type: 'boolean' },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    calories_per_serving: { type: 'number' },
    servings: { type: 'number' },
    tags: { type: 'object', additionalProperties: { type: 'string' } },
  },
} satisfies Record<string, unknown>
