import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { loginCommandSchema } from '@/lib/validation/auth'
import { AuthCard } from './AuthCard'
import { AuthFormField } from './AuthFormField'
import { RateLimitAlert } from './RateLimitAlert'

type LoginFormValues = z.infer<typeof loginCommandSchema>

type LoginPageProps = {
  returnTo?: string | null
  prefillEmail?: string | null
}

const LoginPage: React.FC<LoginPageProps> = ({ returnTo, prefillEmail }) => {
  const [apiError, setApiError] = React.useState<{ code?: string; message: string } | null>(null)
  const [rateLimitSeconds, setRateLimitSeconds] = React.useState<number | null>(null)
  const [isOauthLoading, setIsOauthLoading] = React.useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginCommandSchema),
    defaultValues: { email: prefillEmail ?? '', password: '' },
    mode: 'onSubmit',
  })

  React.useEffect(() => {
    form.reset({ email: prefillEmail ?? '', password: '' })
  }, [form, prefillEmail])

  const emailValue = form.watch('email')
  const passwordValue = form.watch('password')

  const handleRateLimitExpired = React.useCallback(() => {
    setRateLimitSeconds(null)
  }, [])

  const handleSubmit = form.handleSubmit(async (values) => {
    setApiError(null)
    setRateLimitSeconds(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const retryAfterSeconds =
          typeof payload?.error?.retry_after_seconds === 'number'
            ? payload.error.retry_after_seconds
            : null
        if (res.status === 429 && retryAfterSeconds) {
          setRateLimitSeconds(retryAfterSeconds)
        }
        const message =
          typeof payload?.error?.message === 'string'
            ? payload.error.message
            : 'Nie udało się zalogować.'
        setApiError({ code: payload?.error?.code, message })
        return
      }

      window.location.assign(returnTo ?? '/recipes')
    } catch {
      setApiError({ message: 'Nie udało się połączyć z serwerem. Spróbuj ponownie.' })
    }
  })

  const isRateLimited = typeof rateLimitSeconds === 'number' && rateLimitSeconds > 0
  const isMissingCredentials = !emailValue?.trim() || !passwordValue?.trim()
  const isSubmitDisabled = form.formState.isSubmitting || isRateLimited || isMissingCredentials

  const handleGoogleLogin = React.useCallback(async () => {
    setApiError(null)
    setIsOauthLoading(true)
    try {
      const res = await fetch('/api/auth/oauth/google', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnTo }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.data?.url) {
        const message =
          typeof payload?.error?.message === 'string'
            ? payload.error.message
            : 'Nie udało się rozpocząć logowania przez Google.'
        setApiError({ code: payload?.error?.code, message })
        return
      }
      window.location.assign(payload.data.url)
    } catch {
      setApiError({ message: 'Nie udało się połączyć z serwerem. Spróbuj ponownie.' })
    } finally {
      setIsOauthLoading(false)
    }
  }, [returnTo])

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6" data-testid="login-page">
      <AuthCard
        title="Zaloguj się"
        description="Wprowadź adres email i hasło, aby kontynuować."
        footer={
          <>
            <span>Nie masz konta?</span>
            <Button asChild variant="link" className="px-1">
              <a href="/auth/register">Załóż konto</a>
            </Button>
          </>
        }
      >
        {returnTo ? (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Po zalogowaniu wrócisz do:{' '}
            <span className="font-medium text-foreground">{returnTo}</span>
          </div>
        ) : null}

        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit} data-testid="login-form">
            {apiError ? (
              <Alert variant="destructive" data-testid="login-error-alert">
                <AlertTitle>Nie udało się zalogować</AlertTitle>
                <AlertDescription>{apiError.message}</AlertDescription>
              </Alert>
            ) : null}

            {isRateLimited && rateLimitSeconds ? (
              <RateLimitAlert
                retryAfterSeconds={rateLimitSeconds}
                onExpire={handleRateLimitExpired}
              />
            ) : null}

            <AuthFormField<LoginFormValues>
              name="email"
              label="Email"
              type="email"
              placeholder="twoj@email.com"
              autoComplete="email"
              disabled={form.formState.isSubmitting}
            />
            <AuthFormField<LoginFormValues>
              name="password"
              label="Hasło"
              type="password"
              autoComplete="current-password"
              disabled={form.formState.isSubmitting}
            />

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={form.formState.isSubmitting || isOauthLoading}
              data-testid="login-google-button"
            >
              {isOauthLoading ? 'Łączenie z Google...' : 'Zaloguj się z Google'}
            </Button>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" disabled={isSubmitDisabled} data-testid="login-submit-button">
                {form.formState.isSubmitting ? 'Logowanie...' : 'Zaloguj się'}
              </Button>
              <Button asChild variant="link" size="sm" className="px-0">
                <a href="/auth/forgot-password">Nie pamiętam hasła</a>
              </Button>
            </div>
          </form>
        </Form>
      </AuthCard>
    </section>
  )
}

export default LoginPage
