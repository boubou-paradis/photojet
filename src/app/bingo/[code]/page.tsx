'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — téléphone du joueur. On y arrive par le QR de la session
// (/invite redirige ici tant que la partie est en cours). Un prénom, puis
// le(s) carton(s) ; le joueur pose ses jetons et appuie sur « QUINE ! ».
// Tout le fonctionnement (mémoire locale, relectures, renvoi des demandes)
// est dans PhoneController : cette page ne fait qu'afficher.

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useParams } from 'next/navigation'
import '@/components/bingo/bingo.css'
import '@/components/bingo/phone.css'
import { Ball } from '@/components/bingo/Ball'
import { PhoneCard } from '@/components/bingo/phone/PhoneCard'
import { useBingoTitles } from '@/hooks/useBingoTitles'
import type { PublicTitle } from '@/lib/bingo/music'
import { BINGO_NAME_MAX, PHASE_LABELS } from '@/lib/bingo/constants'
import { claimButtonLabel, currentPhase, inWords } from '@/lib/bingo/display'
import { PhoneController, type PhoneSnapshot } from '@/lib/bingo/phone-controller'
import type { StoredCard } from '@/lib/bingo/phone-store'
import { bestRow, fullRows, linesNeeded, visibleLast, wrongMarks } from '@/lib/bingo/phone-view'
import type { Phase } from '@/lib/bingo/types'

const CLAIM_SUB: Record<Phase, string> = { quine: 'J’AI UNE LIGNE COMPLÈTE', double: 'J’AI DEUX LIGNES COMPLÈTES', plein: 'MON CARTON EST PLEIN' }
const NEXT_STEP: Record<Phase, string> = { quine: 'la quine', double: 'la double quine', plein: 'le carton plein' }

function useController(code: string) {
  const [ctl] = useState(() => new PhoneController(code))
  useEffect(() => {
    ctl.start()
    return () => ctl.stop()
  }, [ctl])
  const snap = useSyncExternalStore(ctl.subscribe, ctl.get, ctl.get)
  return [ctl, snap] as const
}

export default function BingoPhonePage() {
  const params = useParams()
  const code = String(params.code ?? '').toUpperCase()
  const [ctl, s] = useController(code)

  return (
    <main className="bgo bgo-phone" data-testid="bingo-phone" data-stage={s.stage}>
      <div className="app">
        {s.stage === 'loading' && <Hello title="ANIMABINGO" text="Chargement de la partie…" />}
        {s.stage === 'join' && <Join code={code} s={s} onJoin={(name) => void ctl.join(name)} />}
        {s.stage === 'closed' && (
          <Hello title="ANIMABINGO" text={s.online ? 'Pas de partie ouverte pour le moment. Cette page se met à jour toute seule.' : 'Reconnexion…'}>
            <a className="link" href={`/invite/${encodeURIComponent(code)}?photos=1`}>Partager des photos</a>
          </Hello>
        )}
        {s.stage === 'play' && s.mem && <Play ctl={ctl} s={s} code={code} />}
      </div>
      {s.notice && <div className="toast" role="status" data-testid="phone-notice">{s.notice}</div>}
    </main>
  )
}

function Hello({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="hello">
      <Ball n={77} size={96} label="AnimaBingo" />
      <h1 className="gold-text">{title}</h1>
      <p>{text}</p>
      {children}
    </div>
  )
}

function Join({ code, s, onJoin }: { code: string; s: PhoneSnapshot; onJoin: (name: string) => void }) {
  const [name, setName] = useState('')
  const phases = s.pub?.active ? s.pub.phases : []
  return (
    <div className="hello">
      <Ball n={77} size={96} label="AnimaBingo" />
      <h1 className="gold-text">ANIMABINGO</h1>
      <p>Recevez votre carton, posez vos jetons et criez {phases.length ? `« ${PHASE_LABELS[phases[0]].toUpperCase()} ! »` : '« QUINE ! »'} avant les autres.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onJoin(name.trim())
        }}
      >
        <label htmlFor="prenom-joueur">Votre prénom</label>
        <input
          id="prenom-joueur"
          name="prenom-joueur"
          className="input"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={BINGO_NAME_MAX}
          placeholder="Emma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="phone-name"
          required
        />
        {s.joinError && <div className="err" role="alert">{s.joinError}</div>}
        <button className="btn gold" type="submit" disabled={s.joining || !name.trim()} data-testid="phone-join">
          {s.joining ? 'Un instant…' : 'Recevoir mon carton'}
        </button>
      </form>
      <a className="link" href={`/invite/${encodeURIComponent(code)}?photos=1`}>Juste partager des photos</a>
    </div>
  )
}

/**
 * Loto musical : empreinte de la playlist de la partie du joueur. Gardée sur le
 * téléphone (par partie) : un autre jeu à l'écran ou une coupure n'affiche
 * jamais un carton musical comme un carton numéros.
 */
function useKnownMusic(gameId: string, pub: Extract<PhoneSnapshot['pub'], { active: true }> | null) {
  const key = `animabingo:mode:${gameId}`
  const live = pub && pub.gameId === gameId ? pub.music ?? null : undefined
  useEffect(() => {
    if (live === undefined) return
    try {
      if (live) window.localStorage.setItem(key, JSON.stringify(live))
      else window.localStorage.removeItem(key)
    } catch { /* stockage indisponible */ }
  }, [key, live])
  if (live !== undefined) return live
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { sig?: unknown; n?: unknown } | null
    return v && typeof v.sig === 'string' && typeof v.n === 'number' ? { sig: v.sig, n: v.n } : null
  } catch {
    return null
  }
}

function Play({ ctl, s, code }: { ctl: PhoneController; s: PhoneSnapshot; code: string }) {
  const mem = s.mem!
  const pub = s.pub?.active ? s.pub : null
  const music = useKnownMusic(mem.gameId, pub)
  const titles = useBingoTitles(code, music)
  const held = s.pub?.active === false && s.pub.held === true
  const [active, setActive] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const claimCard = mem.claim ? mem.cards.find((c) => c.id === mem.claim!.cardId) : undefined
  const index = claimCard ? mem.cards.indexOf(claimCard) : Math.min(active, mem.cards.length - 1)
  const card = mem.cards[index]
  const marks = mem.marks[card.id] ?? []
  const phase = currentPhase(pub)
  const last = visibleLast(pub, now + s.offset)
  // Loto musical : pendant l'écoute, le titre en cours n'est pas encore dans
  // `drawn` ; on ne signale rien en ambre avant sa révélation (recalculé ensuite).
  const wrong = s.outcome === 'rejected' && mem.claim && pub && !(music && pub.hidden) ? wrongMarks(mem.claim.marks, pub.drawn) : []
  const canClaim = !!pub && !!phase && ['running', 'checking', 'celebrating'].includes(pub.status) && !mem.claim
  const frozen = !!mem.claim && s.outcome === null

  const recentWinners = useMemo(() => {
    if (!pub || pub.status !== 'celebrating' || !phase) return []
    return pub.winners.filter((w) => w.phase === phase)
  }, [pub, phase])

  let button = phase ? claimButtonLabel(phase) : s.pub ? 'PARTIE TERMINÉE' : 'CHARGEMENT…'
  if (pub?.status === 'lobby') button = 'EN ATTENTE DU TIRAGE'
  else if (pub?.status === 'finished') button = 'PARTIE TERMINÉE'
  else if (held) button = 'PARTIE EN PAUSE'

  return (
    <>
      <header>
        <Ball n={77} size={40} label="AnimaBingo" />
        <div className="who">
          <b>{mem.name}</b>
          <span data-testid="phone-net">
            <i className={`dot ${s.online ? '' : 'off'}`} />
            {s.online ? 'Connecté' : 'Reconnexion…'}
          </span>
        </div>
        {phase && <span className="pill">{PHASE_LABELS[phase].toUpperCase()}</span>}
      </header>

      {!s.online && <div className="strip warn" role="status" data-testid="phone-offline">Reconnexion… vos jetons sont gardés sur ce téléphone.</div>}
      {s.volatile && <div className="strip warn">Navigation privée : ne fermez pas cette page, vos jetons ne seraient pas gardés.</div>}
      {held && <div className="strip warn" data-testid="phone-held">Un autre jeu est à l’écran. Votre carton et vos jetons sont gardés.</div>}
      {pub?.paused && pub.status !== 'finished' && <div className="strip warn" data-testid="phone-paused">Pause : l’animateur reprend dans un instant.</div>}
      {pub?.status === 'lobby' && <div className="strip">La partie va commencer : gardez cette page ouverte.</div>}
      {pub?.status === 'finished' && <div className="strip win">Partie terminée. Merci d’avoir joué !</div>}
      {recentWinners.length > 0 && !mem.claim && (
        <div className="strip win" data-testid="phone-celebrating">
          {PHASE_LABELS[phase!]} pour {recentWinners.map((w) => (pub!.display.showName !== false && w.name ? w.name : `le carton n° ${w.serial}`)).join(', ')} !
        </div>
      )}
      {music && pub?.hidden && pub.status !== 'lobby' && (
        <div className="strip last" data-testid="phone-listening">
          <div className="grow"><small>MORCEAU N° {pub.count + 1}</small><span className="song">Écoutez… quel est ce titre ?</span></div>
          <div className="eqp" aria-hidden><i /><i /><i /><i /></div>
        </div>
      )}
      {music && !pub?.hidden && last && pub?.status !== 'lobby' && titles && (
        <div className="strip last" data-testid="phone-last">
          <div className="grow"><small>DERNIER TITRE</small><span className="song">{titles[last - 1]?.t}<small>{titles[last - 1]?.a}</small></span></div>
        </div>
      )}
      {!music && last && pub?.status !== 'lobby' && (
        <div className="strip last" data-testid="phone-last">
          <div className="grow"><small>DERNIER NUMÉRO</small><em>{inWords(last)}</em></div>
          <Ball n={last} size={46} />
        </div>
      )}

      {mem.cards.length > 1 && (
        <div className="tabs" style={{ '--n': mem.cards.length } as CSSProperties} role="tablist">
          {mem.cards.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={i === index} className={`tab ${i === index ? 'on' : ''}`} onClick={() => setActive(i)} disabled={!!claimCard} data-testid="phone-tab">
              Carton {i + 1}<b>n° {c.serial}</b>
              <div className="dots">{[0, 1, 2, 3, 4].map((j) => <i key={j} className={j < bestRow(c.cells, mem.marks[c.id] ?? []) ? 'f' : ''} />)}</div>
            </button>
          ))}
        </div>
      )}

      {music && !titles ? (
        <div className="strip" role="status" data-testid="phone-titles-loading">Chargement des titres de votre carton…</div>
      ) : (
        <PhoneCard card={card} marks={marks} wrong={wrong} frozen={frozen} onToggle={(n) => ctl.toggle(card.id, n)} titles={titles} />
      )}
      <div className="legend"><span>{music ? 'Touchez un titre quand vous l’entendez' : 'Touchez un numéro pour poser un jeton'}</span><span><b data-testid="phone-count">{marks.length}</b> / 15</span></div>

      <div className="spacer" />
      <button className="quine" type="button" disabled={!canClaim} onClick={() => ctl.claim(card.id)} data-testid="phone-claim">
        {button}
        {canClaim && phase && <small>{CLAIM_SUB[phase]}</small>}
      </button>
      <div className="hint">La régie vérifie votre carton avant de valider.</div>

      {mem.claim && s.outcome === null && <Checking sent={mem.claim.claimId !== null} online={s.online} phase={phase} />}
      {mem.claim && s.outcome === 'accepted' && claimCard && (
        <Won card={claimCard} marks={mem.claim.marks} phase={phase} s={s} onBack={() => ctl.dismiss()} titles={titles} />
      )}
      {mem.claim && s.outcome === 'rejected' && claimCard && (
        <Refused card={claimCard} marks={mem.claim.marks} wrong={wrong} onBack={() => ctl.dismiss()} titles={titles} />
      )}
    </>
  )
}

function Checking({ sent, online, phase }: { sent: boolean; online: boolean; phase: Phase | null }) {
  return (
    <div className="sheet verif" role="dialog" aria-modal="true" aria-label="Vérification" data-testid="phone-checking" data-sent={sent ? '1' : '0'}>
      <div className="spin" />
      <h1>VÉRIFICATION…</h1>
      <p>{sent ? 'Votre demande est arrivée en régie. Restez sur cette page.' : 'Votre demande est gardée sur ce téléphone et partira toute seule dès le retour du réseau.'}</p>
      <div className="steps">
        <div className="done"><i>✓</i>{phase ? `${PHASE_LABELS[phase]} demandée` : 'Demande enregistrée'}</div>
        {sent ? (
          <div className="done" data-testid="phone-sent"><i>✓</i>Reçue par la régie</div>
        ) : (
          <div className="wait" data-testid="phone-unsent"><i />{online ? 'Envoi en cours…' : 'Pas encore envoyée : renvoi automatique'}</div>
        )}
        <div className={sent ? 'now' : ''}><i />L’animateur vérifie votre carton</div>
      </div>
    </div>
  )
}

const CROWN = (
  <svg className="crown" viewBox="0 0 110 80" aria-hidden>
    <defs><linearGradient id="bgp-cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6d2" /><stop offset=".5" stopColor="#e2bf55" /><stop offset="1" stopColor="#8a6a12" /></linearGradient></defs>
    <path d="M8 66 L14 22 L36 44 L55 10 L74 44 L96 22 L102 66 Z" fill="url(#bgp-cg)" stroke="#5a4210" strokeWidth="2" />
    <rect x="8" y="64" width="94" height="12" rx="4" fill="url(#bgp-cg)" />
    <circle cx="55" cy="10" r="6" fill="#a66bff" /><circle cx="14" cy="22" r="5" fill="#a66bff" /><circle cx="96" cy="22" r="5" fill="#a66bff" />
  </svg>
)

function Won({ card, marks, phase, s, onBack, titles }: { card: StoredCard; marks: number[]; phase: Phase | null; s: PhoneSnapshot; onBack: () => void; titles: readonly PublicTitle[] | null }) {
  const pub = s.pub?.active ? s.pub : null
  // Phase gagnée = celle de la demande ; la partie a peut-être déjà avancé.
  const claimPhase = pub && s.mem?.claim ? pub.phases[s.mem.claim.phaseIndex] : phase
  const rows = fullRows(card.cells, marks)
  const nextPhase = pub && s.mem?.claim ? pub.phases[s.mem.claim.phaseIndex + 1] : undefined
  const confetti = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    left: `${(i * 37) % 100}%`, background: ['#f6e3a1', '#d4af37', '#a66bff', '#ffffff'][i % 4], '--d': `${3 + (i % 5)}s`, '--w': `${-(i % 7) * 0.6}s`,
  } as CSSProperties)), [])
  return (
    <div className="sheet win" role="dialog" aria-modal="true" aria-label="Gagné" data-testid="phone-won">
      <div className="confetti">{confetti.map((st, i) => <i key={i} style={st} />)}</div>
      {CROWN}
      <h1 className="gold-text" style={{ fontSize: 44 }}>{claimPhase ? PHASE_LABELS[claimPhase].toUpperCase() : 'GAGNÉ'}<br />VALIDÉE !</h1>
      <p>
        Carton n° {card.serial}{claimPhase && rows.length ? ` · ligne${rows.length > 1 ? 's' : ''} ${rows.slice(0, linesNeeded(claimPhase)).join(' et ')}` : ''}
        {pub?.display.showName !== false ? <><br />Votre prénom s’affiche sur le grand écran.</> : null}
      </p>
      <PhoneCard card={card} marks={marks} mini titles={titles} />
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>{nextPhase ? `La partie continue : prochaine étape, ${NEXT_STEP[nextPhase]}.` : 'Bravo, et merci d’avoir joué !'}</p>
      <button className="btn gold" type="button" onClick={onBack} data-testid="phone-back">Reprendre mon carton</button>
    </div>
  )
}

function Refused({ card, marks, wrong, onBack, titles }: { card: StoredCard; marks: number[]; wrong: number[]; onBack: () => void; titles: readonly PublicTitle[] | null }) {
  const names = titles ? wrong.map((n) => `« ${titles[n - 1]?.t ?? n} »`) : null
  return (
    <div className="sheet nope" role="dialog" aria-modal="true" aria-label="Pas encore" data-testid="phone-refused">
      <h1>PAS ENCORE !</h1>
      <p>{titles ? 'Le carton ne correspond pas encore aux titres passés.' : 'Le carton ne correspond pas encore aux numéros sortis.'}</p>
      {names && wrong.length > 0 && (
        <p style={{ fontSize: 14, color: '#f3c98a' }}>
          {wrong.length === 1 ? <><b>{names[0]}</b> n’est pas encore passé : son jeton est signalé en ambre.</> : <><b>{names.join(', ')}</b> ne sont pas encore passés : leurs jetons sont signalés en ambre.</>} Retirez-le{wrong.length > 1 ? 's' : ''} et continuez à jouer.
        </p>
      )}
      {!names && wrong.length > 0 && (
        <p style={{ fontSize: 14, color: '#f3c98a' }}>
          {wrong.length === 1 ? <>Le <b>{wrong[0]}</b> n’est pas encore sorti : son jeton est signalé en ambre.</> : <>Les <b>{wrong.join(', ')}</b> ne sont pas encore sortis : leurs jetons sont signalés en ambre.</>} Retirez-le{wrong.length > 1 ? 's' : ''} et continuez à jouer.
        </p>
      )}
      <PhoneCard card={card} marks={marks} wrong={wrong} mini titles={titles} />
      <button className="btn gold" type="button" onClick={onBack} data-testid="phone-back">Reprendre mon carton</button>
    </div>
  )
}
