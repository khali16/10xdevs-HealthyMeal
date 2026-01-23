import * as React from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { resetPasswordCommandSchema } from '@/lib/validation/auth'
import { AuthCard } from './AuthCard'
import { AuthFormField } from './AuthFormField'

type ResetPasswordFormValues = z.infer<typeof resetPasswordCommandSchema>

const ResetPasswordPage: React.FC = () => {
  const [isComplete, setIsComplete] = React.useState(false)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordCommandSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onSubmit',
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    void values
    setIsComplete(true)
  })

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
      <AuthCard
        title="Ustaw nowe hasło"
        description="Wybierz nowe hasło, aby odzyskać dostęp do konta."
        footer={
          <Button asChild variant="link" className="px-0">
            <a href="/auth/login">Przejdź do logowania</a>
          </Button>
        }
      >
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {isComplete ? (
              <Alert>
                <AlertTitle>Hasło zostało zaktualizowane</AlertTitle>
                <AlertDescription>Zaloguj się, używając nowego hasła.</AlertDescription>
              </Alert>
            ) : null}

            <AuthFormField<ResetPasswordFormValues>
              name="password"
              label="Nowe hasło"
              type="password"
              autoComplete="new-password"
              description="Hasło powinno mieć co najmniej 8 znaków."
              disabled={form.formState.isSubmitting}
            />
            <AuthFormField<ResetPasswordFormValues>
              name="confirmPassword"
              label="Potwierdź nowe hasło"
              type="password"
              autoComplete="new-password"
              disabled={form.formState.isSubmitting}
            />

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Zapisywanie...' : 'Zapisz nowe hasło'}
            </Button>
          </form>
        </Form>
      </AuthCard>
    </section>
  )
}

export default ResetPasswordPage
