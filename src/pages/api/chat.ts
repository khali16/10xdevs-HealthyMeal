import type { APIRoute } from 'astro'
import { supabaseClient } from '@/db/supabase.client'
import { OpenRouterService } from '@/lib/openrouter/OpenRouterService'
import { isOpenRouterError } from '@/lib/openrouter/errors'
import { createChatCompletionInputSchema } from '@/lib/openrouter/validation'
import type { ApiError, ApiSuccess, ChatCompletionResponseData } from '@/types'

export const prerender = false

const jsonHeaders = { 'Content-Type': 'application/json' }
const DEFAULT_MODEL = 'openai/gpt-4o-mini'

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } } as ApiError),
      { status: 401, headers: jsonHeaders },
    )
  }

  const token = authHeader.substring(7)
  const { data, error } = await supabaseClient.auth.getUser(token)
  if (error || !data.user?.id) {
    return new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } } as ApiError),
      { status: 401, headers: jsonHeaders },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  const parsed = createChatCompletionInputSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      } as ApiError),
      { status: 400, headers: jsonHeaders },
    )
  }

  const service = new OpenRouterService(
    {
      apiKey: import.meta.env.OPENROUTER_API_KEY,
      baseUrl: import.meta.env.OPENROUTER_BASE_URL,
      appUrl: import.meta.env.OPENROUTER_APP_URL,
      appName: import.meta.env.OPENROUTER_APP_NAME ?? 'HealthyMeal',
      defaultModel: DEFAULT_MODEL,
      // Defense-in-depth: keep a strict allowlist until product decides otherwise.
      allowedModels: [DEFAULT_MODEL],
    },
    {
      logger: {
        debug: (msg, meta) => console.debug(msg, meta),
        info: (msg, meta) => console.info(msg, meta),
        warn: (msg, meta) => console.warn(msg, meta),
        error: (msg, meta) => console.error(msg, meta),
      },
    },
  )

  try {
    const result = await service.createChatCompletion(parsed.data)
    const requestId = (result.raw as any)?.id
    const response: ApiSuccess<ChatCompletionResponseData> = {
      data: {
        text: result.text,
        requestId: typeof requestId === 'string' ? requestId : undefined,
        structured: parsed.data.response_format ? safeJsonParseForStructured(result.text) : undefined,
      },
    }

    return new Response(JSON.stringify(response), { status: 200, headers: jsonHeaders })
  } catch (err: unknown) {
    if (isOpenRouterError(err)) {
      const status = err.status ?? 502
      return new Response(
        JSON.stringify({ error: { code: err.code, message: err.message } } as ApiError),
        { status, headers: jsonHeaders },
      )
    }

    console.error('Chat completion failed', { error: err, userId: data.user.id })
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'Internal Server Error' } } as ApiError),
      { status: 500, headers: jsonHeaders },
    )
  }
}

function safeJsonParseForStructured(text: string): unknown {
  const candidate = (text ?? '').trim()
  if (!candidate) {
    throw new Error('Structured output was empty')
  }

  try {
    return JSON.parse(candidate)
  } catch {
    const objStart = candidate.indexOf('{')
    const objEnd = candidate.lastIndexOf('}')
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
      return JSON.parse(candidate.slice(objStart, objEnd + 1))
    }

    const arrStart = candidate.indexOf('[')
    const arrEnd = candidate.lastIndexOf(']')
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
      return JSON.parse(candidate.slice(arrStart, arrEnd + 1))
    }

    throw new Error('Structured output is not valid JSON')
  }
}

