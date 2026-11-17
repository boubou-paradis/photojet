'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot, live/Regie.tsx), qui reste la référence.

// Régie, onglet Direct : état de l'énigme, réponse (régie seulement),
// arbitrage, commandes, équipes et capitaines, journal.

import { useEffect, useState } from 'react'
import {
  BookOpen, Check, Eye, Flag, Keyboard, ListOrdered, Lock, Minus, Pause, Play, Plus, RotateCcw, SkipForward, Smartphone, Sparkles, Trophy, Undo2, Unlink, Wifi, WifiOff, X,
} from 'lucide-react'
import { regieShortcut } from '@/lib/demimot/shortcuts'
import type { RegieView } from '@/lib/demimot/view'
import { DomBoard } from '../Studio'
import type { Send } from './api'

export const PHASE_LABEL: Record<string, string> = {
  waiting: 'Accueil des équipes', ready: 'Énigme prête', revealing: 'Dévoilement en cours', final_window: 'Dernière chance', answering: 'Une équipe a la main',
  paused: 'En pause', turn: 'Tour de lettres', resolved: 'Énigme terminée', final_intro: 'Présentation de la finale', podium: 'Podium', end_tie: 'Égalité en tête',
}

/** Étape affichée en régie (phase de la partie, ou de l'énigme en cours). */
export function regieStatus(v: RegieView): string {
  const r = v.public.round
  return v.phase === 'round' && r ? v.public.phase : v.phase === 'end_tie' ? 'end_tie' : v.phase
}

/** Fenêtre du buzz en cours (vue privée) : un arbitrage d'un buzz déjà traité est refusé par le serveur. */
export const windowOf = (v: RegieView) => v.private.buzzWindowId ?? 0

function useServerNow(stepMs: number, offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), stepMs)
    return () => clearInterval(t)
  }, [stepMs, offset])
  return now
}

export function RegieDirect({ v, send, onRelease, offset, online }: { v: RegieView; send: Send; onRelease: (teamId: string, name: string) => void; offset: number; online: boolean }) {
  const p = v.public
  const r = p.round
  const now = useServerNow(100, offset)
  const team = (id?: string | null) => p.teams.find((t) => t.id === id)
  const buzz = team(r?.buzz?.teamId)
  const turn = team(r?.turn?.teamId)
  const [letter, setLetter] = useState('')
  const status = regieStatus(v)
  const letters = r ? r.cells.filter((c) => c.kind === 'letter').length : 0

  // Raccourcis clavier (désactivés pendant la saisie d'un champ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || !online) return
      const cmd = regieShortcut(e.key, { status, round: r, display: p.display, buzzWindowId: windowOf(v) })
      if (cmd) {
        e.preventDefault()
        void send(cmd)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, r, p.display, send, v, online])

  const remaining = (deadline: number | null | undefined, total: number) => (deadline ? Math.max(0, Math.min(1, (deadline - now) / total)) : 0)

  return (
    <div className="regie-body">
      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <div className="panel" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pill live" data-testid="regie-phase">{PHASE_LABEL[status] ?? status}</span>
          {r && (
            <span className="pill">
              {r.isFinal ? 'Finale Déclic' : r.isTiebreak ? 'Départage' : 'Énigme'} {r.number}/{r.total} · {r.category} · {r.isFinal ? `${v.private.potentialPoints ?? r.points} pts en jeu` : `${r.points} pts`}
            </span>
          )}
          {r && <span className="pill">{r.mode === 'reveal' ? `Révélation · 1 lettre / ${(v.settings.revealIntervalMs / 1000).toLocaleString('fr-FR')} s` : 'Tour de lettres'}</span>}
          <span className="spacer" />
          {r && <span className="pill">{letters - r.hiddenCount} / {letters} lettres</span>}
          <DisplaySwitch v={v} send={send} />
        </div>

        {r && (
          <div className="panel" style={{ padding: 10 }}>
            <h3><Eye size={14} /> Aperçu de l’écran géant</h3>
            <DomBoard cells={r.cells} accent={buzz?.color ?? turn?.color ?? null} reducedMotion compact />
          </div>
        )}
        {v.private.solution && (
          <div className="panel secret" data-testid="solution">
            <h3><Lock size={14} /> Réponse : visible uniquement en régie</h3>
            <div className="sol">{v.private.solution}</div>
            {v.private.variants.length > 0 && <div className="var">Aussi accepté : {v.private.variants.join(' · ')}</div>}
          </div>
        )}

        {status === 'waiting' && (
          <div className="panel">
            <h3><Smartphone size={14} /> Accueil des équipes</h3>
            <p className="regie-help">
              L’écran géant affiche le QR code de la soirée et le code <b>{p.code}</b>. Chaque équipe connecte <b>un seul téléphone</b> (le capitaine). Équipes, énigmes et règles : onglets Préparation et Réglages.
            </p>
            <div className="grid-actions">
              <button className="btn primary xl" style={{ gridColumn: 'span 2' }} onClick={() => send({ type: 'startGame' })} data-testid="start-game">
                <Play size={20} /> Lancer la partie
              </button>
              <button className="btn" onClick={() => send({ type: 'display', display: p.display === 'rules' ? 'board' : 'rules' })}><BookOpen size={16} /> {p.display === 'rules' ? 'Masquer la règle' : 'Afficher la règle'}</button>
            </div>
            <p className="why">{p.teams.filter((t) => t.connected).length}/{p.teams.length} capitaines connectés. La partie peut démarrer sans eux : un capitaine peut rejoindre à tout moment.</p>
          </div>
        )}

        {status === 'answering' && buzz && r?.buzz && (
          <div className="panel" style={{ borderColor: buzz.color, boxShadow: `0 0 0 1px ${buzz.color}` }} data-testid="judge-panel">
            <h3 style={{ color: buzz.color }}><Sparkles size={14} /> {buzz.name} a la main : écoutez la réponse</h3>
            <div className="timerbar" style={{ ['--team' as string]: buzz.color, marginBottom: 12 } as React.CSSProperties}>
              <i style={{ width: `${remaining(r.buzz.deadline, r.buzz.totalMs) * 100}%` }} />
            </div>
            <div className="judge">
              <button className="btn good xl" onClick={() => send({ type: 'judge', correct: true, windowId: windowOf(v) })} data-testid="judge-good"><Check size={22} /> Bonne réponse <kbd>V</kbd></button>
              <button className="btn bad xl" onClick={() => send({ type: 'judge', correct: false, windowId: windowOf(v) })} data-testid="judge-bad"><X size={22} /> Mauvaise réponse <kbd>X</kbd></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => send({ type: 'cancelBuzz', windowId: windowOf(v) })}><Undo2 size={16} /> Annuler le buzz <kbd>A</kbd></button>
              <button className="btn" onClick={() => send({ type: 'pause' })}><Pause size={16} /> Pause <kbd>P</kbd></button>
              <span className="regie-help" style={{ alignSelf: 'center', margin: 0 }}>Mauvaise réponse : {buzz.name} est bloquée, le dévoilement reprend pour les autres.</span>
            </div>
          </div>
        )}

        {status === 'turn' && turn && r && (
          <div className="panel" style={{ borderColor: turn.color }} data-testid="turn-panel">
            <h3 style={{ color: turn.color }}><Sparkles size={14} /> Tour de {turn.name}</h3>
            <div className="timerbar" style={{ ['--team' as string]: turn.color, marginBottom: 12 } as React.CSSProperties}>
              <i style={{ width: `${remaining(r.turn?.deadline, r.turn?.totalMs ?? 1) * 100}%` }} />
            </div>
            <form
              className="letter-form"
              autoComplete="off"
              onSubmit={async (e) => {
                e.preventDefault()
                const a = await send({ type: 'proposeLetter', letter })
                if (a?.ok) setLetter('')
              }}
            >
              <label htmlFor="dm-lettre-proposee">Lettre proposée</label>
              <input id="dm-lettre-proposee" name="dm-lettre-proposee" value={letter} onChange={(e) => setLetter(e.target.value.slice(-1))} maxLength={2} autoComplete="off" data-testid="letter-input" />
              <button className="btn primary" type="submit" disabled={!letter.trim()}>Proposer</button>
            </form>
            {r.letters.length > 0 && <p className="regie-help">Déjà proposées : {r.letters.map((l) => `${l.letter} (${l.hits})`).join(' · ')}</p>}
            <div className="judge" style={{ marginTop: 10 }}>
              <button className="btn good" onClick={() => send({ type: 'solveTurn', correct: true })}><Check size={18} /> Solution trouvée</button>
              <button className="btn bad" onClick={() => send({ type: 'solveTurn', correct: false })}><X size={18} /> Solution fausse</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => send({ type: 'passTurn' })}><SkipForward size={16} /> Passer la main</button>
              <button className="btn" onClick={() => send({ type: 'pause' })}><Pause size={16} /> Pause <kbd>P</kbd></button>
            </div>
          </div>
        )}

        {['ready', 'revealing', 'final_window', 'paused', 'resolved'].includes(status) && r && (
          <div className="panel">
            <h3><Play size={14} /> Commandes</h3>
            <div className="grid-actions">
              {status === 'paused' ? (
                <button className="btn primary xl" style={{ gridColumn: 'span 2' }} onClick={() => send({ type: 'resume' })} data-testid="resume"><Play size={20} /> Reprendre <kbd>Espace</kbd></button>
              ) : status === 'resolved' ? (
                <button className="btn gold xl" style={{ gridColumn: 'span 2' }} onClick={() => send({ type: 'next', roundKey: r.key })} data-testid="next"><SkipForward size={20} /> {nextLabel(v)} <kbd>Entrée</kbd></button>
              ) : (
                <button className="btn primary xl" style={{ gridColumn: 'span 2' }} disabled={status !== 'ready'} onClick={() => send({ type: 'startReveal' })} data-testid="start-reveal">
                  <Play size={20} /> {r.mode === 'letters' ? 'Lancer le tour de lettres' : 'Lancer le dévoilement'} <kbd>Espace</kbd>
                </button>
              )}
              <button className="btn xl" disabled={!['revealing', 'final_window', 'ready'].includes(status)} onClick={() => send({ type: 'pause' })}><Pause size={20} /> Pause <kbd>P</kbd></button>
              <button className="btn" disabled={!(status === 'revealing' || status === 'ready') || r.mode !== 'reveal'} onClick={() => send({ type: 'revealLetter' })}><Plus size={16} /> Révéler une lettre <kbd>L</kbd></button>
              <button className="btn" disabled={status === 'resolved'} onClick={() => send({ type: 'skip' }, 'Passer cette énigme ? Aucun point ne sera attribué.')}><SkipForward size={16} /> Passer l’énigme</button>
              <button className="btn" disabled={r.solutionShown} onClick={() => send({ type: 'revealSolution' }, status === 'resolved' ? undefined : 'Révéler la solution ? L’énigme sera terminée sans gagnant.')}><Eye size={16} /> Révéler la solution</button>
              <button className="btn" disabled={!v.undo} onClick={() => send({ type: 'undo' }, `Annuler : ${v.undo} ?`)} title={v.undo ? `Annuler : ${v.undo}` : undefined} data-testid="undo"><Undo2 size={16} /> Annuler l’arbitrage</button>
              {status === 'resolved' && <button className="btn" onClick={() => send({ type: 'finish' }, 'Terminer la partie maintenant et afficher le podium ?')}><Flag size={16} /> Terminer et podium</button>}
              <div className="why">{whyText(v, status)}</div>
            </div>
          </div>
        )}

        {status === 'final_intro' && (
          <div className="panel">
            <h3><Sparkles size={14} /> Finale Déclic</h3>
            <p className="regie-help">L’écran présente la règle de la finale : {v.settings.finale.base} points + {v.settings.finale.bonusPerHidden} par lettre encore cachée au moment du buzz.</p>
            <button className="btn primary xl" onClick={() => send({ type: 'startFinale' })} data-testid="start-finale"><Play size={20} /> Lancer la finale <kbd>Entrée</kbd></button>
          </div>
        )}
        {status === 'end_tie' && (
          <div className="panel">
            <h3><Trophy size={14} /> Égalité en tête</h3>
            <p className="regie-help">{(p.tie?.teamIds ?? []).map((id) => team(id)?.name).join(', ')} sont à égalité. Une énigme de départage se joue entre elles seules (les autres équipes sont bloquées).</p>
            <div className="grid-actions">
              <button className="btn primary xl" onClick={() => send({ type: 'tiebreak' })} data-testid="tiebreak"><Play size={20} /> Énigme de départage <kbd>Entrée</kbd></button>
              <button className="btn xl" onClick={() => send({ type: 'finish' })}><Trophy size={20} /> Podium avec ex æquo</button>
            </div>
          </div>
        )}
        {status === 'podium' && (
          <div className="panel">
            <h3><Trophy size={14} /> Partie terminée</h3>
            <p className="regie-help">Le podium est affiché. Une nouvelle partie remet les scores à zéro et garde les équipes ; les énigmes déjà jouées ne reviennent pas tant que la bibliothèque n’est pas épuisée.</p>
            <button className="btn primary xl" onClick={() => send({ type: 'reset' }, 'Démarrer une nouvelle partie ? Les scores seront remis à zéro.')} data-testid="reset"><RotateCcw size={20} /> Nouvelle partie</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <Teams v={v} send={send} onRelease={onRelease} />
        {v.private.nextUp.length > 0 && (
          <div className="panel">
            <h3><ListOrdered size={14} /> À suivre (régie seulement)</h3>
            <div className="log">
              {v.private.nextUp.map((n, i) => (
                <div key={i}>
                  <b>{(r?.number ?? 0) + i + 1}.</b> {n.category} : {n.solution} {n.mode === 'letters' && <em className="muted">· tour de lettres</em>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="panel">
          <h3><Keyboard size={14} /> Journal</h3>
          <div className="log" data-testid="log">
            {[...v.log].reverse().slice(0, 30).map((l, i) => (
              <div key={i}>
                <b>{new Date(l.at).toLocaleTimeString('fr-FR')}</b> {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function nextLabel(v: RegieView) {
  const r = v.public.round
  if (!r) return 'Suivante'
  if (r.isTiebreak) return 'Résultat du départage'
  if (r.number < r.total) return r.isFinal ? 'Énigme de finale suivante' : 'Énigme suivante'
  if (!r.isFinal && v.settings.finale.enabled) return 'Annoncer la finale'
  return 'Fin de partie'
}

function whyText(v: RegieView, status: string) {
  if (status === 'ready') return 'Le buzzer des capitaines s’ouvre dès le lancement.'
  if (status === 'revealing') return '« Énigme suivante » sera disponible une fois l’énigme résolue ou passée.'
  if (status === 'final_window') return `Toutes les lettres sont visibles : dernière chance de ${Math.round(v.settings.finalWindowMs / 1000)} s.`
  if (status === 'paused') return 'Buzzers fermés pendant la pause ; les délais reprennent où ils en étaient.'
  if (status === 'resolved') return v.undo ? `Erreur d’arbitrage ? « Annuler l’arbitrage » rétablit l’énigme en pause (${v.undo}).` : ''
  return ''
}

function DisplaySwitch({ v, send }: { v: RegieView; send: Send }) {
  const d = v.public.display
  const opt: [RegieView['public']['display'], string][] = [['board', 'Plateau'], ['standings', 'Classement'], ['rules', 'Règle'], ['black', 'Noir']]
  return (
    <div className="seg" role="radiogroup" aria-label="Affichage de l’écran géant">
      {opt.map(([k, label]) => (
        <button key={k} role="radio" aria-checked={d === k} className={d === k ? 'on' : ''} onClick={() => send({ type: 'display', display: k })}>
          {label}
          {k === 'standings' && <kbd>C</kbd>}
        </button>
      ))}
    </div>
  )
}

function Teams({ v, send, onRelease }: { v: RegieView; send: Send; onRelease: (teamId: string, name: string) => void }) {
  const p = v.public
  return (
    <div className="panel">
      <h3><Smartphone size={14} /> Équipes et capitaines ({p.teams.filter((t) => t.connected).length}/{p.teams.length} connectés)</h3>
      {p.teams.map((t) => {
        const cap = v.captains.find((c) => c.teamId === t.id)
        const has = !!cap?.since
        return (
          <div className="team-row" key={t.id} style={{ ['--team' as string]: t.color } as React.CSSProperties} data-testid={`team-${t.id}`}>
            <span className="sw" />
            <div style={{ minWidth: 0 }}>
              <div className="nm">{t.name} {t.blocked && <Lock size={13} style={{ verticalAlign: -1, color: '#fca5a5' }} aria-label="bloquée" />}</div>
              <div className="cap">
                {t.connected ? <><Wifi size={12} /> Capitaine connecté</> : has ? <><WifiOff size={12} /> Capitaine déconnecté</> : <>Aucun téléphone</>}
                {has && (
                  <button className="pill linkish" onClick={() => onRelease(t.id, t.name)} title="Libérer pour un autre téléphone">
                    <Unlink size={11} /> Remplacer
                  </button>
                )}
              </div>
            </div>
            <span className="sc">{t.score}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="icon-btn" title={`Retirer 10 points à ${t.name}`} aria-label={`Retirer 10 points à ${t.name}`} onClick={() => send({ type: 'adjustScore', teamId: t.id, delta: -10 })}><Minus size={14} /></button>
              <button className="icon-btn" title={`Ajouter 10 points à ${t.name}`} aria-label={`Ajouter 10 points à ${t.name}`} onClick={() => send({ type: 'adjustScore', teamId: t.id, delta: 10 })}><Plus size={14} /></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
