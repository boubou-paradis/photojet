// ===========================================
// Hook to get client origin (for QR code URLs)
// ===========================================

'use client'

import { useState, useEffect } from 'react'

export function useClientOrigin(): string {
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  return origin
}

export function getJoinUrl(origin: string, sessionCode: string): string {
  return `${origin}/join/${sessionCode}`
}

export function getPlayUrl(origin: string, sessionId: string): string {
  return `${origin}/play/${sessionId}`
}
