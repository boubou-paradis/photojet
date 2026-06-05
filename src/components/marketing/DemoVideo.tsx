// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState } from 'react'
import Image from 'next/image'

// Vidéo démo YouTube — départ à 3:11 (191s)
const YOUTUBE_ID = 'stQhsL-FZ0U'
const START_SECONDS = 191

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
          className="absolute inset-0 w-full h-full cursor-pointer"
          aria-label="Lire la vidéo de démonstration AnimaJet"
        >
          <Image
            src="/images/hero-animajet.png"
            alt="Démonstration AnimaJet : animation interactive sur écran géant"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            sizes="(max-width: 1024px) 100vw, 1024px"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/80 via-[#0D0D0F]/20 to-[#0D0D0F]/40" />

          {/* Play button */}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative block">
              <span className="absolute inset-0 rounded-full bg-[#D4AF37]/40 animate-ping" />
              <span className="relative flex w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#E5C349] items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.4)] group-hover:scale-110 transition-transform">
                <svg className="w-9 h-9 lg:w-10 lg:h-10 text-[#0D0D0F] ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </span>

          <span className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
            <span className="text-white font-semibold text-sm lg:text-base drop-shadow">
              ▶ Regarder AnimaJet en action
            </span>
            <span className="hidden sm:inline-block text-xs text-gray-200 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              Vidéo démo
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
