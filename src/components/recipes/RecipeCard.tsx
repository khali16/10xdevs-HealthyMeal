import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import type { RecipeCardVM } from './types'

type Props = {
  item: RecipeCardVM
  onOpen?: (id: string) => void
  onToggleFavorite?: (id: string, next: boolean) => void
}

export const RecipeCard: React.FC<Props> = ({ item, onOpen, onToggleFavorite }) => {
  const handleOpen = () => onOpen?.(item.id)
  const handleToggleFavorite = () => onToggleFavorite?.(item.id, !item.isFavorite)

  return (
    <Card className="group h-full transition hover:shadow-md" data-testid={`recipe-card-${item.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>
          <button
            onClick={handleOpen}
            className="text-left text-base font-semibold leading-tight text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`recipe-card-title-${item.id}`}
          >
            {item.title}
          </button>
        </CardTitle>
        <Button
          type="button"
          variant={item.isFavorite ? 'secondary' : 'ghost'}
          size="icon"
          onClick={handleToggleFavorite}
          aria-pressed={item.isFavorite}
          aria-label={item.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          data-testid={`recipe-card-favorite-${item.id}`}
        >
          <Star className={item.isFavorite ? 'fill-yellow-400 text-yellow-500' : 'text-muted-foreground'} />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {item.dietLabel && <Badge variant="outline">{item.dietLabel}</Badge>}
          {item.totalTimeMinutes != null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">
              ⏱ {item.totalTimeMinutes} min
            </span>
          )}
          {item.caloriesPerServing != null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium">
              🔥 {item.caloriesPerServing} kcal/porcję
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">
            {item.rating != null ? item.rating.toFixed(1) : 'Brak oceny'}
          </span>
        </div>
        {item.updatedAt && (
          <p className="text-xs text-muted-foreground">
            Ostatnia aktualizacja: {new Date(item.updatedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

