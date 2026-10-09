'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz sur l'écran géant (/live). Le buzzer est le héros : le même
// objet que sur la carte promo et les téléphones, en très grand. Lisible à
// 10 m. Ne reçoit que des données publiques : l'état diffusé sur le canal
// privé (pseudos et écarts déjà destinés à l'écran) et les compteurs du statut.

import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import QRCode from 'react-qr-code'
import AnimaBuzzLogo from '@/components/buzzer/AnimaBuzzLogo'
import Buzzer from '@/components/buzzer/Buzzer'
import { buzzerFontVars } from '@/components/buzzer/fonts'
import { STAGE_CSS } from '@/components/buzzer/live/stageStyles'
import { BUZZER_CSS } from '@/components/buzzer/styles'
import { useBuzzerChannel } from '@/hooks/useBuzzerChannel'
import type { BuzzerLiveStatus } from '@/hooks/useBuzzerStatus'
import { windowEndsAt } from '@/lib/buzzer/machine'
import type { BuzzerActiveState } from '@/lib/buzzer/types'
import { getInviteUrl } from '@/lib/utils'
import type { Session } from '@/types/database'

interface BuzzerGameProps {
  session: Session
  status: BuzzerLiveStatus
}

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

const formatGap = (ms: number) => `+${(ms / 1000).toFixed(2).replace('.', ',')} s`

// Confettis : positions fixes (pas de hasard au rendu).
const CONFETTI_COLORS = ['#d4af37', '#f3d77a', '#a855f7', '#d946ef', '#ffffff', '#c084fc']
const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  left: `${(i * 2.17 + (i % 5) * 3.1) % 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  '--t': `${(2 + (i % 7) * 0.22).toFixed(2)}s`,
  '--d': `${(0.35 + (i % 9) * 0.07).toFixed(2)}s`,
  '--rot': `${(i % 2 ? 1 : -1) * (240 + i * 13)}deg`,
}))

export default function BuzzerGame({ session, status }: BuzzerGameProps) {
  const channel = useBuzzerChannel(status.sessionId)
  const { refresh } = channel
  const state = channel.state?.active ? channel.state : null
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)
  const [now, setNow] = useState(() => Date.now())

  // Plein écran : même règle que les autres jeux. Mac = faux plein écran (le
  // conteneur est déjà fixed inset-0) : jamais l'API native qui crée un Space.
  const toggleFullscreen = useCallback(async () => {
    if (isMac) {
      setIsFullscreen((prev) => !prev)
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isMac])

  // Chrono : rafraîchi 4 fois par seconde pendant que les buzzers sont ouverts.
  const ticking = state?.phase === 'open' && !!state.deadlineAt
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [ticking])

  // Fin de la fenêtre après le 1er buzz : on relit la file complète (suivants et écarts).
  const windowEnd = state?.phase === 'buzzed' ? windowEndsAt(state) : null
  const offset = channel.clockOffsetMs
  useEffect(() => {
    if (windowEnd === null) return
    const wait = Math.max(0, windowEnd - (Date.now() + offset)) + 300
    const timer = setTimeout(() => void refresh(), wait)
    return () => clearTimeout(timer)
  }, [windowEnd, offset, refresh])

  return (
    <div className={`bzs ${buzzerFontVars}`} data-fullscreen={isFullscreen || undefined}>
      <style>{BUZZER_CSS + STAGE_CSS}</style>
      <div className="bzs-stage">
        <Scene session={session} status={status} state={state} serverNow={now + offset} />
      </div>
      <button onClick={toggleFullscreen} className="bzs-fs" aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}

function Top({ round, right }: { round?: string; right: string }) {
  return (
    <div className="bzs-top">
      <span className="flex items-center">
        <AnimaBuzzLogo variant="small" subtitle={false} size="2.3cqw" />
        {round && <span className="round">{round}</span>}
      </span>
      <span>{right}</span>
    </div>
  )
}

function Scene({ session, status, state, serverNow }: { session: Session; status: BuzzerLiveStatus; state: BuzzerActiveState | null; serverNow: number }) {
  const players = `${status.playerCount} ${state?.mode === 'team' ? 'téléphone' : 'joueur'}${status.playerCount > 1 ? 's' : ''}`
  const round = state && state.roundNo > 0 ? `Manche ${state.roundNo}` : undefined

  // ---------- Lobby (ou état pas encore reçu) ----------
  if (!state || state.phase === 'lobby') {
    const shown = status.recent.slice(0, 20)
    const more = Math.max(0, status.playerCount - shown.length)
    return (
      <>
        <Top right={`Code ${session.code}`} />
        <div className="bzs-lobby">
          <div className="l">
            <div className="title"><AnimaBuzzLogo variant="full" size="6.4cqw" /></div>
            <div className="bzs-qr">
              <div className="code"><QRCode value={getInviteUrl(session.code)} size={256} level="M" fgColor="#0a0a14" style={{ width: '100%', height: '100%' }} /></div>
              <div className="how"><b>Scannez pour jouer</b>{getInviteUrl(session.code).replace(/^https?:\/\//, '')}<br />Aucune application</div>
            </div>
          </div>
          <div className="r">
            <div className="bzs-count">{status.playerCount}<small>{state?.mode === 'team' ? 'téléphones connectés' : 'joueurs connectés'}</small></div>
            {shown.length === 0 ? (
              <p className="bzs-empty">Les premiers inscrits apparaîtront ici.</p>
            ) : (
              <div className="bzs-names">
                {shown.map((name, i) => <span key={name} className={i < 3 ? 'new' : undefined}>{name}</span>)}
                {more > 0 && <span className="more">+{more} autre{more > 1 ? 's' : ''}</span>}
              </div>
            )}
          </div>
          <div className="sleep"><Buzzer state="off" size="9cqw" /></div>
        </div>
      </>
    )
  }

  // ---------- Test des buzzers ----------
  if (state.phase === 'test') {
    const pct = status.playerCount > 0 ? Math.round((status.testedCount / status.playerCount) * 100) : 0
    return (
      <>
        <Top round="Avant la partie" right={players} />
        <div className="bzs-banner top"><div className="bzs-headline" style={{ fontSize: '3.4cqw' }}>Test des buzzers</div></div>
        <div className="bzs-center"><Buzzer state="test" size="29cqw" /></div>
        <div className="bzs-banner bottom">
          <div className="bzs-sub" style={{ font: '400 2.6cqw var(--font-bz-display), sans-serif', color: '#fff' }}>
            {status.testedCount} / {status.playerCount} buzzers testés
          </div>
          <div className="bzs-gauge"><i style={{ width: `${pct}%` }} /></div>
        </div>
      </>
    )
  }

  // ---------- Attente ----------
  if (state.phase === 'waiting') {
    return (
      <>
        <Top round={round} right={players} />
        <div className="bzs-center"><Buzzer state="off" size="29cqw" /></div>
        <div className="bzs-banner bottom"><div className="bzs-headline dim">Préparez-vous</div></div>
      </>
    )
  }

  // ---------- Buzzers ouverts (ou réouverts après une mauvaise réponse) ----------
  if (state.phase === 'open') {
    const reopened = state.attempt > 1
    const total = state.timerS ?? 0
    const left = state.deadlineAt ? Math.max(0, Math.ceil((Date.parse(state.deadlineAt) - serverNow) / 1000)) : null
    return (
      <>
        <Top round={round} right={players} />
        {reopened && state.blocked.length > 0 && (
          <div className="bzs-banner top"><div className="bzs-sub">{listNames(state.blocked)} ne {state.blocked.length > 1 ? 'peuvent' : 'peut'} plus buzzer</div></div>
        )}
        <div className="bzs-center"><Buzzer key={`open-${state.roundNo}-${state.attempt}`} state="open" size="29cqw" /></div>
        <div className="bzs-banner bottom"><div className="bzs-headline"><span className="bzs-dot" />{reopened ? 'Buzzers réouverts' : 'Buzzers ouverts'}</div></div>
        {left !== null && total > 0 && (
          <div className="bzs-chrono">
            <svg viewBox="0 0 100 100"><circle className="bg" cx="50" cy="50" r="45" /><circle className="fg" cx="50" cy="50" r="45" style={{ strokeDashoffset: 283 * (1 - left / total) }} /></svg>
            <span>{left}</span>
          </div>
        )}
      </>
    )
  }

  // ---------- Quelqu'un a la main ----------
  if (state.phase === 'buzzed' && state.priority) {
    const holder = state.priority
    const firstEntry = state.queue[0]
    const tookOver = firstEntry !== undefined && firstEntry.unit !== holder.unit
    const holderEntry = state.queue.find((q) => q.unit === holder.unit)
    const followers = state.queue.filter((q) => q.status === 'queued').slice(0, 3)
    const nameClass = `name${holder.label.length > 9 ? ' long' : ''}`
    return (
      <div key={`buzz-${state.roundNo}-${state.attempt}-${holder.unit}`} style={{ display: 'contents' }}>
        <Top round={round} right={players} />
        {tookOver ? (
          <>
            <div className="bzs-amber" />
            <div className="bzs-center"><div className="bzs-recede" style={{ animationDelay: '0s' }}><Buzzer state="wrong" size="29cqw" /></div></div>
            <div className="bzs-wrongA">
              <div className="bzs-headline">Mauvaise réponse</div>
              <div className="bzs-sub">{listNames(state.blocked.slice(-1))} ne peut plus buzzer pour cette manche</div>
            </div>
            <div className="bzs-callout bzs-delay">
              <div className="eyebrow">Prend la main{holderEntry ? ` · ${formatGap(holderEntry.gapMs)} après ${firstEntry.label}` : ''}</div>
              <div className={nameClass}>{holder.label.toUpperCase()} !</div>
            </div>
          </>
        ) : (
          <>
            <div className="bzs-center"><div className="bzs-recede"><Buzzer state="pressed" size="29cqw" /></div></div>
            <div className="bzs-shock" /><div className="bzs-shock s2" /><div className="bzs-flash" />
            <div className="bzs-callout">
              <div className="eyebrow">1er buzz</div>
              <div className={nameClass}>{holder.label.toUpperCase()} !</div>
            </div>
          </>
        )}
        {followers.length > 0 && (
          <div className="bzs-next" style={tookOver ? { animation: 'bzs-fadeup .4s ease-out 2.2s both' } : undefined}>
            {followers.map((q) => (
              <div key={q.unit}><span className="r">{q.rank}</span><span className="n">{q.label}</span><span className="g">{formatGap(q.gapMs)}</span></div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---------- Manche terminée ----------
  if (state.outcome === 'won' && state.winner) {
    return (
      <div key={`won-${state.roundNo}`} style={{ display: 'contents' }}>
        <Top round={round} right={players} />
        <div className="bzs-center"><div className="bzs-recede" style={{ animationDelay: '.1s' }}><Buzzer state="win" size="29cqw" /></div></div>
        <div className="bzs-confetti">
          {CONFETTI.map((c, i) => <i key={i} style={c as CSSProperties} />)}
        </div>
        <div className="bzs-callout">
          <div className="eyebrow">Bonne réponse</div>
          <div className={`name gold${state.winner.length > 9 ? ' long' : ''}`}>{state.winner.toUpperCase()}</div>
          <div className="meta">remporte la manche {state.roundNo}</div>
        </div>
      </div>
    )
  }

  const cancelled = state.outcome === 'cancelled'
  const allBlocked = state.outcome === 'no_answer' && state.blocked.length > 0
  return (
    <>
      <Top round={round} right={players} />
      <div className="bzs-center"><Buzzer state="late" size="29cqw" /></div>
      <div className="bzs-banner bottom">
        <div className="bzs-headline dim">{cancelled ? 'Manche annulée' : allBlocked ? 'Personne n’a trouvé !' : 'Personne n’a buzzé !'}</div>
        <div className="bzs-sub">{cancelled ? 'Préparez-vous pour la suivante' : `Manche ${state.roundNo} notée sans réponse`}</div>
      </div>
    </>
  )
}

/** « Luna », « Luna et Chris », « Luna, Chris et Mango ». */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}
