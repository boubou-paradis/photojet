'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglage des sons d'AnimaVote (page animateur) : activer ou couper,
// écouter, remplacer par un fichier personnel (gardé sur ce PC), revenir
// au son par défaut.

import { useRef, useState } from 'react'
import { Play, RotateCcw, Upload, Volume2, VolumeX } from 'lucide-react'
import { VOTE_SOUNDS, type VoteSoundId, type VoteSounds } from '@/hooks/useVoteSounds'

export default function VoteSoundsPanel({ sounds }: { sounds: VoteSounds }) {
  const inputs = useRef<Partial<Record<VoteSoundId, HTMLInputElement | null>>>({})
  const [error, setError] = useState<string | null>(null)

  async function onFile(id: VoteSoundId, file: File | undefined) {
    if (!file) return
    setError(await sounds.replace(id, file))
  }

  return (
    <section className="ava-box" aria-label="Sons">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 style={{ margin: 0 }}>Sons</h4>
          <p className="ava-sub" style={{ marginTop: 4 }}>Joués sur ce PC (votre sono), jamais sur l’écran géant ni sur les téléphones.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sounds.enabled}
          onClick={() => sounds.setEnabled(!sounds.enabled)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border ${sounds.enabled ? 'border-[#D4AF37]/50 text-[#D4AF37]' : 'border-white/10 text-gray-400'}`}
        >
          {sounds.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {sounds.enabled ? 'Sons activés' : 'Sons coupés'}
        </button>
      </div>

      <ul className="mt-3 divide-y divide-white/5">
        {VOTE_SOUNDS.map((s) => {
          const mine = sounds.custom[s.id]
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="text-gray-200 w-56">{s.label}</span>
              <span className="text-xs text-[#9a94b5] flex-1 min-w-0 truncate">{mine ? `Votre son : ${mine}` : 'Son AnimaVote'}</span>
              <button type="button" onClick={() => sounds.play(s.id)} disabled={!sounds.enabled} className="p-2 rounded-lg border border-white/10 text-gray-300 hover:border-[#D4AF37]/40 disabled:opacity-40" aria-label={`Écouter : ${s.label}`} title="Écouter">
                <Play className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => inputs.current[s.id]?.click()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-[#D4AF37]/40 text-xs">
                <Upload className="h-3.5 w-3.5" />
                Remplacer
              </button>
              {mine && (
                <button type="button" onClick={() => void sounds.reset(s.id)} className="p-2 rounded-lg border border-white/10 text-gray-300 hover:border-[#D4AF37]/40" aria-label={`Revenir au son AnimaVote : ${s.label}`} title="Revenir au son AnimaVote">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <input
                ref={(el) => { inputs.current[s.id] = el }}
                type="file"
                accept="audio/*"
                className="hidden"
                aria-label={`Fichier pour : ${s.label}`}
                onChange={(e) => {
                  void onFile(s.id, e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </li>
          )
        })}
      </ul>
      {error && <p className="text-sm text-orange-300 mt-2" role="alert">{error}</p>}
    </section>
  )
}
