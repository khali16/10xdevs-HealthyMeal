import type { ApiError, ApiListMeta, AllergenDictionaryDTO } from '@/types'

type AllergensResponse = { data: AllergenDictionaryDTO[]; meta?: ApiListMeta }

export type ApiMappedError = { code?: string; message: string; fieldErrors?: Record<string, string[]> }

const DEFAULT_ERROR: ApiMappedError = { code: 'INTERNAL', message: 'Unexpected API response' }

type ListAllergensParams = {
  is_active?: boolean
  page?: number
  page_size?: number
  sort?: 'name' | 'created_at' | 'updated_at'
  order?: 'asc' | 'desc'
  q?: string
}

export async function listAllergens(
  params: ListAllergensParams,
  signal?: AbortSignal,
): Promise<AllergensResponse> {
  const qs = buildAllergensQuery(params)
  const res = await fetch(`/api/allergens?${qs}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  if (!res.ok) {
    const err = mapApiError(payload)
    throw err
  }

  const typed = payload as AllergensResponse
  if (!typed?.data) {
    throw DEFAULT_ERROR
  }

  return typed
}

function buildAllergensQuery(params: ListAllergensParams): string {
  const query = new URLSearchParams()

  if (params.is_active !== undefined) query.set('is_active', String(params.is_active))
  if (params.page) query.set('page', String(params.page))
  if (params.page_size) query.set('page_size', String(params.page_size))
  if (params.sort) query.set('sort', params.sort)
  if (params.order) query.set('order', params.order)
  if (params.q) query.set('q', params.q)

  return query.toString()
}

function mapApiError(payload: unknown): ApiMappedError {
  const apiErr = payload as ApiError | undefined
  if (apiErr?.error?.message) {
    return {
      code: apiErr.error.code,
      message: apiErr.error.message,
      fieldErrors: apiErr.error.fieldErrors,
    }
  }
  return DEFAULT_ERROR
}
