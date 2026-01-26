import type { APIRoute } from 'astro'
import { createRecipeCommandSchema } from '@/lib/validation/recipes'
import { createRecipe, listRecipes, type RecipeSort } from '@/lib/services/recipes.service'
import { supabaseClient } from '@/db/supabase.client'
import type { ApiError, ApiListMeta } from '@/types'

export const prerender = false

export const POST: APIRoute = async (context) => {
  // Try to get authenticated user from JWT token
  let supabase = context.locals.supabase
  let userId: string | null = context.locals.user?.id ?? null
  let userEmail: string | null = context.locals.user?.email ?? null

  const authHeader = context.request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // User provided JWT token - verify it
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)
    
    if (!error && user) {
      userId = user.id
      userEmail = user.email ?? null
      // Create authenticated client for this user
      supabase = supabaseClient
    } else {
      return new Response(
        JSON.stringify(<ApiError>{
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Ensure user exists in public.users table
  // This is necessary because recipes table has a foreign key to users table
  const { data: existingUser, error: userCheckError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (userCheckError) {
    console.error('Error checking user existence:', userCheckError)
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'INTERNAL', message: 'Failed to verify user' },
      }),
      { status: 500 },
    )
  }

  if (!existingUser) {
    if (!userEmail) {
      return new Response(
        JSON.stringify(<ApiError>{
          error: { code: 'BAD_REQUEST', message: 'Missing user email' },
        }),
        { status: 400 },
      )
    }

    const { error: createUserError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: userEmail,
        password_hash: '$2a$10$placeholder_hash_auth_managed',
        is_active: true,
        created_at: new Date().toISOString(),
      })

    if (createUserError) {
      console.error('Error creating user in public.users:', createUserError)
      return new Response(
        JSON.stringify(<ApiError>{
          error: { code: 'INTERNAL', message: 'Failed to create user record' },
        }),
        { status: 500 },
      )
    }
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

export const GET: APIRoute = async (context) => {
  // Try to get authenticated user from JWT token
  let supabase = context.locals.supabase
  let userId: string | null = context.locals.user?.id ?? null

  const authHeader = context.request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)

    if (!error && user) {
      userId = user.id
      supabase = supabaseClient
    } else {
      return new Response(
        JSON.stringify(<ApiError>{
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  if (!userId) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Parse query parameters
  const url = new URL(context.request.url)
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1
  const pageSize = Math.min(
    Number.parseInt(url.searchParams.get('page_size') ?? '20', 10) || 20,
    100,
  )
  const sortRaw = url.searchParams.get('sort')
  const allowedSorts: RecipeSort[] = ['newest', 'favorites', 'top_rated']
  const sort = allowedSorts.includes(sortRaw as RecipeSort) ? (sortRaw as RecipeSort) : 'newest'
  const q = sanitizeString(url.searchParams.get('q'), 200)
  const diet = sanitizeString(url.searchParams.get('diet'), 50)
  const maxCalories = clampInt(url.searchParams.get('max_calories'), 0, 100000)
  const maxTotalTime = clampInt(url.searchParams.get('max_total_time'), 0, 2000)
  const favorite = parseBoolean(url.searchParams.get('favorite'))
  const tags = readTags(url.searchParams)

  try {
    const { items, total } = await listRecipes(supabase, userId, page, pageSize, sort, {
      q: q ?? undefined,
      diet: diet ?? undefined,
      max_calories: maxCalories ?? undefined,
      max_total_time: maxTotalTime ?? undefined,
      favorite: favorite ?? undefined,
      tags,
    })

    const meta: ApiListMeta = {
      page,
      page_size: pageSize,
      total,
      has_next: page * pageSize < total,
    }

    return new Response(JSON.stringify({ data: items, meta }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('List recipes failed', e)
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'INTERNAL', message: 'Internal Server Error' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

function sanitizeString(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function clampInt(
  value: string | number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (Number.isNaN(num)) return null
  const clamped = Math.min(Math.max(num, min), max)
  return clamped
}

function parseBoolean(value: string | null): boolean | null {
  if (value == null) return null
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return null
}

function readTags(params: URLSearchParams): Record<string, string> | undefined {
  const tags: Record<string, string> = {}
  params.forEach((value, key) => {
    if (key.startsWith('tag:') && value) {
      const tagKey = key.slice(4)
      if (tagKey) {
        tags[tagKey] = value
      }
    }
  })
  return Object.keys(tags).length ? tags : undefined
}

