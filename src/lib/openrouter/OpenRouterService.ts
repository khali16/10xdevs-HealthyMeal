import { z } from 'zod'

import {
  EmptyModelResponseError,
  ModelNotAllowedError,
  OpenRouterConfigError,
  OpenRouterHttpError,
  OpenRouterInvalidJsonError,
  OpenRouterNetworkError,
  OpenRouterTimeoutError,
  StructuredOutputInvalidError,
  StructuredOutputNotSupportedError,
} from './errors'
import type {
  CreateChatCompletionInput,
  CreateChatCompletionResult,
  Logger,
  OpenRouterChatCompletionsRequest,
  OpenRouterChatCompletionsResponse,
  OpenRouterConfig,
  OpenRouterDeps,
  StructuredInput,
  TextOnlyInput,
} from './types'
import {
  OPENROUTER_LIMITS,
  modelParamsSchema,
  parseCreateChatCompletionInput,
  responseFormatJsonSchemaSchema,
  validateStructuredOutput,
} from './validation'

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_ATTEMPTS = 3

const NOOP_LOGGER: Required<Logger> = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

export class OpenRouterService {
  public readonly defaultModel: string
  public readonly defaultParams: Readonly<Record<string, unknown>>

  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly appUrl?: string
  private readonly appName?: string
  private readonly timeoutMs: number
  private readonly allowedModels?: Set<string>

  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly logger: Required<Logger>

  constructor(config: OpenRouterConfig, deps?: OpenRouterDeps) {
    if (!config?.apiKey?.trim()) {
      throw new OpenRouterConfigError('Missing OPENROUTER_API_KEY')
    }
    if (!config?.defaultModel?.trim()) {
      throw new OpenRouterConfigError('Missing defaultModel')
    }

    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).trim()
    if (!baseUrl) {
      throw new OpenRouterConfigError('Missing baseUrl')
    }
    try {
      // eslint-disable-next-line no-new
      new URL(baseUrl)
    } catch (cause) {
      throw new OpenRouterConfigError('Invalid baseUrl', { cause })
    }

    const appUrl = config.appUrl?.trim()
    if (appUrl) {
      try {
        // eslint-disable-next-line no-new
        new URL(appUrl)
      } catch (cause) {
        throw new OpenRouterConfigError('Invalid appUrl', { cause })
      }
    }

    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new OpenRouterConfigError('Invalid timeoutMs')
    }

    const allowedModels =
      config.allowedModels?.map((m) => m.trim()).filter(Boolean) ?? undefined
    const allowedModelsSet = allowedModels?.length ? new Set(allowedModels) : undefined
    if (allowedModelsSet && !allowedModelsSet.has(config.defaultModel)) {
      throw new OpenRouterConfigError('defaultModel must be in allowedModels')
    }

    const validatedDefaultParams = modelParamsSchema.parse(config.defaultParams ?? {})

    this.apiKey = config.apiKey
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.appUrl = appUrl
    this.appName = config.appName?.trim() || undefined
    this.timeoutMs = Math.trunc(timeoutMs)
    this.allowedModels = allowedModelsSet

    this.defaultModel = config.defaultModel
    this.defaultParams = Object.freeze({ ...validatedDefaultParams })

    this.fetchImpl = deps?.fetchImpl ?? fetch
    this.now = deps?.now ?? (() => Date.now())
    this.logger = {
      debug: deps?.logger?.debug ?? NOOP_LOGGER.debug,
      info: deps?.logger?.info ?? NOOP_LOGGER.info,
      warn: deps?.logger?.warn ?? NOOP_LOGGER.warn,
      error: deps?.logger?.error ?? NOOP_LOGGER.error,
    }
  }

  public async createChatCompletion(input: CreateChatCompletionInput): Promise<CreateChatCompletionResult> {
    const parsed = parseCreateChatCompletionInput(input)

    const model = parsed.model ?? this.defaultModel
    this.assertModelAllowed(model)

    const params = modelParamsSchema.parse({ ...(this.defaultParams as object), ...(parsed.params ?? {}) })
    const messages = this.buildMessages(parsed)

    const body: OpenRouterChatCompletionsRequest = {
      model,
      messages,
      ...(params as Record<string, unknown>),
      ...(parsed.response_format ? { response_format: parsed.response_format } : {}),
    }

    const startedAt = this.now()
    try {
      const raw = await this.postJson<OpenRouterChatCompletionsResponse>('/chat/completions', body)
      const text = this.extractAssistantText(raw)

      return {
        text,
        raw,
        structured: undefined,
      }
    } finally {
      const elapsedMs = this.now() - startedAt
      this.logger.debug('openrouter.chat_completions.request_complete', {
        elapsedMs,
        model,
        input: this.redactForLogs({ ...parsed, params }),
      })
    }
  }

  public async createChatCompletionText(input: TextOnlyInput): Promise<string> {
    const { response_format: _ignored, ...rest } = input as CreateChatCompletionInput
    const result = await this.createChatCompletion(rest)
    if (!result.text?.trim()) {
      throw new EmptyModelResponseError()
    }
    return result.text
  }

  public async createChatCompletionStructured<T>(input: StructuredInput<T>): Promise<T> {
    // Validate structured contract early
    responseFormatJsonSchemaSchema.parse(input.response_format)
    if (!(input.schema instanceof z.ZodType)) {
      throw new StructuredOutputInvalidError('Missing schema validator')
    }

    const baseInput: CreateChatCompletionInput = {
      systemMessage: input.systemMessage,
      history: input.history,
      userMessage: input.userMessage,
      model: input.model,
      params: input.params,
      response_format: input.response_format,
    }

    const attemptOnce = async (systemMessageOverride?: string): Promise<T> => {
      const nextInput: CreateChatCompletionInput = {
        ...baseInput,
        systemMessage: systemMessageOverride ?? baseInput.systemMessage,
      }

      const res = await this.createChatCompletion(nextInput)
      const structuredRaw = this.safeJsonParse(res.text)
      return validateStructuredOutput(structuredRaw, input.schema)
    }

    try {
      return await attemptOnce()
    } catch (err) {
      // If model ignored structured output, the content is often non-JSON.
      // Try one quick retry with a stricter system prompt.
      const retryable =
        err instanceof OpenRouterInvalidJsonError ||
        err instanceof StructuredOutputInvalidError ||
        err instanceof z.ZodError

      if (!retryable) throw err

      try {
        return await attemptOnce(
          [
            baseInput.systemMessage,
            'Return ONLY valid JSON matching the provided schema. Do not wrap in markdown. Do not add commentary.',
          ]
            .filter(Boolean)
            .join('\n'),
        )
      } catch (err2) {
        if (err2 instanceof z.ZodError) {
          throw new StructuredOutputInvalidError('Structured output validation failed', { cause: err2 })
        }
        if (err2 instanceof OpenRouterInvalidJsonError) {
          throw new StructuredOutputNotSupportedError()
        }
        throw err2
      }
    }
  }

  public async healthCheck(): Promise<{ ok: boolean; details?: string }> {
    try {
      await this.createChatCompletionText({
        systemMessage: 'You are a health check endpoint. Reply with "ok".',
        userMessage: 'ping',
        params: { temperature: 0, max_tokens: 5 },
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, details: this.safeErrorMessage(err) }
    }
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (this.appUrl) headers['HTTP-Referer'] = this.appUrl
    if (this.appName) headers['X-Title'] = this.appName

    return headers
  }

  private assertModelAllowed(model: string): void {
    if (!this.allowedModels) return
    if (this.allowedModels.has(model)) return
    throw new ModelNotAllowedError(model)
  }

  private buildMessages(input: CreateChatCompletionInput): OpenRouterChatCompletionsRequest['messages'] {
    const systemMessage = input.systemMessage?.trim()
    const userMessage = input.userMessage?.trim()
    if (!userMessage) {
      throw new StructuredOutputInvalidError('Missing userMessage')
    }

    const history = (input.history ?? []).slice(-OPENROUTER_LIMITS.maxHistoryMessages)

    const messages = [
      ...(systemMessage ? [{ role: 'system' as const, content: systemMessage }] : []),
      ...history,
      { role: 'user' as const, content: userMessage },
    ]

    // Keep message content within a simple character budget (defense-in-depth).
    // If too long: drop oldest history items first.
    const budget = OPENROUTER_LIMITS.maxMessageChars * 2
    const calcLen = (arr: typeof messages) => arr.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)

    let total = calcLen(messages)
    if (total <= budget) return messages

    const next = [...messages]
    while (next.length > 2 && total > budget) {
      // keep system (idx 0) and last user message
      const dropIdx = systemMessage ? 1 : 0
      next.splice(dropIdx, 1)
      total = calcLen(next)
    }

    return next
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers = this.buildHeaders()
    const startedAt = this.now()

    const maxAttempts = DEFAULT_MAX_ATTEMPTS
    let lastErr: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { payload } = await this.postJsonOnce<T>(url, headers, body)
        return payload
      } catch (err) {
        lastErr = err

        const retryAfterMs = this.retryAfterMs(err)
        const shouldRetry = attempt < maxAttempts && this.isRetryable(err)
        const elapsedMs = this.now() - startedAt

        this.logger.warn('openrouter.request_failed', {
          attempt,
          maxAttempts,
          elapsedMs,
          retryAfterMs,
          error: this.redactForLogs(this.safeErrorObject(err)),
          url,
        })

        if (!shouldRetry) break

        await this.sleep(retryAfterMs ?? this.backoffMs(attempt))
      }
    }

    throw lastErr
  }

  private async postJsonOnce<T>(
    url: string,
    headers: HeadersInit,
    body: unknown,
  ): Promise<{ payload: T; upstreamStatus: number }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const upstreamStatus = res.status

      const rawText = await res.text()
      let json: unknown
      try {
        json = rawText ? JSON.parse(rawText) : {}
      } catch (cause) {
        throw new OpenRouterInvalidJsonError('Upstream returned invalid JSON', { cause })
      }

      if (!res.ok) {
        const { message, code } = this.extractUpstreamError(json)
        throw new OpenRouterHttpError(
          upstreamStatus,
          this.safeUpstreamMessage(upstreamStatus, message),
          { upstreamCode: code, cause: json },
        )
      }

      return { payload: json as T, upstreamStatus }
    } catch (err) {
      if (this.isAbortError(err)) {
        throw new OpenRouterTimeoutError('Upstream timeout', { cause: err })
      }
      if (err instanceof OpenRouterHttpError) throw err
      if (err instanceof OpenRouterInvalidJsonError) throw err
      throw new OpenRouterNetworkError('Upstream network error', { cause: err })
    } finally {
      clearTimeout(timeout)
    }
  }

  private extractAssistantText(raw: OpenRouterChatCompletionsResponse): string {
    const text = raw?.choices?.[0]?.message?.content
    if (typeof text !== 'string') {
      throw new EmptyModelResponseError()
    }
    const trimmed = text.trim()
    if (!trimmed) {
      throw new EmptyModelResponseError()
    }
    return trimmed
  }

  private safeJsonParse(text: string): unknown {
    const candidate = (text ?? '').trim()
    if (!candidate) {
      throw new OpenRouterInvalidJsonError('Structured output was empty')
    }

    try {
      return JSON.parse(candidate)
    } catch {
      // Minimal heuristics: try to extract the first JSON object/array.
      const objStart = candidate.indexOf('{')
      const objEnd = candidate.lastIndexOf('}')
      if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
        const slice = candidate.slice(objStart, objEnd + 1)
        try {
          return JSON.parse(slice)
        } catch (cause) {
          throw new OpenRouterInvalidJsonError('Structured output is not valid JSON', { cause })
        }
      }

      const arrStart = candidate.indexOf('[')
      const arrEnd = candidate.lastIndexOf(']')
      if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
        const slice = candidate.slice(arrStart, arrEnd + 1)
        try {
          return JSON.parse(slice)
        } catch (cause) {
          throw new OpenRouterInvalidJsonError('Structured output is not valid JSON', { cause })
        }
      }

      throw new OpenRouterInvalidJsonError('Structured output is not valid JSON')
    }
  }

  private extractUpstreamError(json: unknown): { message?: string; code?: string } {
    const obj = json as OpenRouterChatCompletionsResponse | undefined
    const message = obj?.error?.message
    const code = obj?.error?.code
    return { message: typeof message === 'string' ? message : undefined, code: typeof code === 'string' ? code : undefined }
  }

  private safeUpstreamMessage(status: number, upstreamMessage?: string): string {
    if (status === 401 || status === 403) return 'Upstream authorization failed'
    if (status === 429) return 'Upstream rate limited'
    if (status >= 500) return 'Upstream service error'
    if (upstreamMessage && upstreamMessage.length <= 200) return upstreamMessage
    return 'Upstream request failed'
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof OpenRouterTimeoutError) return true
    if (err instanceof OpenRouterNetworkError) return true
    if (err instanceof OpenRouterHttpError) {
      if (err.upstreamStatus === 429) return true
      if (err.upstreamStatus >= 500) return true
    }
    return false
  }

  private retryAfterMs(err: unknown): number | null {
    // We don't have headers attached to the error; keep a placeholder for future enhancement.
    // Returning null means we fall back to exponential backoff.
    if (err instanceof OpenRouterHttpError && err.upstreamStatus === 429) return 1_000
    return null
  }

  private backoffMs(attempt: number): number {
    const base = 250 * 2 ** (attempt - 1)
    const jitter = Math.floor(Math.random() * 100)
    return Math.min(5_000, base + jitter)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private isAbortError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      // DOMException in browsers, AbortError in Node fetch
      'name' in err &&
      (err as { name?: unknown }).name === 'AbortError'
    )
  }

  private safeErrorMessage(err: unknown): string {
    if (err instanceof Error && typeof err.message === 'string' && err.message) return err.message
    return 'Unknown error'
  }

  private safeErrorObject(err: unknown): unknown {
    if (err instanceof OpenRouterHttpError) {
      return { name: err.name, code: err.code, status: err.status, upstreamStatus: err.upstreamStatus, upstreamCode: err.upstreamCode, message: err.message }
    }
    if (err instanceof Error) {
      return { name: err.name, message: err.message }
    }
    return { error: String(err) }
  }

  private redactForLogs(input: unknown): unknown {
    // Defensive redaction: never log secrets or full prompts.
    if (!input || typeof input !== 'object') return input
    const obj = input as Record<string, unknown>

    const clone: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes('authorization') || k.toLowerCase().includes('apikey')) {
        clone[k] = '[redacted]'
        continue
      }
      if (k === 'userMessage' && typeof v === 'string') {
        clone[k] = `[redacted:${v.length}]`
        continue
      }
      if (k === 'systemMessage' && typeof v === 'string') {
        clone[k] = `[redacted:${v.length}]`
        continue
      }
      if (k === 'history' && Array.isArray(v)) {
        clone[k] = v.map((m) => {
          const mm = m as Record<string, unknown>
          const content = typeof mm.content === 'string' ? `[redacted:${mm.content.length}]` : mm.content
          return { ...mm, content }
        })
        continue
      }
      clone[k] = v
    }
    return clone
  }
}

