import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { startRecipeAIAdjustment, type ApiMappedError } from '@/lib/api/recipes'
import { cn } from '@/lib/utils'

type RecipeAdjustButtonProps = {
  recipeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AdjustPreset = {
  id: string
  name: string
  description?: string
  access_level: 'global' | 'persona'
  persona?: string
  is_pinned?: boolean
  parameters: {
    avoid_allergens?: boolean
    use_exclusions?: boolean
    target_calories?: number
  }
}

type RecentPresetEntry = {
  id: string
  lastUsed: number
}

const DEFAULT_MODEL = 'google/gemini-3-flash-preview'
const RECENT_PRESETS_KEY = 'healthymeal.recent-presets'
const MAX_RECENT_PRESETS = 5

const PRESETS: AdjustPreset[] = [
  {
    id: 'preset-global-balanced',
    name: 'Zbilansowany',
    description: 'Zachowuje proporcje makro i neutralny smak.',
    access_level: 'global',
    is_pinned: true,
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-global-low-cal',
    name: 'Lekka wersja',
    description: 'Obniża kalorie na porcję bez utraty sytości.',
    access_level: 'global',
    is_pinned: true,
    parameters: { target_calories: 380, avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-global-high-protein',
    name: 'Więcej białka',
    description: 'Wzmacnia udział białka i sycących składników.',
    access_level: 'global',
    is_pinned: true,
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-elimination-gluten',
    name: 'Bez glutenu',
    description: 'Zamienniki zbóż zawierających gluten.',
    access_level: 'persona',
    persona: 'Diety eliminacyjne',
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-elimination-lactose',
    name: 'Bez laktozy',
    description: 'Zastępuje nabiał alternatywami roślinnymi.',
    access_level: 'persona',
    persona: 'Diety eliminacyjne',
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-elimination-low-fodmap',
    name: 'Low FODMAP',
    description: 'Minimalizuje fermentujące składniki.',
    access_level: 'persona',
    persona: 'Diety eliminacyjne',
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-athletes-postworkout',
    name: 'Posiłek potreningowy',
    description: 'Wyższe białko i szybkie węglowodany.',
    access_level: 'persona',
    persona: 'Sportowcy',
    parameters: { target_calories: 520, use_exclusions: true },
  },
  {
    id: 'preset-athletes-cut',
    name: 'Redukcja',
    description: 'Kontrolowane kalorie i lekki profil tłuszczu.',
    access_level: 'persona',
    persona: 'Sportowcy',
    parameters: { target_calories: 430, use_exclusions: true },
  },
  {
    id: 'preset-athletes-mass',
    name: 'Masa',
    description: 'Wyższa energia i większe porcje.',
    access_level: 'persona',
    persona: 'Sportowcy',
    parameters: { target_calories: 650, use_exclusions: true },
  },
  {
    id: 'preset-beginners-simple',
    name: 'Prosty start',
    description: 'Minimalna liczba składników i kroków.',
    access_level: 'persona',
    persona: 'Początkujący',
    parameters: { avoid_allergens: true },
  },
  {
    id: 'preset-beginners-quick',
    name: 'Szybkie gotowanie',
    description: 'Krótszy czas przygotowania i prostsze techniki.',
    access_level: 'persona',
    persona: 'Początkujący',
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
  {
    id: 'preset-beginners-budget',
    name: 'Budżetowo',
    description: 'Tańsze zamienniki i proste składniki.',
    access_level: 'persona',
    persona: 'Początkujący',
    parameters: { avoid_allergens: true, use_exclusions: true },
  },
]

const PERSONA_LABELS = ['Diety eliminacyjne', 'Sportowcy', 'Początkujący'] as const

const PRESET_BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]))

const PINNED_PRESETS = PRESETS.filter(
  (preset) => preset.access_level === 'global' && preset.is_pinned,
)

const PERSONA_GROUPS = PERSONA_LABELS.map((label) => ({
  label,
  items: PRESETS.filter(
    (preset) => preset.access_level === 'persona' && preset.persona === label,
  ),
}))

function normalizeRecentPresets(entries: RecentPresetEntry[]): RecentPresetEntry[] {
  const deduped = new Map<string, RecentPresetEntry>()
  for (const entry of entries) {
    if (!entry?.id || typeof entry.lastUsed !== 'number') continue
    const prev = deduped.get(entry.id)
    if (!prev || entry.lastUsed > prev.lastUsed) {
      deduped.set(entry.id, entry)
    }
  }
  return Array.from(deduped.values())
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_RECENT_PRESETS)
}

function readRecentPresets(): RecentPresetEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalizeRecentPresets(parsed)
  } catch {
    return []
  }
}

function writeRecentPresets(ids: string[]): RecentPresetEntry[] {
  if (typeof window === 'undefined') return []
  const now = Date.now()
  const current = readRecentPresets()
  const updates = ids.map((id, index) => ({ id, lastUsed: now + index }))
  const merged = normalizeRecentPresets([...updates, ...current])
  try {
    window.localStorage.setItem(RECENT_PRESETS_KEY, JSON.stringify(merged))
  } catch {
    return merged
  }
  return merged
}

function PresetCard({
  preset,
  selected,
  onToggle,
}: {
  preset: AdjustPreset
  selected: boolean
  onToggle: (preset: AdjustPreset) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(preset)}
      className="text-left"
    >
      <Card
        className={cn(
          'transition-colors hover:border-primary/60',
          selected && 'border-primary/70 bg-primary/5',
        )}
      >
        <CardHeader className="gap-1">
          <CardTitle className="text-sm">{preset.name}</CardTitle>
          {preset.description ? (
            <CardDescription>{preset.description}</CardDescription>
          ) : null}
          <CardAction onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => {
                if (checked === true && !selected) onToggle(preset)
                if (checked === false && selected) onToggle(preset)
              }}
              aria-label={`Wybierz preset ${preset.name}`}
            />
          </CardAction>
        </CardHeader>
      </Card>
    </button>
  )
}

export function RecipeAdjustButton({
  recipeId,
  open,
  onOpenChange,
}: RecipeAdjustButtonProps) {
  const [avoidAllergens, setAvoidAllergens] = React.useState(true)
  const [useExclusions, setUseExclusions] = React.useState(true)
  const [targetCalories, setTargetCalories] = React.useState<string>('')
  const [selectedPresetIds, setSelectedPresetIds] = React.useState<string[]>([])
  const [recentPresets, setRecentPresets] = React.useState<RecentPresetEntry[]>([])
  const [selectedPresetFromSelect, setSelectedPresetFromSelect] = React.useState<string>()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setRecentPresets(readRecentPresets())
    setFormError(null)
  }, [open])

  const applyPreset = React.useCallback((preset: AdjustPreset) => {
    setSelectedPresetIds((prev) =>
      prev.includes(preset.id) ? prev : [...prev, preset.id],
    )
    if (typeof preset.parameters.avoid_allergens === 'boolean') {
      setAvoidAllergens(preset.parameters.avoid_allergens)
    }
    if (typeof preset.parameters.use_exclusions === 'boolean') {
      setUseExclusions(preset.parameters.use_exclusions)
    }
    if (typeof preset.parameters.target_calories === 'number') {
      setTargetCalories(String(preset.parameters.target_calories))
    }
  }, [])

  const togglePreset = React.useCallback(
    (preset: AdjustPreset) => {
      if (selectedPresetIds.includes(preset.id)) {
        setSelectedPresetIds((prev) => prev.filter((id) => id !== preset.id))
        return
      }
      applyPreset(preset)
    },
    [applyPreset, selectedPresetIds],
  )

  const handleSelectPreset = React.useCallback(
    (value: string) => {
      setSelectedPresetFromSelect(value)
      const preset = PRESET_BY_ID.get(value)
      if (preset) applyPreset(preset)
    },
    [applyPreset],
  )

  const recentPresetCards = React.useMemo(
    () =>
      recentPresets
        .map((entry) => PRESET_BY_ID.get(entry.id))
        .filter((preset): preset is AdjustPreset => Boolean(preset)),
    [recentPresets],
  )

  const selectedPresetNames = React.useMemo(
    () =>
      selectedPresetIds
        .map((id) => PRESET_BY_ID.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
    [selectedPresetIds],
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmed = targetCalories.trim()
    let parsedCalories: number | undefined
    if (trimmed) {
      const value = Number(trimmed)
      if (!Number.isFinite(value) || value < 0) {
        setFormError('Kalorie muszą być liczbą dodatnią.')
        return
      }
      parsedCalories = value
    }

    const payload = {
      parameters: {
        avoid_allergens: avoidAllergens,
        use_exclusions: useExclusions,
        target_calories: parsedCalories,
        presets: selectedPresetIds.length ? selectedPresetIds : undefined,
      },
      model: DEFAULT_MODEL,
    }

    setIsSubmitting(true)
    try {
      const result = await startRecipeAIAdjustment(recipeId, payload)
      if (selectedPresetIds.length) {
        const updated = writeRecentPresets(selectedPresetIds)
        setRecentPresets(updated)
      }
      if (result.adjusted_recipe_id) {
        window.location.assign(`/recipes/${result.adjusted_recipe_id}`)
        return
      }
      onOpenChange(false)
    } catch (error) {
      const mapped = error as ApiMappedError
      setFormError(mapped?.message ?? 'Nie udało się uruchomić dostosowania.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        Dostosuj przepis
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] space-y-6 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dostosuj przepis</DialogTitle>
            <DialogDescription>
              Wybierz preset i parametry dopasowania. Zawsze możesz zrezygnować przed
              uruchomieniem AI.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Presety</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {PINNED_PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={selectedPresetIds.includes(preset.id)}
                    onToggle={togglePreset}
                  />
                ))}
              </div>
              {PERSONA_GROUPS.map((group) => (
                <div key={group.label} className="space-y-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.items.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        selected={selectedPresetIds.includes(preset.id)}
                        onToggle={togglePreset}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Ostatnio używane</h3>
              {recentPresetCards.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentPresetCards.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      selected={selectedPresetIds.includes(preset.id)}
                      onToggle={togglePreset}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Brak ostatnio używanych presetów.
                </p>
              )}
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Parametry</h3>
              <div className="space-y-2">
                <Label htmlFor="preset-select">Wybierz preset</Label>
                <Select
                  value={selectedPresetFromSelect}
                  onValueChange={handleSelectPreset}
                >
                  <SelectTrigger id="preset-select" className="w-full">
                    <SelectValue placeholder="Wybierz preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Globalne</SelectLabel>
                      {PINNED_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {PERSONA_GROUPS.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.items.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPresetNames.length ? (
                  <p className="text-xs text-muted-foreground">
                    Wybrane: {selectedPresetNames.join(', ')}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <Label htmlFor="avoid-allergens">Unikaj alergenów</Label>
                <Checkbox
                  id="avoid-allergens"
                  checked={avoidAllergens}
                  onCheckedChange={(checked) =>
                    setAvoidAllergens(checked === true)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <Label htmlFor="use-exclusions">Uwzględnij wykluczenia</Label>
                <Checkbox
                  id="use-exclusions"
                  checked={useExclusions}
                  onCheckedChange={(checked) => setUseExclusions(checked === true)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-calories">Docelowe kalorie (na porcję)</Label>
                <Input
                  id="target-calories"
                  type="number"
                  min={0}
                  value={targetCalories}
                  onChange={(event) => setTargetCalories(event.target.value)}
                  placeholder="np. 450"
                />
              </div>
            </section>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Uruchamiam...' : 'Dostosuj'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ustawienia są edytowalne po wybraniu presetów. AI może wymagać
              dodatkowej weryfikacji alergenów.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

