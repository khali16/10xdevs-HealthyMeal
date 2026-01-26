import * as React from 'react'
import type { FieldValues, Path } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

type AuthFormFieldProps<TFieldValues extends FieldValues> = {
  name: Path<TFieldValues>
  label: string
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
  autoComplete?: string
  description?: string
  disabled?: boolean
}

export const AuthFormField = <TFieldValues extends FieldValues>({
  name,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  description,
  disabled,
}: AuthFormFieldProps<TFieldValues>) => {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              autoComplete={autoComplete}
              disabled={disabled}
              value={field.value ?? ''}
              data-testid={`auth-input-${name}`}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
