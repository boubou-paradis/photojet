'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Commandes de la musique d'ambiance (PC animateur) : choisir un fichier,
// lecture / pause, volume, retirer.

import { useRef } from 'react'
import { Music, Pause, Play, Trash2, Volume2, VolumeX } from 'lucide-react'
import type { AmbianceMusic } from '@/hooks/useAmbianceMusic'

export default function AmbianceMusicControls({ music, inGame = false }: { music: AmbianceMusic; inGame?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="card-gold rounded-xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#E91E63]/10 flex items-center justify-center border border-[#E91E63]/30">
          <Music className="h-5 w-5 text-[#E91E63]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold">Musique d&apos;ambiance</h3>
          <p className={`text-xs truncate ${music.playing ? 'text-green-400' : 'text-gray-500'}`}>
            {music.name
              ? `${music.name}${music.playing ? ' · en cours ♫' : ''}`
              : inGame
                ? 'Aucune musique choisie'
                : 'Jouée en boucle sur votre ordinateur pendant toute la partie (facultatif)'}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) music.choose(file)
            e.target.value = ''
          }}
        />

        {music.name ? (
          <>
            <button
              onClick={music.toggle}
              className={`p-2.5 rounded-lg ${music.playing ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}
              title={music.playing ? 'Pause' : 'Lecture'}
            >
              {music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={() => inputRef.current?.click()} className="px-3 py-2 text-sm bg-[#2E2E33] text-gray-300 rounded-lg hover:bg-[#3E3E43]">
              Changer
            </button>
            <button onClick={music.remove} className="p-2.5 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25" title="Retirer la musique">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2.5 bg-[#2E2E33] text-[#E91E63] rounded-xl hover:bg-[#3E3E43] text-sm border border-[#E91E63]/30"
          >
            Choisir une musique
          </button>
        )}
      </div>

      {music.name && (
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => music.setVolume(0)} className="p-1 text-gray-400 hover:text-white" title="Muet">
            <VolumeX className="h-4 w-4" />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={music.volume}
            onChange={(e) => music.setVolume(parseFloat(e.target.value))}
            aria-label="Volume de la musique d'ambiance"
            className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#D4AF37]"
          />
          <button onClick={() => music.setVolume(1)} className="p-1 text-gray-400 hover:text-white" title="Volume max">
            <Volume2 className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500 w-10 text-right tabular-nums">{Math.round(music.volume * 100)} %</span>
        </div>
      )}
    </section>
  )
}
