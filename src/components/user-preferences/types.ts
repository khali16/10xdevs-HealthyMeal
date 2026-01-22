import type { UserPreferencesDTO } from '@/types'
import { DIET_OPTIONS } from './constants'

export type AllergenKey = string

export type AllergenOptionVM = {
  id: string
  name: string
  label: string
  is_active: boolean
}

export type DietKey = (typeof DIET_OPTIONS)[number]['key']

export type DietOptionVM = {
  key: DietKey
  label: string
}

export type UserPreferencesFormValues = {
  allergens: AllergenKey[]
  exclusions: string[]
  diet: DietKey | null
  target_calories: number | null
  target_servings: number | null
}

export type UserPreferencesFieldErrorsVM = Partial<{
  allergens: string
  exclusions: string
  diet: string
  target_calories: string
  target_servings: string
}>

export type UserPreferencesViewState =
  | { status: 'loading' }
  | { status: 'ready'; data: { dto: UserPreferencesDTO | null } }
  | { status: 'not_found' }
  | { status: 'unauthorized' }
  | { status: 'error'; error: { code?: string; message: string } }
