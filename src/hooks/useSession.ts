'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'

export function useSession(code: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchSession() {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single()

        if (error) throw error
        setSession(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Session not found')
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchSession()
    }
  }, [code, supabase])

  return { session, loading, error }
}
