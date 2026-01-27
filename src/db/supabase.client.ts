import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';

import type { Database } from '../db/database.types.ts';

export type SupabaseClient = BaseSupabaseClient<Database>;

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

function shouldUseSecureCookies(headers: Headers): boolean {
  const forwardedProto =
    headers.get('x-forwarded-proto') ?? headers.get('x-forwarded-protocol');
  if (forwardedProto) {
    const first = forwardedProto.split(',')[0]?.trim();
    if (first === 'https') return true;
    if (first === 'http') return false;
  }

  const forwardedSsl = headers.get('x-forwarded-ssl');
  if (forwardedSsl) return forwardedSsl.toLowerCase() === 'on';

  const host = (headers.get('host') ?? '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')) {
    return false;
  }

  // Fallback: in real production deployments we expect HTTPS.
  return import.meta.env.PROD;
}

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader) return [];
  return cookieHeader.split(';').map((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    return { name, value: rest.join('=') };
  });
}

export const createSupabaseServerInstance = (context: {
  headers: Headers;
  cookies: AstroCookies;
}): SupabaseClient => {
  const cookieOptions: CookieOptionsWithName = {
    path: '/',
    secure: shouldUseSecureCookies(context.headers),
    httpOnly: true,
    sameSite: 'lax',
  };

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  });
};
