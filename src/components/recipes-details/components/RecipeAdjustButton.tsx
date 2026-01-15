import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type RecipeAdjustButtonProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RecipeAdjustButton({ open, onOpenChange }: RecipeAdjustButtonProps) {
  const [avoidAllergens, setAvoidAllergens] = React.useState(true)
  const [useExclusions, setUseExclusions] = React.useState(true)
  const [targetCalories, setTargetCalories] = React.useState<string>('')
  const [formError, setFormError] = React.useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    if (targetCalories && Number(targetCalories) < 0) {
      setFormError('Kalorie muszą być liczbą dodatnią.')
      return
    }
    onOpenChange(false)
  }

  return (
    <>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        Dostosuj przepis
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dostosuj przepis</DialogTitle>
            <DialogDescription>
              Wybierz parametry dostosowania przepisu. Integracja AI zostanie
              dodana w kolejnym kroku.
            </DialogDescription>
          </DialogHeader>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="avoid-allergens">Unikaj alergenów</Label>
              <Switch
                id="avoid-allergens"
                checked={avoidAllergens}
                onCheckedChange={setAvoidAllergens}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="use-exclusions">Uwzględnij wykluczenia</Label>
              <Switch
                id="use-exclusions"
                checked={useExclusions}
                onCheckedChange={setUseExclusions}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-calories">Docelowe kalorie (na porcję)</Label>
              <Input
                id="target-calories"
                type="number"
                min={0}
                value={targetCalories}
                onChange={(event) => setTargetCalories(event.target.value)}
                placeholder="np. 450"
              />
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit">Zapisz parametry</Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            To ustawienia wstępne. Dalsze kroki pojawią się po uruchomieniu modułu AI.
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

