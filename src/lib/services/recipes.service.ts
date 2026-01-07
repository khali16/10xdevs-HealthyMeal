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

  if (error) throw mapDbError(error)

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
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw mapDbError(error)
  const items = (data ?? []).map((r) => mapRecipeRowToDTO(r as unknown as RecipeRow))
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
    .maybeSingle()

  if (error) throw mapDbError(error)
  if (!data) return null
  return mapRecipeRowToDTO(data as unknown as RecipeRow)
}


