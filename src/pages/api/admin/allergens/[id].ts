import type { APIRoute } from 'astro';
import { DEFAULT_USER_ID } from '@/db/supabase.client';
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

/**
 * PATCH /api/admin/allergens/{id}
 * Updates an allergen dictionary entry with automatic audit logging.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const userId = DEFAULT_USER_ID;
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' },
      } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const id = params.id;
  if (!id) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Missing id' },
      } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate UUID format
  const uuidValidation = uuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid UUID format' },
      } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
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
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const parsed = patchAllergenCommandSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Check if at least one field is provided
  if (Object.keys(parsed.data).length === 0) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field must be provided for update',
        },
      } as ApiError),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const dto = await updateAllergen(locals.supabase, userId, id, parsed.data);

    const response: ApiSuccess<typeof dto> = {
      data: dto,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('Update allergen failed', { error: e, userId, allergenId: id, operation: 'PATCH' });

    const error = e as { code?: string };
    if (error.code === 'ALLERGEN_NOT_FOUND') {
      return new Response(
        JSON.stringify({
          error: { code: 'ALLERGEN_NOT_FOUND', message: 'Allergen not found' },
        } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
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
        { status: 409, headers: { 'Content-Type': 'application/json' } },
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
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

/**
 * DELETE /api/admin/allergens/{id}
 * Soft deletes an allergen dictionary entry (sets is_active = false) with automatic audit logging.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const userId = DEFAULT_USER_ID;
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL', message: 'Missing DEFAULT_USER_ID' },
      } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const id = params.id;
  if (!id) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Missing id' },
      } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Validate UUID format
  const uuidValidation = uuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return new Response(
      JSON.stringify({
        error: { code: 'BAD_REQUEST', message: 'Invalid UUID format' },
      } as ApiError),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    await deleteAllergen(locals.supabase, userId, id);

    return new Response(null, {
      status: 204,
    });
  } catch (e: unknown) {
    console.error('Delete allergen failed', { error: e, userId, allergenId: id, operation: 'DELETE' });

    const error = e as { code?: string };
    if (error.code === 'ALLERGEN_NOT_FOUND') {
      return new Response(
        JSON.stringify({
          error: { code: 'ALLERGEN_NOT_FOUND', message: 'Allergen not found' },
        } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      } as ApiError),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

