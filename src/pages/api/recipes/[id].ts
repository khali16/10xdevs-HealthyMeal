import type { APIRoute } from 'astro'
import { deleteRecipe, getRecipeById, patchRecipe } from '@/lib/services/recipes.service'
import { supabaseClient } from '@/db/supabase.client'
import { patchRecipeCommandSchema } from '@/lib/validation/recipes'
import type { ApiError } from '@/types'

export const prerender = false

export const GET: APIRoute = async ({ params, locals, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Try to get authenticated user from JWT token
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
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const item = await getRecipeById(supabase, userId, id)
    if (!item) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ data: item }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Get recipe failed', e)
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const PATCH: APIRoute = async ({ params, locals, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Try to get authenticated user from JWT token
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
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
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

  const parsed = patchRecipeCommandSchema.safeParse(payload)
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

  const fieldErrors: Record<string, string[]> = {}
  if (parsed.data.title === null) fieldErrors.title = ['Title cannot be null.']
  if (parsed.data.ingredients === null) fieldErrors.ingredients = ['Ingredients cannot be null.']
  if (parsed.data.steps === null) fieldErrors.steps = ['Steps cannot be null.']
  if (parsed.data.servings === null) fieldErrors.servings = ['Servings cannot be null.']

  if (Object.keys(fieldErrors).length > 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors,
        },
      } as ApiError),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const updated = await patchRecipe(supabase, userId, id, parsed.data)
    if (!updated) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Patch recipe failed', { error: e, userId, recipeId: id, operation: 'PATCH' })
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const DELETE: APIRoute = async ({ params, locals, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Try to get authenticated user from JWT token
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
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const deleted = await deleteRecipe(supabase, userId, id)
    if (!deleted) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(null, { status: 204 })
  } catch (e) {
    console.error('Delete recipe failed', { error: e, userId, recipeId: id, operation: 'DELETE' })
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}


