import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type AuthCardProps = {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export const AuthCard: React.FC<AuthCardProps> = ({ title, description, children, footer }) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t text-sm text-muted-foreground">{footer}</CardFooter>
      ) : null}
    </Card>
  )
}
