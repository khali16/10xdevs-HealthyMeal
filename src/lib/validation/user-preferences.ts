import { z } from 'zod'

const stringArraySchema = z.array(z.string().trim().min(1).max(100)).max(200)

/**
 * Schema for POST/PUT /api/user/preferences
 * Arrays are required but may be empty. Null is allowed for optional fields.
 */
export const userPreferencesCommandSchema = z.object({
  allergens: stringArraySchema,
  exclusions: stringArraySchema,
  diet: z.string().trim().min(1).max(50).nullable(),
  target_calories: z.number().int().positive().nullable(),
  target_servings: z.number().int().positive().nullable(),
})
