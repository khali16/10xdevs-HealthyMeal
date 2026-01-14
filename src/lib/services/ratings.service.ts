import type { SupabaseClient } from '@/db/supabase.client'
import type { RecipeRatingDTO } from '@/types'

/**
 * Upserts a rating for a recipe by a user.
 * If a rating already exists, it updates it; otherwise creates a new one.
 *
 * @param supabase - Supabase client with user context
 * @param userId - ID of the user rating the recipe
 * @param recipeId - ID of the recipe being rated
 * @param rating - Rating value (1-5)
 * @returns RecipeRatingDTO with the rating data
 * @throws Error if database operation fails
 */
export async function upsertRating(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  rating: number,
): Promise<RecipeRatingDTO> {
  const { data, error } = await supabase
    .from('recipe_ratings')
    .upsert(
      {
        user_id: userId,
        recipe_id: recipeId,
        rating,
      },
      {
        onConflict: 'user_id,recipe_id',
      },
    )
    .select('recipe_id, rating')
    .single()

  if (error) throw mapDbError(error)

  return {
    recipe_id: data.recipe_id,
    rating: data.rating,
  }
}

/**
 * Deletes a rating for a recipe by a user.
 *
 * @param supabase - Supabase client with user context
 * @param userId - ID of the user whose rating to delete
 * @param recipeId - ID of the recipe whose rating to delete
 * @returns true if rating was deleted, false if it didn't exist
 * @throws Error if database operation fails
 */
export async function deleteRating(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('recipe_ratings')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId)
    .select('id')
    .maybeSingle()

  if (error) throw mapDbError(error)

  return data !== null
}

type PostgrestErrorShape = {
  code?: string
  message?: string
  details?: unknown
  hint?: string
  status?: number
}

/**
 * Maps database errors to JavaScript Error objects with error codes.
 * Handles common PostgreSQL error codes like foreign key violations and unique constraint violations.
 *
 * @param error - Database error from Supabase
 * @returns Error object with optional code property
 */
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

