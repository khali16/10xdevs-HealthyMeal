import * as React from 'react'

type Fetcher<T> = (signal: AbortSignal) => Promise<T>

export function useAbortableFetch() {
  const controllerRef = React.useRef<AbortController | null>(null)

  const abort = React.useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
  }, [])

  const fetchWithAbort = React.useCallback(
    async <T,>(fetcher: Fetcher<T>): Promise<T> => {
      abort()
      const controller = new AbortController()
      controllerRef.current = controller
      try {
        const result = await fetcher(controller.signal)
        return result
      } finally {
        // Clear reference only if we are still the active controller
        if (controllerRef.current === controller) {
          controllerRef.current = null
        }
      }
    },
    [abort],
  )

  React.useEffect(() => abort, [abort])

  return { fetchWithAbort, abort }
}

