import type { APIRoute } from 'astro'
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

  const rawReturnTo = (payload as { returnTo?: string } | null)?.returnTo
  const returnTo = typeof rawReturnTo === 'string' && rawReturnTo.startsWith('/') ? rawReturnTo : null

  const redirectTo = new URL('/auth/callback', context.request.url)
  if (returnTo) redirectTo.searchParams.set('returnTo', returnTo)

  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo.toString() },
  })

  if (error || !data?.url) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: {
          code: 'BAD_REQUEST',
          message: 'Nie udało się rozpocząć logowania przez Google.',
          details: error?.message,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(JSON.stringify({ data: { url: data.url } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
