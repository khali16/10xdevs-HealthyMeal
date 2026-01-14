import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RecipeSort } from './types'

type Props = {
  sort: RecipeSort
  onSortChange: (next: RecipeSort) => void
  onCreateNew?: () => void
}

export const RecipesListHeader: React.FC<Props> = ({ sort, onSortChange, onCreateNew }) => {
  const handleValueChange = (value: string) => onSortChange(value as RecipeSort)

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Przepisy</p>
        <h1 className="text-3xl font-semibold tracking-tight">Twoje przepisy</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sortuj:</span>
          <Select value={sort} onValueChange={handleValueChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Wybierz sortowanie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Najnowsze</SelectItem>
              <SelectItem value="favorites">Ulubione</SelectItem>
              <SelectItem value="top_rated">Najwyżej oceniane</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreateNew} variant="default">
          Nowy przepis
        </Button>
      </div>
    </header>
  )
}

