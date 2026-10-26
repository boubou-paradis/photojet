// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Sons d'AnimaVote, joués sur le PC animateur seulement (la sono) : jamais
// sur l'écran géant ni sur les téléphones. Sons CC0 par défaut
// (public/sounds/vote, crédits dans CREDITS.txt), remplaçables par
// l'animateur : le fichier reste dans CE navigateur (IndexedDB), rien n'est
// envoyé au serveur. Sons coupables d'un clic (choix mémorisé).
// Même fonctionnement que les sons d'AnimaBuzz, avec son propre stockage.

import { useCallback, useEffect, useRef, useState } from 'react'

export type VoteSoundId = 'open' | 'tick' | 'close' | 'drumroll' | 'winner'

export const VOTE_SOUNDS: { id: VoteSoundId; label: string; file: string }[] = [
  { id: 'open', label: 'Ouverture du vote', file: '/sounds/vote/ouverture-carillon.mp3' },
  { id: 'tick', label: 'Tic du compte à rebours', file: '/sounds/vote/tic.mp3' },
  { id: 'close', label: 'Fermeture du vote', file: '/sounds/vote/fermeture-gong.mp3' },
  { id: 'drumroll', label: 'Révélation (roulement)', file: '/sounds/vote/roulement-tambour.mp3' },
  { id: 'winner', label: 'Gagnant', file: '/sounds/vote/fanfare-gagnant.mp3' },
]

const ENABLED_KEY = 'animavote-sounds-on'
const DB_NAME = 'animavote'
const STORE = 'sounds'
export const MAX_SOUND_BYTES = 3 * 1024 * 1024

interface StoredSound {
  name: string
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbRun<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export interface VoteSounds {
  enabled: boolean
  setEnabled: (on: boolean) => void
  /** Nom du fichier personnel par son (absent = son par défaut). */
  custom: Partial<Record<VoteSoundId, string>>
  play: (id: VoteSoundId) => void
  replace: (id: VoteSoundId, file: File) => Promise<string | null>
  reset: (id: VoteSoundId) => Promise<void>
}

export function useVoteSounds(): VoteSounds {
  const [enabled, setEnabledState] = useState(true)
  const [custom, setCustom] = useState<Partial<Record<VoteSoundId, string>>>({})
  const urls = useRef<Partial<Record<VoteSoundId, string>>>({})
  const players = useRef<Partial<Record<VoteSoundId, HTMLAudioElement>>>({})
  const enabledRef = useRef(true)

  const prepare = useCallback((id: VoteSoundId) => {
    const src = urls.current[id] ?? VOTE_SOUNDS.find((s) => s.id === id)!.file
    const audio = new Audio(src)
    audio.preload = 'auto'
    players.current[id] = audio
  }, [])

  // Préférence et sons personnels de ce PC (lus après le montage).
  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []
    ;(async () => {
      try {
        const stored = window.localStorage.getItem(ENABLED_KEY)
        if (stored === '0' && !cancelled) {
          enabledRef.current = false
          setEnabledState(false)
        }
      } catch { /* stockage indisponible : sons actifs */ }
      const names: Partial<Record<VoteSoundId, string>> = {}
      for (const s of VOTE_SOUNDS) {
        try {
          const saved = await dbRun<StoredSound | undefined>('readonly', (store) => store.get(s.id))
          if (saved?.blob) {
            const url = URL.createObjectURL(saved.blob)
            objectUrls.push(url)
            urls.current[s.id] = url
            names[s.id] = saved.name
          }
        } catch { /* IndexedDB indisponible : sons par défaut */ }
        prepare(s.id)
      }
      if (!cancelled) setCustom(names)
    })()
    return () => {
      cancelled = true
      objectUrls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [prepare])

  const setEnabled = useCallback((on: boolean) => {
    enabledRef.current = on
    setEnabledState(on)
    if (!on) for (const audio of Object.values(players.current)) audio?.pause()
    try { window.localStorage.setItem(ENABLED_KEY, on ? '1' : '0') } catch { /* idem */ }
  }, [])

  const play = useCallback((id: VoteSoundId) => {
    if (!enabledRef.current) return
    // Jamais deux effets en même temps : on coupe celui qui joue encore
    // (le roulement s'arrête net quand la fanfare part).
    for (const audio of Object.values(players.current)) {
      if (audio && !audio.paused) audio.pause()
    }
    const audio = players.current[id]
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => { /* lecture refusée (aucun clic sur la page) : sans conséquence */ })
  }, [])

  const replace = useCallback(async (id: VoteSoundId, file: File): Promise<string | null> => {
    if (!file.type.startsWith('audio/')) return 'Choisissez un fichier audio (MP3, WAV, M4A…).'
    if (file.size > MAX_SOUND_BYTES) return 'Fichier trop lourd : 3 Mo au maximum pour un effet sonore.'
    try {
      await dbRun('readwrite', (store) => store.put({ name: file.name, blob: file } satisfies StoredSound, id))
    } catch {
      return 'Impossible d’enregistrer ce son dans ce navigateur.'
    }
    const old = urls.current[id]
    if (old) URL.revokeObjectURL(old)
    urls.current[id] = URL.createObjectURL(file)
    prepare(id)
    setCustom((c) => ({ ...c, [id]: file.name }))
    return null
  }, [prepare])

  const reset = useCallback(async (id: VoteSoundId) => {
    try { await dbRun('readwrite', (store) => store.delete(id)) } catch { /* déjà absent */ }
    const old = urls.current[id]
    if (old) URL.revokeObjectURL(old)
    delete urls.current[id]
    prepare(id)
    setCustom((c) => {
      const next = { ...c }
      delete next[id]
      return next
    })
  }, [prepare])

  return { enabled, setEnabled, custom, play, replace, reset }
}
