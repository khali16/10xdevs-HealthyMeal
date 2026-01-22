import * as React from 'react'
import { Progress } from '@/components/ui/progress'
import type { RecipeCreateWizardStep } from '../types'

type RecipeCreateStepIndicatorProps = {
  step: RecipeCreateWizardStep
  totalSteps: number
}

const getCurrentStep = (step: RecipeCreateWizardStep) => (step === 'paste' ? 1 : 2)

export const RecipeCreateStepIndicator: React.FC<RecipeCreateStepIndicatorProps> = ({
  step,
  totalSteps,
}) => {
  const currentStep = getCurrentStep(step)
  const progressValue = Math.round((currentStep / totalSteps) * 100)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Krok {currentStep}/{totalSteps}</span>
        <span>{progressValue}%</span>
      </div>
      <Progress value={progressValue} />
    </div>
  )
}
