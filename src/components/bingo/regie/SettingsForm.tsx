'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglages d'AnimaBingo : avant le lancement (préparation) et pendant la
// partie (fenêtre « Réglages »). Les phases ne se changent plus après la
// première boule (la base le refuse aussi).

import { useState } from 'react'
import { BINGO_PHASES, PHASE_LABELS } from '@/lib/bingo/constants'
import { detectFormula, FORMULAS, LOTS_MAX, normalizeLots, type FormulaId } from '@/lib/bingo/formulas'
import type { BingoSettings, Phase } from '@/lib/bingo/types'

function Switch({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} data-testid={testId} />
}

function Opt({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="opt">
      <div className="t"><b>{title}</b><span>{help}</span></div>
      {children}
    </div>
  )
}

export function PhasesEditor({ phases, lots, onChange, locked }: {
  phases: Phase[]
  lots: number[]
  onChange: (p: Phase[], lots: number[]) => void
  locked: boolean
}) {
  const off = BINGO_PHASES.filter((p) => !phases.includes(p))
  const l = normalizeLots(phases, lots)
  const move = (i: number, d: -1 | 1) => {
    const next = [...phases]
    const nl = [...l]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    ;[nl[i], nl[j]] = [nl[j], nl[i]]
    onChange(next, nl)
  }
  const setLot = (i: number, n: number) => onChange(phases, l.map((x, k) => (k === i ? Math.min(LOTS_MAX, Math.max(1, n)) : x)))
  return (
    <ol className="order" aria-label="Phases de la partie, dans l’ordre" style={{ padding: 0, margin: '8px 0 0' }}>
      {phases.map((p, i) => (
        <li key={p}>
          <span className="num" style={{ color: 'var(--muted)', width: 18 }}>{i + 1}</span>
          <b>{PHASE_LABELS[p]}</b>
          <span className="lots" role="group" aria-label={`Lots pour ${PHASE_LABELS[p]}`}>
            <button type="button" className="btn ghost" disabled={locked || l[i] <= 1} onClick={() => setLot(i, l[i] - 1)} aria-label={`Un lot de moins pour ${PHASE_LABELS[p]}`}>−</button>
            <span data-testid={`lots-${p}`}>{l[i]} lot{l[i] > 1 ? 's' : ''}</span>
            <button type="button" className="btn ghost" disabled={locked || l[i] >= LOTS_MAX} onClick={() => setLot(i, l[i] + 1)} aria-label={`Un lot de plus pour ${PHASE_LABELS[p]}`}>+</button>
          </span>
          <button type="button" className="btn ghost" disabled={locked || i === 0} onClick={() => move(i, -1)} aria-label={`Monter ${PHASE_LABELS[p]}`}>↑</button>
          <button type="button" className="btn ghost" disabled={locked || i === phases.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre ${PHASE_LABELS[p]}`}>↓</button>
          <button type="button" className="btn ghost" disabled={locked || phases.length === 1} onClick={() => onChange(phases.filter((x) => x !== p), l.filter((_, k) => k !== i))} aria-label={`Retirer ${PHASE_LABELS[p]}`}>Retirer</button>
        </li>
      ))}
      {off.map((p) => (
        <li key={p} className="off">
          <span style={{ width: 18 }} />
          <b>{PHASE_LABELS[p]}</b>
          <button type="button" className="btn ghost" disabled={locked} onClick={() => onChange([...phases, p], [...l, 1])}>Ajouter</button>
        </li>
      ))}
    </ol>
  )
}

export function SettingsForm({ settings, onChange, phases, lots, onPhases, phasesLocked, onTestVoice }: {
  settings: BingoSettings
  onChange: (s: BingoSettings) => void
  phases: Phase[]
  lots: number[]
  /** Étapes et lots changent ensemble (formule). */
  onPhases: (p: Phase[], lots: number[]) => void
  phasesLocked: boolean
  onTestVoice: () => void
}) {
  const pub = (patch: Partial<BingoSettings['public']>) => onChange({ ...settings, public: { ...settings.public, ...patch } })
  const detected = detectFormula(phases, lots)
  const [customOpen, setCustomOpen] = useState(detected === 'custom')
  const formula: FormulaId = customOpen ? 'custom' : detected
  const pick = (id: FormulaId) => {
    if (id === 'custom') {
      setCustomOpen(true)
      onChange({ ...settings, formula: 'custom' })
      return
    }
    setCustomOpen(false)
    onPhases([...FORMULAS[id].phases], [...FORMULAS[id].lots])
    onChange({ ...settings, formula: id })
  }
  const multiLots = normalizeLots(phases, lots).some((n) => n > 1)
  return (
    <div>
      <Opt title="Cartons par téléphone" help="Chaque joueur reçoit ce nombre de cartons en rejoignant la partie.">
        <div className="pills" role="group" aria-label="Cartons par téléphone">
          {([1, 2, 3, 4] as const).map((n) => (
            <button key={n} type="button" className="pill" aria-pressed={settings.cardsPerPlayer === n} onClick={() => onChange({ ...settings, cardsPerPlayer: n })}>{n}</button>
          ))}
        </div>
      </Opt>
      <div className="opt" style={{ display: 'block' }} data-testid="formula">
        <div className="t">
          <b>Formule de la partie</b>
          <span>{phasesLocked ? 'La partie a commencé : la formule ne change plus.' : formula === 'custom' ? 'Choisissez les étapes, leur ordre et le nombre de lots de chacune.' : FORMULAS[formula].help}</span>
        </div>
        <div className="pills formulas" role="group" aria-label="Formule de la partie">
          {(['classic', 'plein', 'suivie', 'custom'] as const).map((id) => (
            <button key={id} type="button" className="pill" aria-pressed={formula === id} disabled={phasesLocked} onClick={() => pick(id)} data-testid={`formula-${id}`}>
              {id === 'custom' ? 'Personnalisée' : FORMULAS[id].label}
            </button>
          ))}
        </div>
        {formula === 'custom' ? (
          <PhasesEditor phases={phases} lots={lots} onChange={onPhases} locked={phasesLocked} />
        ) : (
          <p className="note" style={{ margin: '8px 0 0' }} data-testid="formula-summary">
            {phases.map((p, i) => `${PHASE_LABELS[p]}${(normalizeLots(phases, lots)[i] ?? 1) > 1 ? ` ×${normalizeLots(phases, lots)[i]}` : ''}`).join(' → ')}
          </p>
        )}
      </div>
      <Opt title="Fin d’une étape" help={settings.advance === 'auto' ? 'On passe tout seul à l’étape suivante 8 s après le dernier lot.' : 'Après le dernier lot, un gros bouton « Passer à… » vous laisse le temps d’annoncer et de remettre le lot.'}>
        <div className="pills" role="group" aria-label="Fin d’une étape">
          <button type="button" className="pill" aria-pressed={settings.advance !== 'auto'} onClick={() => onChange({ ...settings, advance: 'manual' })} data-testid="advance-manual">Bouton</button>
          <button type="button" className="pill" aria-pressed={settings.advance === 'auto'} onClick={() => onChange({ ...settings, advance: 'auto' })} data-testid="advance-auto">Auto 8 s</button>
        </div>
      </Opt>
      <Opt title="Gagnants sur la même boule" help={settings.tie === 'each' ? 'Chaque gagnant de la même boule reçoit son propre lot.' : 'Ils se partagent un seul lot.'}>
        <div className="pills" role="group" aria-label="Gagnants sur la même boule">
          <button type="button" className="pill" aria-pressed={settings.tie !== 'each'} onClick={() => onChange({ ...settings, tie: 'shared' })} data-testid="tie-shared">Un lot partagé</button>
          <button type="button" className="pill" aria-pressed={settings.tie === 'each'} onClick={() => onChange({ ...settings, tie: 'each' })} data-testid="tie-each">Chacun un lot</button>
        </div>
      </Opt>
      {multiLots && (
        <Opt title="Même carton plusieurs fois" help="Dans une étape à plusieurs lots, un carton déjà gagnant peut regagner avec de nouvelles lignes complètes.">
          <Switch on={settings.repeatCard} onChange={(v) => onChange({ ...settings, repeatCard: v })} label="Même carton plusieurs fois" testId="opt-repeat-card" />
        </Opt>
      )}
      <Opt title="Pause à chaque demande" help="Une quine annoncée bloque le tirage le temps de la vérifier.">
        <Switch on={settings.pauseOnClaim} onChange={(v) => onChange({ ...settings, pauseOnClaim: v })} label="Pause à chaque demande" />
      </Opt>
      <Opt title="Voix et bruitages" help="Annonce les numéros en français, avec les bruitages (boule, quine, gagnant…), uniquement sur ce PC (branchez-le à la sono).">
        <div className="pills" role="group" aria-label="Voix">
          <button type="button" className="pill" aria-pressed={settings.voice === 'off'} onClick={() => onChange({ ...settings, voice: 'off' })}>Coupée</button>
          <button type="button" className="pill" aria-pressed={settings.voice !== 'off'} onClick={() => onChange({ ...settings, voice: 'tts' })}>Français</button>
          <button type="button" className="pill" onClick={onTestVoice} disabled={settings.voice === 'off'}>Tester</button>
        </div>
      </Opt>
      <Opt title="Dernier numéro sur les téléphones" help="Affiché par défaut. Coupez-le pour obliger à écouter et regarder l’écran.">
        <Switch on={settings.public.showLast} onChange={(v) => pub({ showLast: v })} label="Dernier numéro sur les téléphones" testId="opt-show-last" />
      </Opt>
      <Opt title="Prénom du gagnant à l’écran" help="Sinon, seul le numéro du carton gagnant est affiché.">
        <Switch on={settings.public.showName} onChange={(v) => pub({ showName: v })} label="Prénom du gagnant à l’écran" />
      </Opt>
    </div>
  )
}
