import { z } from 'zod'

export const recipeIngredientSchema = z.object({
  text: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(50).optional(),
  amount: z.number().finite().nonnegative().max(1_000_000).optional(),
  no_scale: z.boolean().optional(),
})

export const recipeTagsSchema = z.record(z.string().trim().max(100))

export const createRecipeCommandSchema = z.object({
  title: z.string().trim().min(1).max(255),
  ingredients: z.array(recipeIngredientSchema).min(1).max(200),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(200),
  tags: recipeTagsSchema.default({}),
  prep_time_minutes: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(1_000))
    .optional(),
  cook_time_minutes: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(1_000))
    .optional(),
  total_time_minutes: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(2_000))
    .optional(),
  calories_per_serving: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(100_000))
    .optional(),
  servings: z.number().int().positive().max(10_000),
})

export const putRecipeRatingCommandSchema = z.object({
  rating: z.number().int().min(1).max(5),
})

export const putRecipeFavoriteCommandSchema = z.object({
  favorite: z.boolean(),
})

/**
 * Schema for PATCH /api/recipes/{id}
 * All fields are optional. Arrays are full-replace, objects (tags) merge, null clears nullable fields.
 */
export const patchRecipeCommandSchema = z.object({
  title: z.string().trim().min(1).max(255).nullable().optional(),
  ingredients: z.array(recipeIngredientSchema).min(1).max(200).nullable().optional(),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(200).nullable().optional(),
  tags: recipeTagsSchema.nullable().optional(),
  prep_time_minutes: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(1_000))
    .nullable()
    .optional(),
  cook_time_minutes: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(1_000))
    .nullable()
    .optional(),
  total_time_minutes: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(2_000))
    .nullable()
    .optional(),
  calories_per_serving: z
    .preprocess((v) => (v === null ? undefined : v), z.number().int().nonnegative().max(100_000))
    .nullable()
    .optional(),
  servings: z.number().int().positive().max(10_000).nullable().optional(),
})


