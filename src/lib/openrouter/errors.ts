export type OpenRouterErrorCode =
  | 'OPENROUTER_CONFIG'
  | 'OPENROUTER_MODEL_NOT_ALLOWED'
  | 'OPENROUTER_TIMEOUT'
  | 'OPENROUTER_NETWORK'
  | 'OPENROUTER_HTTP'
  | 'OPENROUTER_INVALID_JSON'
  | 'OPENROUTER_EMPTY_RESPONSE'
  | 'OPENROUTER_STRUCTURED_INVALID'
  | 'OPENROUTER_STRUCTURED_NOT_SUPPORTED'

/**
 * Base error type for OpenRouter integration.
 * Message should be "safe" (no secrets, no raw prompts).
 */
export class OpenRouterError extends Error {
  public readonly code: OpenRouterErrorCode
  public readonly status?: number
  public readonly cause?: unknown

  constructor(
    code: OpenRouterErrorCode,
    message: string,
    opts?: { status?: number; cause?: unknown },
  ) {
    super(message)
    this.name = 'OpenRouterError'
    this.code = code
    this.status = opts?.status
    this.cause = opts?.cause
  }
}

export class OpenRouterConfigError extends OpenRouterError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super('OPENROUTER_CONFIG', message, { status: 500, cause: opts?.cause })
    this.name = 'OpenRouterConfigError'
  }
}

export class ModelNotAllowedError extends OpenRouterError {
  public readonly model: string

  constructor(model: string) {
    super('OPENROUTER_MODEL_NOT_ALLOWED', 'Model not allowed', { status: 403 })
    this.name = 'ModelNotAllowedError'
    this.model = model
  }
}

export class OpenRouterTimeoutError extends OpenRouterError {
  constructor(message = 'Upstream timeout', opts?: { cause?: unknown }) {
    super('OPENROUTER_TIMEOUT', message, { status: 504, cause: opts?.cause })
    this.name = 'OpenRouterTimeoutError'
  }
}

export class OpenRouterNetworkError extends OpenRouterError {
  constructor(message = 'Upstream network error', opts?: { cause?: unknown }) {
    super('OPENROUTER_NETWORK', message, { status: 502, cause: opts?.cause })
    this.name = 'OpenRouterNetworkError'
  }
}

export class OpenRouterHttpError extends OpenRouterError {
  public readonly upstreamStatus: number
  public readonly upstreamCode?: string

  constructor(
    upstreamStatus: number,
    message: string,
    opts?: { upstreamCode?: string; cause?: unknown },
  ) {
    // Map common cases to stable API statuses; keep "safe" message.
    const status =
      upstreamStatus === 401 || upstreamStatus === 403
        ? 502
        : upstreamStatus === 429
          ? 429
          : upstreamStatus >= 500
            ? 502
            : 502

    super('OPENROUTER_HTTP', message, { status, cause: opts?.cause })
    this.name = 'OpenRouterHttpError'
    this.upstreamStatus = upstreamStatus
    this.upstreamCode = opts?.upstreamCode
  }
}

export class OpenRouterInvalidJsonError extends OpenRouterError {
  constructor(message = 'Upstream returned invalid JSON', opts?: { cause?: unknown }) {
    super('OPENROUTER_INVALID_JSON', message, { status: 502, cause: opts?.cause })
    this.name = 'OpenRouterInvalidJsonError'
  }
}

export class EmptyModelResponseError extends OpenRouterError {
  constructor(message = 'Empty model response') {
    super('OPENROUTER_EMPTY_RESPONSE', message, { status: 502 })
    this.name = 'EmptyModelResponseError'
  }
}

export class StructuredOutputInvalidError extends OpenRouterError {
  constructor(message = 'Structured output invalid', opts?: { cause?: unknown }) {
    super('OPENROUTER_STRUCTURED_INVALID', message, { status: 502, cause: opts?.cause })
    this.name = 'StructuredOutputInvalidError'
  }
}

export class StructuredOutputNotSupportedError extends OpenRouterError {
  constructor(message = 'Structured output not supported') {
    super('OPENROUTER_STRUCTURED_NOT_SUPPORTED', message, { status: 502 })
    this.name = 'StructuredOutputNotSupportedError'
  }
}

export function isOpenRouterError(err: unknown): err is OpenRouterError {
  return err instanceof OpenRouterError
}

