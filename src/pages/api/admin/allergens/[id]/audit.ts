import type { APIRoute } from 'astro';
import {
  getAllergenById,
  getAllergenAudit,
  type PaginationParams,
  type AuditSortParams,
} from '@/lib/services/allergens.service';
import {
  listAllergenAuditQuerySchema,
  uuidSchema,
} from '@/lib/validation/allergens';
import type { ApiError, ApiListSuccess } from '@/types';

export const prerender = false;

/**
 * GET /api/admin/allergens/{id}/audit
 * Lists audit entries for a specific allergen dictionary entry.
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  const userId = locals.user?.id ?? null;

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

  // Parse and validate query parameters
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const parsed = listAllergenAuditQuerySchema.safeParse(queryParams);
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

  try {
    // Check if allergen exists
    const allergen = await getAllergenById(locals.supabase, id);
    if (!allergen) {
      return new Response(
        JSON.stringify({
          error: { code: 'ALLERGEN_NOT_FOUND', message: 'Allergen not found' },
        } as ApiError),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const pagination: PaginationParams = {
      page: parsed.data.page,
      pageSize: parsed.data.page_size,
    };

    const sort: AuditSortParams = {
      sort: parsed.data.sort,
      order: parsed.data.order,
    };

    const { items, total } = await getAllergenAudit(
      locals.supabase,
      id,
      pagination,
      sort,
    );

    const hasNext = pagination.page * pagination.pageSize < total;
    const meta = {
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      has_next: hasNext,
    };

    const response: ApiListSuccess<typeof items[0]> = {
      data: items,
      meta,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (e: unknown) {
    console.error('Get allergen audit failed', { error: e, userId, allergenId: id, operation: 'GET' });

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

