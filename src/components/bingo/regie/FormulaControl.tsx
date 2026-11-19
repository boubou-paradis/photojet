'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Régie AnimaBingo : la formule se choisit EN DIRECT, partie par partie.
// - Avant la première boule : 4 gros boutons + lots par étape, appliqués tout
//   de suite (FormulaPicker, à la place du tableau encore vide).
// - Pendant la partie : fenêtre « Formule » (FormulaPanel) : carton plein
//   maintenant, étape suivante, lots de l'étape en cours, quine suivie,
//   étapes pas encore commencées. Appliquer = confirmation explicite.
// La base revérifie tout (action « formula ») : étapes jouées intouchables,
// jamais moins de lots que ceux déjà gagnés, étape envoyée (expect) pour qu'un
// double clic ne fasse rien deux fois. Boules, cartons, jetons et gagnants
// ne sont jamais touchés.

import { useEffect, useState } from 'react'
import { BINGO_PHASES, PHASE_LABELS } from '@/lib/bingo/constants'
import { lotInfo, nextPhase } from '@/lib/bingo/display'
import { detectFormula, FORMULAS, LOTS_MAX, normalizeLots, type FormulaId } from '@/lib/bingo/formulas'
import type { BingoPublicState, Phase } from '@/lib/bingo/types'
import type { AdminBody, AdminResult } from './api'
import type { ConfirmRequest } from './ConfirmDialog'

type Live = Extract<BingoPublicState, { active: true }>
type Run = (b: AdminBody, o?: { quiet?: boolean; key?: string }) => Promise<AdminResult | null>

const TO: Record<Phase, string> = { quine: 'à la quine', double: 'à la double quine', plein: 'au carton plein' }
const IDS = ['classic', 'plein', 'suivie', 'custom'] as const
const SHORT: Record<FormulaId, string> = {
  classic: 'Quine, double quine, carton plein',
  plein: 'Une seule étape',
  suivie: '5 quines, puis double et plein',
  custom: 'Étapes et lots au choix',
}

/**
 * Étapes et lots. Les `fixed` premières lignes (étapes jouées + étape en
 * cours) restent à leur place ; les étapes jouées (`played`) ne changent plus ;
 * l'étape en cours ne descend jamais sous `minNow` lots.
 */
export function StepsEditor({ phases, lots, onChange, fixed = 0, played = 0, minNow = 1, disabled = false }: {
  phases: Phase[]
  lots: number[]
  onChange: (p: Phase[], l: number[]) => void
  fixed?: number
  played?: number
  minNow?: number
  disabled?: boolean
}) {
  const l = normalizeLots(phases, lots)
  const off = BINGO_PHASES.filter((p) => !phases.includes(p))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (i < fixed || j < fixed || j >= phases.length) return
    const np = [...phases]
    const nl = [...l]
    ;[np[i], np[j]] = [np[j], np[i]]
    ;[nl[i], nl[j]] = [nl[j], nl[i]]
    onChange(np, nl)
  }
  const min = (i: number) => (i === fixed - 1 && fixed > played ? Math.max(1, minNow) : 1)
  const setLot = (i: number, n: number) => onChange(phases, l.map((x, k) => (k === i ? Math.min(LOTS_MAX, Math.max(min(i), n)) : x)))
  return (
    <ol className="steps" aria-label="Étapes de la partie, dans l’ordre">
      {phases.map((p, i) => {
        const isPlayed = i < played
        const isNow = i === fixed - 1 && fixed > played
        const lock = disabled || isPlayed
        return (
          <li key={p} className={isPlayed ? 'played' : isNow ? 'now' : ''} data-testid={`step-row-${p}`}>
            <span className="num">{i + 1}</span>
            <b>{PHASE_LABELS[p]}<small>{isPlayed ? 'jouée' : isNow ? 'en cours' : ''}</small></b>
            <span className="lots" role="group" aria-label={`Lots pour ${PHASE_LABELS[p]}`}>
              <button type="button" className="btn ghost" disabled={lock || l[i] <= min(i)} onClick={() => setLot(i, l[i] - 1)} aria-label={`Un lot de moins pour ${PHASE_LABELS[p]}`} data-testid={`lots-minus-${p}`}>−</button>
              <span data-testid={`lots-${p}`}>{l[i]} lot{l[i] > 1 ? 's' : ''}</span>
              <button type="button" className="btn ghost" disabled={lock || l[i] >= LOTS_MAX} onClick={() => setLot(i, l[i] + 1)} aria-label={`Un lot de plus pour ${PHASE_LABELS[p]}`} data-testid={`lots-plus-${p}`}>+</button>
            </span>
            {i >= fixed ? (
              <span className="mv">
                <button type="button" className="btn ghost" disabled={disabled || i === fixed} onClick={() => move(i, -1)} aria-label={`Monter ${PHASE_LABELS[p]}`}>↑</button>
                <button type="button" className="btn ghost" disabled={disabled || i === phases.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre ${PHASE_LABELS[p]}`}>↓</button>
                <button type="button" className="btn ghost" disabled={disabled || phases.length === 1} onClick={() => onChange(phases.filter((x) => x !== p), l.filter((_, k) => k !== i))} aria-label={`Retirer ${PHASE_LABELS[p]}`} data-testid={`step-remove-${p}`}>Retirer</button>
              </span>
            ) : <span className="mv" />}
          </li>
        )
      })}
      {off.map((p) => (
        <li key={p} className="off">
          <span className="num" />
          <b>{PHASE_LABELS[p]}</b>
          <button type="button" className="btn ghost" disabled={disabled} onClick={() => onChange([...phases, p], [...l, 1])} data-testid={`step-add-${p}`}>Ajouter</button>
        </li>
      ))}
    </ol>
  )
}

/** Avant la première boule : choix rapide, appliqué tout de suite. */
export function FormulaPicker({ live, held, busy, run }: { live: Live; held: boolean; busy: string | null; run: Run }) {
  const lots = normalizeLots(live.phases, live.lots)
  const detected = detectFormula(live.phases, lots)
  const [custom, setCustom] = useState(detected === 'custom')
  const shown: FormulaId = custom ? 'custom' : detected
  const apply = (phases: Phase[], l: number[]) => void run({ action: 'formula', phases, lots: normalizeLots(phases, l), expect: 0 }, { key: 'formula' })
  const pick = (id: FormulaId) => {
    if (id === 'custom') return setCustom(true)
    setCustom(false)
    apply([...FORMULAS[id].phases], [...FORMULAS[id].lots])
  }
  const off = held || busy !== null
  return (
    <div className="box fpick" data-testid="formula-pick">
      <h2><span>Partie {live.round} : choisissez la formule</span><span>avant la 1<sup>re</sup> boule</span></h2>
      <div className="fbig" role="group" aria-label="Formule de la partie">
        {IDS.map((id) => (
          <button key={id} type="button" aria-pressed={shown === id} disabled={off} onClick={() => pick(id)} data-testid={`formula-${id}`}>
            <b>{id === 'custom' ? 'Personnalisée' : FORMULAS[id].label}</b>
            <span>{SHORT[id]}</span>
          </button>
        ))}
      </div>
      <StepsEditor phases={live.phases} lots={lots} disabled={off} onChange={(p, l) => { setCustom(detectFormula(p, l) === 'custom'); apply(p, l) }} />
      <p className="note">Appliqué tout de suite, annoncé sur l’écran géant. Pendant la partie, le bouton « Formule » permet encore de la changer.</p>
    </div>
  )
}

/** Petit bouton sous le gros bouton : ouvre la fenêtre Formule. */
export function FormulaButton({ live, held, onOpen }: { live: Live; held: boolean; onOpen: () => void }) {
  if (held || !['running', 'checking', 'celebrating'].includes(live.status) || live.phaseIndex >= live.phases.length) return null
  return (
    <div className="step-links">
      <button className="btn sm ghost" onClick={onOpen} data-testid="formula-open">Formule · étapes et lots</button>
    </div>
  )
}

/** Pendant la partie : changer la formule sans rien perdre. */
export function FormulaPanel({ live, busy, run, askConfirm, onClose }: {
  live: Live
  busy: string | null
  run: Run
  askConfirm: (r: ConfirmRequest) => void
  onClose: () => void
}) {
  const idx = live.phaseIndex
  const cur = live.phases[idx]
  const lot = lotInfo(live)
  const lotsNow = normalizeLots(live.phases, live.lots)
  const [phases, setPhases] = useState<Phase[]>(live.phases)
  const [lots, setLots] = useState<number[]>(lotsNow)
  // L'étape a changé pendant que la fenêtre était ouverte : on repart de l'état réel.
  const key = `${live.round}|${idx}|${live.phases.join()}|${lotsNow.join()}`
  useEffect(() => {
    setPhases(live.phases)
    setLots(normalizeLots(live.phases, live.lots))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const nl = normalizeLots(phases, lots)
  const changed = phases.join() !== live.phases.join() || nl.join() !== lotsNow.join()
  const closes = nl[idx] <= lot.used && lot.used > 0
  const next = nextPhase(live)
  const last = live.phases[live.phases.length - 1]
  const off = busy !== null
  const label = (p: Phase[], l: number[]) => p.map((x, i) => `${PHASE_LABELS[x]}${l[i] > 1 ? ` ×${l[i]}` : ''}`).join(' → ')

  async function applyDraft() {
    const r = await run({ action: 'formula', phases, lots: nl, expect: idx }, { key: 'formula' })
    if (r?.ok) onClose()
  }
  // Carton plein maintenant : les étapes pas encore commencées sont retirées, puis on y passe.
  const goPlein = () => askConfirm({
    title: 'Passer au carton plein maintenant ?',
    message: `La ${PHASE_LABELS[cur].toLowerCase()} s’arrête${lot.n > 1 ? ` (${lot.used} lot${lot.used > 1 ? 's' : ''} gagné${lot.used > 1 ? 's' : ''} sur ${lot.n})` : ''} et on joue tout de suite le carton plein.`,
    note: 'Les boules déjà sorties, les cartons, les jetons et les gagnants validés sont conservés.',
    check: 'J’ai compris : on passe directement au carton plein.',
    confirm: 'Passer au carton plein',
    onConfirm: async () => {
      if (last !== 'plein' || live.phases.indexOf('plein') < idx) {
        const p = [...live.phases.slice(0, idx + 1), 'plein' as Phase]
        const l = [...lotsNow.slice(0, idx + 1), lotsNow[live.phases.indexOf('plein')] ?? 1]
        const r = await run({ action: 'formula', phases: p, lots: l, expect: idx }, { key: 'formula' })
        if (!r?.ok) return
      }
      const r = await run({ action: 'jump_final', expect: idx }, { key: 'jump' })
      if (r?.ok) onClose()
    },
  })
  const goNext = () => next && askConfirm({
    title: `Passer ${TO[next]} ?`,
    message: `La ${PHASE_LABELS[cur].toLowerCase()} s’arrête maintenant${lot.n > 1 ? ` (${lot.used} lot${lot.used > 1 ? 's' : ''} gagné${lot.used > 1 ? 's' : ''} sur ${lot.n})` : ''}.`,
    note: 'Les boules déjà sorties, les cartons, les jetons et les gagnants validés sont conservés.',
    check: `J’ai compris : on ne joue plus la ${PHASE_LABELS[cur].toLowerCase()}.`,
    confirm: `Passer ${TO[next]}`,
    onConfirm: async () => {
      const r = await run({ action: 'next_phase', expect: idx }, { key: 'next' })
      if (r?.ok) onClose()
    },
  })
  const suivie = () => {
    // Quine suivie : 5 quines (jamais sous les lots déjà gagnés), puis double et plein.
    const rest = (['double', 'plein'] as Phase[]).filter((p) => !live.phases.slice(0, idx + 1).includes(p))
    setPhases([...live.phases.slice(0, idx + 1), ...rest])
    setLots([...lotsNow.slice(0, idx), Math.max(5, lot.used), ...rest.map((p) => (live.phases.includes(p) ? lotsNow[live.phases.indexOf(p)] : 1))])
  }
  const celebratingDone = live.status === 'celebrating' && lot.done

  return (
    <div className="bgo-modal" role="dialog" aria-modal="true" aria-label="Formule de la partie" data-testid="formula-panel">
      <div className="card bgo fpanel">
        <h4>Formule · partie {live.round}</h4>
        <p className="note" style={{ marginTop: 0 }}>Boules, cartons, jetons et gagnants validés sont toujours conservés. Une étape jouée ne revient jamais.</p>
        <div className="fquick">
          {!live.phases.slice(0, idx + 1).includes('plein') && (
            <button className="btn" disabled={off} onClick={goPlein} data-testid="formula-jump">Carton plein maintenant</button>
          )}
          {next && !celebratingDone && idx + 1 < live.phases.length - 1 && (
            <button className="btn ghost" disabled={off} onClick={goNext} data-testid="step-skip">Passer {TO[next]}</button>
          )}
          {cur === 'quine' && (
            <button className="btn ghost" disabled={off} onClick={suivie} data-testid="formula-suivie-now">Passer en quine suivie</button>
          )}
        </div>
        <StepsEditor phases={phases} lots={nl} onChange={(p, l) => { setPhases(p); setLots(l) }} fixed={idx + 1} played={idx} minNow={lot.used} disabled={off} />
        <div className="frecap" data-testid="formula-recap">
          {changed ? (
            <>
              <span>Avant : {label(live.phases, lotsNow)}</span>
              <b>Après : {label(phases, nl)}</b>
              {closes && <em>{PHASE_LABELS[cur]} : {lot.used} lot{lot.used > 1 ? 's' : ''} déjà gagné{lot.used > 1 ? 's' : ''}, l’étape est terminée (bouton « Passer à… »).</em>}
              {!closes && lot.used > 0 && <span>{lot.used} lot{lot.used > 1 ? 's' : ''} déjà gagné{lot.used > 1 ? 's' : ''} : impossible d’en mettre moins.</span>}
            </>
          ) : <span>Modifiez les lots de l’étape en cours ou les étapes à venir.</span>}
        </div>
        <div className="acts">
          <button className="btn ghost" onClick={onClose}>Fermer</button>
          <button className="btn gold" disabled={!changed || off || (closes && live.pending > 0)} onClick={() => void applyDraft()} data-testid="formula-apply">
            {busy === 'formula' ? 'Application…' : 'Appliquer la nouvelle formule'}
          </button>
        </div>
        {closes && live.pending > 0 && <p className="note" style={{ textAlign: 'right' }}>Vérifiez d’abord la demande en attente.</p>}
      </div>
    </div>
  )
}
