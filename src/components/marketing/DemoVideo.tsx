// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState } from 'react'
import Image from 'next/image'

// Vidéo démo YouTube — départ à 3:11 (191s)
const YOUTUBE_ID = 'stQhsL-FZ0U'
const START_SECONDS = 191

/**
 * L'image d'aperçu est sombre sur son tiers gauche (zone prévue pour du texte) :
 * sur tablette et ordinateur, le bouton de lecture et le libellé s'y placent,
 * au lieu de laisser un aplat noir vide. Sur téléphone, bouton centré.
 */
export default function DemoVideo() {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="group relative aspect-video rounded-3xl overflow-hidden border border-[#D4AF37]/25 shadow-[0_20px_60px_rgba(0,0,0,0.5)] bg-black">
      {playing ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?start=${START_SECONDS}&autoplay=1&rel=0&modestbranding=1`}
          title="Démonstration AnimaJet"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 w-full h-full cursor-pointer text-left"
          aria-label="Lire la vidéo de démonstration AnimaJet"
        >
          <Image
            src="/images/hero-animajet.png"
            alt="Démonstration AnimaJet : animation interactive sur écran géant"
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
            sizes="(max-width: 1024px) 100vw, 1024px"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/70 via-transparent to-[#0D0D0F]/30" />
          <span className="hidden md:block absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-black/70 to-transparent" />

          {/* Bouton + libellé : centrés sur téléphone, dans la zone sombre de gauche à partir de 768 px */}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 md:flex-row md:justify-start md:gap-6 md:pl-[8%]">
            <span className="relative flex shrink-0 w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#E5C349] items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.35)] group-hover:scale-105 transition-transform">
              <svg className="w-7 h-7 md:w-9 md:h-9 lg:w-10 lg:h-10 text-[#0D0D0F] ml-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="hidden md:flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Vidéo démo</span>
              <span className="text-white font-semibold text-xl lg:text-2xl leading-tight">
                Regarder AnimaJet<br />en action
              </span>
            </span>
          </span>

          {/* Libellé bas de vignette, téléphone uniquement */}
          <span className="md:hidden absolute bottom-4 left-5 right-5 text-white font-semibold text-sm drop-shadow">
            Regarder AnimaJet en action
          </span>
        </button>
      )}
    </div>
  )
}
