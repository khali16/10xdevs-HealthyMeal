import { z } from 'zod'

import type { StartAIAdjustmentCommand } from '@/types'

export const startAIAdjustmentCommandSchema = z
  .object({
    parameters: z
      .object({
        avoid_allergens: z.boolean().optional(),
        use_exclusions: z.boolean().optional(),
        target_calories: z.number().int().min(0).optional(),
        presets: z.array(z.string().trim().min(1)).max(20).optional(),
      })
      .strict(),
    model: z.string().trim().min(1).max(100),
  })
  .strict() satisfies z.ZodType<StartAIAdjustmentCommand>
