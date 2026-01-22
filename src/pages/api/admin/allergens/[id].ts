import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth';
import {
  getAllergenById,
  updateAllergen,
  deleteAllergen,
} from '@/lib/services/allergens.service';
import {
  patchAllergenCommandSchema,
  uuidSchema,
} from '@/lib/validation/allergens';
import type { ApiError, ApiSuccess } from '@/types';

export const prerender = false;

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * PATCH /api/admin/allergens/{id}
 * Updates an allergen dictionary entry with automatic audit logging.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const auth = await requireAdmin(request, locals.supabase);
  if (auth instanceof Response) return auth;

  const id = params.id;
  if (!id) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Missing id' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  // Validate UUID format
  const uuidValidation = uuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid UUID format' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  const parsed = patchAllergenCommandSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  // Check if at least one field is provided
  if (Object.keys(parsed.data).length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BAD_REQUEST',
          message: 'At least one field must be provided for update',
        },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    const dto = await updateAllergen(locals.supabase, auth.userId, id, parsed.data);

    const response: ApiSuccess<typeof dto> = {
      data: dto,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (e: unknown) {
    console.error('Update allergen failed', {
      error: e,
      userId: auth.userId,
      allergenId: id,
      operation: 'PATCH',
    });

    const error = e as { code?: string };
    if (error.code === 'ALLERGEN_NOT_FOUND') {
      return new Response(
        JSON.stringify({
          error: { code: 'ALLERGEN_NOT_FOUND', message: 'Allergen not found' },
        } as ApiError),
        { status: 404, headers: jsonHeaders },
      );
    }

    if (error.code === 'DUPLICATE_ALLERGEN_NAME') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'DUPLICATE_ALLERGEN_NAME',
            message: 'Allergen with this name already exists',
          },
        } as ApiError),
        { status: 409, headers: jsonHeaders },
      );
    }

    if (error.code === 'DB_CONFLICT') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'DUPLICATE_ALLERGEN_NAME',
            message: 'Allergen with this name already exists',
          },
        } as ApiError),
        { status: 409, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      } as ApiError),
      { status: 500, headers: jsonHeaders },
    );
  }
};

/**
 * DELETE /api/admin/allergens/{id}
 * Soft deletes an allergen dictionary entry (sets is_active = false) with automatic audit logging.
 */
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const auth = await requireAdmin(request, locals.supabase);
  if (auth instanceof Response) return auth;

  const id = params.id;
  if (!id) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Missing id' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  // Validate UUID format
  const uuidValidation = uuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid UUID format' },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    await deleteAllergen(locals.supabase, auth.userId, id);

    return new Response(null, {
      status: 204,
    });
  } catch (e: unknown) {
    console.error('Delete allergen failed', {
      error: e,
      userId: auth.userId,
      allergenId: id,
      operation: 'DELETE',
    });

    const error = e as { code?: string };
    if (error.code === 'ALLERGEN_NOT_FOUND') {
      return new Response(
        JSON.stringify({
          error: { code: 'ALLERGEN_NOT_FOUND', message: 'Allergen not found' },
        } as ApiError),
        { status: 404, headers: jsonHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      } as ApiError),
      { status: 500, headers: jsonHeaders },
    );
  }
};

