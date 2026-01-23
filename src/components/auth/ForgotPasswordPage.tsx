import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { forgotPasswordCommandSchema } from '@/lib/validation/auth'
import { AuthCard } from './AuthCard'
import { AuthFormField } from './AuthFormField'

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordCommandSchema>

type ForgotPasswordPageProps = {
  prefillEmail?: string | null
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ prefillEmail }) => {
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordCommandSchema),
    defaultValues: { email: prefillEmail ?? '' },
    mode: 'onSubmit',
  })

  React.useEffect(() => {
    form.reset({ email: prefillEmail ?? '' })
  }, [form, prefillEmail])

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmittedEmail(values.email)
  })

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
      <AuthCard
        title="Nie pamiętam hasła"
        description="Podaj adres email, a wyślemy link do resetu hasła."
        footer={
          <Button asChild variant="link" className="px-0">
            <a href="/auth/login">Wróć do logowania</a>
          </Button>
        }
      >
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {submittedEmail ? (
              <Alert>
                <AlertTitle>Sprawdź skrzynkę mailową</AlertTitle>
                <AlertDescription>
                  Jeśli konto istnieje, wyślemy link do resetu hasła na adres{' '}
                  <span className="font-medium text-foreground">{submittedEmail}</span>.
                </AlertDescription>
              </Alert>
            ) : null}

            <AuthFormField<ForgotPasswordFormValues>
              name="email"
              label="Email"
              type="email"
              placeholder="twoj@email.com"
              autoComplete="email"
              disabled={form.formState.isSubmitting}
            />

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Wysyłanie...' : 'Wyślij link'}
            </Button>
          </form>
        </Form>
      </AuthCard>
    </section>
  )
}

export default ForgotPasswordPage
