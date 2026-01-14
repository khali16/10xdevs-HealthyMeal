import * as React from 'react'
import { RecipesListHeader } from './RecipesListHeader'
import { RecipesFiltersBar } from './RecipesFiltersBar'
import { RecipesGrid } from './RecipesGrid'
import { RecipesPagination } from './RecipesPagination'
import { RecipesEmptyState } from './RecipesEmptyState'
import { RecipesErrorState } from './RecipesErrorState'
import { useRecipesListQueryState } from './hooks/useRecipesListQueryState'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useAbortableFetch } from './hooks/useAbortableFetch'
import { listRecipes } from '@/lib/api/recipes'
import { mapRecipeDtoToCardVM } from './mappers'
import type { RecipesListFiltersVM, RecipesListViewState, RecipeSort } from './types'

const DEFAULT_FILTERS: RecipesListFiltersVM = {
  q: '',
  diet: null,
  max_calories: null,
  max_total_time: null,
  favorite: false,
}

const RecipesListPage: React.FC = () => {
  const { query, setQuery } = useRecipesListQueryState()
  const [searchInput, setSearchInput] = React.useState<string>(query.q ?? '')
  const debouncedSearch = useDebouncedValue(searchInput, 500)

  const [viewState, setViewState] = React.useState<RecipesListViewState>({
    status: 'loading',
    items: [],
    error: undefined,
  })
  const [isFetching, setIsFetching] = React.useState<boolean>(false)

  const { fetchWithAbort } = useAbortableFetch()

  const filters: RecipesListFiltersVM = {
    ...DEFAULT_FILTERS,
    q: searchInput,
    diet: query.diet ?? null,
    max_calories: query.max_calories ?? null,
    max_total_time: query.max_total_time ?? null,
    favorite: query.favorite ?? false,
  }

  React.useEffect(() => {
    setSearchInput(query.q ?? '')
  }, [query.q])

  React.useEffect(() => {
    const normalized = debouncedSearch.trim()
    if (normalized === (query.q ?? '')) return
    setQuery(
      {
        q: normalized || undefined,
        page: 1,
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      setIsFetching(true)
      setViewState((prev) => ({ status: 'loading', items: prev.items, error: undefined }))
      try {
        const res = await fetchWithAbort((signal) => listRecipes(query, signal))
        if (cancelled) return
        const items = res.data.map(mapRecipeDtoToCardVM)
        if (!items.length) {
          setViewState({ status: 'empty', items: [], meta: res.meta, error: undefined
          })
        } else {
          setViewState({ status: 'ready', items, meta: res.meta, error: undefined })
        }
      } catch (e: any) {
        if (cancelled) return
        const message = e?.message ?? 'Nie udało się pobrać przepisów.'
        setViewState((prev) => ({
          status: 'error',
          items: prev.items,
          meta: prev.meta,
          error: { message, code: e?.code },
        }))
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [query, fetchWithAbort])

  const handleSortChange = (next: RecipeSort) => {
    setQuery({ sort: next, page: 1 })
  }

  const handleFiltersChange = (next: Partial<RecipesListFiltersVM>) => {
    const patch: Record<string, any> = { page: 1 }
    if ('q' in next) {
      const val = next.q?.trim() ?? ''
      setSearchInput(val)
    }
    if ('diet' in next) patch.diet = next.diet || undefined
    if ('max_calories' in next)
      patch.max_calories =
        typeof next.max_calories === 'number' && next.max_calories >= 0
          ? next.max_calories
          : undefined
    if ('max_total_time' in next)
      patch.max_total_time =
        typeof next.max_total_time === 'number' && next.max_total_time >= 0
          ? next.max_total_time
          : undefined
    if ('favorite' in next) patch.favorite = next.favorite ?? undefined
    setQuery(patch)
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setQuery({
      q: undefined,
      diet: undefined,
      max_calories: undefined,
      max_total_time: undefined,
      favorite: undefined,
      page: 1,
    })
  }

  const handlePageChange = (page: number) => {
    if (page < 1) return
    setQuery({ page })
  }

  return (
    <section className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <RecipesListHeader sort={query.sort} onSortChange={handleSortChange} />
        <RecipesFiltersBar filters={filters} onChange={handleFiltersChange} onClear={handleClearFilters} />

        {viewState.status === 'error' && (
          <RecipesErrorState message={viewState.error?.message} onRetry={() => setQuery({ ...query })} />
        )}

        {viewState.status === 'empty' && <RecipesEmptyState />}

        {(viewState.status === 'ready' || viewState.status === 'loading' || viewState.status === 'error') && (
          <RecipesGrid items={viewState.items} isLoading={isFetching || viewState.status === 'loading'} />
        )}

        {viewState.meta && (
          <RecipesPagination meta={viewState.meta} isLoading={isFetching} onPageChange={handlePageChange} />
        )}
      </div>
    </section>
  )
}

export default RecipesListPage

