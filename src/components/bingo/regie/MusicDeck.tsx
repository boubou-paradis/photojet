'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : colonne de tirage de la régie.
// TIRER choisit un titre (en base) ; la régie joue l'extrait sur SON
// ordinateur (relié à la sono) ; l'écran et les téléphones voient
// « Morceau n° X » sans le titre. À la fin de l'extrait, ou au clic sur
// RÉVÉLER, le titre apparaît partout.
// Régie fermée pendant un extrait : rien n'est perdu, le titre reste caché et
// le bouton RÉVÉLER attend à la réouverture (l'extrait n'est pas relancé tout seul).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RegieMusic } from '@/lib/bingo/server'
import type { BingoPublicState } from '@/lib/bingo/types'

type Live = Extract<BingoPublicState, { active: true }>

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`

// Réglages de l'élément audio hors du composant (il n'appartient pas à React).
function bindAudio(a: HTMLAudioElement, h: { time: () => void; ended: () => void; error: () => void; paused: () => void }) {
  a.ontimeupdate = h.time
  a.onpause = h.paused
  a.onended = h.ended
  a.onerror = h.error
}
function setSource(a: HTMLAudioElement, url: string) {
  if (a.src !== url) a.src = url
}
function seek(a: HTMLAudioElement, at: number) {
  a.currentTime = at
}

export interface MusicPlayer {
  playing: boolean
  /** Secondes écoulées dans l'extrait. */
  pos: number
  error: string | null
  toggle: () => void
  replay: () => void
}

/**
 * Lecteur d'extraits de la régie. Un NOUVEAU tirage (titre caché) lance son
 * extrait tout seul ; un titre déjà là à l'ouverture de la page ne se relance
 * pas. Fin de l'extrait + titre encore caché → onEnd (révélation).
 */
export function useMusicPlayer(live: Live | null, music: RegieMusic | null, held: boolean, onEnd: () => void): MusicPlayer {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [posState, setPos] = useState<{ k: string | null; s: number }>({ k: null, s: 0 })
  const [error, setError] = useState<string | null>(null)
  const track = music?.current ? music.tracks[music.current - 1] ?? null : null
  const full = live ? live.count + (live.hidden ? 1 : 0) : 0
  const key = live && music?.current ? `${live.gameId}|${live.round}|${full}|${music.current}` : null
  const seen = useRef<string | null | undefined>(undefined)
  const hiddenRef = useRef(false)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    hiddenRef.current = !!live?.hidden
    onEndRef.current = onEnd
  })
  const bounds = useRef({ start: 0, end: 0 })

  // Pas d'état modifié ici : l'événement « pause » de l'élément audio s'en charge.
  const stop = useCallback(() => {
    audio.current?.pause()
  }, [])
  const keyRef = useRef<string | null>(null)
  useEffect(() => { keyRef.current = key })
  const pos = posState.k === key ? posState.s : 0

  const playFrom = useCallback((t: NonNullable<typeof track>, at: number) => {
    const a = audio.current ?? (audio.current = new Audio())
    bounds.current = { start: t.start, end: t.end }
    bindAudio(a, {
      time: () => {
        setPos({ k: keyRef.current, s: a.currentTime - bounds.current.start })
        if (a.currentTime >= bounds.current.end) {
          a.pause()
          setPlaying(false)
          if (hiddenRef.current) onEndRef.current()
        }
      },
      ended: () => {
        setPlaying(false)
        if (hiddenRef.current) onEndRef.current()
      },
      paused: () => setPlaying(false),
      error: () => {
        setPlaying(false)
        setError('Extrait illisible (réseau ?). Réessayez ou révélez le titre.')
      },
    })
    setSource(a, t.url)
    const go = () => {
      seek(a, at)
      void a.play().then(() => {
        setPlaying(true)
        setError(null)
      }).catch(() => {
        setPlaying(false)
        setError('Le navigateur a bloqué la lecture : cliquez sur ▶ pour lancer l’extrait.')
      })
    }
    if (a.readyState >= 1) go()
    else a.addEventListener('loadedmetadata', go, { once: true })
  }, [])

  // Nouveau titre tiré → lecture automatique (jamais pour celui trouvé à l'ouverture).
  useEffect(() => {
    if (seen.current === undefined) {
      if (music) seen.current = key // premier état connu : pas de lecture automatique
      return
    }
    if (key === seen.current) return
    seen.current = key
    stop()
    if (key && track && live?.hidden && !held) playFrom(track, track.start)
  }, [key, track, live?.hidden, held, music, playFrom, stop])

  // Autre jeu à l'écran ou partie quittée : silence.
  useEffect(() => {
    if (held || !live) stop()
  }, [held, live, stop])
  useEffect(() => () => audio.current?.pause(), [])

  const toggle = useCallback(() => {
    if (!track) return
    const a = audio.current
    if (playing) return stop()
    const at = a && a.src === track.url && a.currentTime >= track.start && a.currentTime < track.end ? a.currentTime : track.start
    playFrom(track, at)
  }, [track, playing, stop, playFrom])
  const replay = useCallback(() => { if (track) playFrom(track, track.start) }, [track, playFrom])

  return { playing, pos, error, toggle, replay }
}

export function MusicDeck({ live, music, held, busy, tooSoon, player, onStart, onDraw, onReveal, step = null, links = null }: {
  live: Live
  music: RegieMusic
  held: boolean
  busy: string | null
  tooSoon: boolean
  player: MusicPlayer
  onStart: () => void
  onDraw: () => void
  onReveal: () => void
  /** À la place de TIRER : continuer / passer à l'étape suivante / nouvelle partie. */
  step?: React.ReactNode
  links?: React.ReactNode
}) {
  const hidden = !!live.hidden
  const full = live.count + (hidden ? 1 : 0)
  const track = music.current ? music.tracks[music.current - 1] ?? null : null
  const left = music.tracks.length - full
  const canDraw = !held && live.status === 'running' && left > 0
  const len = track ? track.end - track.start : 0

  let hint = <>Télécommande : <kbd>Page ↓</kbd> {hidden ? 'révéler' : 'tirer'} · <kbd>Page ↑</kbd> pause / lecture · <kbd>B</kbd> rejouer l’extrait</>
  if (held) hint = <>AnimaBingo est en pause (autre jeu à l’écran).</>
  else if (live.status === 'lobby') hint = <>Les joueurs rejoignent la partie. Commencez quand la salle est prête.</>
  else if (live.status === 'checking') hint = <>Tirage bloqué pendant la vérification.</>
  else if (live.status === 'celebrating') hint = <>Gagnant validé : remettez le lot, puis continuez.</>
  else if (live.status === 'finished') hint = <>Partie terminée. Les joueurs gardent leurs cartons.</>
  else if (left === 0 && !hidden) hint = <>Tous les titres de la playlist sont passés.</>

  return (
    <div className="box music-deck" data-testid="draw-column" data-hidden={hidden ? '1' : '0'}>
      <h2><span>Morceau {full ? `n° ${full}` : ''}</span><span>{full} / {music.tracks.length}</span></h2>
      <div className="now-track" data-testid="music-now">
        {track ? (
          <>
            <div className={`eq ${player.playing ? 'on' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <b>{track.title}</b>
            <span>{track.artist || '—'}</span>
            <small className={hidden ? 'secret' : 'shown'}>{hidden ? 'Titre caché à la salle' : 'Titre affiché à la salle'}</small>
          </>
        ) : (
          <span className="none">Aucun morceau tiré</span>
        )}
      </div>
      {track && (
        <div className="player">
          <button className="btn sm ghost" onClick={player.toggle} disabled={held} data-testid="music-toggle" aria-label={player.playing ? 'Mettre l’extrait en pause' : 'Lire l’extrait'}>
            {player.playing ? 'II' : '▶'}
          </button>
          <div className="bar" aria-hidden="true"><i style={{ width: `${len ? Math.min(100, (player.pos / len) * 100) : 0}%` }} /></div>
          <span className="t">{fmt(player.pos)} / {fmt(len)}</span>
          <button className="btn sm ghost" onClick={player.replay} disabled={held} data-testid="music-replay">Rejouer</button>
        </div>
      )}
      {player.error && <div className="note" style={{ color: '#ffd28a' }} role="status">{player.error}</div>}

      {live.status === 'lobby' ? (
        <button className="draw" onClick={onStart} disabled={held || busy !== null} data-testid="start">
          <div><b style={{ fontSize: 26 }}>COMMENCER</b><small>LA PARTIE</small></div>
        </button>
      ) : hidden ? (
        <button className="draw reveal" onClick={onReveal} disabled={held || busy !== null} data-testid="reveal" aria-label="Révéler le titre à la salle">
          <div><b style={{ fontSize: 26 }}>RÉVÉLER</b><small>LE TITRE</small></div>
        </button>
      ) : step ?? (
        <button className="draw" onClick={onDraw} disabled={!canDraw || tooSoon} data-testid="draw" aria-label="Tirer le morceau suivant">
          <div><b>TIRER</b><small>MORCEAU SUIVANT</small></div>
        </button>
      )}
      {links}
      <div className="hint">{hint}</div>
      <p className="note">Le son sort de cet ordinateur : reliez-le à la sono. Le titre apparaît à l’écran à la fin de l’extrait, ou dès que vous cliquez sur « Révéler ».</p>
    </div>
  )
}

/** Liste des titres de la partie (centre de la régie) : joués allumés, dernier mis en avant. */
export function MusicBoard({ music, drawn }: { music: RegieMusic; drawn: readonly number[] }) {
  const order = new Map(drawn.map((n, i) => [n, i + 1]))
  const last = drawn.length ? drawn[drawn.length - 1] : null
  return (
    <ol className="mboard" aria-label="Titres de la partie">
      {music.tracks.map((t, i) => {
        const n = i + 1
        const k = order.get(n)
        return (
          <li key={n} className={n === last ? 'last' : k ? 'on' : ''} title={t.artist ? `${t.title} · ${t.artist}` : t.title}>
            <span className="k">{k ?? ''}</span>
            <b>{t.title}</b>
          </li>
        )
      })}
    </ol>
  )
}
