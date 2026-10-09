// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Sons d'AnimaBuzz, joués sur le PC animateur seulement (la sono) : jamais
// sur l'écran géant ni sur les téléphones. Sons CC0 par défaut
// (public/sounds/buzzer, crédits dans CREDITS.txt), remplaçables par
// l'animateur : le fichier reste dans CE navigateur (IndexedDB), rien n'est
// envoyé au serveur. Sons coupables d'un clic (choix mémorisé).

import { useCallback, useEffect, useRef, useState } from 'react'

export type BuzzerSoundId = 'open' | 'buzz' | 'right' | 'wrong' | 'round'

export const BUZZER_SOUNDS: { id: BuzzerSoundId; label: string; file: string }[] = [
  { id: 'open', label: 'Ouverture des buzzers', file: '/sounds/buzzer/ouverture-ninja.mp3' },
  { id: 'buzz', label: 'Buzz', file: '/sounds/buzzer/buzz-poulet.wav' },
  { id: 'right', label: 'Bonne réponse', file: '/sounds/buzzer/bonne-reponse.mp3' },
  { id: 'wrong', label: 'Mauvaise réponse', file: '/sounds/buzzer/mauvaise-reponse.mp3' },
  { id: 'round', label: 'Nouvelle manche', file: '/sounds/buzzer/nouvelle-manche.mp3' },
]

const ENABLED_KEY = 'animabuzz-sounds-on'
const DB_NAME = 'animabuzz'
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

export interface BuzzerSounds {
  enabled: boolean
  setEnabled: (on: boolean) => void
  /** Nom du fichier personnel par son (absent = son par défaut). */
  custom: Partial<Record<BuzzerSoundId, string>>
  play: (id: BuzzerSoundId) => void
  replace: (id: BuzzerSoundId, file: File) => Promise<string | null>
  reset: (id: BuzzerSoundId) => Promise<void>
}

export function useBuzzerSounds(): BuzzerSounds {
  const [enabled, setEnabledState] = useState(true)
  const [custom, setCustom] = useState<Partial<Record<BuzzerSoundId, string>>>({})
  const urls = useRef<Partial<Record<BuzzerSoundId, string>>>({})
  const players = useRef<Partial<Record<BuzzerSoundId, HTMLAudioElement>>>({})
  const enabledRef = useRef(true)

  const prepare = useCallback((id: BuzzerSoundId) => {
    const src = urls.current[id] ?? BUZZER_SOUNDS.find((s) => s.id === id)!.file
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
      const names: Partial<Record<BuzzerSoundId, string>> = {}
      for (const s of BUZZER_SOUNDS) {
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
    try { window.localStorage.setItem(ENABLED_KEY, on ? '1' : '0') } catch { /* idem */ }
  }, [])

  const play = useCallback((id: BuzzerSoundId) => {
    if (!enabledRef.current) return
    // Jamais deux effets en même temps : on coupe celui qui joue encore.
    for (const audio of Object.values(players.current)) {
      if (audio && !audio.paused) audio.pause()
    }
    const audio = players.current[id]
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch(() => { /* lecture refusée (aucun clic sur la page) : sans conséquence */ })
  }, [])

  const replace = useCallback(async (id: BuzzerSoundId, file: File): Promise<string | null> => {
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

  const reset = useCallback(async (id: BuzzerSoundId) => {
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
