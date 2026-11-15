// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// Écran public (TV / vidéoprojecteur) : studio plein cadre.
// Pendant la recherche, seuls le mur de lettres, l'en-tête du décor et les pupitres occupent le regard.
// Les panneaux (accueil, règle, classement, podium) n'apparaissent qu'en dehors de la recherche
// ou à la demande de la régie.

import { useMemo, useState } from 'react'
import QRCode from '@/components/QRCode'
import { DEMIMOT_LECTERN_MAX } from '@/lib/demimot/constants'
import { toCells } from '@/lib/demimot/text'
import type { PublicCell, PublicTeam, PublicView } from '@/lib/demimot/view'
import type { Quality, StudioState, StudioTeam } from './three/StudioScene'
import { resolveTheme, themeCssVars, themeOf, type ThemeId } from './themes'
import { Studio } from './Studio'

const cellsOf = (t: string): PublicCell[] => toCells(t).map((c) => ({ kind: c.kind, ch: c.ch }))
const WELCOME = cellsOf('Quelques lettres. À vous de trouver.')
const BRAVO = cellsOf('Bravo')
const FINALE = cellsOf('Finale Déclic')
const WHITE = '#F7F7F2'

export interface PublicScreenProps {
  view: PublicView
  clockOffsetMs?: number
  quality?: Quality | 'dom'
  reducedMotion?: boolean
  /** Horloge figée (maquette, captures) : sert à calculer un décalage d'horloge. */
  frozenNow?: number
}

/** Traduit la vue publique (issue du moteur) en état de décor. Fonction pure. */
export function toStudioState(view: PublicView, clockOffsetMs: number, themeId: ThemeId): StudioState {
  const th = themeOf(themeId)
  // Couleurs d'information issues du thème (points : métal clair ; dernière chance, bonus : accent).
  const GOLD = th.metal.text
  const MINT = th.accentText
  const r = view.round
  const byId = new Map(view.teams.map((t) => [t.id, t]))
  const buzz = r?.buzz ? byId.get(r.buzz.teamId) : undefined
  const turn = r?.turn ? byId.get(r.turn.teamId) : undefined
  const winner = r?.outcome?.kind === 'won' ? byId.get(r.outcome.teamId) : undefined
  const activeId = view.phase === 'answering' ? buzz?.id : view.phase === 'turn' ? turn?.id : view.phase === 'resolved' ? winner?.id : undefined

  let board = { key: 'welcome', cells: WELCOME }
  if (view.phase === 'podium') board = { key: 'bravo', cells: BRAVO }
  else if (view.phase === 'final_intro') board = { key: 'finale', cells: FINALE }
  else if (view.phase !== 'waiting' && r) board = { key: r.key, cells: r.cells }

  let category: string | null = r ? (r.isTiebreak ? 'Départage' : r.isFinal ? `Finale · ${r.category}` : r.category) : null
  const pts = r ? (r.isFinal && view.finale ? `${view.finale.base} pts + ${view.finale.bonusPerHidden} par lettre cachée` : `${r.points} pts`) : ''
  let line: StudioState['line'] = r ? [{ text: `Énigme ${r.number}/${r.total} · `, color: WHITE }, { text: pts, color: GOLD }] : []

  if (view.phase === 'waiting') {
    category = 'Bienvenue'
    line = [{ text: 'Un téléphone capitaine par équipe', color: WHITE }]
  } else if (view.phase === 'final_intro') {
    category = 'Finale Déclic'
    line = view.finale ? [{ text: `${view.finale.base} pts + `, color: GOLD }, { text: `${view.finale.bonusPerHidden} par lettre cachée`, color: MINT }] : []
  } else if (view.phase === 'podium') {
    category = 'Classement final'
    line = view.tie ? [{ text: 'Égalité en tête', color: GOLD }] : [{ text: 'Merci à toutes les équipes', color: WHITE }]
  } else if (r) {
    if (view.phase === 'ready') line = r.mode === 'letters' ? [{ text: 'Tour de lettres · ', color: WHITE }, { text: pts, color: GOLD }] : [{ text: `Énigme ${r.number}/${r.total} · `, color: WHITE }, { text: pts, color: GOLD }]
    else if (view.phase === 'answering' && buzz) line = [{ text: buzz.name, color: buzz.color }, { text: ' a la main', color: WHITE }]
    else if (view.phase === 'final_window') line = [{ text: 'Dernière chance', color: MINT }]
    else if (view.phase === 'paused') line = [{ text: 'Pause', color: GOLD }]
    else if (view.phase === 'turn' && turn) {
      line = [{ text: 'À ', color: WHITE }, { text: turn.name, color: turn.color }]
      if (r.letters.length) line.push({ text: ` · déjà dites : ${r.letters.map((l) => l.letter).join(' ')}`, color: WHITE })
    } else if (view.phase === 'resolved') {
      line =
        winner && r.outcome?.kind === 'won'
          ? [{ text: winner.name, color: winner.color }, { text: ` +${r.outcome.points} pts`, color: GOLD }]
          : [{ text: r.outcome?.kind === 'none' && r.outcome.reason === 'skipped' ? 'Énigme passée' : 'Personne n’a trouvé', color: WHITE }]
    }
  }

  const teams: StudioTeam[] = view.teams.map((t: PublicTeam) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    score: t.score,
    state: t.id === activeId ? 'active' : t.blocked ? 'blocked' : view.phase === 'waiting' && !t.connected ? 'off' : 'normal',
    note: view.phase === 'resolved' && t.id === activeId ? 'BRAVO' : undefined,
  }))

  // La jauge porte aussi un libellé : nom de l'équipe qui a la main (lisible même à 20 équipes) + secondes.
  let gauge: StudioState['gauge'] = null
  if (r && view.phase === 'answering' && r.buzz && buzz) gauge = { color: buzz.color, endsAt: r.buzz.deadline, totalMs: r.buzz.totalMs, label: buzz.name }
  else if (r && view.phase === 'final_window' && r.finalWindowEndsAt) gauge = { color: th.gauge, endsAt: r.finalWindowEndsAt, totalMs: r.finalWindowMs, label: 'Dernière chance' }
  else if (r && view.phase === 'turn' && r.turn?.deadline && turn) gauge = { color: turn.color, endsAt: r.turn.deadline, totalMs: r.turn.totalMs, label: turn.name }

  return {
    board,
    category,
    line,
    code: view.code,
    teams,
    gauge,
    clockOffsetMs,
    accent: (view.phase === 'answering' ? buzz?.color : view.phase === 'turn' ? turn?.color : view.phase === 'resolved' ? winner?.color : null) ?? null,
    celebrateKey: view.phase === 'resolved' && winner && r ? `${r.key}:won` : null,
    showTeams: view.phase !== 'waiting' && view.phase !== 'podium',
    compactScores: view.teams.length > DEMIMOT_LECTERN_MAX,
    theme: th.id,
  }
}

export function PublicScreen({ view, clockOffsetMs = 0, quality = 'auto', reducedMotion = false, frozenNow }: PublicScreenProps) {
  const [frozenOffset] = useState(() => (frozenNow === undefined ? 0 : frozenNow - Date.now()))
  const offset = clockOffsetMs + frozenOffset
  // Couleur du plateau : réglage de la partie (choisi en régie).
  const themeId = resolveTheme(view.theme?.id)
  const studio = useMemo(() => toStudioState(view, offset, themeId), [view, offset, themeId])
  return (
    <div className="stage" data-phase={view.phase} data-theme={themeId} data-testid="public-screen" style={themeCssVars(themeId) as React.CSSProperties}>
      <Studio state={studio} quality={quality} reducedMotion={reducedMotion} />
      <div className="hud">
        {view.phase === 'waiting' && view.display === 'board' && <Join view={view} />}
        {view.display === 'rules' && <Rules view={view} />}
        {view.phase === 'final_intro' && view.finale && view.display === 'board' && <Rules view={view} finale />}
        {view.display === 'standings' && <Standings teams={view.teams} title="Classement" />}
        {view.phase === 'podium' && view.display === 'board' && <Podium teams={view.teams} />}
      </div>
      {view.display === 'black' && <div className="black-screen" data-testid="black" />}
    </div>
  )
}

function Join({ view }: { view: PublicView }) {
  // QR unique de la soirée (/invite/<code>) : il mène les capitaines vers À Demi-Mot.
  const host = view.joinUrl.replace(/^https?:\/\//, '')
  return (
    <div className="join-zone">
      {/* Plus de 6 équipes : QR et code à gauche, pastilles à droite (le panneau reste bas, sous le plateau de lettres). */}
      <div className={`join-card${view.teams.length > 6 ? ' many' : ''}`}>
        <div className="qr" aria-label="QR code pour rejoindre la partie">
          <QRCode value={view.joinUrl} size={256} level="M" fgColor="#0D0D0F" style={{ width: '100%', height: 'auto' }} />
        </div>
        <div className="txt">
          <div className="lead">Capitaines, rejoignez votre équipe</div>
          <div>
            Scannez le QR code ou ouvrez <b>{host}</b>
          </div>
          <div className="code">{view.code}</div>
        </div>
        <div className={`team-chips${view.teams.length > 6 ? ' many' : ''}`}>
          {view.teams.map((t, i) => (
            <span key={t.id} className={`team-chip${t.connected ? '' : ' off'}`} style={{ ['--team' as string]: t.color } as React.CSSProperties}>
              <b>{i + 1}</b> {t.name}
              <em>{t.connected ? 'prête' : 'en attente'}</em>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Rules({ view, finale }: { view: PublicView; finale?: boolean }) {
  const f = view.finale
  return (
    <div className="overlay-panel rules">
      <h2 className="title-3d">{finale ? 'Finale Déclic' : 'La règle'}</h2>
      {finale && f ? (
        <>
          <p className="big">{f.puzzles} énigmes en Révélation</p>
          <p className="big">
            <span style={{ color: 'var(--plate-metal-text)' }}>{f.base} points</span> + <span style={{ color: 'var(--plate-accent-text)' }}>{f.bonusPerHidden} points par lettre encore cachée</span>
          </p>
          <p>Le bonus est figé au moment du buzz et accordé seulement si la réponse est juste.</p>
        </>
      ) : (
        <ol>
          <li>Les lettres de la phrase se dévoilent une à une.</li>
          <li>
            Le capitaine buzze dès que l’équipe a trouvé ; la réponse se donne <b>à l’oral</b>.
          </li>
          <li>Bonne réponse : les points. Mauvaise réponse : l’équipe est bloquée, les autres continuent.</li>
          <li>En Tour de lettres, chaque équipe propose une lettre à son tour.</li>
        </ol>
      )}
    </div>
  )
}

export function Standings({ teams, title }: { teams: PublicTeam[]; title: string }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  return (
    <div className="overlay-panel">
      <h2 className="title-3d">{title}</h2>
      <div
        className={`rank-list${teams.length > 6 ? ' dense' : ''}${teams.length > DEMIMOT_LECTERN_MAX ? ' two-cols' : ''}`}
        style={teams.length > DEMIMOT_LECTERN_MAX ? { gridTemplateRows: `repeat(${Math.ceil(teams.length / 2)}, auto)` } : undefined}
      >
        {sorted.map((t) => (
          <div className="rank-row" key={t.id}>
            <span className="pos">{1 + teams.filter((o) => o.score > t.score).length}</span>
            <span className="nm">
              <span className="dot" style={{ background: t.color, width: '1.6vh', height: '1.6vh', boxShadow: `0 0 10px ${t.color}` }} />
              <span>{t.name}</span>
            </span>
            <span className="sc">{t.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Podium({ teams }: { teams: PublicTeam[] }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score).slice(0, 3)
  const ranks = sorted.map((t) => 1 + teams.filter((o) => o.score > t.score).length)
  // Métal et hauteur suivent le RANG (ex æquo = même marche), pas la position dans la liste triée.
  const metalOf = (rank: number) =>
    rank <= 1 ? ['#E6D6AC', '#A58E5E', '15vh'] : rank === 2 ? ['#E5E7EB', '#9CA3AF', '11vh'] : ['#E6B07A', '#9A5B26', '8vh']
  return (
    <div className="podium" data-ranks={ranks.join(',')}>
      {[1, 0, 2]
        .filter((i) => sorted[i])
        .map((i) => {
          const t = sorted[i]
          const m = metalOf(ranks[i])
          return (
            <div className="step" data-rank={ranks[i]} key={t.id} style={{ ['--team' as string]: t.color, ['--m1' as string]: m[0], ['--m2' as string]: m[1] } as React.CSSProperties}>
              <div className="label">{t.name}</div>
              <div className="pts">{t.score} pts</div>
              <div className="block" style={{ height: m[2] }}>
                {ranks[i]}
              </div>
            </div>
          )
        })}
    </div>
  )
}
