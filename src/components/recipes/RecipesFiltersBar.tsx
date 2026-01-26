import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { RecipesListFiltersVM } from './types'

type Props = {
  filters: RecipesListFiltersVM
  onChange: (next: Partial<RecipesListFiltersVM>) => void
  onClear?: () => void
}

export const RecipesFiltersBar: React.FC<Props> = ({ filters, onChange, onClear }) => {
  const handleSubmit = (e: React.FormEvent) => e.preventDefault()

  const handleNumberChange = (key: 'max_calories' | 'max_total_time') =>
    (value: string) => {
      const parsed = value === '' ? null : Number.parseInt(value, 10)
      if (Number.isNaN(parsed)) {
        onChange({ [key]: null })
      } else {
        onChange({ [key]: Math.max(0, parsed ?? 0) })
      }
    }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Filtry przepisów"
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
      data-testid="recipes-filters-bar"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="q">Szukaj</Label>
          <Input
            id="q"
            placeholder="np. kurczak, makaron"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            data-testid="filter-search-input"
          />
        </div>

        <div className="space-y-2">
          <Label>Preferencja diety</Label>
          <Select value={filters.diet ?? ''} onValueChange={(value) => onChange({ diet: value || null })}>
            <SelectTrigger className="w-full" data-testid="filter-diet-select">
              <SelectValue placeholder="Dowolna" />
            </SelectTrigger>
            <SelectContent>
              {/* <SelectItem value="">Dowolna</SelectItem> */}
              <SelectItem value="vegan">Wegańska</SelectItem>
              <SelectItem value="vegetarian">Wegetariańska</SelectItem>
              <SelectItem value="keto">Keto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_calories">Maks kcal / porcję</Label>
          <Input
            id="max_calories"
            inputMode="numeric"
            type="number"
            min={0}
            value={filters.max_calories ?? ''}
            onChange={(e) => handleNumberChange('max_calories')(e.target.value)}
            data-testid="filter-max-calories-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_total_time">Maks czas (min)</Label>
          <Input
            id="max_total_time"
            inputMode="numeric"
            type="number"
            min={0}
            value={filters.max_total_time ?? ''}
            onChange={(e) => handleNumberChange('max_total_time')(e.target.value)}
            data-testid="filter-max-time-input"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="favorite"
            checked={filters.favorite}
            onCheckedChange={(checked) => onChange({ favorite: checked })}
            aria-label="Tylko ulubione"
            data-testid="filter-favorite-switch"
          />
          <Label htmlFor="favorite">Tylko ulubione</Label>
        </div>
        {onClear && (
          <Button type="button" variant="ghost" onClick={onClear} data-testid="filter-clear-button">
            Wyczyść filtry
          </Button>
        )}
      </div>
    </form>
  )
}

