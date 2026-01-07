import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../db/database.types.ts';

export type SupabaseClient = BaseSupabaseClient<Database>;

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const DEFAULT_USER_ID: string =
  (import.meta.env.SUPABASE_DEFAULT_USER_ID as string | undefined) ?? '00000000-0000-0000-0000-000000000000';
