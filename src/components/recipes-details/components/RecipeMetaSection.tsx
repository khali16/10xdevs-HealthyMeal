import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RecipeMetaVM } from '../types'

type RecipeMetaSectionProps = {
  meta: RecipeMetaVM
}

export function RecipeMetaSection({ meta }: RecipeMetaSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadane</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Przygotowanie</dt>
            <dd>{meta.prepTimeMinutes ?? '—'} min</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Gotowanie</dt>
            <dd>{meta.cookTimeMinutes ?? '—'} min</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Łącznie</dt>
            <dd>{meta.totalTimeMinutes ?? '—'} min</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Kalorie / porcja</dt>
            <dd>{meta.caloriesPerServing ?? '—'}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

