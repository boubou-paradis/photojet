'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — extrait audio d'une manche préparée, joué sur le PC de
// l'animateur (la sono), jamais sur l'écran géant ni les téléphones.
// Joué entre le début et la fin de la découpe : arrêt automatique à la fin.
// La page décide quand jouer (lancement), couper (buzz) et reprendre
// (mauvaise réponse) ; l'animateur garde Pause / Lecture / Rejouer.

import { useCallback, useEffect, useRef, useState } from 'react'
import { buzzerMediaUrl } from '@/lib/buzzer/media-client'

const VOLUME_KEY = 'animabuzz-extract-volume'

export interface ExtractSource {
  path: string
  start: number | null
  end: number | null
}

export interface PrepExtract {
  /** Extrait chargé (null : la manche n'a pas d'audio). */
  source: ExtractSource | null
  playing: boolean
  /** Position dans l'extrait (s, depuis le début de la découpe) et durée de l'extrait. */
  position: number
  length: number | null
  ended: boolean
  error: boolean
  volume: number
  setVolume: (v: number) => void
  load: (source: ExtractSource | null) => void
  /** Préchargement (manche suivante) : rien n'est joué. */
  preload: (path: string | null) => void
  playFromStart: () => void
  resume: () => void
  pause: () => void
  stop: () => void
}

function readVolume(): number {
  try {
    const v = Number(window.localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.9
  } catch {
    return 0.9
  }
}

export function usePrepExtract(): PrepExtract {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const preloadRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<ExtractSource | null>(null)
  const [source, setSource] = useState<ExtractSource | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState(false)
  const [volume, setVolumeState] = useState(0.9)

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.volume = readVolume()
      audioRef.current = audio
    }
    return audioRef.current
  }, [])

  useEffect(() => {
    const audio = getAudio()
    // Volume mémorisé, affiché hors du corps de l'effet.
    const first = setTimeout(() => setVolumeState(audio.volume), 0)
    const startOf = () => sourceRef.current?.start ?? 0
    const endOf = () => sourceRef.current?.end ?? (Number.isFinite(audio.duration) ? audio.duration : null)
    const onTime = () => {
      const end = endOf()
      if (end !== null && audio.currentTime >= end - 0.02 && !audio.paused) {
        audio.pause()
        setEnded(true)
      }
      setPosition(Math.max(0, audio.currentTime - startOf()))
    }
    const onMeta = () => {
      const end = endOf()
      setDuration(end !== null ? Math.max(0, end - startOf()) : null)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setEnded(true)
    }
    const onError = () => {
      if (sourceRef.current) setError(true)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    // timeupdate ne tombe que ~4 fois par seconde : arrêt précis à la fin de la découpe.
    const timer = setInterval(() => {
      if (!audio.paused) onTime()
    }, 100)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
    }
  }, [getAudio])

  const load = useCallback((next: ExtractSource | null) => {
    const audio = getAudio()
    const cur = sourceRef.current
    if (cur && next && cur.path === next.path && cur.start === next.start && cur.end === next.end) return
    audio.pause()
    sourceRef.current = next
    setSource(next)
    setEnded(false)
    setError(false)
    setPosition(0)
    setDuration(next && next.start !== null && next.end !== null ? next.end - next.start : null)
    if (!next) {
      audio.removeAttribute('src')
      audio.load()
      return
    }
    audio.src = buzzerMediaUrl(next.path)
    audio.load()
  }, [getAudio])

  const preload = useCallback((path: string | null) => {
    if (!path) return
    const url = buzzerMediaUrl(path)
    if (preloadRef.current?.src === url) return
    const a = new Audio()
    a.preload = 'auto'
    a.src = url
    preloadRef.current = a
  }, [])

  const play = useCallback((fromStart: boolean) => {
    const audio = getAudio()
    const src = sourceRef.current
    if (!src) return
    const start = src.start ?? 0
    const end = src.end ?? (Number.isFinite(audio.duration) ? audio.duration : null)
    if (fromStart || audio.currentTime < start || (end !== null && audio.currentTime >= end - 0.05)) {
      try {
        audio.currentTime = start
      } catch {
        /* métadonnées pas encore chargées : on démarre au début du fichier */
      }
    }
    setEnded(false)
    void audio.play().catch(() => setPlaying(false))
  }, [getAudio])

  const playFromStart = useCallback(() => play(true), [play])
  const resume = useCallback(() => play(false), [play])
  const pause = useCallback(() => audioRef.current?.pause(), [])
  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    try {
      audio.currentTime = sourceRef.current?.start ?? 0
    } catch {
      /* rien à remettre à zéro */
    }
    setPosition(0)
  }, [])

  const setVolume = useCallback((v: number) => {
    const value = Math.min(1, Math.max(0.05, v))
    getAudio().volume = value
    setVolumeState(value)
    try {
      window.localStorage.setItem(VOLUME_KEY, String(value))
    } catch {
      /* stockage indisponible : réglage pour cette page seulement */
    }
  }, [getAudio])

  return { source, playing, position, length: duration, ended, error, volume, setVolume, load, preload, playFromStart, resume, pause, stop }
}
