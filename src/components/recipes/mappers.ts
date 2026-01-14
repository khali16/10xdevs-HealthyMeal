import type { RecipeDTO } from '@/types'
import type { RecipeCardVM } from './types'

export function mapRecipeDtoToCardVM(dto: RecipeDTO): RecipeCardVM {
  return {
    id: dto.id,
    title: dto.title,
    dietLabel: dto.tags?.diet ?? null,
    totalTimeMinutes:
      dto.total_time_minutes ??
      (dto.prep_time_minutes != null && dto.cook_time_minutes != null
        ? dto.prep_time_minutes + dto.cook_time_minutes
        : null),
    caloriesPerServing: dto.calories_per_serving ?? null,
    rating: dto.rating ?? null,
    isFavorite: dto.is_favorite ?? false,
    updatedAt: dto.updated_at ?? undefined,
  }
}

