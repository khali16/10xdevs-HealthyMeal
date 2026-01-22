import * as React from 'react'
import { supabaseClient } from '@/db/supabase.client'

type SupabaseAccessTokenState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'ready'; accessToken: string }

export const useSupabaseAccessToken = () => {
  const [state, setState] = React.useState<SupabaseAccessTokenState>({ status: 'loading' })

  React.useEffect(() => {
    let isMounted = true

    const loadToken = async () => {
      try {
        const { data, error } = await supabaseClient.auth.getSession()
        if (!isMounted) return
        if (error || !data.session?.access_token) {
          setState({ status: 'unauthorized' })
          return
        }
        setState({ status: 'ready', accessToken: data.session.access_token })
      } catch {
        if (!isMounted) return
        setState({ status: 'unauthorized' })
      }
    }

    void loadToken()

    return () => {
      isMounted = false
    }
  }, [])

  return state
}
