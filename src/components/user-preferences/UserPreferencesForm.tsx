import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { userPreferencesCommandSchema } from '@/lib/validation/user-preferences'
import { DIET_OPTIONS } from './constants'
import type {
  AllergenKey,
  AllergenOptionVM,
  DietKey,
  UserPreferencesFormValues,
} from './types'
import type { ApiMappedError } from '@/lib/api/user-preferences'
import type { UpsertUserPreferencesCommand } from '@/types'

type UserPreferencesFormProps = {
  mode: 'full' | 'onboarding'
  defaultValues: UserPreferencesFormValues
  allergenOptions: AllergenOptionVM[]
  isSaving: boolean
  apiError?: { code?: string; message: string } | null
  saveMessage?: string | null
  disableSubmit?: boolean
  onSubmit: (cmd: UpsertUserPreferencesCommand) => Promise<ApiMappedError | null>
  onCancel: () => void
}

export const UserPreferencesForm: React.FC<UserPreferencesFormProps> = ({
  mode,
  defaultValues,
  allergenOptions,
  isSaving,
  apiError,
  saveMessage,
  disableSubmit,
  onSubmit,
  onCancel,
}) => {
  const allergenKeys = React.useMemo(
    () => new Set(allergenOptions.map((option) => option.name)),
    [allergenOptions],
  )

  const schema = React.useMemo(() => {
    return userPreferencesCommandSchema.superRefine((values, ctx) => {
      if (!allergenKeys.size) return
      const invalid = values.allergens.filter((item) => !allergenKeys.has(item))
      if (invalid.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['allergens'],
          message: 'Wybierz alergeny tylko z dostępnej listy.',
        })
      }
    })
  }, [allergenKeys])

  const form = useForm<UserPreferencesFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onSubmit',
  })

  React.useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    const normalized = normalizeValues(values)
    const response = await onSubmit(normalized)

    if (response?.fieldErrors) {
      mapFieldErrors(response.fieldErrors, (name, message) => {
        form.setError(name, { type: 'server', message })
      })
    }
  })

  const isDirty = form.formState.isDirty

  return (
    <Form {...form}>
      <form className="mt-6 flex flex-col gap-6" onSubmit={handleSubmit}>
        {disableSubmit ? (
          <Alert variant="destructive">
            <AlertTitle>Brak słownika alergenów</AlertTitle>
            <AlertDescription>
              Nie udało się pobrać listy alergenów. Spróbuj odświeżyć stronę.
            </AlertDescription>
          </Alert>
        ) : null}

        {apiError ? (
          <Alert variant="destructive">
            <AlertTitle>Nie udało się zapisać</AlertTitle>
            <AlertDescription>{apiError.message}</AlertDescription>
          </Alert>
        ) : null}

        {saveMessage ? (
          <Alert>
            <AlertTitle>Sukces</AlertTitle>
            <AlertDescription>{saveMessage}</AlertDescription>
          </Alert>
        ) : null}

        <AllergensFieldset options={allergenOptions} disabled={isSaving} />
        <ExclusionsFieldset disabled={isSaving} />
        <DietFieldset disabled={isSaving} />
        <TargetsFieldset disabled={isSaving} />
        {mode === 'full' ? (
          <FormActions
            isSaving={isSaving}
            isDirty={isDirty}
            disableSubmit={disableSubmit}
            onCancel={onCancel}
          />
        ) : null}
      </form>
    </Form>
  )
}

type AllergensFieldsetProps = {
  options: AllergenOptionVM[]
  disabled?: boolean
}

const AllergensFieldset: React.FC<AllergensFieldsetProps> = ({ options, disabled }) => {
  return (
    <fieldset className="rounded-lg border border-dashed p-4">
      <legend className="px-2 text-sm font-medium">Alergeny</legend>
      <FormField
        name="allergens"
        render={({ field }) => {
          const value = new Set(field.value ?? [])
          return (
            <FormItem className="mt-3">
              <FormDescription>Wybierz alergeny, których chcesz unikać.</FormDescription>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={value.has(option.name)}
                      onChange={() => {
                        const next = new Set(value)
                        if (next.has(option.name)) {
                          next.delete(option.name)
                        } else {
                          next.add(option.name)
                        }
                        field.onChange(Array.from(next))
                      }}
                      disabled={disabled}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </fieldset>
  )
}

type ExclusionsFieldsetProps = {
  disabled?: boolean
}

const ExclusionsFieldset: React.FC<ExclusionsFieldsetProps> = ({ disabled }) => {
  const [inputValue, setInputValue] = React.useState('')
  const [inputError, setInputError] = React.useState<string | null>(null)

  return (
    <fieldset className="rounded-lg border border-dashed p-4">
      <legend className="px-2 text-sm font-medium">Wykluczenia</legend>
      <FormField
        name="exclusions"
        render={({ field }) => {
          const value = field.value ?? []

          const addItem = () => {
            const normalized = normalizeExclusion(inputValue)
            if (!normalized) {
              setInputError('Wpisz nazwę wykluczenia.')
              return
            }
            if (normalized.length > 100) {
              setInputError('Wykluczenie może mieć maksymalnie 100 znaków.')
              return
            }
            const existing = value.find((item) => item.toLowerCase() === normalized.toLowerCase())
            if (existing) {
              setInputError('To wykluczenie już istnieje.')
              return
            }
            if (value.length >= 200) {
              setInputError('Możesz dodać maksymalnie 200 wykluczeń.')
              return
            }
            const next = [...value, normalized]
            field.onChange(next)
            setInputValue('')
            setInputError(null)
          }

          const removeItem = (item: string) => {
            field.onChange(value.filter((valueItem) => valueItem !== item))
          }

          return (
            <FormItem className="mt-3">
              <FormDescription>Dodaj składniki, których nie chcesz używać.</FormDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {value.length ? (
                  value.map((item) => (
                    <Badge key={item} variant="secondary" className="flex items-center gap-2">
                      <span>{item}</span>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => removeItem(item)}
                        disabled={disabled}
                        aria-label={`Usuń ${item}`}
                      >
                        ✕
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Brak wykluczeń.</span>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder="np. papryka"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addItem()
                    }
                  }}
                  disabled={disabled}
                />
                <Button type="button" variant="secondary" onClick={addItem} disabled={disabled}>
                  Dodaj
                </Button>
              </div>
              {inputError ? <p className="text-sm text-destructive">{inputError}</p> : null}
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </fieldset>
  )
}

type DietFieldsetProps = {
  disabled?: boolean
}

const DietFieldset: React.FC<DietFieldsetProps> = ({ disabled }) => {
  return (
    <fieldset className="rounded-lg border border-dashed p-4">
      <legend className="px-2 text-sm font-medium">Dieta</legend>
      <FormField
        name="diet"
        render={({ field }) => (
          <FormItem className="mt-3">
            <FormLabel>Wybierz dietę</FormLabel>
            <FormControl>
              <Select
                value={field.value ?? 'none'}
                onValueChange={(next) => field.onChange(next === 'none' ? null : (next as DietKey))}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Brak / Nie ustawiono" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak / Nie ustawiono</SelectItem>
                  {DIET_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </fieldset>
  )
}

type TargetsFieldsetProps = {
  disabled?: boolean
}

const TargetsFieldset: React.FC<TargetsFieldsetProps> = ({ disabled }) => {
  return (
    <fieldset className="rounded-lg border border-dashed p-4">
      <legend className="px-2 text-sm font-medium">Cele</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <FormField
          name="target_calories"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Docelowe kalorie</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(parseNumber(event.target.value))}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="target_servings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bazowa liczba porcji</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(parseNumber(event.target.value))}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  )
}

type FormActionsProps = {
  isSaving: boolean
  isDirty: boolean
  disableSubmit?: boolean
  onCancel: () => void
}

const FormActions: React.FC<FormActionsProps> = ({ isSaving, isDirty, disableSubmit, onCancel }) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
        Anuluj
      </Button>
      <Button type="submit" disabled={isSaving || disableSubmit || !isDirty}>
        {isSaving ? 'Zapisywanie...' : 'Zapisz'}
      </Button>
    </div>
  )
}

const normalizeExclusion = (value: string) => value.trim().replace(/\s+/g, ' ')

const normalizeValues = (values: UserPreferencesFormValues): UpsertUserPreferencesCommand => ({
  allergens: values.allergens.map((item) => item.trim()).filter(Boolean),
  exclusions: values.exclusions.map((item) => normalizeExclusion(item)).filter(Boolean),
  diet: values.diet ? values.diet.trim() : null,
  target_calories: normalizeNumber(values.target_calories),
  target_servings: normalizeNumber(values.target_servings),
})

const normalizeNumber = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return null
  const parsed = Math.floor(value)
  return parsed > 0 ? parsed : null
}

const parseNumber = (value: string) => {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const mapFieldErrors = (
  fieldErrors: Record<string, string[]>,
  apply: (name: keyof UserPreferencesFormValues, message: string) => void,
) => {
  if (fieldErrors.allergens?.[0]) apply('allergens', fieldErrors.allergens[0])
  if (fieldErrors.exclusions?.[0]) apply('exclusions', fieldErrors.exclusions[0])
  if (fieldErrors.diet?.[0]) apply('diet', fieldErrors.diet[0])
  if (fieldErrors.target_calories?.[0]) apply('target_calories', fieldErrors.target_calories[0])
  if (fieldErrors.target_servings?.[0]) apply('target_servings', fieldErrors.target_servings[0])
}
