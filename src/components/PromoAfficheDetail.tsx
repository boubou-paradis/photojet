// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState } from 'react'

// Panneau d'une affiche promotionnelle dans Paramètres : choix Ajuster /
// Plein écran, aperçu de ce qui sera coupé sur un écran 16:9 et conseils.

const SCREEN_RATIO = 16 / 9
const MIN_SHARP_WIDTH = 1280

type Props = {
  index: number
  src: string
  fullScreen: boolean
  onChange: (fullScreen: boolean) => void
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)} %`
}

export default function PromoAfficheDetail({ index, src, fullScreen, onChange }: Props) {
  const [size, setSize] = useState<{ src: string; w: number; h: number } | null>(null)
  const dims = size && size.src === src ? size : null
  const ratio = dims ? dims.w / dims.h : null

  // Rognage sur un écran 16:9, réparti à parts égales sur les deux bords.
  let cropText: string | null = null
  let isIdeal = false
  if (ratio !== null) {
    if (Math.abs(ratio - SCREEN_RATIO) < 0.01) {
      isIdeal = true
    } else if (ratio < SCREEN_RATIO) {
      cropText = `${formatPercent((1 - ratio / SCREEN_RATIO) / 2)} coupé en haut et autant en bas`
    } else {
      cropText = `${formatPercent((1 - SCREEN_RATIO / ratio) / 2)} coupé à gauche et autant à droite`
    }
  }

  // Fenêtre 16:9 visible, en pourcentage de l'image affichée.
  const windowStyle: React.CSSProperties = ratio === null
    ? { inset: 0 }
    : ratio < SCREEN_RATIO
      ? { left: 0, width: '100%', height: `${(ratio / SCREEN_RATIO) * 100}%`, top: `${(100 - (ratio / SCREEN_RATIO) * 100) / 2}%` }
      : { top: 0, height: '100%', width: `${(SCREEN_RATIO / ratio) * 100}%`, left: `${(100 - (SCREEN_RATIO / ratio) * 100) / 2}%` }

  const modeButton = (value: boolean, label: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={fullScreen === value}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        fullScreen === value ? 'bg-[#D4AF37] text-[#1A1405]' : 'text-[#B0B0B5] hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#202024] p-3">
      <div className="space-y-2 min-w-0">
        <div className="relative h-52 rounded-md overflow-hidden flex items-center justify-center bg-[repeating-linear-gradient(45deg,#1b1b1f_0_8px,#222227_8px_16px)]">
          <div className="relative max-h-full max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Aperçu de l'affiche ${index + 1}`}
              className="block max-h-52 max-w-full"
              onLoad={(e) => setSize({ src, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
            {fullScreen && ratio !== null && (
              <div
                className="absolute pointer-events-none outline-2 outline-dashed outline-[#D4AF37] -outline-offset-1 shadow-[0_0_0_2000px_rgba(10,10,12,0.72)]"
                style={windowStyle}
              >
                {/* Place du QR code (coin bas droit) */}
                <div className="absolute right-[1.6%] bottom-[2.8%] w-[5.2%] aspect-[98/118] rounded-[2px] bg-white/90" />
              </div>
            )}
          </div>
          <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white">
            {fullScreen ? 'Plein écran · aperçu sur écran 16:9' : 'Ajuster · affiche entière'}
          </span>
        </div>
        {fullScreen && (
          <p className="text-xs text-[#6B6B70]">
            Zone encadrée : ce que verra l&apos;écran. Zone assombrie : ce qui sera coupé. Carré blanc : place du QR code.
          </p>
        )}
      </div>

      <div className="space-y-3 min-w-0">
        <p className="text-sm font-medium text-white">
          Affiche {index + 1}
          {dims && <span className="ml-2 text-xs font-normal text-[#6B6B70]">{dims.w} × {dims.h} px</span>}
        </p>
        <div className="space-y-1.5">
          <p className="text-xs text-[#B0B0B5]">Affichage à l&apos;écran</p>
          <div className="inline-flex gap-0.5 rounded-lg bg-[#2E2E33] p-0.5">
            {modeButton(false, 'Ajuster')}
            {modeButton(true, 'Plein écran')}
          </div>
        </div>
        <p className="text-xs text-[#B0B0B5]">
          {fullScreen
            ? 'Plein écran : l’affiche remplit tout l’écran, bord à bord. Si elle n’est pas en 16:9, les bords sont coupés.'
            : 'Ajuster : l’affiche entière est visible, dans un cadre, avec le fond de la soirée autour.'}
        </p>
        {isIdeal && (
          <p className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-400">
            Format 16:9 : rien ne sera coupé
          </p>
        )}
        {cropText && fullScreen && (
          <p className="inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-400">{cropText}</p>
        )}
        {fullScreen && dims && dims.w < MIN_SHARP_WIDTH && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400">
            Image de {dims.w} px de large : elle risque d&apos;être floue en plein écran. Pour un rendu net, utilisez au moins 1280 px de large.
          </p>
        )}
        <p className="text-xs text-[#B0B0B5]">
          <span className="font-semibold text-white">Format idéal : 1920 × 1080 px (16:9).</span>{' '}
          À ce format, rien n&apos;est coupé en plein écran.
        </p>
        {fullScreen && (
          <p className="text-xs text-[#6B6B70]">
            L&apos;aperçu suppose un écran 16:9. Sur un écran d&apos;un autre format (16:10, 4:3), la partie coupée change un peu.
          </p>
        )}
      </div>
    </div>
  )
}
