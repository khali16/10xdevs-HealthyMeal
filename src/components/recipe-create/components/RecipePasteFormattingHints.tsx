import * as React from 'react'

export const RecipePasteFormattingHints: React.FC = () => {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Podpowiedź formatowania</p>
      <p>
        Warto używać nagłówków typu „Składniki” i „Kroki” oraz list punktowanych lub numerowanych.
      </p>
    </div>
  )
}
