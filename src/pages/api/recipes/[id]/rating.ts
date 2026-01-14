import type { APIRoute } from 'astro'
import { DEFAULT_USER_ID } from '@/db/supabase.client'
import { getRecipeById } from '@/lib/services/recipes.service'
import { upsertRating, deleteRating } from '@/lib/services/ratings.service'
import { putRecipeRatingCommandSchema } from '@/lib/validation/recipes'
import type { ApiError } from '@/types'

export const prerender = false

/**
 * PUT /api/recipes/[id]/rating
 * Creates or updates a rating for a recipe by the default user.
 */
export const PUT: APIRoute = async ({ params, locals, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const userId = DEFAULT_USER_ID
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parsed = putRecipeRatingCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    // Check if recipe exists
    const recipe = await getRecipeById(locals.supabase, userId, id)
    if (!recipe) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Upsert rating
    const dto = await upsertRating(locals.supabase, userId, id, parsed.data.rating)
    return new Response(JSON.stringify({ data: dto }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    console.error('Put recipe rating failed', { error: e, userId, recipeId: id, operation: 'PUT' })
    
    // Handle specific database errors
    const error = e as { code?: string }
    if (error.code === 'DB_FOREIGN_KEY') {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/**
 * DELETE /api/recipes/[id]/rating
 * Deletes a rating for a recipe by the default user.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const userId = DEFAULT_USER_ID
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    // Check if recipe exists
    const recipe = await getRecipeById(locals.supabase, userId, id)
    if (!recipe) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Delete rating
    const deleted = await deleteRating(locals.supabase, userId, id)
    if (!deleted) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Rating not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(null, { status: 204 })
  } catch (e: unknown) {
    console.error('Delete recipe rating failed', { error: e, userId, recipeId: id, operation: 'DELETE' })
    
    // Handle specific database errors
    const error = e as { code?: string }
    if (error.code === 'DB_FOREIGN_KEY') {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

