import type { ApiListMeta } from '@/types'

export type RecipeSort = 'newest' | 'favorites' | 'top_rated'

export type RecipesListFiltersVM = {
  q: string
  diet: string | null
  max_calories: number | null
  max_total_time: number | null
  favorite: boolean
}

export type RecipesListQuery = {
  page: number
  page_size: number
  sort: RecipeSort
  q?: string
  diet?: string
  max_calories?: number
  max_total_time?: number
  favorite?: boolean
  tags?: Record<string, string>
}

export type RecipeCardVM = {
  id: string
  title: string
  dietLabel?: string | null
  totalTimeMinutes?: number | null
  caloriesPerServing?: number | null
  rating?: number | null
  isFavorite?: boolean
  updatedAt?: string
}

export type RecipesListViewState =
  | { status: 'loading'; items: RecipeCardVM[]; meta?: undefined; error: undefined }
  | { status: 'ready'; items: RecipeCardVM[]; meta: ApiListMeta; error: undefined }
  | { status: 'empty'; items: []; meta: ApiListMeta; error: undefined }
  | {
      status: 'error'
      items: RecipeCardVM[]
      meta?: ApiListMeta
      error: { code?: string; message: string }
    }

