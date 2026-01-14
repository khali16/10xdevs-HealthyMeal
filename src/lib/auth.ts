import type { APIContext } from 'astro';
import { supabaseClient } from '@/db/supabase.client';
import type { ApiError } from '@/types';

/**
 * Verifies JWT token from Authorization header and checks for admin role.
 * 
 * @param context - Astro API context
 * @returns User ID if authenticated and authorized as admin
 * @throws Response with 401 if unauthorized or 403 if not admin
 */
export async function requireAdmin(context: APIContext): Promise<string> {
  const authHeader = context.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ) as unknown as never;
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);

  if (error || !user) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ) as unknown as never;
  }

  // Check for admin role in user metadata or app_metadata
  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'admin') {
    return new Response(
      JSON.stringify({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      } as ApiError),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ) as unknown as never;
  }

  return user.id;
}

