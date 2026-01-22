import * as React from 'react'
import { Badge } from '@/components/ui/badge'

type RecipeConfidenceBadgeProps = {
  confidence: number | null
  threshold?: number
}

const formatConfidence = (confidence: number) => Math.round(confidence * 100) / 100

export const RecipeConfidenceBadge: React.FC<RecipeConfidenceBadgeProps> = ({
  confidence,
  threshold = 0.9,
}) => {
  if (confidence === null) {
    return <Badge variant="outline">brak danych</Badge>
  }

  const variant = confidence < threshold ? 'destructive' : 'secondary'

  return <Badge variant={variant}>{formatConfidence(confidence)}</Badge>
}
