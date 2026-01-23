import type { z } from 'zod'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ModelParams = {
  temperature?: number
  max_tokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
  stop?: string | string[]
}

export type OpenRouterResponseFormatJsonSchema = {
  type: 'json_schema'
  json_schema: {
    name: string
    strict: true
    schema: Record<string, unknown>
  }
}

export type OpenRouterResponseFormat = OpenRouterResponseFormatJsonSchema

export type CreateChatCompletionInput = {
  systemMessage?: string
  history?: ChatMessage[]
  userMessage: string

  model?: string
  params?: ModelParams

  /**
   * Structured output support via OpenRouter's OpenAI-compatible API.
   * When present, the model is expected to return JSON in assistant message content.
   */
  response_format?: OpenRouterResponseFormat
}

export type CreateChatCompletionResult = {
  text: string
  raw: unknown
  structured?: unknown
}

export type TextOnlyInput = Omit<CreateChatCompletionInput, 'response_format'>

export type StructuredInput<T> = Omit<CreateChatCompletionInput, 'response_format'> & {
  response_format: OpenRouterResponseFormatJsonSchema
  schema: z.ZodType<T>
}

export type Logger = {
  debug?: (msg: string, meta?: unknown) => void
  info?: (msg: string, meta?: unknown) => void
  warn?: (msg: string, meta?: unknown) => void
  error?: (msg: string, meta?: unknown) => void
}

export type OpenRouterConfig = {
  apiKey: string
  baseUrl?: string
  appUrl?: string
  appName?: string

  defaultModel: string
  defaultParams?: ModelParams
  timeoutMs?: number
  allowedModels?: string[]
}

export type OpenRouterDeps = {
  fetchImpl?: typeof fetch
  now?: () => number
  logger?: Logger
}

/**
 * Minimal OpenAI-compatible chat completion request.
 * See: POST /chat/completions
 */
export type OpenRouterChatCompletionsRequest = {
  model: string
  messages: ChatMessage[]
  response_format?: OpenRouterResponseFormat
} & ModelParams

export type OpenRouterChatCompletionsResponse = {
  id?: string
  choices?: Array<{
    index?: number
    message?: { role?: string; content?: string }
    finish_reason?: string
  }>
  error?: { message?: string; type?: string; code?: string }
}

