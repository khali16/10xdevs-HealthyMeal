import type { ApiError, ApiSuccess, UpsertUserPreferencesCommand, UserPreferencesDTO } from '@/types'

type UserPreferencesResponse = { data: UserPreferencesDTO }

export type ApiMappedError = { code?: string; message: string; fieldErrors?: Record<string, string[]> }

const DEFAULT_ERROR: ApiMappedError = { code: 'INTERNAL', message: 'Unexpected API response' }

export async function getUserPreferences(
  signal?: AbortSignal,
): Promise<UserPreferencesResponse> {
  const res = await fetch('/api/user/preferences', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  if (!res.ok) {
    let err = mapApiError(payload)
    if (res.status === 404) {
      err = { ...err, code: err.code ?? 'NOT_FOUND' }
    }
    if (res.status === 401) {
      err = { ...err, code: err.code ?? 'UNAUTHORIZED' }
    }
    throw err
  }

  const typed = payload as UserPreferencesResponse
  if (!typed?.data) {
    throw DEFAULT_ERROR
  }

  return typed
}

export async function putUserPreferences(
  cmd: UpsertUserPreferencesCommand,
): Promise<UserPreferencesResponse> {
  const res = await fetch('/api/user/preferences', {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  if (!res.ok) {
    let err = mapApiError(payload)
    if (res.status === 401) {
      err = { ...err, code: err.code ?? 'UNAUTHORIZED' }
    }
    if (res.status === 400 || res.status === 422) {
      err = { ...err, code: err.code ?? 'BAD_REQUEST' }
    }
    throw err
  }

  const typed = payload as UserPreferencesResponse
  if (!typed?.data) {
    throw DEFAULT_ERROR
  }

  return typed
}

function mapApiError(payload: unknown): ApiMappedError {
  const apiErr = payload as ApiError | undefined
  if (apiErr?.error?.message) {
    return {
      code: apiErr.error.code,
      message: apiErr.error.message,
      fieldErrors: apiErr.error.fieldErrors,
    }
  }
  return DEFAULT_ERROR
}
