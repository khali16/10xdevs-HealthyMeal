import * as React from 'react'
import type { RecipeSort, RecipesListQuery } from '../types'

const SORT_VALUES: RecipeSort[] = ['newest', 'favorites', 'top_rated']
const DEFAULT_QUERY: RecipesListQuery = { page: 1, page_size: 20, sort: 'newest' }

type SetQueryOptions = { replace?: boolean }

export function useRecipesListQueryState() {
  const [query, setQuery] = React.useState<RecipesListQuery>(DEFAULT_QUERY)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const initial = parseQuery(window.location.search)
    setQuery(initial)

    const onPopState = () => {
      const next = parseQuery(window.location.search)
      setQuery(next)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const updateQuery = React.useCallback(
    (partial: Partial<RecipesListQuery>, options?: SetQueryOptions) => {
      setQuery((current) => {
        const merged = normalizeQuery({ ...current, ...partial })
        if (typeof window !== 'undefined') {
          const search = serializeQuery(merged)
          const url = `${window.location.pathname}?${search}`
          const method = options?.replace ? 'replaceState' : 'pushState'
          window.history[method]({ path: url }, '', url)
        }
        return merged
      })
    },
    [],
  )

  return { query, setQuery: updateQuery }
}

function parseQuery(search: string): RecipesListQuery {
  const params = new URLSearchParams(search)
  const page = clampInt(params.get('page'), 1, Number.MAX_SAFE_INTEGER, 1)
  const pageSize = clampInt(params.get('page_size'), 1, 100, 20)

  const sortRaw = params.get('sort') as RecipeSort | null
  const sort = SORT_VALUES.includes(sortRaw ?? '') ? sortRaw! : 'newest'

  const q = sanitizeString(params.get('q'), 200)
  const diet = sanitizeString(params.get('diet'), 50)

  const maxCalories = clampInt(params.get('max_calories'), 0, 100000)
  const maxTotalTime = clampInt(params.get('max_total_time'), 0, 2000)

  const favorite = parseBoolean(params.get('favorite'))

  const tags = readTags(params)

  return normalizeQuery({
    page,
    page_size: pageSize,
    sort,
    q: q ?? undefined,
    diet: diet ?? undefined,
    max_calories: maxCalories ?? undefined,
    max_total_time: maxTotalTime ?? undefined,
    favorite: favorite ?? undefined,
    tags,
  })
}

function serializeQuery(query: RecipesListQuery): string {
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

function normalizeQuery(input: Partial<RecipesListQuery>): RecipesListQuery {
  const page = clampInt(input.page, 1, Number.MAX_SAFE_INTEGER, 1)!
  const pageSize = clampInt(input.page_size, 1, 100, 20)!

  const sort = SORT_VALUES.includes((input.sort as RecipeSort) ?? '')
    ? (input.sort as RecipeSort)
    : 'newest'

  const q = sanitizeString(input.q, 200) ?? undefined
  const diet = sanitizeString(input.diet, 50) ?? null

  const maxCalories = clampInt(input.max_calories, 0, 100000)
  const maxTotalTime = clampInt(input.max_total_time, 0, 2000)

  const favorite = typeof input.favorite === 'boolean' ? input.favorite : undefined

  const tags = cleanTags(input.tags)

  return {
    page,
    page_size: pageSize,
    sort,
    ...(q ? { q } : {}),
    ...(diet ? { diet } : {}),
    ...(maxCalories != null ? { max_calories: maxCalories } : {}),
    ...(maxTotalTime != null ? { max_total_time: maxTotalTime } : {}),
    ...(favorite != null ? { favorite } : {}),
    ...(tags && Object.keys(tags).length ? { tags } : {}),
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
  fallback?: number,
): number | null {
  if (value == null) return fallback ?? null
  const num = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (Number.isNaN(num)) return fallback ?? null
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

function cleanTags(input?: Record<string, string> | null): Record<string, string> | undefined {
  if (!input) return undefined
  const entries = Object.entries(input)
    .map(([k, v]) => [k.trim(), v?.trim()] as const)
    .filter(([k, v]) => k.length > 0 && v)
  if (!entries.length) return undefined
  return Object.fromEntries(entries) as Record<string, string>
}

