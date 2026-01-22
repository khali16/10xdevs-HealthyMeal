import * as React from 'react'
import { Button } from '@/components/ui/button'
import { RecipePrivacyNotice } from '@/components/recipe-create/components/RecipePrivacyNotice'

type RecipeEditHeaderProps = {
  recipeTitle?: string
  onBack?: () => void
  showPrivacyNotice?: boolean
}

export const RecipeEditHeader: React.FC<RecipeEditHeaderProps> = ({
  recipeTitle,
  onBack,
  showPrivacyNotice = false,
}) => {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Edycja przepisu</p>
          <h1 className="text-2xl font-semibold text-foreground">
            {recipeTitle ? `Edytuj: ${recipeTitle}` : 'Edytuj przepis'}
          </h1>
        </div>
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            Wróć
          </Button>
        ) : null}
      </div>
      {showPrivacyNotice ? <RecipePrivacyNotice /> : null}
    </header>
  )
}
