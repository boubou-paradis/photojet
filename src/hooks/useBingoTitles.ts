'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : titres et artistes de la partie, pour l'écran
// géant et les téléphones. La playlist est figée pendant la partie : la liste
// ne change qu'avec son empreinte (`sig`). Gardée en mémoire et sur
// l'appareil (localStorage) : elle survit au mode avion et aux rechargements.
// Réseau coupé au premier chargement : nouvel essai toutes les 3 s.

import { useEffect, useState } from 'react'
import type { PublicTitle } from '@/lib/bingo/music'

const memory = new Map<string, PublicTitle[]>()
const storeKey = (sig: string) => `animabingo:titres:${sig}`

function isTitles(x: unknown, n: number): x is PublicTitle[] {
  return Array.isArray(x) && x.length === n && x.every((t) => t && typeof t.t === 'string' && typeof t.a === 'string')
}

function readCache(sig: string, n: number): PublicTitle[] | null {
  const m = memory.get(sig)
  if (m) return m
  try {
    const raw = window.localStorage.getItem(storeKey(sig))
    const v = raw ? JSON.parse(raw) : null
    if (isTitles(v, n)) {
      memory.set(sig, v)
      return v
    }
  } catch { /* stockage indisponible : on relira le réseau */ }
  return null
}

function writeCache(sig: string, titles: PublicTitle[]) {
  memory.set(sig, titles)
  try {
    // Une seule playlist gardée à la fois : on efface les anciennes.
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith('animabingo:titres:') && k !== storeKey(sig)) window.localStorage.removeItem(k)
    }
    window.localStorage.setItem(storeKey(sig), JSON.stringify(titles))
  } catch { /* plein ou interdit : la mémoire suffit pour cette page */ }
}

/** Titres de la partie musicale en cours (null = loto numéros ou pas encore chargés). */
export function useBingoTitles(code: string, music: { sig: string; n: number } | null | undefined): PublicTitle[] | null {
  const sig = music?.sig ?? null
  const n = music?.n ?? 0
  const [loaded, setLoaded] = useState<{ sig: string; titles: PublicTitle[] } | null>(null)
  const cached = sig && typeof window !== 'undefined' ? readCache(sig, n) : null

  useEffect(() => {
    if (!sig || cached) return
    let off = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const res = await fetch(`/api/bingo/titles?code=${encodeURIComponent(code)}&sig=${sig}`)
        const json = (await res.json()) as { sig?: string | null; titles?: unknown }
        if (!off && json.sig === sig && isTitles(json.titles, n)) {
          writeCache(sig, json.titles)
          setLoaded({ sig, titles: json.titles })
          return
        }
      } catch { /* réseau coupé */ }
      if (!off) timer = setTimeout(load, 3000)
    }
    void load()
    return () => {
      off = true
      if (timer) clearTimeout(timer)
    }
  }, [code, sig, n, cached])

  if (!sig) return null
  return cached ?? (loaded?.sig === sig ? loaded.titles : null)
}
