import type { SupabaseClient } from '@/db/supabase.client';
import type { ApiError } from '@/types';

/**
 * Verifies JWT token from Authorization header and checks for admin role.
 *
 * @param request - Incoming request
 * @param supabase - Supabase client (from context.locals)
 * @returns User ID if authenticated and authorized as admin
 * @throws Response with 401 if unauthorized
 */
export async function requireAdmin(
  request: Request,
  supabase: SupabaseClient,
): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Check for admin role in user metadata or app_metadata
  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'admin') {
    return new Response(
      JSON.stringify({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin access required',
        },
      } as ApiError),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return { userId: user.id };
}

