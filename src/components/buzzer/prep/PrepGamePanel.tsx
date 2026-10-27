'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — panneau animateur d'une partie en manches préparées
// (maquette validée). Remplace le bloc de commandes du mode libre ; file,
// historique et joueurs restent ceux du mode libre. Montre la réponse
// attendue : ce panneau ne doit pas être projeté.
// Un seul bouton principal suit l'enchaînement (comme PageDown) :
// lancer la manche → buzz → réponse → lancer le vote → clôturer → suivante.

import { Check, EyeOff, Pause, Play, RotateCcw, Volume2, X } from 'lucide-react'
import Buzzer, { type BuzzerVisualState } from '@/components/buzzer/Buzzer'
import type { PrepExtract } from '@/hooks/usePrepExtract'
import { buzzerMediaUrl } from '@/lib/buzzer/media-client'
import { formatSeconds, type PrepRound } from '@/lib/buzzer/prep'
import { VOTE_LETTERS, nextPrepStep, voteBars, type PrepAction, type PrepActiveState } from '@/lib/buzzer/prep-flow'
import type { BuzzerActiveState } from '@/lib/buzzer/types'

interface PrepGamePanelProps {
  state: BuzzerActiveState
  prep: PrepActiveState
  /** Manches figées (null : pas encore relues). */
  rounds: PrepRound[] | null
  extract: PrepExtract
  busy: boolean
  resumeAfterRight: boolean
  onPrep: (action: PrepAction) => void
  onFree: (action: 'open' | 'test_start') => void
  onStop: () => void
}

const displayFont = { fontFamily: 'var(--font-bz-display), "Arial Black", sans-serif' } as const
const smallBtn = 'inline-flex items-center justify-center gap-2 px-3 py-2 min-h-10 rounded-lg text-sm border border-white/10 text-gray-200 hover:border-[#D4AF37]/40 disabled:opacity-40'
const bigBtn = 'w-full py-4 rounded-xl text-lg flex items-center justify-center gap-3 disabled:opacity-60'
const kbd = 'text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-black/25'
const cap = 'text-[11px] uppercase tracking-wider font-bold text-[#a7a2ba]'

/** Manche sans question, extrait, réponse ni image : elle commence par le vote. */
export function isVoteOnly(round: PrepRound | undefined): boolean {
  return !!round?.vote && !round.question && !round.audioPath && !round.answer && !round.imagePath
}

function fmt(s: number): string {
  return formatSeconds(Math.max(0, Math.floor(s)))
}

export default function PrepGamePanel({ state, prep, rounds, extract, busy, resumeAfterRight, onPrep, onFree, onStop }: PrepGamePanelProps) {
  const round = rounds?.[prep.roundIndex]
  const next = rounds?.[prep.roundIndex + 1]
  const ended = prep.step === 'end'
  const hasHand = prep.step === 'question' && state.phase === 'buzzed' && !!state.priority
  const step = nextPrepStep(state, prep, { voteOnly: isVoteOnly(round) })
  const n = Math.min(prep.roundIndex + 1, prep.total)

  let visual: BuzzerVisualState = 'off'
  let status = ''
  let statusTone = 'border-white/15 text-[#cfcade]'
  if (ended) {
    status = 'Toutes les manches sont jouées'
  } else if (prep.step === 'ready') {
    status = 'Prête'
  } else if (prep.step === 'question') {
    if (state.phase === 'open') {
      visual = 'open'
      status = state.attempt > 1 ? 'Buzzers réouverts' : 'Buzzers ouverts'
      statusTone = 'border-emerald-400/60 text-emerald-300'
    } else if (state.phase === 'buzzed') {
      visual = 'win'
      status = state.priority ? `${state.priority.label} a la main` : 'Buzz reçu'
      statusTone = 'border-[#D4AF37] text-[#f3d77a]'
    } else if (state.phase === 'waiting') {
      status = 'Buzzers fermés (pause)'
    } else {
      visual = 'late'
      status = state.outcome === 'cancelled' ? 'Manche annulée' : 'Personne n’a trouvé'
    }
  } else if (prep.step === 'reveal') {
    visual = state.outcome === 'won' ? 'tested' : 'off'
    status = state.outcome === 'won' && state.winner ? `Trouvé par ${state.winner}` : 'Réponse révélée'
    statusTone = 'border-[#D4AF37]/60 text-[#f3d77a]'
  } else if (prep.step === 'vote_open') {
    status = `Vote en cours · ${prep.vote?.count ?? 0} vote${(prep.vote?.count ?? 0) > 1 ? 's' : ''}`
    statusTone = 'border-violet-400/60 text-violet-200'
  } else if (prep.step === 'vote_closed') {
    status = 'Vote clôturé'
    statusTone = 'border-violet-400/60 text-violet-200'
  }

  const canSkip = !ended && (prep.step === 'ready' || prep.step === 'question')
  const canTest = prep.step === 'ready' && ['lobby', 'closed'].includes(state.phase)

  return (
    <section className="card-gold rounded-xl p-4 sm:p-5 flex flex-col gap-4 min-w-0" data-testid="prep-panel" data-step={prep.step}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Progress prep={prep} />
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-400/50 text-amber-300">
          <EyeOff className="h-3.5 w-3.5" aria-hidden />Ne pas projeter : montre les réponses
        </span>
      </div>

      <div className="flex items-center gap-4 min-w-0">
        <Buzzer state={visual} size="76px" mini label={hasHand ? '1er' : undefined} />
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm tracking-wider text-[#D4AF37]" style={displayFont}>{ended ? `${prep.total} MANCHE${prep.total > 1 ? 'S' : ''}` : `MANCHE ${n} / ${prep.total}`}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusTone}`} role="status">{status}</span>
            {!ended && typeof round?.points === 'number' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[#D4AF37]/50 text-[#D4AF37]">Manche à {round.points} pt{round.points > 1 ? 's' : ''}</span>
            )}
          </div>
          {!ended && (
            <p className="text-white text-xl sm:text-2xl leading-tight break-words" style={displayFont}>
              {round?.question || (isVoteOnly(round) ? 'Vote de la salle' : <span className="text-[#9a94b5] text-base font-sans">Sans question : jouez comme en mode libre</span>)}
            </p>
          )}
        </div>
      </div>

      {!ended && round && (round.answer || round.imagePath) && (
        <div className="flex items-center gap-4 p-3 rounded-xl border border-dashed border-emerald-400/50 bg-gradient-to-r from-emerald-400/10 to-transparent">
          {round.imagePath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={buzzerMediaUrl(round.imagePath)} alt="" className="w-14 h-14 rounded-lg object-cover flex-none ring-2 ring-[#f3d77a]" />
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className={`${cap} !text-emerald-300`}>Réponse attendue · vous seul</span>
            <span className="text-white text-lg break-words" style={displayFont}>{round.answer || 'Image seulement'}</span>
          </div>
        </div>
      )}

      {!ended && round?.audioPath && <ExtractBlock extract={extract} round={round} resumeAfterRight={resumeAfterRight} />}

      {ended ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#cfcade]">Les manches de la liste sont terminées. Les joueurs restent connectés : vous pouvez continuer en mode libre ou quitter AnimaBuzz.</p>
          <button className={`${bigBtn} bg-gradient-to-b from-[#fbe7a3] to-[#D4AF37] text-[#0a0a14]`} style={displayFont} disabled={busy} onClick={onStop}>Continuer en mode libre</button>
        </div>
      ) : hasHand ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button className={`${bigBtn} bg-gradient-to-b from-[#4ade80] to-[#22c55e] text-[#052e16]`} style={displayFont} disabled={busy} onClick={() => onPrep('right')}>
              <Check className="h-5 w-5" strokeWidth={3} aria-hidden />Bonne réponse<span className={kbd}>PageUp</span>
            </button>
            <button className={`${bigBtn} bg-gradient-to-b from-[#fcd34d] to-[#f59e0b] text-[#2b1702]`} style={displayFont} disabled={busy} onClick={() => onPrep('wrong')}>
              <X className="h-5 w-5" strokeWidth={3} aria-hidden />Mauvaise réponse<span className={kbd}>PageDown</span>
            </button>
          </div>
          <p className="text-xs text-[#a7a2ba] -mt-1">
            Bonne réponse : la réponse s’affiche sur l’écran géant{round?.audioPath && resumeAfterRight ? ' et la musique reprend' : ''}. Mauvaise réponse : la main passe au suivant, ou les buzzers se rouvrent{round?.audioPath ? ' et la musique reprend' : ''}.
          </p>
        </>
      ) : step ? (
        <button
          className={`${bigBtn} ${step.action === 'vote_open' || step.action === 'vote_close' ? 'bg-gradient-to-b from-[#b16cff] to-[#7c3aed] text-white' : 'bg-gradient-to-b from-[#fbe7a3] to-[#D4AF37] text-[#0a0a14]'}`}
          style={displayFont}
          disabled={busy}
          onClick={() => (step.action === 'open' ? onFree('open') : onPrep(step.action))}
        >
          {step.label}<span className={kbd}>PageDown</span>
        </button>
      ) : (
        <button className={`${bigBtn} bg-gradient-to-b from-[#b16cff] to-[#7c3aed] text-white`} style={displayFont} disabled>En attente d’un buzz…</button>
      )}

      {!ended && (
        <div className="flex flex-wrap gap-2">
          {prep.step === 'question' && state.phase === 'open' && (
            <button className={smallBtn} disabled={busy} onClick={() => onPrep('reveal')}>Personne ne trouve : révéler</button>
          )}
          {prep.step === 'ready' && prep.hasVote && !isVoteOnly(round) && (
            <button className={smallBtn} disabled={busy} onClick={() => onPrep('vote_open')}>Lancer le vote tout de suite</button>
          )}
          {canSkip && (
            <button className={smallBtn} disabled={busy} onClick={() => onPrep('next_round')}>Passer la manche</button>
          )}
          {canTest && <button className={smallBtn} disabled={busy} onClick={() => onFree('test_start')}>Tester les buzzers</button>}
          <button className={`${smallBtn} ml-auto`} disabled={busy} onClick={onStop}>Revenir au mode libre</button>
        </div>
      )}

      {!ended && <Sequence prep={prep} hasHand={hasHand} phase={state.phase} />}

      {!ended && (round?.vote || next) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {round?.vote && <VoteBox prep={prep} round={round} />}
          {next ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col gap-1 min-w-0">
              <span className={cap}>Manche suivante</span>
              <span className="text-sm text-white font-semibold truncate">{prep.roundIndex + 2} · {next.question || (isVoteOnly(next) ? 'Vote de la salle' : 'Sans question')}</span>
              <span className="text-xs text-[#a7a2ba]">
                {[next.audioPath ? `Extrait ${next.audioStart !== null && next.audioEnd !== null ? `${fmt(next.audioStart)} → ${fmt(next.audioEnd)}` : 'complet'}` : null, next.imagePath ? 'image' : null, next.vote ? 'vote' : null].filter(Boolean).join(' · ') || (next.answer ? 'Question et réponse' : 'Mode libre')}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col gap-1">
              <span className={cap}>Manche suivante</span>
              <span className="text-sm text-[#a7a2ba]">C’est la dernière manche de la liste.</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Progress({ prep }: { prep: PrepActiveState }) {
  const done = Math.min(prep.roundIndex, prep.total)
  if (prep.total > 24) {
    return (
      <div className="flex items-center gap-3 min-w-0 flex-1" aria-label="Avancement des manches">
        <div className="h-2 flex-1 min-w-24 max-w-xs rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-[#D4AF37]" style={{ width: `${(done / prep.total) * 100}%` }} /></div>
        <span className="text-xs text-[#a7a2ba] tabular-nums">{done} / {prep.total} jouées</span>
      </div>
    )
  }
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Avancement des manches">
      {Array.from({ length: prep.total }, (_, i) => {
        const cls = i < done ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/40' : i === prep.roundIndex ? 'bg-[radial-gradient(circle_at_40%_30%,#fff3c4,#d4af37_60%,#8a6516)] text-[#1A1A1E] border-transparent shadow-[0_0_12px_rgba(212,175,55,.6)]' : 'text-[#7d7891] border-white/10'
        return <li key={i} className={`w-7 h-7 rounded-full grid place-items-center text-xs border ${cls}`} style={displayFont} aria-current={i === prep.roundIndex ? 'step' : undefined}>{i + 1}</li>
      })}
    </ol>
  )
}

function ExtractBlock({ extract, round, resumeAfterRight }: { extract: PrepExtract; round: PrepRound; resumeAfterRight: boolean }) {
  const len = extract.length
  const pct = len && len > 0 ? Math.min(100, (extract.position / len) * 100) : 0
  return (
    <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-black/25 border border-white/[0.07]" data-testid="prep-extract" data-playing={extract.playing ? 'true' : 'false'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`${cap} !text-[#f3d77a] inline-flex items-center gap-2`}><Volume2 className="h-4 w-4" aria-hidden />Extrait sur la sono</span>
        <span className="text-xs text-[#a7a2ba] tabular-nums">
          {fmt(extract.position)}{len !== null ? ` / ${fmt(len)}` : ''} · coupé au premier buzz{resumeAfterRight ? '' : ', pas de reprise après une bonne réponse'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden" aria-hidden><div className="h-full bg-gradient-to-r from-[#f3d77a] to-[#a855f7]" style={{ width: `${pct}%` }} /></div>
      {extract.error && <p className="text-xs text-orange-300" role="alert">Extrait impossible à lire (connexion ?). Rechargez la page si le problème continue.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {extract.playing ? (
          <button className={smallBtn} onClick={extract.pause}><Pause className="h-4 w-4" aria-hidden />Pause</button>
        ) : (
          <button className={smallBtn} onClick={extract.resume}><Play className="h-4 w-4" aria-hidden />Lecture</button>
        )}
        <button className={smallBtn} onClick={extract.playFromStart}><RotateCcw className="h-4 w-4" aria-hidden />Rejouer depuis le début</button>
        <span className="text-xs text-[#a7a2ba] truncate max-w-[14rem]" title={round.audioName ?? undefined}>{round.audioName}</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-[#a7a2ba]">
          Volume
          <input type="range" min={5} max={100} value={Math.round(extract.volume * 100)} onChange={(e) => extract.setVolume(Number(e.target.value) / 100)} className="accent-[#D4AF37]" />
        </label>
      </div>
    </div>
  )
}

function Sequence({ prep, hasHand, phase }: { prep: PrepActiveState; hasHand: boolean; phase: string }) {
  const items: { key: string; label: string; on: boolean; done: boolean }[] = []
  const order = ['ready', 'question', 'reveal', 'vote_open', 'vote_closed']
  const at = order.indexOf(prep.step)
  items.push({ key: 'start', label: 'Lancer la manche', on: prep.step === 'ready', done: at > 0 })
  items.push({ key: 'buzz', label: hasHand ? 'Bonne / mauvaise réponse' : phase === 'open' ? 'Buzz…' : 'Buzz → réponse', on: prep.step === 'question', done: at > 1 })
  if (prep.hasVote) {
    items.push({ key: 'vote', label: 'Lancer le vote', on: prep.step === 'reveal', done: at > 2 })
    items.push({ key: 'close', label: 'Clôturer le vote', on: prep.step === 'vote_open', done: at > 3 })
  }
  items.push({ key: 'next', label: prep.roundIndex + 1 >= prep.total ? 'Fin des manches' : 'Manche suivante', on: prep.step === 'vote_closed' || (!prep.hasVote && prep.step === 'reveal'), done: false })
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.07]">
      <span className={cap}>Enchaînement · bouton principal ou télécommande <span className={`${kbd} text-gray-200 normal-case`}>PageDown</span></span>
      <ol className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li key={it.key} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${it.on ? 'bg-[#D4AF37] text-[#1A1A1E] border-[#D4AF37]' : it.done ? 'border-white/10 text-[#7d7891]' : 'border-white/15 text-[#cfcade]'}`}>{it.label}</li>
        ))}
      </ol>
    </div>
  )
}

function VoteBox({ prep, round }: { prep: PrepActiveState; round: PrepRound }) {
  const vote = round.vote!
  const closed = prep.step === 'vote_closed' && prep.vote?.results
  const bars = closed ? voteBars(prep.vote!.results!, vote.correct) : null
  return (
    <div className="rounded-xl border border-violet-400/30 bg-violet-500/[0.06] p-3 flex flex-col gap-2 min-w-0">
      <span className={`${cap} !text-violet-200`}>{prep.step === 'vote_open' ? `Vote en cours · ${prep.vote?.count ?? 0} vote${(prep.vote?.count ?? 0) > 1 ? 's' : ''}` : closed ? 'Résultats du vote' : 'Vote prévu dans cette manche'}</span>
      <span className="text-white text-sm font-semibold break-words">{vote.question}</span>
      <ul className="flex flex-col gap-1">
        {vote.choices.map((c, i) => (
          <li key={i} className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg ${vote.correct === i ? 'border border-emerald-400/50' : 'border border-white/10'}`}>
            <b className="text-[#D4AF37]">{VOTE_LETTERS[i]}</b>
            <span className="truncate text-gray-200">{c}</span>
            {vote.correct === i && <Check className="h-3.5 w-3.5 text-emerald-400 flex-none" aria-label="bonne réponse" />}
            {bars && <span className="ml-auto text-xs tabular-nums text-[#cfcade]">{prep.vote!.results![i]} · {bars.pct[i]} %</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
