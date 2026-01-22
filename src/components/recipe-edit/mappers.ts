import type { RecipeDTO } from '@/types'
import type {
  RecipeEditDraftVM,
  RecipeIngredientDraftVM,
  RecipeStepDraftVM,
} from './types'

const createLocalId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `local_${Math.random().toString(36).slice(2, 10)}`
}

const toNullableNumber = (value: number | null | undefined) =>
  value == null ? undefined : value

const mapIngredient = (ingredient: RecipeDTO['ingredients'][number]): RecipeIngredientDraftVM => ({
  id: createLocalId(),
  text: ingredient.text,
  amount: ingredient.amount,
  unit: ingredient.unit,
  no_scale: ingredient.no_scale,
})

const mapStep = (step: string): RecipeStepDraftVM => ({
  id: createLocalId(),
  text: step,
})

export const mapRecipeDtoToEditDraftVM = (dto: RecipeDTO): RecipeEditDraftVM => ({
  title: dto.title,
  ingredients: dto.ingredients.map(mapIngredient),
  steps: dto.steps.map(mapStep),
  meta: {
    servings: dto.servings,
    prep_time_minutes: toNullableNumber(dto.prep_time_minutes),
    cook_time_minutes: toNullableNumber(dto.cook_time_minutes),
    total_time_minutes: toNullableNumber(dto.total_time_minutes),
    calories_per_serving: toNullableNumber(dto.calories_per_serving),
    tags: dto.tags ?? {},
    total_time_minutes_mode: 'auto',
  },
})
