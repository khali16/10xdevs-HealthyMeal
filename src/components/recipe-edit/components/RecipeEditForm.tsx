import * as React from 'react'
import { RecipeIngredientsEditor } from '@/components/recipe-create/components/RecipeIngredientsEditor'
import { RecipeMetaEditor } from '@/components/recipe-create/components/RecipeMetaEditor'
import { RecipeStepsEditor } from '@/components/recipe-create/components/RecipeStepsEditor'
import { RecipeTitleField } from '@/components/recipe-create/components/RecipeTitleField'
import type {
  RecipeEditDraftVM,
  RecipeEditValidationErrorsVM,
  RecipeIngredientDraftVM,
  RecipeMetaDraftVM,
  RecipeStepDraftVM,
} from '../types'

type RecipeEditFormProps = {
  draft: RecipeEditDraftVM
  errors: RecipeEditValidationErrorsVM | null
  disabled?: boolean
  onChangeTitle: (value: string) => void
  onChangeIngredient: (id: string, patch: Partial<RecipeIngredientDraftVM>) => void
  onAddIngredient: () => void
  onRemoveIngredient: (id: string) => void
  onChangeStep: (id: string, patch: Partial<RecipeStepDraftVM>) => void
  onAddStep: () => void
  onRemoveStep: (id: string) => void
  onChangeMeta: (patch: Partial<RecipeMetaDraftVM>) => void
}

export const RecipeEditForm: React.FC<RecipeEditFormProps> = ({
  draft,
  errors,
  disabled,
  onChangeTitle,
  onChangeIngredient,
  onAddIngredient,
  onRemoveIngredient,
  onChangeStep,
  onAddStep,
  onRemoveStep,
  onChangeMeta,
}) => {
  return (
    <fieldset className="flex flex-col gap-6" disabled={disabled}>
      <RecipeTitleField
        value={draft.title}
        confidence={null}
        onChange={onChangeTitle}
        error={errors?.title}
      />
      <RecipeIngredientsEditor
        items={draft.ingredients}
        onChange={onChangeIngredient}
        onAdd={onAddIngredient}
        onRemove={onRemoveIngredient}
        error={errors?.ingredients}
        errorsById={errors?.ingredientsById}
      />
      <RecipeStepsEditor
        items={draft.steps}
        onChange={onChangeStep}
        onAdd={onAddStep}
        onRemove={onRemoveStep}
        error={errors?.steps}
        errorsById={errors?.stepsById}
      />
      <RecipeMetaEditor
        meta={draft.meta}
        onChange={onChangeMeta}
        errors={{
          servings: errors?.servings,
          calories: errors?.calories_per_serving,
          prep: errors?.prep_time_minutes,
          cook: errors?.cook_time_minutes,
          total: errors?.total_time_minutes,
        }}
      />
      {errors?.tags ? <p className="text-sm text-destructive">{errors.tags}</p> : null}
    </fieldset>
  )
}
