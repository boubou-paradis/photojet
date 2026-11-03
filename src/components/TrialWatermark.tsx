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
// Marge autour d'un QR code laissée sans filigrane (zone de silence du QR)
const QR_MARGIN = 16

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

  // Les QR codes (marqués data-qr) doivent rester scannables : on découpe un
  // trou dans le calque autour de chacun. Sondage léger, car les QR apparaissent
  // avec des animations et changent de place d'un jeu à l'autre.
  const layerRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host) return
    let last = ''
    const update = () => {
      const layer = layerRef.current
      if (!layer) return
      const w = window.innerWidth
      const h = window.innerHeight
      const rects = Array.from(document.querySelectorAll('[data-qr]'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)

      // L'étiquette du coin s'efface si elle recouvre un QR code
      const label = labelRef.current
      if (label) {
        const l = label.getBoundingClientRect()
        const covers = rects.some(
          (r) =>
            r.left - QR_MARGIN < l.right &&
            r.right + QR_MARGIN > l.left &&
            r.top - QR_MARGIN < l.bottom &&
            r.bottom + QR_MARGIN > l.top
        )
        label.style.visibility = covers ? 'hidden' : ''
      }

      const holes = rects.map((r) => {
          const x = Math.max(0, Math.floor(r.left - QR_MARGIN))
          const y = Math.max(0, Math.floor(r.top - QR_MARGIN))
          const rw = Math.ceil(r.width + QR_MARGIN * 2)
          const rh = Math.ceil(r.height + QR_MARGIN * 2)
          return `M${x} ${y}h${rw}v${rh}h${-rw}Z`
        })
      const key = `${w}x${h}|${holes.join('')}`
      if (key === last) return
      last = key
      if (holes.length === 0) {
        layer.style.maskImage = ''
        layer.style.webkitMaskImage = ''
        return
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path fill="#fff" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z${holes.join('')}"/></svg>`
      const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
      layer.style.maskImage = mask
      layer.style.webkitMaskImage = mask
    }
    update()
    const timer = setInterval(update, 500)
    window.addEventListener('resize', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', update)
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
      }}
    >
      <div
        ref={layerRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${WATERMARK_LAYER_PATH})`,
          backgroundSize: 'max(100vw, 100vh)',
          backgroundPosition: 'top left',
          backgroundRepeat: 'no-repeat',
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }}
      />
      <div
        ref={labelRef}
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
