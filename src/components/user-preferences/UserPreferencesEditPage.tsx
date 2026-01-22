import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAbortableFetch } from '@/components/recipes/hooks/useAbortableFetch'
import { getUserPreferences } from '@/lib/api/user-preferences'
import type { ApiMappedError as PreferencesApiError } from '@/lib/api/user-preferences'
import { listAllergens } from '@/lib/api/allergens'
import type { ApiMappedError as AllergensApiError } from '@/lib/api/allergens'
import { putUserPreferences } from '@/lib/api/user-preferences'
import type { AllergenOptionVM, UserPreferencesFormValues, UserPreferencesViewState } from './types'
import { UserPreferencesForm } from './UserPreferencesForm'
import type { UpsertUserPreferencesCommand, UserPreferencesDTO } from '@/types'

const UserPreferencesEditPage: React.FC = () => {
  const { fetchWithAbort } = useAbortableFetch()
  const [viewState, setViewState] = React.useState<UserPreferencesViewState>({
    status: 'loading',
  })
  const [allergenOptions, setAllergenOptions] = React.useState<AllergenOptionVM[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const [apiError, setApiError] = React.useState<{ code?: string; message: string } | null>(null)
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null)

  const loadData = React.useCallback(async () => {
    setViewState({ status: 'loading' })
    setAllergenOptions([])

    try {
      const result = await fetchWithAbort((signal) =>
        Promise.allSettled([
          getUserPreferences(signal),
          listAllergens(
            { is_active: true, page: 1, page_size: 50, sort: 'name', order: 'asc' },
            signal,
          ),
        ]),
      )

      const [preferencesResult, allergensResult] = result
      if (allergensResult.status === 'rejected') {
        throw allergensResult.reason
      }

      const mappedAllergens = allergensResult.value.data
        .filter((item) => item.is_active)
        .map((item) => ({
          id: item.id,
          name: item.allergen_name,
          label: item.allergen_name,
          is_active: item.is_active,
        }))

      setAllergenOptions(mappedAllergens)

      if (preferencesResult.status === 'rejected') {
        const mapped = preferencesResult.reason as PreferencesApiError
        if (mapped?.code === 'NOT_FOUND') {
          setViewState({ status: 'not_found' })
          return
        }
        if (mapped?.code === 'UNAUTHORIZED') {
          setViewState({ status: 'unauthorized' })
          return
        }
        setViewState({
          status: 'error',
          error: {
            code: mapped?.code,
            message: mapped?.message ?? 'Wystąpił błąd podczas pobierania preferencji.',
          },
        })
        return
      }

      setViewState({ status: 'ready', data: { dto: preferencesResult.value.data } })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return
      const mapped = error as AllergensApiError
      console.error(error)
      setViewState({
        status: 'error',
        error: {
          code: mapped?.code,
          message: mapped?.message ?? 'Wystąpił błąd podczas pobierania danych.',
        },
      })
    }
  }, [fetchWithAbort])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCancel = React.useCallback(() => {
    window.location.assign('/recipes')
  }, [])

  const handleSubmit = React.useCallback(
    async (cmd: UpsertUserPreferencesCommand) => {
      setIsSaving(true)
      setApiError(null)
      setSaveMessage(null)
      try {
        const response = await putUserPreferences(cmd)
        setViewState({ status: 'ready', data: { dto: response.data } })
        setSaveMessage('Zapisano preferencje.')
        return null
      } catch (error) {
        const mapped = error as PreferencesApiError
        if (mapped?.fieldErrors) {
          return mapped
        }
        setApiError({
          code: mapped?.code,
          message: mapped?.message ?? 'Nie udało się zapisać preferencji.',
        })
        return mapped
      } finally {
        setIsSaving(false)
      }
    },
    [],
  )

  const defaultValues = React.useMemo(
    () => buildDefaultValues(viewState.status === 'ready' ? viewState.data.dto : null),
    [viewState],
  )

  const isDictionaryReady = allergenOptions.length > 0

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8">
      <UserPreferencesEditHeader
        updatedAt={viewState.status === 'ready' ? viewState.data.dto?.updated_at ?? null : null}
      />
      <UserPreferencesEditStates state={viewState} onRetry={loadData} />
      {viewState.status === 'ready' || viewState.status === 'not_found' ? (
        <>
          <UserPreferencesEditBody
            allergensCount={allergenOptions.length}
            isFirstSetup={viewState.status === 'not_found'}
          />
          <UserPreferencesForm
            mode="full"
            defaultValues={defaultValues}
            allergenOptions={allergenOptions}
            isSaving={isSaving}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            apiError={apiError}
            saveMessage={saveMessage}
            disableSubmit={!isDictionaryReady}
          />
        </>
      ) : null}
    </section>
  )
}

export default UserPreferencesEditPage

type UserPreferencesEditHeaderProps = {
  updatedAt?: string | null
}

const UserPreferencesEditHeader: React.FC<UserPreferencesEditHeaderProps> = ({ updatedAt }) => {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Preferencje żywieniowe</h1>
        {updatedAt ? (
          <Badge variant="secondary">Ostatnia aktualizacja: {updatedAt}</Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Wpływają na dostosowania AI i domyślne skalowanie porcji.
      </p>
    </header>
  )
}

type UserPreferencesEditBodyProps = {
  allergensCount: number
  isFirstSetup: boolean
}

const UserPreferencesEditBody: React.FC<UserPreferencesEditBodyProps> = ({
  allergensCount,
  isFirstSetup,
}) => {
  return (
    <div className="mt-6 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {isFirstSetup ? 'Nie masz jeszcze zapisanych preferencji.' : 'Możesz zaktualizować preferencje poniżej.'}
      <div className="mt-2">
        Dostępne alergeny: <span className="font-medium text-foreground">{allergensCount}</span>
      </div>
    </div>
  )
}

type UserPreferencesEditStatesProps = {
  state: UserPreferencesViewState
  onRetry: () => void
}

const UserPreferencesEditStates: React.FC<UserPreferencesEditStatesProps> = ({ state, onRetry }) => {
  if (state.status === 'loading') {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (state.status === 'unauthorized') {
    return (
      <Alert className="mt-6">
        <AlertTitle>Brak dostępu</AlertTitle>
        <AlertDescription>
          Nie można pobrać preferencji użytkownika.
        </AlertDescription>
      </Alert>
    )
  }

  if (state.status === 'error') {
    return (
      <Alert variant="destructive" className="mt-6">
        <AlertTitle>Nie udało się pobrać danych</AlertTitle>
        <AlertDescription className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>{state.error.message}</span>
          <Button variant="secondary" onClick={onRetry}>
            Spróbuj ponownie
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

const buildDefaultValues = (dto: UserPreferencesDTO | null): UserPreferencesFormValues => {
  if (!dto) {
    return {
      allergens: [],
      exclusions: [],
      diet: null,
      target_calories: null,
      target_servings: null,
    }
  }

  return {
    allergens: dto.allergens ?? [],
    exclusions: dto.exclusions ?? [],
    diet: (dto.diet as UserPreferencesFormValues['diet']) ?? null,
    target_calories: dto.target_calories ?? null,
    target_servings: dto.target_servings ?? null,
  }
}
