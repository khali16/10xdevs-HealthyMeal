import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = {
  message?: string
  onRetry?: () => void
}

export const RecipesErrorState: React.FC<Props> = ({ message, onRetry }) => {
  return (
    <div className="rounded-lg border bg-card/50 p-6">
      <Alert variant="destructive">
        <AlertTitle>Wystąpił błąd</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          {message ?? 'Coś poszło nie tak. Spróbuj ponownie.'}
          {onRetry && (
            <div>
              <Button variant="destructive" onClick={onRetry}>
                Spróbuj ponownie
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

