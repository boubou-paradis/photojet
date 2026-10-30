// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Précharge les affiches promo du diaporama, une par une pour ne pas saturer
// le réseau de la salle. Une affiche n'est montrée que lorsqu'elle est
// entièrement chargée : jamais d'image coupée à l'écran. Une affiche en erreur
// est signalée dans `failed` et retentée toutes les 30 s (coupure Wi-Fi).

import { useEffect, useRef, useState } from 'react'

export interface PromoImage {
  width: number
  height: number
}

const RETRY_MS = 30000

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Affiche indisponible : ${url}`))
    img.src = url
  })
}

export function usePromoPreload(paths: string[], getUrl: (path: string) => string | null) {
  const [ready, setReady] = useState<ReadonlyMap<string, PromoImage>>(new Map())
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  // Garde les images en mémoire : le navigateur les réaffiche sans les retélécharger
  const loaded = useRef(new Map<string, HTMLImageElement>())
  const getUrlRef = useRef(getUrl)
  getUrlRef.current = getUrl
  const pathsKey = JSON.stringify(paths)

  useEffect(() => {
    const wanted: string[] = JSON.parse(pathsKey)
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      let missed = false
      for (const path of wanted) {
        if (loaded.current.has(path)) continue
        const url = getUrlRef.current(path)
        try {
          if (!url) throw new Error('Affiche sans URL')
          const img = await loadImage(url)
          // Décodage avant affichage ; un échec ici n'empêche pas de montrer l'image
          await img.decode().catch(() => {})
          if (cancelled) return
          loaded.current.set(path, img)
          setReady((prev) => new Map(prev).set(path, { width: img.naturalWidth, height: img.naturalHeight }))
          setFailed((prev) => {
            if (!prev.has(path)) return prev
            const next = new Set(prev)
            next.delete(path)
            return next
          })
        } catch {
          if (cancelled) return
          missed = true
          setFailed((prev) => new Set(prev).add(path))
        }
      }
      if (missed) timer = setTimeout(run, RETRY_MS)
    }

    run()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pathsKey])

  return { ready, failed }
}
