'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Demandes en attente, déjà vérifiées par le serveur (l'animateur reste seul
// juge). Valider / Refuser : à la SOURIS uniquement (jamais la télécommande).

import { PHASE_LABELS } from '@/lib/bingo/constants'
import { verdictText } from '@/lib/bingo/display'
import type { PendingClaim } from '@/lib/bingo/server'
import type { BingoPublicState, Phase } from '@/lib/bingo/types'
import { MiniCard } from './MiniCard'

function ago(iso: string, offset: number) {
  const s = Math.max(0, Math.round((Date.now() + offset - Date.parse(iso)) / 1000))
  return s < 60 ? `il y a ${s} s` : `il y a ${Math.floor(s / 60)} min`
}

export function ClaimsPanel({ claims, state, phase, busyId, offset, onDecide, titles = null, drawnFull }: {
  claims: PendingClaim[]
  state: BingoPublicState | null
  phase: Phase | null
  busyId: number | null
  offset: number
  onDecide: (c: PendingClaim, accept: boolean) => void
  /** Loto musical : titres de la partie. */
  titles?: readonly { t: string; a: string }[] | null
  /** Tirage complet vu par la régie (titre encore caché au public compris). */
  drawnFull?: readonly number[]
}) {
  const label = phase ? PHASE_LABELS[phase] : 'Quine'
  if (!claims.length) {
    return (
      <div className="box claims" data-testid="claims-panel">
        <h2><span>Demandes de {label.toLowerCase()}</span><span>0</span></h2>
        <div className="empty">Aucune demande pour l’instant.<br />Quand un joueur appuie sur « {label.toUpperCase()} ! », sa demande arrive ici, déjà vérifiée.</div>
      </div>
    )
  }
  const drawnAll = drawnFull ?? (state?.active ? state.drawn : [])
  return (
    <div className="box claims alert" data-testid="claims-panel" aria-live="polite">
      <h2><span>{label} en attente</span><span>{claims.length}</span></h2>
      {claims.map((c, i) => {
        const drawn = drawnAll.slice(0, c.drawCount)
        const v = verdictText(c.check, c.phase)
        return (
          <div className="claim" key={c.id} data-testid="claim">
            <div className="h">
              <b>{c.name ?? 'Joueur'}</b>
              <span>Carton n° {c.serial} · boule n° {c.drawCount} · {ago(c.createdAt, offset)}</span>
            </div>
            <div className={`verdict ${v.tone}`}>{v.tone === 'ok' ? '✓ ' : '⚠ '}{v.text}</div>
            {c.lateBy !== null && c.lateBy > 0 && (
              <div className="note">Combinaison complète depuis {c.lateBy} boule{c.lateBy > 1 ? 's' : ''} (annoncée en retard).</div>
            )}
            <MiniCard cells={c.cells} drawn={drawn} marks={c.marks} check={c.check} legend={i === 0} titles={titles} />
            <div className="actions">
              <button className={`btn ${c.check.valid ? 'ok' : 'ghost'}`} disabled={busyId !== null} onClick={() => onDecide(c, true)} data-testid="claim-accept">✓ Valider</button>
              <button className="btn no" disabled={busyId !== null} onClick={() => onDecide(c, false)} data-testid="claim-reject">Refuser</button>
            </div>
          </div>
        )
      })}
      <div className="note">Plusieurs demandes sur la même boule = plusieurs gagnants. Valider ne relance pas le tirage : vous gardez la main.</div>
    </div>
  )
}
