'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Réglages d'AnimaBingo, valables pour toute la soirée : avant le lancement
// (préparation) et pendant la partie (fenêtre « Réglages »). Deux onglets,
// jamais de défilement. La FORMULE n'est plus ici : elle se choisit dans la
// régie, partie par partie (FormulaControl).

import { useState } from 'react'
import type { BingoSettings } from '@/lib/bingo/types'

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

export function SettingsForm({ settings, onChange, onTestVoice }: {
  settings: BingoSettings
  onChange: (s: BingoSettings) => void
  onTestVoice: () => void
}) {
  const pub = (patch: Partial<BingoSettings['public']>) => onChange({ ...settings, public: { ...settings.public, ...patch } })
  const [tab, setTab] = useState<'rules' | 'show'>('rules')
  return (
    <div>
      <div className="seg tabs" role="tablist" aria-label="Réglages">
        <button role="tab" aria-selected={tab === 'rules'} onClick={() => setTab('rules')} data-testid="tab-rules">Règles du jeu</button>
        <button role="tab" aria-selected={tab === 'show'} onClick={() => setTab('show')} data-testid="tab-show">Son et affichage</button>
      </div>
      {tab === 'rules' ? (
      <div role="tabpanel">
      <Opt title="Cartons par téléphone" help="Chaque joueur reçoit ce nombre de cartons en rejoignant la soirée.">
        <div className="pills" role="group" aria-label="Cartons par téléphone">
          {([1, 2, 3, 4] as const).map((n) => (
            <button key={n} type="button" className="pill" aria-pressed={settings.cardsPerPlayer === n} onClick={() => onChange({ ...settings, cardsPerPlayer: n })}>{n}</button>
          ))}
        </div>
      </Opt>
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
      <Opt title="Même carton plusieurs fois" help="Étape à plusieurs lots : un carton déjà gagnant peut regagner avec de nouvelles lignes.">
        <Switch on={settings.repeatCard} onChange={(v) => onChange({ ...settings, repeatCard: v })} label="Même carton plusieurs fois" testId="opt-repeat-card" />
      </Opt>
      <Opt title="Pause à chaque demande" help="Une quine annoncée bloque le tirage le temps de la vérifier.">
        <Switch on={settings.pauseOnClaim} onChange={(v) => onChange({ ...settings, pauseOnClaim: v })} label="Pause à chaque demande" />
      </Opt>
      </div>
      ) : (
      <div role="tabpanel">
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
      )}
    </div>
  )
}
