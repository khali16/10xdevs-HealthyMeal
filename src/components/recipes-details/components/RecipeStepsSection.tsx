import { Separator } from '@/components/ui/separator'

type RecipeStepsSectionProps = {
  steps: string[]
}

export function RecipeStepsSection({ steps }: RecipeStepsSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Kroki</h2>
      <Separator className="my-3" />
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak kroków.</p>
      ) : (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {steps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  )
}

