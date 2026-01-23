import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Podaj adres email.')
  .email('Podaj poprawny adres email.')

const passwordRequiredSchema = z.string().min(1, 'Podaj hasło.')

const passwordSchema = z.string().min(8, 'Hasło musi mieć co najmniej 8 znaków.')

export const loginCommandSchema = z.object({
  email: emailSchema,
  password: passwordRequiredSchema,
})

export const registerCommandSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Potwierdź hasło.'),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Hasła muszą być takie same.',
      })
    }
  })

export const forgotPasswordCommandSchema = z.object({
  email: emailSchema,
})

export const resetPasswordCommandSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Potwierdź hasło.'),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Hasła muszą być takie same.',
      })
    }
  })
