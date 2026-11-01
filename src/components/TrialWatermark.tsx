'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WATERMARK_LAYER_PATH } from '@/lib/watermark/constants'
import type { WatermarkCodeKind } from '@/lib/watermark/access'

const RECHECK_MS = 60_000
// Au-dessus du faux plein écran Mac (z-index 9999) et de tous les jeux
const TOP_Z_INDEX = 2147483000

export const TrialWatermarkContext = createContext(false)

export function useTrialWatermark() {
  return useContext(TrialWatermarkContext)
}

// Photo Mystère met SON conteneur en plein écran : tout ce qui est hors de ce
// conteneur disparaît, le voile doit donc le suivre.
function getOverlayHost(): HTMLElement {
  const fullscreen = document.fullscreenElement
  return fullscreen instanceof HTMLElement && fullscreen !== document.documentElement
    ? fullscreen
    : document.body
}

function TrialOverlay() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => setHost(getOverlayHost())
    update()
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  // Remet le voile en place s'il est retiré ou modifié depuis le navigateur. Le
  // même nœud est réutilisé : React le possède et doit pouvoir le retirer ensuite.
  // useLayoutEffect : la surveillance doit s'arrêter avant le retrait par React,
  // sinon le voile serait remis au moment où l'abonnement le fait disparaître.
  useLayoutEffect(() => {
    if (!host || !overlayRef.current) return
    const overlay = overlayRef.current
    const style = overlay.getAttribute('style') ?? ''

    const hostObserver = new MutationObserver(() => {
      if (overlay.parentNode !== host) host.appendChild(overlay)
    })
    hostObserver.observe(host, { childList: true })

    const overlayObserver = new MutationObserver(() => {
      if (overlay.getAttribute('style') !== style) overlay.setAttribute('style', style)
      overlay.removeAttribute('hidden')
      overlay.removeAttribute('class')
    })
    overlayObserver.observe(overlay, { attributes: true })

    return () => {
      hostObserver.disconnect()
      overlayObserver.disconnect()
    }
  }, [host])

  if (!host) return null

  return createPortal(
    <div
      ref={overlayRef}
      aria-hidden="true"
      data-trial-watermark=""
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: TOP_Z_INDEX,
        pointerEvents: 'none',
        backgroundImage: `url(${WATERMARK_LAYER_PATH})`,
        backgroundSize: 'max(100vw, 100vh)',
        backgroundPosition: 'top left',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          padding: '10px 20px',
          background: 'rgba(0,0,0,.82)',
          color: '#D4AF37',
          font: '700 clamp(13px, 1.4vw, 26px) Arial, sans-serif',
          borderBottomRightRadius: 14,
          borderRight: '2px solid #D4AF37',
          borderBottom: '2px solid #D4AF37',
        }}
      >
        Version d&apos;essai · AnimaJet
      </div>
    </div>,
    host
  )
}

export function TrialWatermarkProvider({
  code,
  kind = 'session',
  initial,
  children,
}: {
  code: string
  kind?: WatermarkCodeKind
  initial: boolean
  children: React.ReactNode
}) {
  const [active, setActive] = useState(initial)

  // Aucun appel pour un abonné : seul un écran ouvert en essai se revérifie.
  // En cas d'erreur, pas de voile (voir failOpen) ; il revient au contrôle suivant.
  useEffect(() => {
    if (!initial) return
    const timer = setInterval(async () => {
      let watermark = false
      try {
        const response = await fetch(`/api/watermark/${encodeURIComponent(code)}?kind=${kind}`)
        if (response.ok) watermark = (await response.json()).watermark === true
      } catch {
        // Réseau instable : voir ci-dessus
      }
      setActive(watermark)
    }, RECHECK_MS)
    return () => clearInterval(timer)
  }, [initial, code, kind])

  return (
    <TrialWatermarkContext.Provider value={active}>
      {children}
      {active && <TrialOverlay />}
    </TrialWatermarkContext.Provider>
  )
}

/** Bandeau central du diaporama : coupe chaque photo, en plus du filigrane incrusté. */
export function TrialSlideshowBand() {
  return (
    <div
      aria-hidden="true"
      data-trial-band=""
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: TOP_Z_INDEX + 1,
        pointerEvents: 'none',
        padding: '2.4vh 16px',
        background: 'rgba(0,0,0,.88)',
        borderTop: '3px solid #D4AF37',
        borderBottom: '3px solid #D4AF37',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 'clamp(28px, 5vw, 96px)',
          lineHeight: 1.05,
          letterSpacing: '0.06em',
          color: '#D4AF37',
        }}
      >
        VERSION D&apos;ESSAI
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 'clamp(13px, 1.7vw, 32px)',
          color: '#fff',
          marginTop: 8,
        }}
      >
        Réservé aux tests · Abonnez-vous sur animajet.fr
      </div>
    </div>
  )
}
