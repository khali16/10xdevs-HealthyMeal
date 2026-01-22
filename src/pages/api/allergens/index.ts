import type { APIRoute } from 'astro'
import { listAllergens } from '@/lib/services/allergens.service'
import { listAllergensQuerySchema } from '@/lib/validation/allergens'
import { getSupabaseServiceRoleClient } from '@/db/supabase.client'
import type { ApiError, ApiListMeta } from '@/types'

export const prerender = false

const jsonHeaders = { 'Content-Type': 'application/json' }

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const queryParams = Object.fromEntries(url.searchParams.entries())
  const parsed = listAllergensQuerySchema.safeParse(queryParams)

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid query params',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  try {
    const { items, total } = await listAllergens(
      getSupabaseServiceRoleClient(),
      {
        is_active: parsed.data.is_active,
        q: parsed.data.q,
      },
      {
        page: parsed.data.page,
        pageSize: parsed.data.page_size,
      },
      {
        sort: parsed.data.sort,
        order: parsed.data.order,
      },
    )

    const meta: ApiListMeta = {
      page: parsed.data.page,
      page_size: parsed.data.page_size,
      total,
      has_next: parsed.data.page * parsed.data.page_size < total,
    }

    return new Response(JSON.stringify({ data: items, meta }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (e) {
    console.error('List allergens failed', e)
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL', message: 'Internal Server Error' },
      } as ApiError),
      { status: 500, headers: jsonHeaders },
    )
  }
}
