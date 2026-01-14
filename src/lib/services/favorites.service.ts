import type { SupabaseClient } from '@/db/supabase.client'
import type { RecipeFavoriteDTO } from '@/types'

/**
 * Sets or removes a favorite flag for a recipe by a user.
 * If favorite is true, creates or updates the favorite record.
 * If favorite is false, removes the favorite record if it exists.
 *
 * @param supabase - Supabase client with user context
 * @param userId - ID of the user favoriting/unfavoriting the recipe
 * @param recipeId - ID of the recipe being favorited/unfavorited
 * @param favorite - Boolean flag indicating if recipe should be favorited
 * @returns RecipeFavoriteDTO with the favorite status
 * @throws Error if database operation fails
 */
export async function setFavorite(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  favorite: boolean,
): Promise<RecipeFavoriteDTO> {
  if (favorite) {
    // Upsert favorite record
    const { data, error } = await supabase
      .from('recipe_favorites')
      .upsert(
        {
          user_id: userId,
          recipe_id: recipeId,
        },
        {
          onConflict: 'user_id,recipe_id',
        },
      )
      .select('recipe_id')
      .single()

    if (error) throw mapDbError(error)

    return {
      recipe_id: data.recipe_id,
      favorite: true,
    }
  } else {
    // Delete favorite record if it exists
    const { error } = await supabase
      .from('recipe_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)

    if (error) throw mapDbError(error)

    return {
      recipe_id: recipeId,
      favorite: false,
    }
  }
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

