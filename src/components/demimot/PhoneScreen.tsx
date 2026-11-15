// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// Téléphone du capitaine : identité de l'équipe et grand buzzer.
// Aucun succès optimiste : « accepted » n'apparaît qu'après la réponse de l'autorité.

import { Check, Hourglass, Lock, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import type { PhoneStatus, PublicTeam } from '@/lib/demimot/view'

export interface PhoneScreenProps {
  status: PhoneStatus
  team: PublicTeam | null
  teams?: PublicTeam[]
  takenTeamIds?: string[]
  otherTeamName?: string
  secondsLeft?: number | null
  online: boolean
  wakeLock?: 'on' | 'unsupported' | 'off'
  onBuzz?: () => void
  onPickTeam?: (id: string) => void
}

export function PhoneScreen(p: PhoneScreenProps) {
  const team = p.team
  const style = team ? ({ ['--team' as string]: team.color } as React.CSSProperties) : undefined
  if (p.status === 'choose_team' || !team) {
    return (
      <div className="phone" data-testid="phone" data-status="choose_team">
        <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
          <div className="title-3d" style={{ fontSize: 34 }}>À Demi-Mot</div>
          <div className="signature" style={{ fontSize: 15, marginTop: 8 }}>Quelques lettres. À vous de trouver.</div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 15, textAlign: 'center', margin: '10px 0 16px' }}>
          Vous êtes le <b style={{ color: 'var(--white)' }}>capitaine</b> : choisissez votre équipe. Vos coéquipiers jouent à l’oral, autour de la table.
        </p>
        <div className="team-pick">
          {(p.teams ?? []).map((t) => {
            const taken = p.takenTeamIds?.includes(t.id) ?? false
            return (
              <button key={t.id} disabled={taken} onClick={() => p.onPickTeam?.(t.id)} style={{ ['--team' as string]: t.color } as React.CSSProperties}>
                <span className="sw" />
                {t.name}
                <em>{taken ? 'déjà prise' : 'libre'}</em>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const { cls, label, disabled, title, sub } = describe(p)
  return (
    <div className="phone" style={style} data-testid="phone" data-status={p.status}>
      <div className="phone-head">
        <span className="sw" />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{team.name}</div>
          <div className="sub">
            {p.online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {p.online ? 'Capitaine connecté' : 'Reconnexion…'}
          </div>
        </div>
        <div className="score">
          {team.score}
          <small>points</small>
        </div>
      </div>
      {!p.online && (
        <div className="phone-banner warn">
          <RefreshCw size={16} /> Connexion perdue, reconnexion automatique…
        </div>
      )}
      <div className="phone-main">
        <button className={`buzzer ${cls}`} disabled={disabled} onClick={p.onBuzz} aria-label={title} data-testid="buzzer">
          <span className="inner">{label}</span>
        </button>
      </div>
      <div className="phone-status" aria-live="polite">
        {title}
        {sub && <small>{sub}</small>}
      </div>
      {p.wakeLock === 'unsupported' && <div className="phone-banner warn" style={{ fontSize: 12.5 }}>Astuce : gardez l’écran allumé pendant la partie.</div>}
    </div>
  )
}

function describe(p: PhoneScreenProps): { cls: string; label: React.ReactNode; disabled: boolean; title: string; sub?: string } {
  switch (p.status) {
    case 'open':
      return { cls: 'open', label: 'BUZZ !', disabled: false, title: 'Buzzer ouvert', sub: 'Appuyez dès que votre équipe a trouvé.' }
    case 'sent':
      return { cls: 'sent', label: <><Hourglass size={34} /> Envoi…</>, disabled: true, title: 'Buzz envoyé', sub: 'En attente de l’arbitre…' }
    case 'accepted':
      return { cls: 'accepted', label: <><Check size={44} /> À vous !</>, disabled: true, title: 'Vous avez la main !', sub: p.secondsLeft != null ? `Donnez la réponse à l’animateur · ${p.secondsLeft} s` : 'Donnez la réponse à l’animateur.' }
    case 'too_late':
      return { cls: 'idle', label: 'Trop tard', disabled: true, title: p.otherTeamName ? `${p.otherTeamName} a buzzé avant vous` : 'Une autre équipe a buzzé avant vous', sub: 'Restez prêts : le buzzer peut se rouvrir.' }
    case 'blocked':
      return { cls: 'locked', label: <><Lock size={36} /> Bloquée</>, disabled: true, title: 'Équipe bloquée pour cette énigme', sub: 'Vous rejouerez à la prochaine énigme.' }
    case 'letters_turn':
      return { cls: 'accepted', label: 'À vous !', disabled: true, title: 'Proposez une lettre à l’animateur', sub: 'Tour de lettres : le buzzer est inactif.' }
    case 'revoked':
      return { cls: 'locked', label: 'Remplacé', disabled: true, title: 'Ce téléphone a été remplacé', sub: 'L’animateur a transféré l’équipe sur un autre téléphone.' }
    case 'reconnecting':
    case 'connecting':
      return { cls: 'idle', label: 'Connexion…', disabled: true, title: 'Connexion au jeu…' }
    default:
      return { cls: 'idle', label: 'En attente', disabled: true, title: 'Préparez-vous', sub: 'Le buzzer s’ouvrira au lancement du dévoilement.' }
  }
}
