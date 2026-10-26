'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote - le bulletin du participant (téléphone). On y arrive par le QR
// de la session (/invite redirige ici tant qu'AnimaVote est en cours).
// Pas de pseudo : l'arrivée est automatique. Parcours : toucher un choix
// (seulement sélectionné) → feuille de confirmation → « Confirmer mon vote »
// → envoi direct à la base (fonction vote_cast, seule juge) → verrouillé.
// Reprise après rechargement, coupure ou veille : même identité (jeton gardé
// sur le téléphone) et bulletin relu sur /api/vote/me. Aucun résultat ici.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import AnimaVoteLogo from '@/components/vote/AnimaVoteLogo'
import CandidatePhoto, { candidateName } from '@/components/vote/CandidateVisual'
import { voteFontVars } from '@/components/vote/fonts'
import { PHONE_CSS } from '@/components/vote/phone/styles'
import { VOTE_CSS } from '@/components/vote/styles'
import { useVoteChannel } from '@/hooks/useVoteChannel'
import { useWakeLock } from '@/hooks/useWakeLock'
import { closingRemainingMs, displayOrder, phoneScreen } from '@/lib/vote/machine'
import { forgetParticipant, readStoredParticipant, storeParticipant, type StoredVoteParticipant } from '@/lib/vote/participant-storage'
import type { CastResult, VoteActiveState, VoteCandidate, VoteEvent, VoteMe, VoteMyBallot, VoteState } from '@/lib/vote/types'
import { createClient } from '@/lib/supabase'

type Boot = 'checking' | 'ready' | 'none' | 'full' | 'error'
type Gone = { title: string; text: string }
/** Choix sélectionné (pas encore envoyé) pour un scrutin donné. */
type Pick = { eventId: string; id: string | 'blank' }

const vibrate = (pattern: number | number[]) => {
  try {
    // Avant tout toucher, le navigateur refuse (et le signale) : on s'abstient.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
    navigator.vibrate?.(pattern)
  } catch {
    /* non supporté : silencieux */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const CHECK = (
  <span className="avp-chk" aria-hidden>
    <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#1a1306" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
)

const LOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.4" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export default function VotePhonePage() {
  const params = useParams()
  const code = String(params.code ?? '')
  const photosHref = `/invite/${encodeURIComponent(code)}?photos=1`

  const [boot, setBoot] = useState<Boot>('checking')
  const [identity, setIdentity] = useState<StoredVoteParticipant | null>(null)
  const [gone, setGone] = useState<Gone | null>(null)
  const [myBallot, setMyBallot] = useState<VoteMyBallot | null>(null)
  /** Scrutin pour lequel la base a répondu « déjà voté » (écran dédié). */
  const [alreadyFor, setAlreadyFor] = useState<string | null>(null)
  /** Scrutin pour lequel la base a répondu « fermé » à mon envoi. */
  const [closedFor, setClosedFor] = useState<string | null>(null)
  const [pick, setPick] = useState<Pick | null>(null)
  const [sending, setSending] = useState(false)
  const [castError, setCastError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const sendingRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  // ---------- Arrivée (automatique) ou reprise ----------
  const join = useCallback(async () => {
    setBoot('checking')
    const stored = readStoredParticipant(code)
    try {
      const res = await fetch('/api/vote/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stored ? { code, participantId: stored.participantId, token: stored.token } : { code }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; sessionId?: string; participantId?: string; token?: string }
      if (res.ok && body.sessionId && body.participantId && body.token) {
        const me = { sessionId: body.sessionId, participantId: body.participantId, token: body.token }
        storeParticipant(code, me)
        setIdentity(me)
        setGone(null)
        setBoot('ready')
        return
      }
      if (res.status === 409) {
        if (body.error === 'Le vote est complet.') setBoot('full')
        else {
          forgetParticipant(code)
          setBoot('none')
        }
        return
      }
      setBoot('error')
    } catch {
      setBoot('error')
    }
  }, [code])

  useEffect(() => {
    const first = setTimeout(() => void join(), 0)
    return () => clearTimeout(first)
  }, [join])

  // ---------- État du téléphone (sans résultat) + MON bulletin ----------
  const loadMe = useCallback(async (): Promise<VoteState | null> => {
    if (!identity) return null
    const res = await fetch('/api/vote/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identity),
      cache: 'no-store',
    })
    if (res.status === 403 || res.status === 410) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setGone(res.status === 410
        ? { title: 'Le vote est terminé', text: 'Merci pour ta participation !' }
        : { title: 'Téléphone inconnu', text: body.error ?? 'Scanne à nouveau le QR code.' })
      return null
    }
    if (!res.ok) return null
    const body = (await res.json()) as VoteMe
    // Une relecture partie avant mon envoi ne doit pas effacer le bulletin que je viens de poser.
    setMyBallot((prev) => body.myBallot ?? (prev && body.state.active && body.state.event?.id === prev.eventId ? prev : null))
    return body.state
  }, [identity])

  const channel = useVoteChannel(identity && !gone ? identity.sessionId : null, 'phone', identity ? loadMe : undefined)
  const { refresh } = channel
  const offset = channel.clockOffsetMs

  // Vote quitté par l'animateur : fin propre, identité oubliée.
  const ended = channel.state !== null && !channel.state.active
  const finished: Gone | null = gone ?? (ended ? { title: 'Le vote est terminé', text: 'Merci pour ta participation !' } : null)
  const isFinished = finished !== null
  useEffect(() => {
    if (isFinished) forgetParticipant(code)
  }, [isFinished, code])

  useWakeLock(boot === 'ready' && !isFinished)

  const state: VoteActiveState | null = channel.state?.active ? channel.state : null
  const event = state?.event ?? null

  // Compte à rebours de fermeture : affiché et respecté à la seconde.
  const closesAt = event?.status === 'open' ? event.closesAt : null
  useEffect(() => {
    if (!closesAt) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [closesAt])

  // Ouverture du vote : petite vibration.
  const lastStatus = useRef<string | null>(null)
  useEffect(() => {
    const status = event ? `${event.id}:${event.status}` : null
    if (event?.status === 'open' && lastStatus.current !== status && lastStatus.current !== null) vibrate(20)
    lastStatus.current = status
  }, [event])

  const serverNow = now + offset
  const remainingMs = state ? closingRemainingMs(state, serverNow) : null
  let screen = state ? phoneScreen(state, myBallot, serverNow) : null
  if (screen === 'choose' && event && closedFor === event.id) screen = 'closed'

  const currentPick = pick && event && pick.eventId === event.id ? pick.id : null

  // ---------- Envoi du bulletin ----------
  async function confirm() {
    if (!identity || !event || !currentPick || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setCastError(null)
    const blank = currentPick === 'blank'
    let result: CastResult | null = null
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      const { data, error } = await supabase.rpc('vote_cast', {
        p_session_id: identity.sessionId,
        p_participant_id: identity.participantId,
        p_token: identity.token,
        p_event_id: event.id,
        p_candidate_id: blank ? null : currentPick,
        p_blank: blank,
      })
      if (!error && data) result = data as CastResult
      else await sleep(300 * (attempt + 1))
    }
    sendingRef.current = false
    setSending(false)

    if (!result) {
      setCastError('Connexion difficile : ton vote n’est pas parti. Réessaie.')
      return
    }
    if (result.ok) {
      setMyBallot({ eventId: event.id, candidateId: result.candidateId, blank: result.blank })
      setAlreadyFor(result.already ? event.id : null)
      setPick(null)
      vibrate(result.already ? 40 : [15, 40, 25])
      return
    }
    switch (result.reason) {
      case 'closed':
        setClosedFor(event.id)
        setPick(null)
        void refresh()
        return
      case 'unknown_participant':
        setGone({ title: 'Téléphone inconnu', text: 'Scanne à nouveau le QR code.' })
        return
      case 'invalid':
        setPick(null)
        setCastError('Ce choix n’est plus disponible. Choisis à nouveau.')
        void refresh()
        return
      case 'no_game':
        void refresh()
        return
    }
  }

  function select(id: string | 'blank') {
    if (!event || sending) return
    setCastError(null)
    setPick({ eventId: event.id, id })
    vibrate(12)
  }

  // ---------- Rendu ----------
  let content: React.ReactNode
  if (finished) {
    content = <EndState title={finished.title} text={finished.text} photosHref={photosHref} />
  } else if (boot === 'checking' || (boot === 'ready' && !state)) {
    content = <div className="avp-state"><span className="av-spin" aria-label="Chargement" /></div>
  } else if (boot === 'none') {
    content = <EndState title="Aucun vote en cours" text="Attends que l’animateur ouvre le vote, puis rescanne le QR code." photosHref={photosHref} />
  } else if (boot === 'full') {
    content = <EndState title="Le vote est complet" text="Le nombre maximum de téléphones est atteint pour ce vote." photosHref={photosHref} />
  } else if (boot === 'error') {
    content = (
      <div className="avp-state">
        <h2>Connexion difficile</h2>
        <p>Le réseau est saturé. Réessaie dans un instant.</p>
        <button type="button" className="avp-retry" onClick={() => void join()}>Réessayer</button>
      </div>
    )
  } else if (!event || screen === 'waiting') {
    content = <Waiting event={event} />
  } else if (screen === 'voted' && myBallot) {
    content = <Voted event={event} ballot={myBallot} already={alreadyFor === event.id} />
  } else if (screen === 'closed') {
    content = <EndState title="Le vote est terminé" text="Regarde l’écran géant pour découvrir les résultats." icon="closed" />
  } else {
    content = (
      <Choose
        event={event}
        seed={`${identity?.participantId ?? ''}:${event.id}`}
        pick={currentPick}
        sending={sending}
        error={castError}
        remainingMs={remainingMs}
        onSelect={select}
        onCancel={() => setPick(null)}
        onConfirm={() => void confirm()}
      />
    )
  }

  return (
    <div className={`av-root avp ${voteFontVars}`}>
      <style>{VOTE_CSS + PHONE_CSS}</style>
      <div className="avp-in">{content}</div>
    </div>
  )
}

// ---------------------------------------------------------------------

function Head({ event, text }: { event: VoteEvent | null; text?: string | null }) {
  return (
    <div className="avp-head">
      <AnimaVoteLogo variant="small" size="19px" />
      {event && <h1>{event.title}</h1>}
      {text && <p>{text}</p>}
    </div>
  )
}

function Waiting({ event }: { event: VoteEvent | null }) {
  const thumbs = event ? [...event.candidates].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 6) : []
  return (
    <>
      <Head event={event} />
      <div className="avp-state">
        <div className="avp-medal">
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(212,175,55,.35)" strokeWidth="3" strokeDasharray="4 7" />
            <rect x="34" y="26" width="32" height="42" rx="5" fill="#f7f0e3" />
            <path d="M41 47l7 7 12-13" fill="none" stroke="#7c3aed" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity=".35" />
          </svg>
        </div>
        <h2>Le vote ouvre <span className="av-gold">dans un instant</span></h2>
        <p>{event?.intro ?? (thumbs.length > 0 ? 'Découvre les choix en attendant. Cette page s’ouvrira toute seule.' : 'Cette page s’ouvrira toute seule.')}</p>
        {event?.displayMode !== 'text' && thumbs.length > 0 && (
          <div className="avp-thumbs">
            {thumbs.map((c) => <div key={c.id}><CandidatePhoto candidate={c} clean /></div>)}
          </div>
        )}
      </div>
    </>
  )
}

interface ChooseProps {
  event: VoteEvent
  seed: string
  pick: string | null
  sending: boolean
  error: string | null
  remainingMs: number | null
  onSelect: (id: string | 'blank') => void
  onCancel: () => void
  onConfirm: () => void
}

function Choose({ event, seed, pick, sending, error, remainingMs, onSelect, onCancel, onConfirm }: ChooseProps) {
  const list = useMemo(() => displayOrder(event.candidates, event.shuffle, seed), [event.candidates, event.shuffle, seed])
  const picked = pick && pick !== 'blank' ? event.candidates.find((c) => c.id === pick) ?? null : null
  const secondRound = event.roundNo > 1
  const subtitle = secondRound ? 'Nouveau vote : tu peux voter à nouveau.' : event.subtitle ?? 'Touche ton choix, puis confirme.'
  const dimmed = pick ? ' avp-dimmed' : ''

  let choices: React.ReactNode
  if (event.displayMode === 'photo') {
    choices = (
      <div className={`${list.length <= 2 ? 'avp-duo' : 'avp-grid'}${dimmed}`}>
        {list.map((c) => (
          <button key={c.id} type="button" className={`avp-cand${pick === c.id ? ' sel' : ''}`} aria-pressed={pick === c.id} onClick={() => onSelect(c.id)}>
            {c.number && <span className="av-num">{c.number}</span>}
            {CHECK}
            <CandidatePhoto candidate={c} clean={list.length <= 2} />
            <span className="meta"><b>{c.label}</b>{c.description && <span>{c.description}</span>}</span>
          </button>
        ))}
      </div>
    )
  } else if (event.displayMode === 'card') {
    choices = (
      <div className={`avp-list${dimmed}`}>
        {list.map((c) => (
          <button key={c.id} type="button" className={`avp-card${pick === c.id ? ' sel' : ''}`} aria-pressed={pick === c.id} onClick={() => onSelect(c.id)}>
            <span className="tile"><CandidatePhoto candidate={c} square clean /></span>
            <span className="tx"><b>{c.label}</b>{c.description && <span>{c.description}</span>}</span>
            {pick === c.id ? CHECK : c.number && <span className="n">N°{c.number}</span>}
          </button>
        ))}
      </div>
    )
  } else {
    choices = (
      <div className={`avp-list${dimmed}`}>
        {list.map((c) => (
          <button key={c.id} type="button" className={`avp-row${pick === c.id ? ' sel' : ''}`} aria-pressed={pick === c.id} onClick={() => onSelect(c.id)}>
            <span className="rad">{pick === c.id && <SmallCheck />}</span>
            <span>{c.emoji ? `${c.emoji} ` : ''}{c.label}</span>
            {c.number && <span className="n">N°{c.number}</span>}
          </button>
        ))}
      </div>
    )
  }

  return (
    <>
      {secondRound && <span className="avp-ribbon">SECOND TOUR</span>}
      <Head event={event} text={subtitle} />
      {remainingMs !== null && (
        <div className="avp-closing" role="status">
          <span className="av-dot" />
          Dernières secondes pour voter !
          <b>{Math.ceil(remainingMs / 1000)} s</b>
        </div>
      )}
      <div className={`avp-body${pick ? ' sheet-open' : ''}`}>
        {error && !pick && <p className="avp-err" role="alert">{error}</p>}
        {choices}
        {event.allowBlank && (
          <div className={`avp-blankwrap${dimmed}`}>
            <button type="button" className={`avp-row blank${pick === 'blank' ? ' sel' : ''}`} aria-pressed={pick === 'blank'} onClick={() => onSelect('blank')}>
              <span className="rad">{pick === 'blank' && <SmallCheck />}</span>
              Vote blanc
            </button>
          </div>
        )}
      </div>
      <p className="avp-foot">Un seul vote par téléphone. Ton choix reste anonyme.</p>

      <div className={`avp-sheet${pick ? ' on' : ''}`} role="dialog" aria-modal="false" aria-label="Confirmer mon vote" aria-hidden={!pick}>
        <div className="grab" />
        <div className="ey">TU CHOISIS</div>
        <div className="avp-mini">
          {picked && event.displayMode !== 'text' && <div className="pic"><CandidatePhoto candidate={picked} clean /></div>}
          <div>
            <b>{pick === 'blank' ? 'Vote blanc' : picked ? candidateName(picked) : ''}</b>
            {picked?.description && <span>{picked.description}</span>}
          </div>
        </div>
        {error && <p className="avp-err" role="alert">{error}</p>}
        <button type="button" className="avp-gold" onClick={onConfirm} disabled={sending || !pick} tabIndex={pick ? 0 : -1}>
          {sending ? <span className="av-spin" aria-label="Envoi" /> : 'CONFIRMER MON VOTE'}
        </button>
        <button type="button" className="avp-ghost" onClick={onCancel} disabled={sending} tabIndex={pick ? 0 : -1}>Changer mon choix</button>
        <div className="avp-warn">{LOCK}Une fois confirmé, ton vote est définitif.</div>
      </div>
    </>
  )
}

function SmallCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#1a1306" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function Voted({ event, ballot, already }: { event: VoteEvent; ballot: VoteMyBallot; already: boolean }) {
  const chosen: VoteCandidate | null = ballot.candidateId ? event.candidates.find((c) => c.id === ballot.candidateId) ?? null : null
  const choice = ballot.blank ? 'vote blanc' : chosen ? candidateName(chosen) : 'enregistré'
  return (
    <div className="avp-state">
      {already ? (
        <div className="avp-medal">
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="45" fill="none" stroke="#d4af37" strokeWidth="5" />
            <circle cx="50" cy="50" r="36" fill="rgba(124,58,237,.3)" />
            <rect x="36" y="46" width="28" height="22" rx="4" fill="#f3dc9b" />
            <path d="M41 46v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#f3dc9b" strokeWidth="5" />
          </svg>
        </div>
      ) : (
        <div className="avp-medal">
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle className="ring" cx="50" cy="50" r="45" fill="none" stroke="#d4af37" strokeWidth="5" />
            <circle cx="50" cy="50" r="36" fill="rgba(124,58,237,.35)" />
            <path className="draw" d="M33 51l11 11 23-24" fill="none" stroke="#f3dc9b" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <h2>{already ? 'VOTE DÉJÀ' : 'VOTE'} <span className="av-gold">ENREGISTRÉ</span></h2>
      <p className="lead">{already ? 'Ce téléphone a déjà voté pour ce vote.' : event.thanks ?? 'Merci pour ta participation !'}</p>
      <div className="avp-locked">
        {chosen && event.displayMode !== 'text' && <div className="pic"><CandidatePhoto candidate={chosen} clean /></div>}
        <div>
          <b>Ton choix : {choice}</b>
          <span>{already ? 'Aucun nouveau vote possible' : 'Verrouillé pour ce vote'}</span>
        </div>
        {LOCK}
      </div>
      <div className="avp-watch"><span className="av-spin" aria-hidden />Regarde l’écran géant pour découvrir le résultat.</div>
    </div>
  )
}

function EndState({ title, text, photosHref, icon }: { title: string; text: string; photosHref?: string; icon?: 'closed' }) {
  return (
    <>
      <div className="avp-head"><AnimaVoteLogo variant="small" size="19px" /></div>
      <div className="avp-state">
        <div className="avp-medal">
          {icon === 'closed' ? (
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e0409a" strokeWidth="5" />
              <circle cx="50" cy="50" r="36" fill="rgba(224,64,154,.22)" />
              <path d="M38 34h24M38 66h24M41 34c0 12 18 14 18 32M59 34c0 12-18 14-18 32" fill="none" stroke="#f7f0e3" strokeWidth="4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(212,175,55,.35)" strokeWidth="3" strokeDasharray="4 7" />
              <rect x="34" y="26" width="32" height="42" rx="5" fill="#f7f0e3" />
            </svg>
          )}
        </div>
        <h2>{title}</h2>
        <p>{text}</p>
        {photosHref && <a href={photosHref} className="avp-link">Partager des photos</a>}
      </div>
    </>
  )
}
