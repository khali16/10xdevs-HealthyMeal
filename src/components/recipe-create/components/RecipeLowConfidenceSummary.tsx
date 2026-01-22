import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { LowConfidenceIssueVM } from '../types'

type RecipeLowConfidenceSummaryProps = {
  issues: LowConfidenceIssueVM[]
  threshold: number
}

export const RecipeLowConfidenceSummary: React.FC<RecipeLowConfidenceSummaryProps> = ({
  issues,
  threshold,
}) => {
  if (!issues.length) return null

  return (
    <Alert>
      <AlertTitle>Wykryto pola z niską pewnością</AlertTitle>
      <AlertDescription>
        <p>Próg pewności: {threshold}</p>
        <ul className="ml-4 list-disc">
          {issues.map((issue) => (
            <li key={issue.field}>
              {issue.label} ({Math.round(issue.confidence * 100) / 100})
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
