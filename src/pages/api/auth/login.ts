import type { APIRoute } from 'astro'
import { loginCommandSchema } from '@/lib/validation/auth'
import type { ApiError } from '@/types'
import { createSupabaseServerInstance, getSupabaseServiceRoleClient } from '@/db/supabase.client'

export const prerender = false

const DEFAULT_RATE_LIMIT_ATTEMPTS = 5
const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 5

type RateLimitConfig = {
  attempts: number
  windowMinutes: number
}

export const POST: APIRoute = async (context) => {
  let payload: unknown
  try {
    payload = await context.request.json()
  } catch {
    return new Response(
      JSON.stringify(<ApiError>{ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parsed = loginCommandSchema.safeParse(payload)
  if (!parsed.success) {
    return new Response(
      JSON.stringify(<ApiError>{
        error: {
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const ipAddress = context.clientAddress ?? '0.0.0.0'
  const userAgent = context.request.headers.get('user-agent') ?? null
  const serviceRole = getSupabaseServiceRoleClient()

  const rateConfig = await readRateLimitConfig(serviceRole)
  const windowMs = rateConfig.windowMinutes * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()

  const { data: failures, error: failuresError } = await serviceRole
    .from('login_attempts')
    .select('created_at')
    .eq('ip_address', ipAddress)
    .eq('success', false)
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (!failuresError && failures && failures.length >= rateConfig.attempts) {
    const oldest = failures[0]?.created_at ? new Date(failures[0].created_at).getTime() : Date.now()
    const retryAfterMs = Math.max(0, oldest + windowMs - Date.now())
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

    return new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMITED',
          message: 'Zbyt wiele prób logowania. Spróbuj ponownie później.',
          retry_after_seconds: retryAfterSeconds,
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  })

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) {
    await recordLoginAttempt(serviceRole, {
      email: parsed.data.email,
      ipAddress,
      success: false,
      failureReason: error?.message ?? 'INVALID_CREDENTIALS',
      userAgent,
    })

    return new Response(
      JSON.stringify(<ApiError>{
        error: { code: 'UNAUTHORIZED', message: 'Nieprawidłowy email lub hasło.' },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await recordLoginAttempt(serviceRole, {
    email: parsed.data.email,
    ipAddress,
    success: true,
    failureReason: null,
    userAgent,
  })

  return new Response(
    JSON.stringify({ data: { user: { id: data.user.id, email: data.user.email } } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

async function readRateLimitConfig(serviceRole: ReturnType<typeof getSupabaseServiceRoleClient>): Promise<RateLimitConfig> {
  const { data, error } = await serviceRole
    .from('system_config')
    .select('config_key, config_value')
    .in('config_key', ['rate_limit_attempts', 'rate_limit_window_minutes'])
    .eq('is_active', true)

  if (error || !data) {
    return {
      attempts: DEFAULT_RATE_LIMIT_ATTEMPTS,
      windowMinutes: DEFAULT_RATE_LIMIT_WINDOW_MINUTES,
    }
  }

  const configMap = new Map<string, unknown>()
  data.forEach((row) => {
    configMap.set(row.config_key, row.config_value)
  })

  const attemptsValue = configMap.get('rate_limit_attempts')
  const windowValue = configMap.get('rate_limit_window_minutes')

  return {
    attempts: coerceNumber(attemptsValue, DEFAULT_RATE_LIMIT_ATTEMPTS),
    windowMinutes: coerceNumber(windowValue, DEFAULT_RATE_LIMIT_WINDOW_MINUTES),
  }
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

async function recordLoginAttempt(
  serviceRole: ReturnType<typeof getSupabaseServiceRoleClient>,
  args: {
    email: string
    ipAddress: string
    success: boolean
    failureReason: string | null
    userAgent: string | null
  },
): Promise<void> {
  const { email, ipAddress, success, failureReason, userAgent } = args
  const { error } = await serviceRole.from('login_attempts').insert({
    email,
    ip_address: ipAddress,
    success,
    failure_reason: failureReason,
    user_agent: userAgent,
  })

  if (error) {
    console.error('Failed to record login attempt', error)
  }
}
