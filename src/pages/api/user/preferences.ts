import type { APIRoute } from 'astro'
import type { SupabaseClient } from '@/db/supabase.client'
import { userPreferencesCommandSchema } from '@/lib/validation/user-preferences'
import {
  create,
  getByUserId,
  upsert,
} from '@/lib/services/user-preferences.service'
import type { ApiError, ApiSuccess } from '@/types'

export const prerender = false

const jsonHeaders = { 'Content-Type': 'application/json' }

/**
 * Resolves user ID from Bearer token or cookies.
 * Returns a Response on auth failure.
 */
async function resolveUser(
  request: Request,
  supabase: SupabaseClient,
): Promise<{ userId: string; supabase: SupabaseClient } | Response> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user?.id) {
      return new Response(
        JSON.stringify({
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        } as ApiError),
        { status: 401, headers: jsonHeaders },
      )
    }
    return { userId: data.user.id, supabase }
  }

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.id) {
    return new Response(
      JSON.stringify({
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
      } as ApiError),
      { status: 401, headers: jsonHeaders },
    )
  }

  return { userId: data.user.id, supabase }
}

/**
 * GET /api/user/preferences
 * Fetches preferences for the authenticated user.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const auth = await resolveUser(request, locals.supabase)
  if (auth instanceof Response) return auth

  try {
    const dto = await getByUserId(auth.supabase, auth.userId)
    if (!dto) {
      return new Response(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'Preferences not found' },
        } as ApiError),
        { status: 404, headers: jsonHeaders },
      )
    }

    const response: ApiSuccess<typeof dto> = { data: dto }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (e: unknown) {
    console.error('Get user preferences failed', { error: e, userId: auth.userId, operation: 'GET' })
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL', message: 'Internal Server Error' },
      } as ApiError),
      { status: 500, headers: jsonHeaders },
    )
  }
}

/**
 * POST /api/user/preferences
 * Creates preferences for the authenticated user if they do not exist.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await resolveUser(request, locals.supabase)
  if (auth instanceof Response) return auth

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  const parsed = userPreferencesCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  try {
    const dto = await create(auth.supabase, auth.userId, parsed.data)
    const response: ApiSuccess<typeof dto> = { data: dto }
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        ...jsonHeaders,
        Location: '/api/user/preferences',
      },
    })
  } catch (e: unknown) {
    console.error('Create user preferences failed', { error: e, userId: auth.userId, operation: 'POST' })

    const error = e as { code?: string }
    if (error.code === 'DB_CONFLICT') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'ALREADY_EXISTS',
            message: 'Preferences already exist for this user',
          },
        } as ApiError),
        { status: 400, headers: jsonHeaders },
      )
    }

    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL', message: 'Internal Server Error' },
      } as ApiError),
      { status: 500, headers: jsonHeaders },
    )
  }
}

/**
 * PUT /api/user/preferences
 * Creates or updates preferences for the authenticated user.
 */
export const PUT: APIRoute = async ({ request, locals }) => {
  const auth = await resolveUser(request, locals.supabase)
  if (auth instanceof Response) return auth

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  const parsed = userPreferencesCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  try {
    const dto = await upsert(auth.supabase, auth.userId, parsed.data)
    const response: ApiSuccess<typeof dto> = { data: dto }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (e: unknown) {
    console.error('Upsert user preferences failed', { error: e, userId: auth.userId, operation: 'PUT' })
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL', message: 'Internal Server Error' },
      } as ApiError),
      { status: 500, headers: jsonHeaders },
    )
  }
}
