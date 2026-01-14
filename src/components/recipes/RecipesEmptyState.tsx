import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = {
  onCreateNew?: () => void
}

export const RecipesEmptyState: React.FC<Props> = ({ onCreateNew }) => {
  return (
    <div className="rounded-lg border bg-card/50 p-6">
      <Alert>
        <AlertTitle>Brak przepisów</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          Nie znaleźliśmy pasujących przepisów. Spróbuj zmienić filtry lub dodaj pierwszy przepis.
          {onCreateNew && (
            <div>
              <Button onClick={onCreateNew}>Dodaj pierwszy przepis</Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

