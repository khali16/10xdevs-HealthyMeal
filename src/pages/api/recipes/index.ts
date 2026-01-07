import type { APIRoute } from 'astro'
import { createRecipeCommandSchema } from '@/lib/validation/recipes'
import { createRecipe } from '@/lib/services/recipes.service'
import { DEFAULT_USER_ID } from '@/db/supabase.client'
import { listRecipes } from '@/lib/services/recipes.service'
import { mockRecipes } from '@/lib/mocks/recipes'
import type { ApiError } from '@/types'

export const prerender = false

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase
  const userId = DEFAULT_USER_ID
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' },
      }),
      { status: 500 },
    )
  }

  let payload: unknown
  try {
    payload = await context.request.json()
  } catch {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON' },
      }),
      { status: 400 },
    )
  }

  const parsed = createRecipeCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      }),
      { status: 400 },
    )
  }

  try {
    const dto = await createRecipe(supabase, userId, parsed.data)
    const body = JSON.stringify({ data: dto })
    return new Response(body, {
      status: 201,
      headers: {
        Location: `/api/recipes/${dto.id}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (e) {
    console.error('Create recipe failed', e)
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'INTERNAL', message: 'Internal Server Error' },
      }),
      { status: 500 },
    )
  }
}

export const GET: APIRoute = async () => {
  const data = mockRecipes
  const meta = { page: 1, page_size: data.length, total: data.length, has_next: false }
  return new Response(JSON.stringify({ data, meta }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}


