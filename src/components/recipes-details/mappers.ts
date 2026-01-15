import type { RecipeDTO } from '@/types'
import type { RecipeDetailsVM, RecipeTagsVM } from './types'

function mapTags(tags: RecipeDTO['tags']): RecipeTagsVM {
  const entries = Object.entries(tags ?? {})
  const dietValue = tags?.diet ?? null

  const other = entries
    .filter(([key, value]) => key !== 'diet' && value)
    .map(([key, value]) => ({ key, value }))

  return { diet: dietValue, other }
}

export function mapRecipeDtoToDetailsVM(dto: RecipeDTO): RecipeDetailsVM {
  return {
    id: dto.id,
    title: dto.title,
    tags: mapTags(dto.tags ?? {}),
    ingredients: dto.ingredients ?? [],
    steps: dto.steps ?? [],
    meta: {
      prepTimeMinutes: dto.prep_time_minutes ?? null,
      cookTimeMinutes: dto.cook_time_minutes ?? null,
      totalTimeMinutes: dto.total_time_minutes ?? null,
      caloriesPerServing: dto.calories_per_serving ?? null,
      baseServings: dto.servings,
    },
    rating: dto.rating ?? null,
    isFavorite: dto.is_favorite ?? false,
  }
}

