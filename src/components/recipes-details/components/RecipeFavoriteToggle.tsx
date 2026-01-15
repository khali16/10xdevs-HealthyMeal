import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

type RecipeFavoriteToggleProps = {
  checked: boolean
  isPending: boolean
  onChange: (next: boolean) => void
}

export function RecipeFavoriteToggle({
  checked,
  isPending,
  onChange,
}: RecipeFavoriteToggleProps) {
  const id = React.useId()

  return (
    <div className="flex items-center gap-3">
      <Switch
        id={id}
        checked={checked}
        disabled={isPending}
        onCheckedChange={onChange}
        aria-label="Ulubione"
      />
      <Label htmlFor={id}>Ulubione</Label>
    </div>
  )
}

