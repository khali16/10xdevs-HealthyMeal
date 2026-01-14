import { z } from 'zod';

/**
 * Schema for creating a new allergen dictionary entry.
 */
export const createAllergenCommandSchema = z.object({
  allergen_name: z.string().trim().min(1).max(100),
  synonyms: z.array(z.string().trim().min(1).max(200)).min(1),
  is_active: z.boolean(),
});

/**
 * Schema for patching/updating an allergen dictionary entry.
 * All fields are optional, but if provided, they must meet the same constraints as create.
 */
export const patchAllergenCommandSchema = z.object({
  allergen_name: z.string().trim().min(1).max(100).optional(),
  synonyms: z.array(z.string().trim().min(1).max(200)).min(1).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Schema for query parameters in GET /api/admin/allergens
 */
export const listAllergensQuerySchema = z.object({
  is_active: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive())
    .default('1'),
  page_size: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive().max(100))
    .default('20'),
  sort: z.enum(['name', 'created_at', 'updated_at']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Schema for query parameters in GET /api/admin/allergens/{id}/audit
 */
export const listAllergenAuditQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive())
    .default('1'),
  page_size: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive().max(100))
    .default('20'),
  sort: z.enum(['changed_at', 'action']).default('changed_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schema for UUID path parameter
 */
export const uuidSchema = z.string().uuid();

