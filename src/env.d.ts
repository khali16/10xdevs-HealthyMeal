/// <reference types="astro/client" />

import type { SupabaseClient } from './db/supabase.client.ts';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_BASE_URL?: string;
  readonly OPENROUTER_APP_URL?: string;
  readonly OPENROUTER_APP_NAME?: string;
  readonly SUPABASE_DEFAULT_USER_ID?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
