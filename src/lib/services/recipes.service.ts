import type { SupabaseClient } from '@/db/supabase.client'
import type {
  CreateRecipeCommand,
  PatchRecipeCommand,
  RecipeDTO,
  RecipeRow,
  RecipeIngredientDTO,
  RecipeTags,
} from '@/types'

export type RecipeSort = 'newest' | 'favorites' | 'top_rated'
export type RecipesListFilters = {
  q?: string
  diet?: string
  max_calories?: number
  max_total_time?: number
  favorite?: boolean
  tags?: Record<string, string>
}

export async function createRecipe(
  supabase: SupabaseClient,
  userId: string,
  cmd: CreateRecipeCommand,
): Promise<RecipeDTO> {
  const totalTime = cmd.total_time_minutes ?? (
    cmd.prep_time_minutes != null && cmd.cook_time_minutes != null
      ? cmd.prep_time_minutes + cmd.cook_time_minutes
      : null
  )

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: cmd.title,
      ingredients: cmd.ingredients,
      steps: cmd.steps,
      tags: cmd.tags,
      prep_time_minutes: cmd.prep_time_minutes ?? null,
      cook_time_minutes: cmd.cook_time_minutes ?? null,
      total_time_minutes: totalTime,
      calories_per_serving: cmd.calories_per_serving ?? null,
      servings: cmd.servings,
    })
    .select('*')
    .single()

  if (error) {
    // Improve error message for foreign key violations
    const mappedError = mapDbError(error)
    if ((mappedError as any).code === 'DB_FOREIGN_KEY') {
      const err = new Error(`User with ID ${userId} does not exist in public.users table. Please ensure the user exists in the users table.`)
      ;(err as any).code = 'DB_FOREIGN_KEY'
      throw err
    }
    throw mappedError
  }

  return mapRecipeRowToDTO(data)
}

function mapRecipeRowToDTO(row: RecipeRow): RecipeDTO {
  const { ingredients, steps, tags, ...rest } = row as unknown as {
    ingredients: unknown
    steps: unknown
    tags: unknown
  } & Omit<RecipeRow, 'ingredients' | 'steps' | 'tags'>

  return {
    ...(rest as Omit<RecipeRow, 'ingredients' | 'steps' | 'tags'>),
    ingredients: (ingredients as RecipeIngredientDTO[]) ?? [],
    steps: (steps as string[]) ?? [],
    tags: (tags as RecipeTags) ?? {},
    rating: null,
    is_favorite: false,
  }
}

type PostgrestErrorShape = {
  code?: string
  message?: string
  details?: unknown
  hint?: string
  status?: number
}

function mapDbError(error: unknown): Error {
  const e = error as PostgrestErrorShape
  const message = e?.message || 'Database error'
  const code = e?.code
  if (!code) return new Error(message)

  switch (code) {
    case '23505': {
      const err = new Error('Conflict')
      ;(err as any).code = 'DB_CONFLICT'
      return err
    }
    case '23503': {
      const err = new Error('Foreign key violation')
      ;(err as any).code = 'DB_FOREIGN_KEY'
      return err
    }
    default: {
      const err = new Error(message)
      ;(err as any).code = code
      return err
    }
  }
}

/**
 * Fetches ratings and favorites for a list of recipe IDs for a specific user.
 * Returns maps keyed by recipe_id for efficient lookup.
 */
async function fetchRatingsAndFavorites(
  supabase: SupabaseClient,
  userId: string,
  recipeIds: string[],
): Promise<{
  ratings: Map<string, number>
  favorites: Set<string>
}> {
  if (recipeIds.length === 0) {
    return { ratings: new Map(), favorites: new Set() }
  }

  // Fetch ratings
  const { data: ratingsData, error: ratingsError } = await supabase
    .from('recipe_ratings')
    .select('recipe_id, rating')
    .eq('user_id', userId)
    .in('recipe_id', recipeIds)

  if (ratingsError) throw mapDbError(ratingsError)

  const ratings = new Map<string, number>()
  for (const r of ratingsData ?? []) {
    ratings.set(r.recipe_id, r.rating)
  }

  // Fetch favorites
  const { data: favoritesData, error: favoritesError } = await supabase
    .from('recipe_favorites')
    .select('recipe_id')
    .eq('user_id', userId)
    .in('recipe_id', recipeIds)

  if (favoritesError) throw mapDbError(favoritesError)

  const favorites = new Set<string>()
  for (const f of favoritesData ?? []) {
    favorites.add(f.recipe_id)
  }

  return { ratings, favorites }
}

export async function listRecipes(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  pageSize: number,
  sort: RecipeSort,
  filters?: RecipesListFilters,
): Promise<{ items: RecipeDTO[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('recipes')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (filters?.q) {
    query = query.ilike('title', `%${filters.q}%`)
  }

  if (filters?.max_calories != null) {
    query = query.lte('calories_per_serving', filters.max_calories)
  }

  if (filters?.max_total_time != null) {
    query = query.lte('total_time_minutes', filters.max_total_time)
  }

  const tagFilters: Record<string, string> = { ...(filters?.tags ?? {}) }
  if (filters?.diet && !tagFilters.diet) {
    tagFilters.diet = filters.diet
  }

  Object.entries(tagFilters).forEach(([key, value]) => {
    if (value) {
      query = query.eq(`tags->>${key}`, value)
    }
  })

  if (filters?.favorite === true) {
    const { data: favoritesData, error: favoritesError } = await supabase
      .from('recipe_favorites')
      .select('recipe_id')
      .eq('user_id', userId)

    if (favoritesError) throw mapDbError(favoritesError)

    const favoriteIds = (favoritesData ?? []).map((row) => row.recipe_id)
    if (favoriteIds.length === 0) {
      return { items: [], total: 0 }
    }
    query = query.in('id', favoriteIds)
  }

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false }).range(from, to)
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error, count } = await query

  if (error) throw mapDbError(error)

  const recipeRows = (data ?? []) as unknown as RecipeRow[]
  const recipeIds = recipeRows.map((r) => r.id)

  // Fetch ratings and favorites for all recipes
  const { ratings, favorites } = await fetchRatingsAndFavorites(supabase, userId, recipeIds)

  // Map recipes to DTOs with ratings and favorites
  const items = recipeRows.map((r) => {
    const dto = mapRecipeRowToDTO(r)
    dto.rating = ratings.get(r.id) ?? null
    dto.is_favorite = favorites.has(r.id)
    return dto
  })

  if (sort === 'favorites') {
    items.sort((a, b) => {
      const favoriteDiff = Number(b.is_favorite) - Number(a.is_favorite)
      if (favoriteDiff !== 0) return favoriteDiff
      return Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '')
    })
  }

  if (sort === 'top_rated') {
    items.sort((a, b) => {
      const ratingDiff = (b.rating ?? -1) - (a.rating ?? -1)
      if (ratingDiff !== 0) return ratingDiff
      return Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? '')
    })
  }

  if (sort !== 'newest') {
    return { items: items.slice(from, to + 1), total: count ?? items.length }
  }

  return { items, total: count ?? items.length }
} 

export async function getRecipeById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<RecipeDTO | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw mapDbError(error)
  if (!data) return null

  const recipeRow = data as unknown as RecipeRow
  const dto = mapRecipeRowToDTO(recipeRow)

  // Fetch rating and favorite for this recipe
  const { ratings, favorites } = await fetchRatingsAndFavorites(supabase, userId, [id])
  dto.rating = ratings.get(id) ?? null
  dto.is_favorite = favorites.has(id)

  return dto
}

export async function patchRecipe(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  cmd: PatchRecipeCommand,
): Promise<RecipeDTO | null> {
  const { data: existing, error: existingError } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingError) throw mapDbError(existingError)
  if (!existing) return null

  const current = existing as unknown as RecipeRow
  const update: Partial<RecipeRow> = {}

  if (cmd.title !== undefined) update.title = cmd.title ?? current.title
  if (cmd.ingredients !== undefined) update.ingredients = cmd.ingredients ?? current.ingredients
  if (cmd.steps !== undefined) update.steps = cmd.steps ?? current.steps
  if (cmd.tags !== undefined) update.tags = cmd.tags ?? {}
  if (cmd.prep_time_minutes !== undefined) update.prep_time_minutes = cmd.prep_time_minutes
  if (cmd.cook_time_minutes !== undefined) update.cook_time_minutes = cmd.cook_time_minutes
  if (cmd.total_time_minutes !== undefined) update.total_time_minutes = cmd.total_time_minutes
  if (cmd.calories_per_serving !== undefined) update.calories_per_serving = cmd.calories_per_serving
  if (cmd.servings !== undefined) update.servings = cmd.servings ?? current.servings

  const nextPrep =
    update.prep_time_minutes !== undefined ? update.prep_time_minutes : current.prep_time_minutes
  const nextCook =
    update.cook_time_minutes !== undefined ? update.cook_time_minutes : current.cook_time_minutes

  if (
    cmd.total_time_minutes === undefined &&
    (cmd.prep_time_minutes !== undefined || cmd.cook_time_minutes !== undefined)
  ) {
    update.total_time_minutes = nextPrep != null && nextCook != null ? nextPrep + nextCook : null
  }

  if (Object.keys(update).length === 0) {
    return getRecipeById(supabase, userId, id)
  }

  update.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('recipes')
    .update(update)
    .eq('user_id', userId)
    .eq('id', id)

  if (updateError) throw mapDbError(updateError)

  return getRecipeById(supabase, userId, id)
}


