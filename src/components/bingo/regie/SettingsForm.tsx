'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglages d'AnimaBingo : avant le lancement (préparation) et pendant la
// partie (fenêtre « Réglages »). Les phases ne se changent plus après la
// première boule (la base le refuse aussi).

import { BINGO_PHASES, PHASE_LABELS } from '@/lib/bingo/constants'
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

export function PhasesEditor({ phases, onChange, locked }: { phases: Phase[]; onChange: (p: Phase[]) => void; locked: boolean }) {
  const off = BINGO_PHASES.filter((p) => !phases.includes(p))
  const move = (i: number, d: -1 | 1) => {
    const next = [...phases]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <ol className="order" aria-label="Phases de la partie, dans l’ordre" style={{ padding: 0, margin: '8px 0 0' }}>
      {phases.map((p, i) => (
        <li key={p}>
          <span className="num" style={{ color: 'var(--muted)', width: 18 }}>{i + 1}</span>
          <b>{PHASE_LABELS[p]}</b>
          <button type="button" className="btn ghost" disabled={locked || i === 0} onClick={() => move(i, -1)} aria-label={`Monter ${PHASE_LABELS[p]}`}>↑</button>
          <button type="button" className="btn ghost" disabled={locked || i === phases.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre ${PHASE_LABELS[p]}`}>↓</button>
          <button type="button" className="btn ghost" disabled={locked || phases.length === 1} onClick={() => onChange(phases.filter((x) => x !== p))} aria-label={`Retirer ${PHASE_LABELS[p]}`}>Retirer</button>
        </li>
      ))}
      {off.map((p) => (
        <li key={p} className="off">
          <span style={{ width: 18 }} />
          <b>{PHASE_LABELS[p]}</b>
          <button type="button" className="btn ghost" disabled={locked} onClick={() => onChange([...phases, p])}>Ajouter</button>
        </li>
      ))}
    </ol>
  )
}

export function SettingsForm({ settings, onChange, phases, onPhases, phasesLocked, onTestVoice }: {
  settings: BingoSettings
  onChange: (s: BingoSettings) => void
  phases: Phase[]
  onPhases: (p: Phase[]) => void
  phasesLocked: boolean
  onTestVoice: () => void
}) {
  const pub = (patch: Partial<BingoSettings['public']>) => onChange({ ...settings, public: { ...settings.public, ...patch } })
  return (
    <div>
      <Opt title="Cartons par téléphone" help="Chaque joueur reçoit ce nombre de cartons en rejoignant la partie.">
        <div className="pills" role="group" aria-label="Cartons par téléphone">
          {([1, 2, 3, 4] as const).map((n) => (
            <button key={n} type="button" className="pill" aria-pressed={settings.cardsPerPlayer === n} onClick={() => onChange({ ...settings, cardsPerPlayer: n })}>{n}</button>
          ))}
        </div>
      </Opt>
      <div className="opt" style={{ display: 'block' }}>
        <div className="t"><b>Phases et ordre</b><span>{phasesLocked ? 'La partie a commencé : les phases ne changent plus.' : 'On joue les phases dans cet ordre.'}</span></div>
        <PhasesEditor phases={phases} onChange={onPhases} locked={phasesLocked} />
      </div>
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
