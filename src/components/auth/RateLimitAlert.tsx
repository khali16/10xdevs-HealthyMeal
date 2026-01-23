import * as React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type RateLimitAlertProps = {
  retryAfterSeconds: number
  onExpire?: () => void
}

const formatCountdown = (totalSeconds: number) => {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  if (minutes <= 0) {
    return `${seconds} s`
  }
  return `${minutes} min ${seconds} s`
}

export const RateLimitAlert: React.FC<RateLimitAlertProps> = ({ retryAfterSeconds, onExpire }) => {
  const [remaining, setRemaining] = React.useState(retryAfterSeconds)

  React.useEffect(() => {
    setRemaining(retryAfterSeconds)
    if (retryAfterSeconds <= 0) return

    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0) {
          window.clearInterval(interval)
          onExpire?.()
        }
        return next
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [retryAfterSeconds, onExpire])

  return (
    <Alert variant="destructive">
      <AlertTitle>Zbyt wiele prób logowania</AlertTitle>
      <AlertDescription>
        Spróbuj ponownie za {formatCountdown(remaining)}.
      </AlertDescription>
    </Alert>
  )
}
