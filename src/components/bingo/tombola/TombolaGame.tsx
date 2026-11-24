'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola sur l'écran géant (/live). Scène 1920×1080 mise à
// l'échelle, même machine et mêmes boules que le loto. Tout se déduit de
// l'état public : un rechargement affiche exactement le même moment.
// Aucun son ici : la voix sort du PC de l'animateur. Régie absente :
// la tombola reste affichée « en pause ».

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import '@/components/bingo/bingo.css'
import '@/components/bingo/screen.css'
import './tombola.css'
import QRCode from '@/components/QRCode'
import { Ball } from '@/components/bingo/Ball'
import { GoldRings, Machine } from '@/components/bingo/screen/Machine'
import { useTombolaChannel } from '@/hooks/useTombolaChannel'
import type { BingoLiveStatus } from '@/hooks/useBingoStatus'
import { lotsGiven, machineSample, rangesText, type TombolaLive } from '@/lib/bingo/tombola'
import { createPublicClient } from '@/lib/supabase'
import { getInviteUrl } from '@/lib/utils'
import type { LiveSession } from '@/lib/public-api/columns'

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

export default function TombolaGame({ session, status }: { session: LiveSession; status: BingoLiveStatus }) {
  const channel = useTombolaChannel(status.sessionId, session.code, { getClient: createPublicClient })
  const live: TombolaLive | null = channel.state?.active ? channel.state : null
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fit, setFit] = useState({ k: 1, x: 0, y: 0 })
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = () => {
      const k = Math.min(el.clientWidth / 1920, el.clientHeight / 1080)
      setFit({ k, x: (el.clientWidth - 1920 * k) / 2, y: (el.clientHeight - 1080 * k) / 2 })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fin du suspense (0,9 s) : relecture sans attendre la prochaine diffusion.
  const { refresh } = channel
  const revealAt = live?.hidden && live.lastDrawAt ? Date.parse(live.lastDrawAt) + 900 - channel.clockOffsetMs : null
  useEffect(() => {
    if (revealAt === null) return
    const t = setTimeout(() => void refresh(), Math.max(50, revealAt - Date.now() + 150))
    return () => clearTimeout(t)
  }, [revealAt, refresh])

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

  const paused = !!live && (live.paused || !status.live)
  return (
    <div ref={rootRef} className="bgo bgo-screen tmb-screen" data-testid="tombola-live" data-fake-fs={isMac && isFullscreen ? '' : undefined}>
      <div className="fit" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})` } as CSSProperties}>
        <div className="stage">
          <div className="bg" />
          <div className="floor" />
          <div className="tmb-title">TOMBOLA</div>
          {!live ? (
            <div className="moment">
              <Ball n={77} size={160} label="Tombola" />
              <div className="sub">Connexion à la tombola… · Code {session.code}</div>
            </div>
          ) : live.status === 'lobby' && live.draws.length === 0 && !live.hidden ? (
            <Lobby s={live} code={session.code} />
          ) : (
            <Drawing s={live} code={session.code} suspense={live.hidden} />
          )}
        </div>
        {paused && <div className="paused" role="status" data-testid="screen-paused">Pause : l’animateur reprend dans un instant</div>}
        {!channel.online && <div className="reco" role="status" data-testid="screen-offline">Reconnexion…</div>}
      </div>
      <button onClick={toggleFullscreen} className="fs" aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}

function Lobby({ s, code }: { s: TombolaLive; code: string }) {
  const phones = s.phoneFrom !== null && s.phoneOpen
  return (
    <div className="tmb-lobby" data-testid="tombola-lobby">
      {phones ? (
        <div className="tmb-qr"><QRCode value={getInviteUrl(code)} size={360} level="M" fgColor="#0a0a14" style={{ width: '100%', height: 'auto' }} /></div>
      ) : (
        <div className="tmb-lobby-ball"><GoldRings w={520} h={460} /><Ball n={s.paper[0]?.[0] ?? 7} size={240} label="Tombola" /></div>
      )}
      <div className="tmb-lobby-text">
        <h1 className="gold-text">{phones ? 'Votre ticket sur votre téléphone' : 'La tombola va commencer'}</h1>
        {phones && <p className="lead">Scannez le QR code : vous recevez automatiquement un numéro de ticket.</p>}
        {s.paperCount > 0 && <p>Tickets papier : <b>{rangesText(s.paper)}</b></p>}
        {s.phoneFrom !== null && <p>Tickets téléphone : <b data-testid="screen-phone-count">{s.phoneCount} distribué{s.phoneCount > 1 ? 's' : ''}</b></p>}
        <p className="soon">Le tirage va bientôt commencer…</p>
      </div>
    </div>
  )
}

function Drawing({ s, code, suspense }: { s: TombolaLive; code: string; suspense: boolean }) {
  const last = s.draws[s.draws.length - 1] ?? null
  const shown = s.hidden ? null : last
  const pool = useMemo(() => machineSample(s, 60, s.draws.length + 7), [s])
  const winners = s.draws.filter((d) => d.o === 'winner').slice(-12)
  return (
    <>
      <Machine x={70} y={170} scale={0.95} mode={s.hidden ? 'hot' : 'idle'} drawn={s.draws.map((d) => d.n)} pool={pool} seed={s.draws.length + 3} />
      <div className="tmb-hero" data-testid="tombola-hero">
        {suspense || !shown ? (
          <div className="tmb-suspense"><span className="gold-text">Et le numéro gagnant est…</span></div>
        ) : (
          <div className={`tmb-hero-in o-${shown.o}`} key={shown.seq}>
            <Ball n={shown.n} size={340} />
            {shown.o === 'winner' ? (
              <div className="tmb-lot gold-text" data-testid="hero-lot">LOT {shown.lot}</div>
            ) : (
              <div className="tmb-lot off">{shown.o === 'absent' ? 'ABSENT' : 'DÉJÀ GAGNANT'}</div>
            )}
          </div>
        )}
      </div>
      <div className="tmb-winners" data-testid="screen-winners">
        <h2>GAGNANTS</h2>
        <div className="grid">
          {winners.map((w) => (
            <div key={w.seq} className={`w ${last && w.seq === last.seq ? 'now' : ''}`}><small>Lot {w.lot}</small><b>{w.n}</b></div>
          ))}
        </div>
        {lotsGiven(s) > winners.length && <p className="more">{lotsGiven(s)} lots attribués</p>}
      </div>
      <div className="tmb-foot">
        {shown && !suspense
          ? shown.o === 'winner'
            ? <>Le numéro <b>{shown.n}</b> se présente auprès de l’animateur 🎉</>
            : <>Numéro {shown.n} retiré : on tire à nouveau</>
          : <>{s.left} numéro{s.left > 1 ? 's' : ''} dans la machine</>}
      </div>
      {s.phoneOpen && s.phoneFrom !== null && (
        <div className="tmb-qr-mini"><QRCode value={getInviteUrl(code)} size={150} level="M" fgColor="#0a0a14" style={{ width: '100%', height: 'auto' }} /><span>Votre ticket</span></div>
      )}
    </>
  )
}
