import type { APIRoute } from 'astro'
import { getRecipeById } from '@/lib/services/recipes.service'
import { DEFAULT_USER_ID } from '@/db/supabase.client'

export const prerender = false

export const GET: APIRoute = async ({ params, locals }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const userId = DEFAULT_USER_ID
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const item = await getRecipeById(locals.supabase, userId, id)
    if (!item) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Recipe not found' } }),
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
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}


