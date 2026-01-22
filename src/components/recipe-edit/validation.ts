import type { RecipeEditDraftVM, RecipeEditValidationErrorsVM } from './types'

const MAX_TITLE_LENGTH = 255
const MAX_TEXT_LENGTH = 500
const MAX_TAG_LENGTH = 100
const MAX_INGREDIENTS = 200
const MAX_STEPS = 200
const MAX_AMOUNT = 1_000_000
const MAX_UNIT_LENGTH = 50
const MAX_SERVINGS = 10_000
const MAX_PREP_TIME = 1_000
const MAX_COOK_TIME = 1_000
const MAX_TOTAL_TIME = 2_000
const MAX_CALORIES = 100_000

const toTrimmed = (value: string) => value.trim()

const isEmpty = (value?: string) => !value || !value.trim()

const ensureInt = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max

const pushIngredientError = (
  errors: RecipeEditValidationErrorsVM,
  id: string,
  field: 'text' | 'amount' | 'unit',
  message: string,
) => {
  if (!errors.ingredientsById) errors.ingredientsById = {}
  if (!errors.ingredientsById[id]) errors.ingredientsById[id] = {}
  errors.ingredientsById[id][field] = message
}

const pushStepError = (
  errors: RecipeEditValidationErrorsVM,
  id: string,
  message: string,
) => {
  if (!errors.stepsById) errors.stepsById = {}
  errors.stepsById[id] = { text: message }
}

export const validateDraft = (draft: RecipeEditDraftVM): RecipeEditValidationErrorsVM => {
  const errors: RecipeEditValidationErrorsVM = {}

  const title = toTrimmed(draft.title)
  if (!title) {
    errors.title = 'Tytuł jest wymagany.'
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Tytuł może mieć maksymalnie ${MAX_TITLE_LENGTH} znaków.`
  }

  if (!draft.ingredients.length) {
    errors.ingredients = 'Dodaj co najmniej jeden składnik.'
  } else if (draft.ingredients.length > MAX_INGREDIENTS) {
    errors.ingredients = `Maksymalna liczba składników to ${MAX_INGREDIENTS}.`
  }

  draft.ingredients.forEach((ingredient) => {
    const text = toTrimmed(ingredient.text)
    if (!text) {
      pushIngredientError(errors, ingredient.id, 'text', 'Uzupełnij nazwę składnika.')
    } else if (text.length > MAX_TEXT_LENGTH) {
      pushIngredientError(
        errors,
        ingredient.id,
        'text',
        `Maksymalna długość to ${MAX_TEXT_LENGTH} znaków.`,
      )
    }

    if (ingredient.amount != null) {
      if (!Number.isFinite(ingredient.amount)) {
        pushIngredientError(errors, ingredient.id, 'amount', 'Wpisz poprawną liczbę.')
      } else if (ingredient.amount < 0 || ingredient.amount > MAX_AMOUNT) {
        pushIngredientError(
          errors,
          ingredient.id,
          'amount',
          `Wartość musi być w zakresie 0–${MAX_AMOUNT}.`,
        )
      }
    }

    if (ingredient.unit != null) {
      const unit = toTrimmed(ingredient.unit)
      if (!unit) {
        pushIngredientError(errors, ingredient.id, 'unit', 'Usuń pustą jednostkę.')
      } else if (unit.length > MAX_UNIT_LENGTH) {
        pushIngredientError(
          errors,
          ingredient.id,
          'unit',
          `Maksymalnie ${MAX_UNIT_LENGTH} znaków.`,
        )
      }
    }
  })

  if (!draft.steps.length) {
    errors.steps = 'Dodaj co najmniej jeden krok.'
  } else if (draft.steps.length > MAX_STEPS) {
    errors.steps = `Maksymalna liczba kroków to ${MAX_STEPS}.`
  }

  draft.steps.forEach((step) => {
    const text = toTrimmed(step.text)
    if (!text) {
      pushStepError(errors, step.id, 'Uzupełnij treść kroku.')
    } else if (text.length > MAX_TEXT_LENGTH) {
      pushStepError(errors, step.id, `Maksymalna długość to ${MAX_TEXT_LENGTH} znaków.`)
    }
  })

  if (!ensureInt(draft.meta.servings, 1, MAX_SERVINGS)) {
    errors.servings = `Liczba porcji musi być w zakresie 1–${MAX_SERVINGS}.`
  }

  if (draft.meta.prep_time_minutes != null) {
    if (!ensureInt(draft.meta.prep_time_minutes, 0, MAX_PREP_TIME)) {
      errors.prep_time_minutes = `Czas przygotowania 0–${MAX_PREP_TIME} min.`
    }
  }

  if (draft.meta.cook_time_minutes != null) {
    if (!ensureInt(draft.meta.cook_time_minutes, 0, MAX_COOK_TIME)) {
      errors.cook_time_minutes = `Czas gotowania 0–${MAX_COOK_TIME} min.`
    }
  }

  if (draft.meta.total_time_minutes != null) {
    if (!ensureInt(draft.meta.total_time_minutes, 0, MAX_TOTAL_TIME)) {
      errors.total_time_minutes = `Czas całkowity 0–${MAX_TOTAL_TIME} min.`
    }
  }

  if (draft.meta.calories_per_serving != null) {
    if (!ensureInt(draft.meta.calories_per_serving, 0, MAX_CALORIES)) {
      errors.calories_per_serving = `Kalorie 0–${MAX_CALORIES}.`
    }
  }

  Object.values(draft.meta.tags ?? {}).forEach((value) => {
    if (isEmpty(value)) return
    if (value.trim().length > MAX_TAG_LENGTH) {
      errors.tags = 'Tagi mogą mieć maksymalnie 100 znaków.'
    }
  })

  return errors
}
