import type { SupabaseClient } from '@/db/supabase.client'
import type {
  CreateUserPreferencesCommand,
  UpsertUserPreferencesCommand,
  UserPreferencesDTO,
  UserPreferencesRow,
} from '@/types'

/**
 * Fetches user preferences by user ID.
 * Returns null when no preferences exist.
 */
export async function getByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPreferencesDTO | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw mapDbError(error)
  if (!data) return null

  return mapUserPreferencesRowToDTO(data as UserPreferencesRow)
}

/**
 * Creates user preferences for a user.
 * Throws on conflicts (preferences already exist).
 */
export async function create(
  supabase: SupabaseClient,
  userId: string,
  cmd: CreateUserPreferencesCommand,
): Promise<UserPreferencesDTO> {
  const { data, error } = await supabase
    .from('user_preferences')
    .insert({
      user_id: userId,
      allergens: cmd.allergens,
      exclusions: cmd.exclusions,
      diet: cmd.diet,
      target_calories: cmd.target_calories,
      target_servings: cmd.target_servings,
    })
    .select('*')
    .single()

  if (error) throw mapDbError(error)

  return mapUserPreferencesRowToDTO(data as UserPreferencesRow)
}

/**
 * Upserts user preferences for a user.
 */
export async function upsert(
  supabase: SupabaseClient,
  userId: string,
  cmd: UpsertUserPreferencesCommand,
): Promise<UserPreferencesDTO> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        allergens: cmd.allergens,
        exclusions: cmd.exclusions,
        diet: cmd.diet,
        target_calories: cmd.target_calories,
        target_servings: cmd.target_servings,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error) throw mapDbError(error)

  return mapUserPreferencesRowToDTO(data as UserPreferencesRow)
}

function mapUserPreferencesRowToDTO(row: UserPreferencesRow): UserPreferencesDTO {
  const { allergens, exclusions, ...rest } = row as unknown as {
    allergens: unknown
    exclusions: unknown
  } & Omit<UserPreferencesRow, 'allergens' | 'exclusions'>

  return {
    ...(rest as Omit<UserPreferencesRow, 'allergens' | 'exclusions'>),
    allergens: normalizeStringArray(allergens),
    exclusions: normalizeStringArray(exclusions),
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
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
