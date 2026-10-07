// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Musique d'ambiance de Matching, comme celle du Quiz : un fichier choisi
// sur le PC de l'animateur, lu en boucle sur sa sono. Jamais envoyé, jamais
// joué sur /live ni sur les téléphones. À rechoisir à chaque ouverture.

import { useCallback, useEffect, useRef, useState } from 'react'

export interface AmbianceMusic {
  name: string | null
  playing: boolean
  volume: number
  choose: (file: File) => void
  remove: () => void
  /** Reprend depuis le début (lancement d'une partie). */
  restart: () => void
  toggle: () => void
  pause: () => void
  setVolume: (value: number) => void
}

export function useAmbianceMusic(): AmbianceMusic {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.7)
  const volumeRef = useRef(0.7)

  const release = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onplay = null
      audio.onpause = null
      audio.src = ''
      audio.load()
    }
    audioRef.current = null
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
  }, [])

  // Page quittée : la musique s'arrête et la mémoire est libérée.
  useEffect(() => release, [release])

  const choose = useCallback((file: File) => {
    release()
    const url = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = volumeRef.current
    audio.onplay = () => setPlaying(true)
    audio.onpause = () => setPlaying(false)
    audioRef.current = audio
    urlRef.current = url
    setPlaying(false)
    setName(file.name.replace(/\.[^.]+$/, ''))
  }, [release])

  const remove = useCallback(() => {
    release()
    setPlaying(false)
    setName(null)
  }, [release])

  const play = useCallback((fromStart: boolean) => {
    const audio = audioRef.current
    if (!audio) return
    if (fromStart) audio.currentTime = 0
    // Le navigateur exige un geste de l'utilisateur : les boutons en sont un.
    audio.play().catch(() => setPlaying(false))
  }, [])

  const restart = useCallback(() => play(true), [play])
  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) play(false)
    else audio.pause()
  }, [play])
  const pause = useCallback(() => audioRef.current?.pause(), [])

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value))
    volumeRef.current = clamped
    setVolumeState(clamped)
    if (audioRef.current) audioRef.current.volume = clamped
  }, [])

  return { name, playing, volume, choose, remove, restart, toggle, pause, setVolume }
}
