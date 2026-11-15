'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Sons d'À Demi-Mot, joués par la RÉGIE (PC animateur) uniquement : jamais
// sur les téléphones ni sur une page invitée. Synthèse locale (aucun fichier).
// Le navigateur exige un geste avant tout son : le premier clic ou la
// première touche dans la régie active l'audio (le bouton « Lancer » suffit).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent } from '@/lib/demimot/engine'
import { countdownDeadline, tickFor, toSoundEvents } from '@/lib/demimot/sounds'
import type { PublicView } from '@/lib/demimot/view'
import { audioReady, play, playBuzz, playEvents, readSound, setVolume, unlock, writeSound, type BuzzStyle, type SoundName, type SoundPrefs } from '@/components/demimot/sfx'

export interface DemiMotSounds {
  prefs: SoundPrefs
  ready: boolean
  setOn: (on: boolean) => void
  setVolumeLevel: (volume: number) => void
  setBuzz: (buzz: BuzzStyle) => void
  test: (name: SoundName | 'buzz-style', style?: BuzzStyle) => void
  onEvents: (events: readonly GameEvent[] | undefined) => void
}

export function useDemiMotSounds(view: PublicView | null, clockOffsetMs: number): DemiMotSounds {
  const [prefs, setPrefs] = useState<SoundPrefs>(readSound)
  const [ready, setReady] = useState(false)
  const prefsRef = useRef(prefs)
  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])

  // Premier geste dans la page : on débloque l'audio (une seule fois).
  useEffect(() => {
    if (ready) return
    const arm = () => {
      void unlock(prefsRef.current.volume).then((ok) => setReady(ok))
    }
    window.addEventListener('pointerdown', arm, { once: true })
    window.addEventListener('keydown', arm, { once: true })
    return () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [ready])

  const onEvents = useCallback((events: readonly GameEvent[] | undefined) => {
    if (!prefsRef.current.on || !audioReady()) return
    const names = toSoundEvents(events)
    if (names.length) playEvents(names)
  }, [])

  // Tic-tac des 5 dernières secondes (réponse, dernière chance, tour de lettres).
  const deadline = countdownDeadline(view)
  const lastTick = useRef<string | null>(null)
  useEffect(() => {
    if (!deadline || !prefs.on) return
    const t = window.setInterval(() => {
      if (!audioReady()) return
      const now = Date.now() + clockOffsetMs
      const kind = tickFor(deadline, now)
      const key = `${deadline}:${Math.ceil((deadline - now) / 1000)}`
      if (kind && lastTick.current !== key) {
        lastTick.current = key
        play(kind)
      }
    }, 50)
    return () => window.clearInterval(t)
  }, [deadline, clockOffsetMs, prefs.on])

  const update = useCallback((patch: Partial<SoundPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }))
    writeSound(patch)
  }, [])

  return {
    prefs,
    ready,
    setOn: (on) => update({ on }),
    setVolumeLevel: (volume) => {
      setVolume(volume)
      update({ volume })
    },
    setBuzz: (buzz) => update({ buzz }),
    test: (name, style) => {
      void unlock(prefsRef.current.volume).then((ok) => {
        setReady(ok)
        if (!ok) return
        if (name === 'buzz-style') playBuzz(style ?? prefsRef.current.buzz)
        else play(name)
      })
    },
    onEvents,
  }
}
