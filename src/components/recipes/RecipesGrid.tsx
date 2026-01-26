import * as React from 'react'
import type { RecipeCardVM } from './types'
import { RecipeCard } from './RecipeCard'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  items: RecipeCardVM[]
  isLoading?: boolean
  onOpenRecipe?: (id: string) => void
  onToggleFavorite?: (id: string, next: boolean) => void
}

export const RecipesGrid: React.FC<Props> = ({
  items,
  isLoading,
  onOpenRecipe,
  onToggleFavorite,
}) => {
  return (
    <section aria-label="Lista przepisów" className="space-y-4" data-testid="recipes-grid">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="h-full">
            <RecipeCard item={item} onOpen={onOpenRecipe} onToggleFavorite={onToggleFavorite} />
          </li>
        ))}
        {isLoading &&
          Array.from({ length: Math.max(6 - items.length, 3) }).map((_, idx) => (
            <li key={`skeleton-${idx}`} className="h-full">
              <div className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4" data-testid="recipe-card-skeleton">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </li>
          ))}
      </ul>
    </section>
  )
}

