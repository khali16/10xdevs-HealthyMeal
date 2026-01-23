import type { ApiError, ApiSuccess, ChatCompletionRequest, ChatCompletionResponseData } from '@/types'

type ChatResponse = ApiSuccess<ChatCompletionResponseData>

export type ApiMappedError = { code?: string; message: string; fieldErrors?: Record<string, string[]> }

const DEFAULT_ERROR: ApiMappedError = { code: 'INTERNAL', message: 'Unexpected API response' }

export async function postChatCompletion(
  cmd: ChatCompletionRequest,
  opts?: { token?: string; signal?: AbortSignal },
): Promise<ChatResponse> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(cmd),
    signal: opts?.signal,
  })

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw DEFAULT_ERROR
  }

  if (!res.ok) {
    const err = mapApiError(payload)
    throw err
  }

  const typed = payload as ChatResponse
  if (!typed?.data || typeof typed.data.text !== 'string') {
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

