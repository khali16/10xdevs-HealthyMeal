import * as React from 'react'
import { Button } from '@/components/ui/button'
import type { ApiListMeta } from '@/types'

type Props = {
  meta: ApiListMeta
  isLoading?: boolean
  onPageChange: (page: number) => void
}

export const RecipesPagination: React.FC<Props> = ({ meta, isLoading, onPageChange }) => {
  const { page, page_size, total, has_next } = meta
  const from = (page - 1) * page_size + 1
  const to = has_next ? page * page_size : total ?? page * page_size

  const prevDisabled = page <= 1 || isLoading
  const nextDisabled = !has_next || isLoading

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {total != null ? `${from}–${Math.min(to, total)} z ${total}` : `Strona ${page}`}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={prevDisabled} onClick={() => onPageChange(page - 1)}>
          Poprzednia
        </Button>
        <Button variant="outline" disabled={nextDisabled} onClick={() => onPageChange(page + 1)}>
          Następna
        </Button>
      </div>
    </div>
  )
}

