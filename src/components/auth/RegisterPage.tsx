import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { registerCommandSchema } from '@/lib/validation/auth'
import { AuthCard } from './AuthCard'
import { AuthFormField } from './AuthFormField'

type RegisterFormValues = z.infer<typeof registerCommandSchema>

type RegisterPageProps = {
  prefillEmail?: string | null
}

const RegisterPage: React.FC<RegisterPageProps> = ({ prefillEmail }) => {
  const [apiError, setApiError] = React.useState<{ code?: string; message: string } | null>(null)

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerCommandSchema),
    defaultValues: { email: prefillEmail ?? '', password: '', confirmPassword: '' },
    mode: 'onSubmit',
  })

  React.useEffect(() => {
    form.reset({ email: prefillEmail ?? '', password: '', confirmPassword: '' })
  }, [form, prefillEmail])

  const handleSubmit = form.handleSubmit(async (values) => {
    void values
    setApiError(null)
  })

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
      <AuthCard
        title="Załóż konto"
        description="Utwórz konto, aby zapisywać przepisy i preferencje."
        footer={
          <>
            <span>Masz już konto?</span>
            <Button asChild variant="link" className="px-1">
              <a href="/auth/login">Zaloguj się</a>
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {apiError ? (
              <Alert variant="destructive">
                <AlertTitle>Nie udało się utworzyć konta</AlertTitle>
                <AlertDescription>{apiError.message}</AlertDescription>
              </Alert>
            ) : null}

            <AuthFormField<RegisterFormValues>
              name="email"
              label="Email"
              type="email"
              placeholder="twoj@email.com"
              autoComplete="email"
              disabled={form.formState.isSubmitting}
            />
            <AuthFormField<RegisterFormValues>
              name="password"
              label="Hasło"
              type="password"
              autoComplete="new-password"
              description="Hasło powinno mieć co najmniej 8 znaków."
              disabled={form.formState.isSubmitting}
            />
            <AuthFormField<RegisterFormValues>
              name="confirmPassword"
              label="Potwierdź hasło"
              type="password"
              autoComplete="new-password"
              disabled={form.formState.isSubmitting}
            />

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Tworzenie konta...' : 'Załóż konto'}
            </Button>
          </form>
        </Form>
      </AuthCard>
    </section>
  )
}

export default RegisterPage
