'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tablette AnimaBooth : cadre(s) de la session, relus à chaque retour sur
// l'écran caméra (un changement fait dans l'admin s'applique à la photo
// suivante). Chaque PNG est téléchargé une seule fois en blob: et décodé à
// l'avance : il reste disponible si le réseau coupe, et ne « contamine »
// pas le canvas de composition. Un cadre qui ne charge pas est ignoré :
// la borne continue sans cadre.

import { useEffect, useRef, useState } from 'react'
import type { BorneFrameConfig, BorneFrameTemplate, PhotoZone } from '@/lib/borne-templates/constants'

export interface LoadedFrame {
  id: string
  src: string
  img: HTMLImageElement
  width: number
  height: number
  zone: PhotoZone
}

export interface BorneFrameState {
  enabled: boolean
  guestChoice: boolean
  portrait: LoadedFrame | null
  landscape: LoadedFrame | null
}

const OFF: BorneFrameState = { enabled: false, guestChoice: true, portrait: null, landscape: null }
const CONFIG_TIMEOUT_MS = 6000
const IMAGE_TIMEOUT_MS = 15000

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function loadFrame(t: BorneFrameTemplate): Promise<LoadedFrame> {
  const res = await fetchWithTimeout(t.url, IMAGE_TIMEOUT_MS)
  if (!res.ok) throw new Error(`template ${res.status}`)
  const src = URL.createObjectURL(await res.blob())
  const img = new Image()
  img.src = src
  try {
    await img.decode()
  } catch (err) {
    URL.revokeObjectURL(src)
    throw err
  }
  return { id: t.id, src, img, width: t.width, height: t.height, zone: t.zone }
}

/** @param refreshKey change à chaque retour sur l'écran caméra. */
export function useBorneFrame(code: string | undefined, refreshKey: number): BorneFrameState {
  const [state, setState] = useState<BorneFrameState>(OFF)
  const cache = useRef(new Map<string, LoadedFrame>())

  useEffect(() => {
    if (!code) return
    let cancelled = false
    const get = async (t: BorneFrameTemplate | null): Promise<LoadedFrame | null> => {
      if (!t) return null
      const cached = cache.current.get(t.url)
      if (cached) return cached
      try {
        const frame = await loadFrame(t)
        cache.current.set(t.url, frame)
        return frame
      } catch (err) {
        console.warn('[AnimaBooth] cadre non chargé, photo sans cadre', err)
        return null
      }
    }
    ;(async () => {
      try {
        const res = await fetchWithTimeout(`/api/borne/${encodeURIComponent(code)}/template`, CONFIG_TIMEOUT_MS, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled && res.status === 404) setState(OFF)
          return
        }
        const config = (await res.json()) as BorneFrameConfig
        if (!config.enabled) {
          if (!cancelled) setState({ ...OFF, guestChoice: config.guestChoice })
          return
        }
        const [portrait, landscape] = await Promise.all([get(config.portrait), get(config.landscape)])
        if (!cancelled) {
          setState({ enabled: !!(portrait || landscape), guestChoice: config.guestChoice, portrait, landscape })
        }
      } catch {
        // Réseau indisponible : on garde le dernier état connu.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, refreshKey])

  // Libération des blobs au démontage
  useEffect(() => {
    const frames = cache.current
    return () => {
      frames.forEach((f) => URL.revokeObjectURL(f.src))
      frames.clear()
    }
  }, [])

  return state
}
