import type { APIRoute } from 'astro'
import type { ApiError } from '@/types'
import { createSupabaseServerInstance } from '@/db/supabase.client'

export const prerender = false

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  })

  const { error } = await supabase.auth.signOut()

  if (error) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Nie udało się wylogować.',
          details: error.message,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(null, {
    status: 303,
    headers: { Location: '/auth/login' },
  })
}
