import * as React from 'react'
import type {
  RecipeCreateWizardState,
  RecipeDraftVM,
  RecipeCreateWizardStep,
  RecipeIngredientDraftVM,
  RecipeStepDraftVM,
  RecipeMetaDraftVM,
} from '../types'

type RecipeCreateWizardAction =
  | { type: 'set_raw'; raw: string }
  | { type: 'apply_parse'; draftPatch: Partial<RecipeDraftVM> }
  | { type: 'go_next' }
  | { type: 'go_back' }
  | { type: 'set_step'; step: RecipeCreateWizardStep }
  | { type: 'update_title'; value: string }
  | { type: 'update_ingredient'; id: string; patch: Partial<RecipeIngredientDraftVM> }
  | { type: 'add_ingredient' }
  | { type: 'remove_ingredient'; id: string }
  | { type: 'update_step'; id: string; patch: Partial<RecipeStepDraftVM> }
  | { type: 'add_step' }
  | { type: 'remove_step'; id: string }
  | { type: 'update_meta'; patch: Partial<RecipeMetaDraftVM> }
  | { type: 'set_validation_errors'; errors: RecipeCreateWizardState['validationErrors'] }
  | { type: 'set_saving'; isSaving: boolean }
  | { type: 'set_api_error'; apiError: RecipeCreateWizardState['apiError'] }

const createEmptyDraft = (): RecipeDraftVM => ({
  raw: '',
  title: { value: '', confidence: null, source: 'manual' },
  ingredients: [],
  steps: [],
  meta: {
    servings: 1,
    tags: {},
  },
  warnings: [],
})

const initialState: RecipeCreateWizardState = {
  step: 'paste',
  draft: createEmptyDraft(),
  validationErrors: null,
  isSaving: false,
  apiError: null,
}

const reducer = (state: RecipeCreateWizardState, action: RecipeCreateWizardAction): RecipeCreateWizardState => {
  switch (action.type) {
    case 'set_raw':
      return {
        ...state,
        draft: {
          ...state.draft,
          raw: action.raw,
        },
        validationErrors: null,
        apiError: null,
      }
    case 'apply_parse':
      return {
        ...state,
        draft: {
          ...state.draft,
          ...action.draftPatch,
          title: action.draftPatch.title ?? state.draft.title,
          ingredients: action.draftPatch.ingredients ?? state.draft.ingredients,
          steps: action.draftPatch.steps ?? state.draft.steps,
          warnings: action.draftPatch.warnings ?? state.draft.warnings,
        },
        validationErrors: null,
        apiError: null,
      }
    case 'go_next':
      return {
        ...state,
        step: 'review',
        validationErrors: null,
        apiError: null,
      }
    case 'go_back':
      return {
        ...state,
        step: 'paste',
        validationErrors: null,
      }
    case 'set_step':
      return {
        ...state,
        step: action.step,
        validationErrors: null,
      }
    case 'update_title':
      return {
        ...state,
        draft: {
          ...state.draft,
          title: {
            ...state.draft.title,
            value: action.value,
            source: 'manual',
            confidence: null,
          },
        },
        validationErrors: null,
      }
    case 'update_ingredient':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: state.draft.ingredients.map((item) =>
            item.value.id === action.id
              ? (() => {
                  const nextValue = {
                    ...item.value,
                    ...action.patch,
                  }
                  if (!('confidence' in action.patch)) {
                    nextValue.confidence = undefined
                  }
                  return {
                    ...item,
                    source: 'manual',
                    value: nextValue,
                  }
                })()
              : item,
          ),
        },
        validationErrors: null,
      }
    case 'add_ingredient':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: [
            ...state.draft.ingredients,
            {
              source: 'manual',
              value: {
                id: crypto.randomUUID(),
                text: '',
              },
            },
          ],
        },
        validationErrors: null,
      }
    case 'remove_ingredient':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: state.draft.ingredients.filter((item) => item.value.id !== action.id),
        },
        validationErrors: null,
      }
    case 'update_step':
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: state.draft.steps.map((item) =>
            item.value.id === action.id
              ? (() => {
                  const nextValue = {
                    ...item.value,
                    ...action.patch,
                  }
                  if (!('confidence' in action.patch)) {
                    nextValue.confidence = undefined
                  }
                  return {
                    ...item,
                    source: 'manual',
                    value: nextValue,
                  }
                })()
              : item,
          ),
        },
        validationErrors: null,
      }
    case 'add_step':
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: [
            ...state.draft.steps,
            {
              source: 'manual',
              value: {
                id: crypto.randomUUID(),
                text: '',
              },
            },
          ],
        },
        validationErrors: null,
      }
    case 'remove_step':
      return {
        ...state,
        draft: {
          ...state.draft,
          steps: state.draft.steps.filter((item) => item.value.id !== action.id),
        },
        validationErrors: null,
      }
    case 'update_meta':
      return {
        ...state,
        draft: {
          ...state.draft,
          meta: {
            ...state.draft.meta,
            ...action.patch,
          },
        },
        validationErrors: null,
      }
    case 'set_validation_errors':
      return {
        ...state,
        validationErrors: action.errors,
      }
    case 'set_saving':
      return {
        ...state,
        isSaving: action.isSaving,
      }
    case 'set_api_error':
      return {
        ...state,
        apiError: action.apiError,
      }
    default:
      return state
  }
}

export const useRecipeCreateWizardState = () => {
  const [state, dispatch] = React.useReducer(reducer, initialState)

  const actions = React.useMemo(
    () => ({
      setRaw: (raw: string) => dispatch({ type: 'set_raw', raw }),
      applyParse: (draftPatch: Partial<RecipeDraftVM>) => dispatch({ type: 'apply_parse', draftPatch }),
      goNext: () => dispatch({ type: 'go_next' }),
      goBack: () => dispatch({ type: 'go_back' }),
      setStep: (step: RecipeCreateWizardStep) => dispatch({ type: 'set_step', step }),
      updateTitle: (value: string) => dispatch({ type: 'update_title', value }),
      updateIngredient: (id: string, patch: Partial<RecipeIngredientDraftVM>) =>
        dispatch({ type: 'update_ingredient', id, patch }),
      addIngredient: () => dispatch({ type: 'add_ingredient' }),
      removeIngredient: (id: string) => dispatch({ type: 'remove_ingredient', id }),
      updateStep: (id: string, patch: Partial<RecipeStepDraftVM>) =>
        dispatch({ type: 'update_step', id, patch }),
      addStep: () => dispatch({ type: 'add_step' }),
      removeStep: (id: string) => dispatch({ type: 'remove_step', id }),
      updateMeta: (patch: Partial<RecipeMetaDraftVM>) => dispatch({ type: 'update_meta', patch }),
      setValidationErrors: (errors: RecipeCreateWizardState['validationErrors']) =>
        dispatch({ type: 'set_validation_errors', errors }),
      setSaving: (isSaving: boolean) => dispatch({ type: 'set_saving', isSaving }),
      setApiError: (apiError: RecipeCreateWizardState['apiError']) =>
        dispatch({ type: 'set_api_error', apiError }),
    }),
    [],
  )

  return { state, actions }
}
