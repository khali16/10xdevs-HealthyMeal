import type { APIRoute } from 'astro'
import { getRecipeById } from '@/lib/services/recipes.service'
import {
  DEFAULT_USER_ID,
  getSupabaseServiceRoleClient,
  supabaseClient,
} from '@/db/supabase.client'

export const prerender = false

export const GET: APIRoute = async ({ params, locals, request }) => {
  const id = params.id
  if (!id) {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Try to get authenticated user from JWT token
  let supabase = locals.supabase
  let userId: string | null = null

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
  } else {
    // No auth header - use service role to bypass RLS for development
    supabase = getSupabaseServiceRoleClient()
    userId = DEFAULT_USER_ID
  }

  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const item = await getRecipeById(supabase, userId, id)
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


