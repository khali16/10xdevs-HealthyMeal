import { RecipeAdjustButton } from './RecipeAdjustButton'
import { RecipeFavoriteToggle } from './RecipeFavoriteToggle'
import { RecipeRatingControl } from './RecipeRatingControl'

type RecipeInlineActionsProps = {
  rating: number | null
  isFavorite: boolean
  ratingPending: boolean
  favoritePending: boolean
  adjustOpen: boolean
  onSetRating: (rating: number) => void
  onClearRating: () => void
  onToggleFavorite: (next: boolean) => void
  onAdjustOpenChange: (open: boolean) => void
}

export function RecipeInlineActions({
  rating,
  isFavorite,
  ratingPending,
  favoritePending,
  adjustOpen,
  onSetRating,
  onClearRating,
  onToggleFavorite,
  onAdjustOpenChange,
}: RecipeInlineActionsProps) {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <RecipeRatingControl
        value={rating}
        isPending={ratingPending}
        onChange={onSetRating}
        onClear={onClearRating}
      />
      <RecipeFavoriteToggle
        checked={isFavorite}
        isPending={favoritePending}
        onChange={onToggleFavorite}
      />
      <RecipeAdjustButton open={adjustOpen} onOpenChange={onAdjustOpenChange} />
    </div>
  )
}

