'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — liste de manches en préparation : chargée depuis le serveur,
// enregistrée automatiquement 800 ms après la dernière modification (et
// tout de suite si l'onglet se ferme). Le serveur valide chaque envoi.

import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyDraft, type PrepDraft } from '@/lib/buzzer/prep'

const SAVE_DELAY_MS = 800

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useBuzzerPrepDraft(sessionId: string | null) {
  const [draft, setDraftState] = useState<PrepDraft>(emptyDraft)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<DraftSaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const pending = useRef<PrepDraft | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef(sessionId)
  useEffect(() => {
    sessionRef.current = sessionId
  }, [sessionId])

  // Chargement
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setLoaded(false)
    ;(async () => {
      try {
        const res = await fetch(`/api/buzzer/prep?sessionId=${sessionId}`, { cache: 'no-store' })
        const body = (await res.json().catch(() => ({}))) as { draft?: PrepDraft; error?: string }
        if (cancelled) return
        if (res.ok && body.draft) setDraftState(body.draft)
        else setError(body.error ?? 'Liste de manches indisponible.')
      } catch {
        if (!cancelled) setError('Connexion impossible : la liste de manches n’a pas pu être chargée.')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const flush = useCallback(async (keepalive = false) => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const data = pending.current
    const id = sessionRef.current
    if (!data || !id) return
    pending.current = null
    setStatus('saving')
    try {
      const res = await fetch('/api/buzzer/prep', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, draft: data }),
        keepalive,
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatus('error')
        setError(body.error ?? 'Enregistrement impossible.')
        return
      }
      // Une modification arrivée pendant l'envoi repartira au prochain délai.
      if (!pending.current) setStatus('saved')
      setError(null)
    } catch {
      setStatus('error')
      setError('Connexion impossible : modifications non enregistrées.')
      pending.current = pending.current ?? data
    }
  }, [])

  const setDraft = useCallback((update: PrepDraft | ((prev: PrepDraft) => PrepDraft)) => {
    setDraftState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update
      pending.current = next
      return next
    })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }, [flush])

  // Onglet fermé ou page quittée : dernier envoi immédiat.
  useEffect(() => {
    const onHide = () => void flush(true)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      void flush(true)
    }
  }, [flush])

  return { draft, setDraft, loaded, status, error, flush }
}
