import type { APIRoute } from 'astro';
import { requireAdmin } from '@/lib/auth';
import {
  listAllergens,
  createAllergen,
  type ListAllergensFilters,
  type PaginationParams,
  type SortParams,
} from '@/lib/services/allergens.service';
import {
  createAllergenCommandSchema,
  listAllergensQuerySchema,
} from '@/lib/validation/allergens';
import type { ApiError, ApiListSuccess, ApiSuccess } from '@/types';

export const prerender = false;

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * GET /api/admin/allergens
 * Lists allergen dictionary entries with filtering, pagination, and sorting.
 */
export const GET: APIRoute = async ({ request, url, locals }) => {
  const auth = await requireAdmin(request, locals.supabase);
  if (auth instanceof Response) return auth;

  // Parse and validate query parameters
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const parsed = listAllergensQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 422, headers: jsonHeaders },
    );
  }

  try {
    const filters: ListAllergensFilters = {};
    if (parsed.data.is_active !== undefined) {
      filters.is_active = parsed.data.is_active;
    }
    if (parsed.data.q) {
      filters.q = parsed.data.q;
    }

    const pagination: PaginationParams = {
      page: parsed.data.page,
      pageSize: parsed.data.page_size,
    };

    const sort: SortParams = {
      sort: parsed.data.sort,
      order: parsed.data.order,
    };

    const { items, total } = await listAllergens(
      locals.supabase,
      filters,
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
        ...jsonHeaders,
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (e: unknown) {
    console.error('List allergens failed', { error: e, operation: 'GET' });

    const error = e as { code?: string };
    if (error.code === 'DB_CONFLICT') {
      return new Response(
        JSON.stringify({
          error: { code: 'CONFLICT', message: 'Database conflict' },
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
 * POST /api/admin/allergens
 * Creates a new allergen dictionary entry with automatic audit logging.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await requireAdmin(request, locals.supabase);
  if (auth instanceof Response) return auth;

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

  const parsed = createAllergenCommandSchema.safeParse(payload);
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

  try {
    const dto = await createAllergen(locals.supabase, auth.userId, parsed.data);

    const response: ApiSuccess<typeof dto> = {
      data: dto,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        ...jsonHeaders,
        Location: `/api/admin/allergens/${dto.id}`,
      },
    });
  } catch (e: unknown) {
    console.error('Create allergen failed', { error: e, userId: auth.userId, operation: 'POST' });

    const error = e as { code?: string };
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

