import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../db/database.types.ts';

export type SupabaseClient = BaseSupabaseClient<Database>;

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const DEFAULT_USER_ID: string =
  (import.meta.env.SUPABASE_DEFAULT_USER_ID as string | undefined) ?? '00000000-0000-0000-0000-000000000000';

/**
 * Creates a Supabase client with service-role key for admin operations.
 * This client bypasses Row Level Security (RLS) and should only be used server-side
 * in admin endpoints.
 *
 * @returns Service-role Supabase client
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not set
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}