// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran géant AnimaBuzz — scènes des manches préparées (maquette validée).
// Ne reçoit que l'état public : la question une fois la manche lancée, la
// réponse et l'image après la révélation, les résultats du vote à la clôture.
// `renderPrepScene` renvoie null quand la scène du mode libre convient
// (quelqu'un a la main, personne n'a buzzé…) : elle s'affiche alors telle quelle.

import type { CSSProperties, ReactNode } from 'react'
import AnimaBuzzLogo from '@/components/buzzer/AnimaBuzzLogo'
import Buzzer from '@/components/buzzer/Buzzer'
import { buzzerMediaUrl } from '@/lib/buzzer/media-client'
import { VOTE_LETTERS, voteBars, type PrepActiveState } from '@/lib/buzzer/prep-flow'
import type { BuzzerActiveState } from '@/lib/buzzer/types'

const CONFETTI_COLORS = ['#d4af37', '#f3d77a', '#a855f7', '#d946ef', '#ffffff', '#c084fc']
const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  left: `${(i * 2.53 + (i % 5) * 3.7) % 100}%`,
  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  '--t': `${(2.2 + (i % 7) * 0.22).toFixed(2)}s`,
  '--d': `${(0.25 + (i % 9) * 0.07).toFixed(2)}s`,
  '--rot': `${(i % 2 ? 1 : -1) * (220 + i * 11)}deg`,
}))

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
)

export function prepRoundLabel(prep: PrepActiveState): string {
  return `Manche ${Math.min(prep.roundIndex + 1, prep.total)} / ${prep.total}`
}

function PrepTop({ prep, chip }: { prep: PrepActiveState; chip?: string }) {
  return (
    <div className="bzs-top">
      <AnimaBuzzLogo variant="small" subtitle={false} size="2.3cqw" />
      <span className="bzx-chips">
        {chip && <span className="bzx-chip violet">{chip}</span>}
        <span className="bzx-chip">{prepRoundLabel(prep).toUpperCase()}</span>
      </span>
    </div>
  )
}

function questionClass(text: string): string {
  const n = [...text].length
  return n > 110 ? 'text xs' : n > 60 ? 'text sm' : 'text'
}

function voteQuestionClass(text: string): string {
  return [...text].length > 70 ? 'text xs' : 'text sm'
}

function answerClass(text: string): string {
  const n = [...text].length
  return n > 70 ? 't xl' : n > 28 ? 't long' : 't'
}

function Chrono({ state, serverNow }: { state: BuzzerActiveState; serverNow: number }) {
  const total = state.timerS ?? 0
  if (!state.deadlineAt || total <= 0) return null
  const left = Math.max(0, Math.ceil((Date.parse(state.deadlineAt) - serverNow) / 1000))
  return (
    <div className="bzs-chrono">
      <svg viewBox="0 0 100 100"><circle className="bg" cx="50" cy="50" r="45" /><circle className="fg" cx="50" cy="50" r="45" style={{ strokeDashoffset: 283 * (1 - left / total) }} /></svg>
      <span>{left}</span>
    </div>
  )
}

export function renderPrepScene({ state, prep, serverNow }: { state: BuzzerActiveState; prep: PrepActiveState; serverNow: number }): ReactNode | null {
  const n = prep.roundIndex + 1

  // ---------- Toutes les manches jouées ----------
  if (prep.step === 'end') {
    return (
      <div key="prep-end" style={{ display: 'contents' }}>
        <div className="bzs-top"><AnimaBuzzLogo variant="small" subtitle={false} size="2.3cqw" /><span className="bzx-chip">{prep.total} MANCHE{prep.total > 1 ? 'S' : ''}</span></div>
        <div className="bzs-confetti">{CONFETTI.map((c, i) => <i key={i} style={c as CSSProperties} />)}</div>
        <div className="bzs-center"><div className="bzs-recede" style={{ animationDelay: '.1s' }}><Buzzer state="win" size="26cqw" /></div></div>
        <div className="bzs-callout">
          <div className="eyebrow">Fin des manches</div>
          <div className="name gold">MERCI !</div>
        </div>
      </div>
    )
  }

  // ---------- Manche prête, pas encore lancée ----------
  if (prep.step === 'ready') {
    if (state.phase === 'open' || state.phase === 'buzzed') return null
    return (
      <div key={`prep-ready-${n}`} style={{ display: 'contents' }}>
        <PrepTop prep={prep} />
        <div className="bzs-center"><Buzzer state="off" size="27cqw" /></div>
        <div className="bzs-banner bottom">
          <div className="bzs-headline">Manche {n}</div>
          <div className="bzs-sub">Préparez-vous</div>
        </div>
      </div>
    )
  }

  // ---------- Question, buzzers ouverts (ou en attente après une pause) ----------
  if (prep.step === 'question') {
    if (state.phase !== 'open' && state.phase !== 'waiting') return null
    const open = state.phase === 'open'
    const reopened = open && state.attempt > 1
    const q = prep.question?.trim()
    return (
      <div key={`prep-q-${n}`} style={{ display: 'contents' }}>
        <PrepTop prep={prep} />
        {q && (
          <div className="bzx-q">
            <span className="eyebrow">Question {n}</span>
            <span className={questionClass(q)}>{q}</span>
          </div>
        )}
        <div className={q ? 'bzx-buzz' : 'bzs-center'}>
          <Buzzer key={`open-${state.roundNo}-${state.attempt}`} state={open ? 'open' : 'off'} size={q ? '21cqw' : '29cqw'} />
        </div>
        <div className="bzs-banner bottom">
          {open ? (
            <>
              <div className="bzs-headline" style={{ fontSize: '3.4cqw' }}><span className="bzs-dot" />{reopened ? 'Buzzers réouverts' : 'Buzzers ouverts'}</div>
              <div className="bzs-sub">{reopened && state.blocked.length > 0 ? `${listNames(state.blocked)} ne ${state.blocked.length > 1 ? 'peuvent' : 'peut'} plus buzzer` : 'Le premier qui buzze prend la main'}</div>
            </>
          ) : (
            <div className="bzs-headline dim" style={{ fontSize: '3.4cqw' }}>Préparez-vous</div>
          )}
        </div>
        {open && <Chrono state={state} serverNow={serverNow} />}
      </div>
    )
  }

  // ---------- Révélation de la réponse ----------
  if (prep.step === 'reveal') {
    const answer = prep.answer?.trim() || null
    const image = prep.imagePath ? buzzerMediaUrl(prep.imagePath) : null
    // Ni réponse ni image : la scène du mode libre (gagnant ou « personne ») suffit.
    if (!answer && !image) return null
    const won = state.outcome === 'won' && !!state.winner
    return (
      <div key={`prep-reveal-${n}`} style={{ display: 'contents' }}>
        <PrepTop prep={prep} />
        {won && <div className="bzs-confetti">{CONFETTI.map((c, i) => <i key={i} style={c as CSSProperties} />)}</div>}
        <div className="bzs-banner top" style={{ top: '7cqw' }}>
          <span style={{ font: '600 1.9cqw var(--font-inter), sans-serif', letterSpacing: '.32em', textTransform: 'uppercase', color: '#f3d77a' }}>La réponse</span>
        </div>
        <div className={`bzx-reveal${image && answer ? '' : ' solo'}`}>
          {image && (
            <div className={`bzx-cover${answer ? '' : ' photo'}`}>
              <div className="disc" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" />
            </div>
          )}
          {(answer || won) && (
            <div className="bzx-answer">
              {answer && <span className={answerClass(answer)}>{answer}</span>}
              {won && <span className="win"><Check />Trouvé par {state.winner}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------- Vote de la salle ----------
  const vote = prep.vote
  if (!vote) return null
  const cols = vote.choices.length === 3 ? 3 : 2

  if (prep.step === 'vote_open') {
    return (
      <div key={`prep-vote-${vote.id}`} style={{ display: 'contents' }}>
        <PrepTop prep={prep} chip="VOTE DE LA SALLE" />
        <div className="bzx-q" style={{ top: '6.6cqw' }}>
          <span className="eyebrow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f3d77a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
            Votez sur votre téléphone
          </span>
          <span className={voteQuestionClass(vote.question)}>{vote.question}</span>
        </div>
        <div className="bzx-choices" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {vote.choices.map((c, i) => (
            <div key={i} className="bzx-choice" style={{ animationDelay: `${0.15 + i * 0.1}s` }}><span className="k">{VOTE_LETTERS[i]}</span><span className="n">{c}</span></div>
          ))}
        </div>
        <div className="bzx-count">
          <span className="ring">{vote.count}</span>
          <span className="lbl"><b>vote{vote.count > 1 ? 's' : ''} reçu{vote.count > 1 ? 's' : ''}</b><span>Vous pouvez changer d’avis jusqu’à la clôture</span></span>
        </div>
      </div>
    )
  }

  if (prep.step === 'vote_closed') {
    const results = vote.results ?? vote.choices.map(() => 0)
    const { pct, top, total } = voteBars(results, vote.correct)
    return (
      <div key={`prep-results-${vote.id}`} style={{ display: 'contents' }}>
        <PrepTop prep={prep} chip="RÉSULTATS DU VOTE" />
        <div className="bzx-q" style={{ top: '6.6cqw' }}>
          <span className="eyebrow">La salle a voté</span>
          <span className={voteQuestionClass(vote.question)}>{vote.question}</span>
        </div>
        <div className="bzx-bars">
          {vote.choices.map((c, i) => (
            <div key={i} className={`bzx-bar${top === i ? ' top' : ''}`}>
              <span className="k">{VOTE_LETTERS[i]}</span>
              <div style={{ minWidth: 0 }}>
                <div className="row">
                  <span className="n">{c}{vote.correct === i && <span className="bzx-good"><Check />BONNE RÉPONSE</span>}</span>
                  <span className="p">{pct[i]} %</span>
                </div>
                <div className="track"><div className="fill" style={{ width: `${pct[i]}%`, animationDelay: `${0.3 + i * 0.15}s` }} /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bzs-banner bottom" style={{ bottom: '3cqw' }}>
          <div className="bzs-sub" style={{ fontSize: '2cqw' }}><b style={{ font: '400 2.4cqw var(--font-bz-display), sans-serif', color: '#f3d77a' }}>{total}</b> vote{total > 1 ? 's' : ''}</div>
        </div>
      </div>
    )
  }

  return null
}

/** « Luna », « Luna et Chris », « Luna, Chris et Mango ». */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
}
