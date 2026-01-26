import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DIET_OPTIONS } from '@/components/user-preferences/constants'
import type { RecipeMetaDraftVM } from '../types'

type RecipeMetaEditorProps = {
  meta: RecipeMetaDraftVM
  onChange: (patch: Partial<RecipeMetaDraftVM>) => void
  errors?: { servings?: string; prep?: string; cook?: string; total?: string; calories?: string }
}

const TAG_OPTIONS = {
  diet: DIET_OPTIONS.map((option) => ({ value: option.key, label: option.label })),
  course: [
    { value: 'breakfast', label: 'Śniadanie' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Obiad/kolacja' },
    { value: 'snack', label: 'Przekąska' },
    { value: 'dessert', label: 'Deser' },
  ],
  cuisine: [
    { value: 'polish', label: 'Polska' },
    { value: 'italian', label: 'Włoska' },
    { value: 'asian', label: 'Azjatycka' },
    { value: 'mexican', label: 'Meksykańska' },
    { value: 'mediterranean', label: 'Śródziemnomorska' },
  ],
  difficulty: [
    { value: 'easy', label: 'Łatwa' },
    { value: 'medium', label: 'Średnia' },
    { value: 'hard', label: 'Trudna' },
  ],
}

export const RecipeMetaEditor: React.FC<RecipeMetaEditorProps> = ({ meta, onChange, errors }) => {
  const handleNumberChange = (value: string, key: keyof RecipeMetaDraftVM) => {
    if (!value.trim()) {
      onChange({ [key]: undefined } as Partial<RecipeMetaDraftVM>)
      return
    }
    const parsed = Number(value)
    onChange({ [key]: Number.isFinite(parsed) ? parsed : undefined } as Partial<RecipeMetaDraftVM>)
  }

  const handleTagToggle = (key: keyof typeof TAG_OPTIONS, value: string) => {
    const current = meta.tags[key]
    const nextTags = { ...meta.tags }
    if (current === value) {
      delete nextTags[key]
    } else {
      nextTags[key] = value
    }
    onChange({ tags: nextTags })
  }

  return (
    <fieldset className="rounded-lg border border-dashed p-4" data-testid="recipe-meta-editor">
      <legend className="px-2 text-sm font-medium">Metadane</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
        <Label htmlFor="recipe-servings">Liczba porcji</Label>
        <Input
          id="recipe-servings"
          type="number"
          min={1}
          value={meta.servings}
          onChange={(event) => onChange({ servings: Number(event.target.value) })}
          aria-invalid={Boolean(errors?.servings)}
          data-testid="recipe-servings-input"
        />
        {errors?.servings && <p className="text-sm text-destructive">{errors.servings}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recipe-calories">Kalorie na porcję</Label>
          <Input
            id="recipe-calories"
            type="number"
            min={0}
            value={meta.calories_per_serving ?? ''}
            onChange={(event) => handleNumberChange(event.target.value, 'calories_per_serving')}
            aria-invalid={Boolean(errors?.calories)}
            data-testid="recipe-calories-input"
          />
          {errors?.calories && <p className="text-sm text-destructive">{errors.calories}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recipe-prep">Czas przygotowania (min)</Label>
          <Input
            id="recipe-prep"
            type="number"
            min={0}
            value={meta.prep_time_minutes ?? ''}
            onChange={(event) => handleNumberChange(event.target.value, 'prep_time_minutes')}
            aria-invalid={Boolean(errors?.prep)}
            data-testid="recipe-prep-time-input"
          />
          {errors?.prep && <p className="text-sm text-destructive">{errors.prep}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recipe-cook">Czas gotowania (min)</Label>
          <Input
            id="recipe-cook"
            type="number"
            min={0}
            value={meta.cook_time_minutes ?? ''}
            onChange={(event) => handleNumberChange(event.target.value, 'cook_time_minutes')}
            aria-invalid={Boolean(errors?.cook)}
            data-testid="recipe-cook-time-input"
          />
          {errors?.cook && <p className="text-sm text-destructive">{errors.cook}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recipe-total">Czas całkowity (min)</Label>
          <Input
            id="recipe-total"
            type="number"
            min={0}
            value={meta.total_time_minutes ?? ''}
            onChange={(event) => handleNumberChange(event.target.value, 'total_time_minutes')}
            aria-invalid={Boolean(errors?.total)}
          />
          {errors?.total && <p className="text-sm text-destructive">{errors.total}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Label>Dieta</Label>
          <div className="flex flex-col gap-2">
            {TAG_OPTIONS.diet.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={meta.tags.diet === option.value}
                  onChange={() => handleTagToggle('diet', option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3" data-testid="recipe-course-section">
          <Label>Danie</Label>
          <div className="flex flex-col gap-2">
            {TAG_OPTIONS.course.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={meta.tags.course === option.value}
                  onChange={() => handleTagToggle('course', option.value)}
                  data-testid={`recipe-course-${option.value}`}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Kuchnia</Label>
          <div className="flex flex-col gap-2">
            {TAG_OPTIONS.cuisine.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={meta.tags.cuisine === option.value}
                  onChange={() => handleTagToggle('cuisine', option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Trudność</Label>
          <div className="flex flex-col gap-2">
            {TAG_OPTIONS.difficulty.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={meta.tags.difficulty === option.value}
                  onChange={() => handleTagToggle('difficulty', option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </fieldset>
  )
}
