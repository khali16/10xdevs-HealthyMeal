import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
}

export function RecipeDetailsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  )
}

export function RecipeDetailsErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
      <h2 className="text-lg font-semibold text-destructive">
        Nie udało się pobrać przepisu
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? 'Spróbuj ponownie za chwilę.'}
      </p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          Spróbuj ponownie
        </Button>
      ) : null}
    </div>
  )
}

export function RecipeDetailsNotFoundState() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-6">
      <h2 className="text-lg font-semibold">Nie udało się otworzyć przepisu</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Przepis może być niedostępny lub został usunięty.
      </p>
    </div>
  )
}

