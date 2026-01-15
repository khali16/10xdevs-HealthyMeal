import type {
  ApiError,
  ApiListMeta,
  PutRecipeFavoriteCommand,
  PutRecipeRatingCommand,
  RecipeDTO,
  RecipeFavoriteDTO,
  RecipeRatingDTO,
} from '@/types'
import type { RecipesListQuery } from '@/components/recipes/types'

type RecipesListResponse = { data: RecipeDTO[]; meta: ApiListMeta }
type RecipeResponse = { data: RecipeDTO }
type RecipeRatingResponse = { data: RecipeRatingDTO }
type RecipeFavoriteResponse = { data: RecipeFavoriteDTO }

export type ApiMappedError = { code?: string; message: string }

const DEFAULT_ERROR: ApiMappedError = { code: 'INTERNAL', message: 'Unexpected API response' }

export async function listRecipes(
  query: RecipesListQuery,
  signal?: AbortSignal,
): Promise<RecipesListResponse> {
  const qs = buildRecipesQueryString(query)
  const res = await fetch(`/api/recipes?${qs}`, {
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

  const typed = payload as RecipesListResponse
  if (!typed?.data || !typed?.meta) {
    throw DEFAULT_ERROR
  }

  return typed
}

export async function getRecipeById(
  id: string,
  signal?: AbortSignal,
): Promise<RecipeResponse> {
  const res = await fetch(`/api/recipes/${id}`, {
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
    let err = mapApiError(payload)
    if (res.status === 404) {
      err = { ...err, code: err.code ?? 'NOT_FOUND' }
    }
    throw err
  }

  const typed = payload as RecipeResponse
  if (!typed?.data) {
    throw DEFAULT_ERROR
  }

  return typed
}

export async function putRecipeRating(
  id: string,
  cmd: PutRecipeRatingCommand,
): Promise<RecipeRatingResponse> {
  const res = await fetch(`/api/recipes/${id}/rating`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  if (!res.ok) {
    let err = mapApiError(payload)
    if (res.status === 404) {
      err = { ...err, code: err.code ?? 'NOT_FOUND' }
    }
    throw err
  }

  const typed = payload as RecipeRatingResponse
  if (!typed?.data) {
    throw DEFAULT_ERROR
  }

  return typed
}

export async function deleteRecipeRating(id: string): Promise<void> {
  const res = await fetch(`/api/recipes/${id}/rating`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })

  if (res.ok) return

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  let err = mapApiError(payload)
  if (res.status === 404) {
    err = { ...err, code: err.code ?? 'NOT_FOUND' }
  }
  throw err
}

export async function putRecipeFavorite(
  id: string,
  cmd: PutRecipeFavoriteCommand,
): Promise<RecipeFavoriteResponse> {
  const res = await fetch(`/api/recipes/${id}/favorite`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  if (!res.ok) {
    let err = mapApiError(payload)
    if (res.status === 404) {
      err = { ...err, code: err.code ?? 'NOT_FOUND' }
    }
    throw err
  }

  const typed = payload as RecipeFavoriteResponse
  if (!typed?.data) {
    throw DEFAULT_ERROR
  }

  return typed
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`/api/recipes/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })

  if (res.ok) return

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  let err = mapApiError(payload)
  if (res.status === 404) {
    err = { ...err, code: err.code ?? 'NOT_FOUND' }
  } else if (res.status === 405) {
    err = { ...err, code: err.code ?? 'METHOD_NOT_ALLOWED' }
  }
  throw err
}

function buildRecipesQueryString(query: RecipesListQuery): string {
  const params = new URLSearchParams()

  params.set('page', String(query.page))
  params.set('page_size', String(query.page_size))
  params.set('sort', query.sort)

  if (query.q) params.set('q', query.q)
  if (query.diet) params.set('diet', query.diet)
  if (query.max_calories != null) params.set('max_calories', String(query.max_calories))
  if (query.max_total_time != null) params.set('max_total_time', String(query.max_total_time))
  if (query.favorite != null) params.set('favorite', String(query.favorite))

  if (query.tags) {
    Object.entries(query.tags).forEach(([key, value]) => {
      if (value) params.set(`tag:${key}`, value)
    })
  }

  return params.toString()
}

function mapApiError(payload: unknown): ApiMappedError {
  const apiErr = payload as ApiError | undefined
  if (apiErr?.error?.message) {
    return { code: apiErr.error.code, message: apiErr.error.message }
  }
  return DEFAULT_ERROR
}

