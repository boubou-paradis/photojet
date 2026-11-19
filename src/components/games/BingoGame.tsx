'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo sur l'écran géant (/live). Reçoit l'état public par le canal
// « bingo:<session> » + relectures de sécurité (useBingoChannel). Aucun son
// ici : la voix sort du PC de l'animateur. Un rechargement relit l'état
// exact ; les animations passées ne sont pas rejouées (tout est calé sur
// l'heure du serveur). Régie absente : la partie reste affichée « en pause ».

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import '@/components/bingo/bingo.css'
import '@/components/bingo/screen.css'
import { BingoScreen, type Live } from '@/components/bingo/screen/BingoScreen'
import { Ball } from '@/components/bingo/Ball'
import { useBingoChannel } from '@/hooks/useBingoChannel'
import { useBingoTitles } from '@/hooks/useBingoTitles'
import type { BingoLiveStatus } from '@/hooks/useBingoStatus'
import { createPublicClient } from '@/lib/supabase'
import type { LiveSession } from '@/lib/public-api/columns'

/** Durée de l'écran « prochaine étape » après un changement de phase vu en direct. */
const PHASE_INTRO_MS = 5000

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

export default function BingoGame({ session, status }: { session: LiveSession; status: BingoLiveStatus }) {
  const channel = useBingoChannel(status.sessionId, session.code, { getClient: createPublicClient })
  const live: Live | null = channel.state?.active ? channel.state : null
  const titles = useBingoTitles(session.code, live?.music)
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [fit, setFit] = useState({ k: 1, x: 0, y: 0 })
  const rootRef = useRef<HTMLDivElement>(null)

  // Scène 1920×1080 mise à l'échelle de l'écran, centrée.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      const k = Math.min(w / 1920, h / 1080)
      setFit({ k, x: (w - 1920 * k) / 2, y: (h - 1080 * k) / 2 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Horloge alignée sur le serveur (boule héros, compte à rebours).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const serverNow = now + channel.clockOffsetMs

  // « Prochaine étape » : seulement quand la phase change sous nos yeux (jamais au chargement).
  // Comparaison avec la phase vue au rendu précédent (sans effet : pas de rendu en cascade).
  const [seenPhase, setSeenPhase] = useState<string | null>(null)
  const [introUntil, setIntroUntil] = useState(0)
  const phaseKey = live ? `${live.gameId}|${live.round}|${live.phaseIndex}` : null
  if (phaseKey !== seenPhase) {
    setSeenPhase(phaseKey)
    if (live && seenPhase && live.status === 'running') {
      const [g, r, i] = seenPhase.split('|')
      if (g === live.gameId && Number(r) === live.round && Number(i) < live.phaseIndex) setIntroUntil(now + PHASE_INTRO_MS)
    }
  }

  // Plein écran : même règle que les autres jeux (Mac = faux plein écran).
  const toggleFullscreen = useCallback(async () => {
    if (isMac) {
      setIsFullscreen((p) => !p)
      return
    }
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch { /* refusé par le navigateur */ }
  }, [isMac])
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  useEffect(() => {
    if (!isMac) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isMac])

  const paused = !!live && (live.paused || !status.live) && live.status !== 'finished'
  return (
    <div ref={rootRef} className="bgo bgo-screen" data-testid="bingo-live" data-fake-fs={isMac && isFullscreen ? '' : undefined}>
      <div className="fit" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})` } as CSSProperties}>
        {live ? (
          <BingoScreen s={live} name={session.name ?? ''} code={session.code} now={serverNow} phaseIntro={now < introUntil} titles={titles} />
        ) : (
          <div className="stage">
            <div className="bg" />
            <div className="moment">
              <Ball n={77} size={160} label="AnimaBingo" />
              <h1 className="gold-text" style={{ fontSize: 120, marginTop: 30 }}>ANIMABINGO</h1>
              <div className="sub">Connexion à la partie… · Code {session.code}</div>
            </div>
          </div>
        )}
        {paused && <div className="paused" role="status" data-testid="screen-paused">Pause : l’animateur reprend dans un instant</div>}
        {!channel.online && <div className="reco" role="status" data-testid="screen-offline">Reconnexion…</div>}
      </div>
      <button onClick={toggleFullscreen} className="fs" aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}
