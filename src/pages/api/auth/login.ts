import type { APIRoute } from 'astro'
import { loginCommandSchema } from '@/lib/validation/auth'
import type { ApiError } from '@/types'
import { createSupabaseServerInstance } from '@/db/supabase.client'

export const prerender = false

export const POST: APIRoute = async (context) => {
  let payload: unknown
  try {
    payload = await context.request.json()
  } catch {
    return new Response(
      JSON.stringify(<ApiError>{ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parsed = loginCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  })

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'UNAUTHORIZED', message: 'Nieprawidłowy email lub hasło.' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ data: { user: { id: data.user.id, email: data.user.email } } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
