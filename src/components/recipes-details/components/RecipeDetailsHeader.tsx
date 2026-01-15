import { Badge } from '@/components/ui/badge'
import type { RecipeMetaVM, RecipeTagsVM } from '../types'
import { RecipeActionsMenu } from './RecipeActionsMenu'

type RecipeDetailsHeaderProps = {
  title: string
  tags: RecipeTagsVM
  meta: RecipeMetaVM
  rating: number | null
  onEdit: () => void
  onDelete: () => Promise<void> | void
  isDeleting?: boolean
}

export function RecipeDetailsHeader({
  title,
  tags,
  meta,
  rating,
  onEdit,
  onDelete,
  isDeleting = false,
}: RecipeDetailsHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-wrap gap-2">
          {tags.diet ? <Badge variant="secondary">Dieta: {tags.diet}</Badge> : null}
          {rating != null ? (
            <Badge variant="outline">Ocena: {rating}/5</Badge>
          ) : null}
          {tags.other.map((tag) => (
            <Badge key={tag.key} variant="outline">
              {tag.value}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Porcje: {meta.baseServings}</span>
          {meta.totalTimeMinutes ? (
            <span>Łącznie: {meta.totalTimeMinutes} min</span>
          ) : null}
          {meta.caloriesPerServing ? (
            <span>{meta.caloriesPerServing} kcal / porcja</span>
          ) : null}
        </div>
      </div>
      <RecipeActionsMenu
        onEdit={onEdit}
        onConfirmDelete={onDelete}
        isDeleting={isDeleting}
      />
    </header>
  )
}

