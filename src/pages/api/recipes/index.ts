import type { APIRoute } from 'astro'
import { createRecipeCommandSchema } from '@/lib/validation/recipes'
import { createRecipe, listRecipes } from '@/lib/services/recipes.service'
import { DEFAULT_USER_ID, getSupabaseServiceRoleClient, supabaseClient } from '@/db/supabase.client'
import type { ApiError, ApiListMeta } from '@/types'

export const prerender = false

export const POST: APIRoute = async (context) => {
  // Try to get authenticated user from JWT token
  let supabase = context.locals.supabase
  let userId: string | null = null

  const authHeader = context.request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // User provided JWT token - verify it
    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token)
    
    if (!error && user) {
      userId = user.id
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
  } else {
    // No auth header - use service role for development (bypasses RLS)
    supabase = getSupabaseServiceRoleClient()
    userId = DEFAULT_USER_ID
  }

  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'INTERNAL', message: 'Missing user ID' },
      }),
      { status: 500 },
    )
  }

  // Ensure user exists in public.users table
  // This is necessary because recipes table has a foreign key to users table
  const serviceRoleClient = getSupabaseServiceRoleClient()
  const { data: existingUser, error: userCheckError } = await serviceRoleClient
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
    // User doesn't exist in public.users, try to sync from auth.users
    let authUser = null
    try {
      const { data: authData, error: authError } = await serviceRoleClient.auth.admin.getUserById(userId)
      if (!authError && authData?.user) {
        authUser = authData.user
      }
    } catch (e) {
      console.error('Error fetching auth user:', e)
    }

    if (authUser) {
      // Create user in public.users from auth.users data
      const { error: createUserError } = await serviceRoleClient
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          password_hash: '$2a$10$placeholder_hash_auth_managed',
          is_active: true,
          created_at: authUser.created_at || new Date().toISOString(),
        })

      if (createUserError) {
        console.error('Error creating user in public.users:', createUserError)
        return new Response(
          JSON.stringify(<ApiError>{
            error: {
              code: 'INTERNAL',
              message: `User with ID ${userId} does not exist in public.users table and failed to sync from auth.users. Please run the sync migration or create the user manually.`,
            },
          }),
          { status: 500 },
        )
      }
    } else {
      // User doesn't exist in auth.users either
      return new Response(
        JSON.stringify(<ApiError>{
          error: {
            code: 'NOT_FOUND',
            message: `User with ID ${userId} does not exist. Please ensure the user exists in the users table.`,
          },
        }),
        { status: 404 },
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
  let userId: string | null = null

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
  } else {
    // No auth header - use service role to bypass RLS for development
    supabase = getSupabaseServiceRoleClient()
    userId = DEFAULT_USER_ID
  }

  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Parse query parameters
  const url = new URL(context.request.url)
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1
  const pageSize = Math.min(
    Number.parseInt(url.searchParams.get('page_size') ?? '20', 10) || 20,
    100,
  )

  try {
    const { items, total } = await listRecipes(supabase, userId, page, pageSize)

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


