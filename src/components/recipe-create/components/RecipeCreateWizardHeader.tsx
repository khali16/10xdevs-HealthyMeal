import * as React from 'react'
import { RecipeCreateStepIndicator } from './RecipeCreateStepIndicator'
import { RecipePrivacyNotice } from './RecipePrivacyNotice'
import type { RecipeCreateWizardStep } from '../types'

type RecipeCreateWizardHeaderProps = {
  step: RecipeCreateWizardStep
}

export const RecipeCreateWizardHeader: React.FC<RecipeCreateWizardHeaderProps> = ({ step }) => {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Tworzenie przepisu</p>
        <h1 className="text-3xl font-semibold tracking-tight">Nowy przepis</h1>
      </div>
      <RecipeCreateStepIndicator step={step} totalSteps={2} />
      <RecipePrivacyNotice />
    </header>
  )
}
