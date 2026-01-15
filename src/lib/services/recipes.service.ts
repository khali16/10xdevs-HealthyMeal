import type { SupabaseClient } from '@/db/supabase.client'
import type {
  CreateRecipeCommand,
  RecipeDTO,
  RecipeRow,
  RecipeIngredientDTO,
  RecipeTags,
} from '@/types'

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
): Promise<{ items: RecipeDTO[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

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


