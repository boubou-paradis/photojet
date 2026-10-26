'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote sur l'écran géant (/live). Scènes de la maquette validée : lobby
// avec QR, classement en direct (les lignes glissent, les pourcentages
// s'interpolent) ou compteur seul en mode caché, compte à rebours, puis
// révélation pas à pas (montée, podium 3e → 2e → 1er, gagnant, égalité,
// classement complet). Ne reçoit que des données publiques et agrégées :
// jamais qui a voté pour qui.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import QRCode from 'react-qr-code'
import AnimaVoteLogo from '@/components/vote/AnimaVoteLogo'
import CandidatePhoto, { candidateName } from '@/components/vote/CandidateVisual'
import { voteFontVars } from '@/components/vote/fonts'
import { STAGE_CSS } from '@/components/vote/live/stageStyles'
import { VOTE_CSS } from '@/components/vote/styles'
import { useVoteChannel } from '@/hooks/useVoteChannel'
import type { VoteLiveStatus } from '@/hooks/useVoteStatus'
import { closingRemainingMs } from '@/lib/vote/machine'
import { computeRanking, participationPercent, revealPlan, type RankedCandidate, type Ranking } from '@/lib/vote/results'
import type { VoteActiveState, VoteCandidate, VoteEvent } from '@/lib/vote/types'
import { getInviteUrl } from '@/lib/utils'
import type { Session } from '@/types/database'

interface VoteGameProps {
  session: Session
  status: VoteLiveStatus
}

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

const RING = 326.7 // circonférence des anneaux (r = 52)
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

// Confettis : positions fixes (pas de hasard au rendu).
const CONFETTI_COLORS = ['#d4af37', '#f3dc9b', '#a855f7', '#e0409a', '#4f7cff', '#ffffff']
const CONFETTI = Array.from({ length: 42 }, (_, i) => ({
  left: `${(i * 23.7) % 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  animationDuration: `${(3.5 + (i % 5) * 0.7).toFixed(1)}s`,
  animationDelay: `${(-((i * 0.37) % 5)).toFixed(2)}s`,
}))
const BALLOTS = Array.from({ length: 14 }, (_, i) => ({
  left: `${5 + i * 6.6}%`,
  animationDelay: `${(-((i * 0.53) % 7)).toFixed(2)}s`,
  animationDuration: `${6 + (i % 4)}s`,
}))

export default function VoteGame({ session, status }: VoteGameProps) {
  const channel = useVoteChannel(status.sessionId, 'screen')
  const { refresh } = channel
  const state = channel.state?.active ? channel.state : null
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)
  const [now, setNow] = useState(() => Date.now())

  // Plein écran : même règle que les autres jeux (Mac = faux plein écran).
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

  // Compte à rebours : rafraîchi 4 fois par seconde ; à l'heure de fin, relecture (étape « fermé »).
  const closesAt = state?.event?.status === 'open' ? state.event.closesAt : null
  const offset = channel.clockOffsetMs
  useEffect(() => {
    if (!closesAt) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    const wait = Math.max(0, Date.parse(closesAt) - (Date.now() + offset)) + 600
    const settle = setTimeout(() => void refresh(), wait)
    return () => {
      clearInterval(timer)
      clearTimeout(settle)
    }
  }, [closesAt, offset, refresh])

  return (
    <div className={`av-root avs ${voteFontVars}`} data-fullscreen={isFullscreen || undefined}>
      <style>{VOTE_CSS + STAGE_CSS}</style>
      <div className="avs-stage">
        <Scene session={session} state={state} serverNow={now + offset} />
      </div>
      <button onClick={toggleFullscreen} className="avs-fs" aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}

function Brand() {
  return <div className="avs-brand"><AnimaVoteLogo variant="small" size="2.1cqw" /></div>
}

function Chip({ text, ok }: { text: string; ok?: boolean }) {
  return <div className="avs-chip"><span className={`av-dot${ok ? ' ok' : ''}`} />{text}</div>
}

function Confetti() {
  return (
    <div className="avs-confetti" aria-hidden>
      {CONFETTI.map((c, i) => <i key={i} style={c} />)}
    </div>
  )
}

function Scene({ session, state, serverNow }: { session: Session; state: VoteActiveState | null; serverNow: number }) {
  const event = state?.event ?? null

  if (!state || !event || event.status === 'lobby') return <Lobby session={session} event={event} participants={state?.participants ?? 0} />

  const ranking = computeRanking(event.candidates, state.results)

  if (event.status === 'open') {
    const remaining = closingRemainingMs(state, serverNow)
    return (
      <>
        {state.results ? (
          <LiveBoard key={`live-${event.id}`} event={event} ranking={ranking} total={state.total} />
        ) : event.roundNo > 1 ? (
          <SecondRound key={`r2-${event.id}`} session={session} event={event} total={state.total} participants={state.participants} />
        ) : (
          <HiddenCount key={`hidden-${event.id}`} total={state.total} participants={state.participants} />
        )}
        {remaining !== null && <Countdown remainingMs={remaining} totalS={event.countdownS} />}
      </>
    )
  }

  if (event.status === 'closed') {
    if (state.results) return <LiveBoard key={`closed-${event.id}`} event={event} ranking={ranking} total={state.total} closed />
    return (
      <div className="avs-scene" key={`closed-${event.id}`}>
        <Brand />
        <Chip text="Vote clos" ok />
        <div className="avs-center">
          <div className="avs-done">VOTE <span className="av-gold">TERMINÉ</span></div>
          <div className="count">{plural(state.total, 'vote')} enregistré{state.total > 1 ? 's' : ''}</div>
          <p>Les résultats arrivent dans un instant…</p>
        </div>
      </div>
    )
  }

  // ---------- Révélation pas à pas ----------
  const plan = revealPlan(event.revealMode, ranking)
  const stepIndex = Math.min(event.revealStep, plan.length - 1)
  const step = plan[stepIndex]
  const key = `rv-${event.id}-${stepIndex}`

  switch (step.kind) {
    case 'intro':
      return (
        <div className="avs-scene" key={key}>
          <Brand />
          <div className="avs-rv">
            <div className="l1">LES VOTES SONT <span className="av-gold">CLOS</span></div>
            <div className="l2"><b className="av-gold">{state.total}</b>{state.total > 1 ? 'PARTICIPANTS ONT VOTÉ' : 'PARTICIPANT A VOTÉ'}</div>
            <div className="l3">Découvrons le résultat…</div>
          </div>
        </div>
      )
    case 'empty':
      return (
        <div className="avs-scene" key={key}>
          <Brand />
          <div className="avs-center">
            <div className="avs-title">Aucun vote</div>
            <p>{ranking.blank > 0 ? `${plural(ranking.blank, 'vote blanc')}, aucun choix départagé.` : 'Personne n’a voté pour ce scrutin.'}</p>
          </div>
        </div>
      )
    case 'tie':
      return <Tie key={key} entries={step.entries} />
    case 'full':
      return <FullRanking key={key} event={event} ranking={ranking} />
    case 'winner':
      if (event.revealMode === 'podium') return <Podium key={key} plan={plan} upTo={stepIndex} total={ranking.valid} />
      return <Winner key={key} entry={step.entries[0]} />
    case 'place':
      return <Podium key={key} plan={plan} upTo={stepIndex} total={ranking.valid} />
  }
}

// ---------------------------------------------------------------------

function Lobby({ session, event, participants }: { session: Session; event: VoteEvent | null; participants: number }) {
  const url = getInviteUrl(session.code)
  const floats = event ? [...event.candidates].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 8) : []
  return (
    <div className="avs-scene">
      {event?.displayMode !== 'text' && floats.length > 0 && (
        <div className="avs-floats" aria-hidden>
          {floats.map((c, i) => <div key={c.id} className="mini" style={{ '--i': i } as CSSProperties}><CandidatePhoto candidate={c} clean /></div>)}
        </div>
      )}
      <Chip text="Le vote ouvre bientôt" ok />
      <div className="avs-lobby">
        <div>
          <AnimaVoteLogo size="6.2cqw" mark tagline="À vous de voter !" />
          {event && <h2>{event.title}</h2>}
          {event?.subtitle && <div className="sub">{event.subtitle}</div>}
          <div className="cta">Scannez le QR code pour participer · aucune application</div>
          <div className="avs-count"><b>{participants}</b><span>{participants > 1 ? 'participants connectés' : 'participant connecté'}</span></div>
        </div>
        <div>
          <div className="avs-qr"><QRCode value={url} size={256} level="M" fgColor="#0a0a14" style={{ width: '100%', height: 'auto' }} /></div>
          <div className="avs-qr-url">{url.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>
    </div>
  )
}

/** Nombre qui glisse vers sa nouvelle valeur (pas de saut à chaque vote). */
function Tween({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  useEffect(() => {
    let raf = 0
    const step = () => {
      const cur = shownRef.current
      const next = Math.abs(value - cur) < 0.4 ? value : cur + (value - cur) * 0.12
      shownRef.current = next
      setShown(next)
      if (next !== value) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{Math.round(shown)}</>
}

const BOARD_HEIGHT_CQW = 39
const MAX_ROWS = 10

function LiveBoard({ event, ranking, total, closed }: { event: VoteEvent; ranking: Ranking; total: number; closed?: boolean }) {
  const shown = ranking.entries.slice(0, MAX_ROWS)
  const hiddenCount = ranking.entries.length - shown.length
  const stepCqw = Math.min(5.6, BOARD_HEIGHT_CQW / Math.max(shown.length, 1))
  const rh = stepCqw * 0.875
  const max = shown[0]?.votes ?? 0
  // Position par candidat (ordre stable de rendu = ordre de l'éditeur) : seule la translation change, d'où le glissement.
  const position = new Map(shown.map((e, i) => [e.candidate.id, i]))
  const rows = [...shown].sort((a, b) => a.candidate.sortOrder - b.candidate.sortOrder)
  return (
    <div className="avs-scene">
      <Brand />
      <Chip text={closed ? 'Vote clos' : 'En direct'} ok={closed} />
      <div className="avs-live">
        <div className="avs-live-h">
          <div>
            {event.roundNo > 1 && <span className="avs-ribbon" style={{ marginBottom: '1cqw' }}>SECOND TOUR</span>}
            <div className="avs-title">{closed ? <>Vote <span className="av-gold">clos</span></> : <>Classement <span className="av-gold">en direct</span></>}</div>
          </div>
          <div className="meta"><b><Tween value={total} /></b>{total > 1 ? 'votes enregistrés' : 'vote enregistré'}</div>
        </div>
        <div className="avs-board" style={{ height: `${stepCqw * shown.length}cqw`, '--rh': `${rh}cqw` } as CSSProperties}>
          {rows.map((e) => {
            const index = position.get(e.candidate.id) ?? 0
            const first = e.rank === 1 && e.votes > 0
            return (
              <div key={e.candidate.id} className={`avs-row${first ? ' first' : ''}`} style={{ transform: `translateY(${index * stepCqw}cqw)`, height: `${rh}cqw` }}>
                <div className="rk">{e.rank}</div>
                <div className="av"><CandidatePhoto candidate={e.candidate} square clean /></div>
                <div className="avs-barw">
                  <div className="avs-bar" style={{ width: `${max > 0 ? 18 + (82 * e.votes) / max : 18}%` }} />
                  <div className="avs-bart">
                    <span className="nm">{e.candidate.label}{e.candidate.number && <small>N°{e.candidate.number}</small>}</span>
                    <span><span className="pc"><Tween value={e.percent} /></span> %<small>{plural(e.votes, 'vote')}</small></span>
                  </div>
                </div>
              </div>
            )
          })}
          {hiddenCount > 0 && <div className="avs-more">+ {plural(hiddenCount, 'autre choix')}</div>}
        </div>
      </div>
    </div>
  )
}

function HiddenCount({ total, participants }: { total: number; participants: number }) {
  const pct = participationPercent(total, participants)
  return (
    <div className="avs-scene">
      <div className="avs-ballots" aria-hidden>{BALLOTS.map((b, i) => <i key={i} style={b} />)}</div>
      <Brand />
      <Chip text="Votes ouverts" />
      <div className="avs-hidden">
        <div>
          <div className="avs-title">Les votes sont <span className="av-gold">ouverts</span></div>
          <div className="avs-ring">
            <svg viewBox="0 0 120 120" aria-hidden>
              <defs><linearGradient id="avs-rg"><stop offset="0" stopColor="#7c3aed" /><stop offset="1" stopColor="#d4af37" /></linearGradient></defs>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
              <circle className="p" cx="60" cy="60" r="52" fill="none" stroke="url(#avs-rg)" strokeWidth="9" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - pct / 100)} />
            </svg>
            <div className="avs-ring-c"><b><Tween value={total} /></b><span>{total > 1 ? 'votes' : 'vote'} sur {plural(participants, 'connecté')}</span></div>
          </div>
          <div className="avs-note">Résultats révélés à la clôture</div>
        </div>
      </div>
    </div>
  )
}

function SecondRound({ session, event, total, participants }: { session: Session; event: VoteEvent; total: number; participants: number }) {
  const finalists = [...event.candidates].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 4)
  return (
    <div className="avs-scene">
      <Brand />
      <Chip text="Votes ouverts" />
      <div className="avs-r2">
        <div>
          <span className="avs-ribbon">SECOND TOUR</span>
          <div className="avs-title">Choisissez entre <span className="av-gold">les finalistes</span></div>
          <div className="sub">Votre téléphone affiche déjà le nouveau bulletin</div>
        </div>
        <div>
          <div className="duo">
            {finalists.map((c) => (
              <div key={c.id}>
                <div className="c av-frame">{c.number && <span className="av-num">{c.number}</span>}<CandidatePhoto candidate={c} /></div>
                <div className="nm">{candidateName(c)}</div>
              </div>
            ))}
          </div>
          <div className="count" style={{ marginTop: '2cqw' }}><b><Tween value={total} /></b>{total > 1 ? 'votes' : 'vote'} sur {plural(participants, 'connecté')}</div>
        </div>
        <div className="avs-noscan">
          <div className="q"><QRCode value={getInviteUrl(session.code)} size={128} level="M" fgColor="#0a0a14" style={{ width: '100%', height: 'auto' }} /></div>
          <span>Pas besoin<br />de rescanner</span>
        </div>
      </div>
    </div>
  )
}

function Countdown({ remainingMs, totalS }: { remainingMs: number; totalS: number }) {
  const left = Math.ceil(remainingMs / 1000)
  const done = remainingMs <= 0
  return (
    <div className="avs-cd" role="status">
      <div>
        {done ? (
          <>
            <div className="avs-done">VOTE<br /><span className="av-gold">TERMINÉ</span></div>
            <div className="hint">Plus aucun bulletin accepté</div>
          </>
        ) : (
          <>
            <div className="lbl">FERMETURE DANS</div>
            <div className="avs-cd-ring">
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" />
                <circle className="p" cx="60" cy="60" r="52" fill="none" stroke="#e0409a" strokeWidth="7" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - remainingMs / 1000 / Math.max(totalS, 1))} />
              </svg>
              <div className="avs-cd-n" key={left}>{left}</div>
            </div>
            <div className="hint">Dernières secondes pour voter !</div>
          </>
        )}
      </div>
    </div>
  )
}

function PodiumCards({ entries }: { entries: RankedCandidate[] }) {
  return (
    <div className="cards">
      {entries.slice(0, 3).map((e) => (
        <div key={e.candidate.id} className="card av-frame">
          {e.candidate.number && <span className="av-num">{e.candidate.number}</span>}
          <CandidatePhoto candidate={e.candidate} />
        </div>
      ))}
    </div>
  )
}

const names = (entries: RankedCandidate[]) => entries.map((e) => e.candidate.label).join(' & ')

function Podium({ plan, upTo, total }: { plan: ReturnType<typeof revealPlan>; upTo: number; total: number }) {
  const shown = plan.slice(1, upTo + 1)
  const third = shown.find((s) => s.kind === 'place' && s.rank === 3)
  const second = shown.find((s) => s.kind === 'place' && s.rank === 2)
  const first = shown.find((s) => s.kind === 'winner')
  const latest = plan[upTo]
  const slot = (cls: string, step: typeof third, label: string) => {
    const entries = step && step.kind !== 'intro' && step.kind !== 'empty' ? step.entries : []
    const isNew = step === latest
    if (entries.length === 0) return <div className={`avs-pd ${cls} hide`} aria-hidden><div className="step" /></div>
    const votes = entries[0].votes
    return (
      <div className={`avs-pd ${cls}${isNew ? ' in' : ''}`}>
        {cls === 'p1' ? <div className="avs-crown">LE CHOIX DU PUBLIC</div> : <div className="place">{label}</div>}
        <PodiumCards entries={entries} />
        <div className="who">{cls === 'p1' ? <span className="av-gold">{entries.length === 1 ? candidateName(entries[0].candidate) : names(entries)}</span> : names(entries)}</div>
        <div className="pc">{entries[0].percent} % · {plural(votes, 'vote')}{total > 0 && entries.length > 1 ? ' chacun' : ''}</div>
        <div className="step">{cls[1]}</div>
      </div>
    )
  }
  return (
    <div className="avs-scene">
      <div className="avs-spot" />
      <Brand />
      <div className="avs-podium">
        {slot('p2', second, '2e place')}
        {slot('p1', first, '')}
        {slot('p3', third, '3e place')}
      </div>
      {first && <Confetti />}
    </div>
  )
}

function Winner({ entry }: { entry: RankedCandidate }) {
  return (
    <div className="avs-scene">
      <div className="avs-spot" />
      <Brand />
      <div className="avs-winner">
        <div className="card">{entry.candidate.number && <span className="av-num">{entry.candidate.number}</span>}<CandidatePhoto candidate={entry.candidate} /></div>
        <div className="txt">
          <span className="avs-crown">LE CHOIX DU PUBLIC</span>
          <div className="name"><span className="av-gold">{entry.candidate.label}</span></div>
          {entry.candidate.number && <div className="pc">N°{entry.candidate.number}</div>}
          <div className="pc">{entry.percent} % · {plural(entry.votes, 'vote')}</div>
        </div>
      </div>
      <Confetti />
    </div>
  )
}

function Tie({ entries }: { entries: RankedCandidate[] }) {
  const shown = entries.slice(0, 4)
  const side = (e: RankedCandidate) => (
    <div className="side" key={e.candidate.id}>
      <div className="card av-frame">{e.candidate.number && <span className="av-num">{e.candidate.number}</span>}<CandidatePhoto candidate={e.candidate} /></div>
      <div className="who">{candidateName(e.candidate)}</div>
      <div className="v">{plural(e.votes, 'vote')} · {e.percent} %</div>
    </div>
  )
  const mid = (
    <div className="mid" key="mid">
      <div className="eq av-gold">ÉGALITÉ</div>
      <div className="vs">=</div>
      <div className="next">Second tour<br />dans un instant</div>
    </div>
  )
  const half = Math.ceil(shown.length / 2)
  return (
    <div className="avs-scene">
      <Brand />
      <div className="avs-tie">
        {shown.slice(0, half).map(side)}
        {mid}
        {shown.slice(half).map(side)}
      </div>
    </div>
  )
}

function FullRanking({ event, ranking }: { event: VoteEvent; ranking: Ranking }) {
  const entries = ranking.entries
  const cols = entries.length > 10 ? (entries.length > 20 ? 3 : 2) : 1
  const rows = Math.ceil(entries.length / cols)
  const rowh = Math.min(5, 40 / rows)
  return (
    <div className="avs-scene">
      <Brand />
      <div className="avs-full">
        <div className="avs-title">{event.title} · <span className="av-gold">classement</span></div>
        <div className="avs-full-list" style={{ '--rows': rows, '--cols': cols, '--rowh': `${rowh}cqw`, ...(cols === 1 ? { width: '62cqw', justifySelf: 'center' } : {}) } as CSSProperties}>
          {entries.map((e, i) => (
            <div key={e.candidate.id} className={`avs-fr${e.rank === 1 && e.votes > 0 ? ' first' : ''}`} style={{ animationDelay: `${(entries.length - 1 - i) * 0.12}s` }}>
              <span className="rk">{e.rank}</span>
              <span className="av"><CandidatePhoto candidate={e.candidate as VoteCandidate} square clean /></span>
              <span className="nm">{candidateName(e.candidate)}</span>
              <span className="pc">{e.percent} %<small>{plural(e.votes, 'vote')}</small></span>
            </div>
          ))}
        </div>
      </div>
      {ranking.leaders.length === 1 && <Confetti />}
    </div>
  )
}
