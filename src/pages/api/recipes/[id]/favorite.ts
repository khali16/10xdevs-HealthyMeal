import type { APIRoute } from 'astro'
import { DEFAULT_USER_ID } from '@/db/supabase.client'
import { getRecipeById } from '@/lib/services/recipes.service'
import { setFavorite } from '@/lib/services/favorites.service'
import { putRecipeFavoriteCommandSchema } from '@/lib/validation/recipes'
import type { ApiError } from '@/types'

export const prerender = false

/**
 * PUT /api/recipes/[id]/favorite
 * Sets or removes a favorite flag for a recipe by the default user.
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

  const parsed = putRecipeFavoriteCommandSchema.safeParse(payload)
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

    // Set or remove favorite
    const dto = await setFavorite(locals.supabase, userId, id, parsed.data.favorite)
    return new Response(JSON.stringify({ data: dto }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    console.error('Put recipe favorite failed', { error: e, userId, recipeId: id, operation: 'PUT' })
    
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

