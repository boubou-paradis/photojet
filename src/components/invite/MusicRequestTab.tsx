'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// /invite, onglet « Musique » : Titre + Artiste, « Envoyer », confirmation,
// formulaire vidé. Envoi par route serveur uniquement. « Vos demandes » reste
// sur ce téléphone (mémoire locale), sans jamais dire si le morceau est passé.

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Loader2, Music, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MUSIC_ARTIST_MAX, MUSIC_TITLE_MAX, cleanMusicField } from '@/lib/music/normalize'

interface SentRequest { title: string; artist: string | null }

const MINE_MAX = 10
const storageKey = (code: string) => `animajet-music:${code.toUpperCase()}`

function readMine(code: string): SentRequest[] {
  try {
    const raw = localStorage.getItem(storageKey(code))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(list)) return []
    return list
      .filter((x): x is SentRequest => !!x && typeof x.title === 'string')
      .map((x) => ({ title: cleanMusicField(x.title).slice(0, MUSIC_TITLE_MAX), artist: x.artist ? cleanMusicField(x.artist).slice(0, MUSIC_ARTIST_MAX) : null }))
      .slice(0, MINE_MAX)
  } catch {
    return []
  }
}

function writeMine(code: string, list: SentRequest[]) {
  try { localStorage.setItem(storageKey(code), JSON.stringify(list.slice(0, MINE_MAX))) } catch { /* stockage bloqué */ }
}

const ERRORS: Record<string, string> = {
  disabled: 'Les demandes de musique sont fermées pour le moment.',
  not_found: 'Cet événement n’accepte plus de demandes.',
  title_required: 'Indiquez le titre du morceau.',
  title_too_long: `Titre trop long (${MUSIC_TITLE_MAX} caractères au plus).`,
  artist_too_long: `Nom d’artiste trop long (${MUSIC_ARTIST_MAX} caractères au plus).`,
}

export default function MusicRequestTab({ code }: { code: string }) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState<SentRequest[]>([])
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const artistRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMine(readMine(code))
    return () => { if (sentTimer.current) clearTimeout(sentTimer.current) }
  }, [code])

  const canSend = cleanMusicField(title).length > 0 && !sending

  function hideConfirmation() {
    if (sentTimer.current) clearTimeout(sentTimer.current)
    setSent(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    setError(null)
    hideConfirmation()
    try {
      const response = await fetch(`/api/public/music/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist }),
      })
      if (!response.ok) {
        const { error: reason } = await response.json().catch(() => ({ error: '' }))
        setError(ERRORS[reason as string] ?? 'Envoi échoué. Vérifiez votre connexion et réessayez.')
        return
      }
      const entry = { title: cleanMusicField(title), artist: cleanMusicField(artist) || null }
      const next = [entry, ...mine].slice(0, MINE_MAX)
      setMine(next)
      writeMine(code, next)
      setTitle('')
      setArtist('')
      setSent(true)
      sentTimer.current = setTimeout(() => setSent(false), 4000)
    } catch {
      setError('Envoi échoué. Vérifiez votre connexion et réessayez.')
    } finally {
      setSending(false)
    }
  }

  const counter = (value: string, max: number, from: number) =>
    value.length >= from ? <span className={value.length >= max ? 'text-red-400' : 'text-gray-500'}>{value.length}/{max}</span> : null

  return (
    <div className="relative">
      <div className="absolute -inset-1 bg-cyan-500/10 rounded-3xl blur-xl opacity-50" />
      <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <form onSubmit={handleSubmit} className="p-6 space-y-3" data-testid="music-form">
          {/* Même emplacement pour l'accroche et la confirmation : le formulaire ne saute pas. */}
          <div className="min-h-[88px] flex items-center justify-center">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                role="status"
                data-testid="music-sent"
                className="w-full flex items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-emerald-300 font-semibold"
              >
                <CheckCircle className="h-5 w-5 shrink-0" />
                Demande envoyée au DJ&nbsp;! 🎶
              </motion.div>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-700/10 mb-2">
                  <Music className="h-7 w-7 text-cyan-300" />
                </div>
                <p className="text-gray-400 text-sm">Une chanson à demander au DJ&nbsp;?</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="titre-demande" className="text-gray-300">Titre</label>
              {counter(title, MUSIC_TITLE_MAX, 60)}
            </div>
            <Input
              id="titre-demande"
              name="titre-demande"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="next"
              maxLength={MUSIC_TITLE_MAX}
              placeholder="ex. Les lacs du Connemara"
              value={title}
              onChange={(e) => { setTitle(e.target.value); hideConfirmation() }}
              // Entrée dans le titre : passe à l'artiste au lieu d'envoyer.
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); artistRef.current?.focus() } }}
              className="h-12 bg-[#0D0D0F] border-white/10 focus:border-cyan-400 text-white placeholder:text-gray-600 rounded-xl"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="artiste-demande" className="text-gray-300">Artiste</label>
              {counter(artist, MUSIC_ARTIST_MAX, 45) ?? <span className="text-gray-500">facultatif</span>}
            </div>
            <Input
              ref={artistRef}
              id="artiste-demande"
              name="artiste-demande"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="send"
              maxLength={MUSIC_ARTIST_MAX}
              placeholder="ex. Michel Sardou"
              value={artist}
              onChange={(e) => { setArtist(e.target.value); hideConfirmation() }}
              className="h-12 bg-[#0D0D0F] border-white/10 focus:border-cyan-400 text-white placeholder:text-gray-600 rounded-xl"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center" role="alert">{error}</p>}

          <Button
            type="submit"
            disabled={!canSend}
            className="w-full h-14 bg-gradient-to-r from-cyan-600 to-cyan-400 text-[#041318] font-bold text-lg rounded-xl shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {sending ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Envoi…</>
            ) : (
              <><Send className="mr-2 h-5 w-5" />Envoyer</>
            )}
          </Button>

          {mine.length > 0 && (
            <div className="pt-3 border-t border-white/10" data-testid="music-mine">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Vos demandes</p>
              <ul className="space-y-1">
                {mine.map((r, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2 min-w-0">
                    <Music className="h-3.5 w-3.5 mt-1 shrink-0 text-cyan-400/70" />
                    <span className="min-w-0 break-words">
                      {r.title}
                      {r.artist && <span className="text-gray-500"> · {r.artist}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
