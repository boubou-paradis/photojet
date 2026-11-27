'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Régie : mode du plateau sur le grand écran (3D / 2D + raison), bouton « Réessayer la 3D » et dernier repli enregistré.
// Style autonome (fond sombre, accent or) : s'insère tel quel dans les régies Roue, À Demi-Mot, AnimaBingo et Tombola.

import { useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { FX3D_REASON_LABEL, useFx3dMonitor, type Fx3dEvent, type Fx3dGame, type Fx3dStatus } from '@/lib/fx3d/status'
import s from './Fx3dPanel.module.css'

const RETRYABLE = new Set(['too_slow', 'context_lost', 'load_failed', 'no_webgl'])

const hhmm = (t: number) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function reasonText(r: Fx3dStatus['reason'] | Fx3dEvent['reason'], fps?: number) {
  if (!r) return ''
  return FX3D_REASON_LABEL[r] + (r === 'too_slow' && fps !== undefined ? ` (${fps} images/s)` : '')
}

export function Fx3dPanel({ code, game, className }: { code: string | null | undefined; game: Fx3dGame; className?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const { status, retry } = useFx3dMonitor(code, game, supabase)
  const last = status?.log.at(-1)

  let tone: 'ok' | 'warn' | 'off' = 'off'
  let text = 'Grand écran : jeu pas affiché'
  if (status) {
    if (status.mode === '3d') {
      tone = status.pendingFps !== undefined ? 'warn' : 'ok'
      text = status.pendingFps !== undefined ? `3D — passera en 2D à la fin de l’animation (PC trop lent, ${status.pendingFps} images/s)` : '3D'
    } else if (status.mode === 'loading') {
      tone = 'warn'
      text = status.restarting ? 'Relance de la 3D (contexte graphique perdu)…' : 'Chargement de la 3D…'
    } else if (status.mode === '2d') {
      tone = status.reason === 'forced' ? 'off' : 'warn'
      text = `2D : ${reasonText(status.reason, status.fps)}`
    }
  }
  const canRetry = status?.mode === '2d' && !!status.reason && RETRYABLE.has(status.reason)

  return (
    <div className={`${s.box} ${className ?? ''}`} data-testid="fx3d-panel" data-mode={status?.mode ?? 'none'} data-reason={status?.reason ?? ''}>
      <div className={s.row}>
        <span className={`${s.dot} ${s[tone]}`} aria-hidden />
        <span className={s.label}>Affichage</span>
        <span className={s.text} data-testid="fx3d-text">{status ? text : 'Grand écran : jeu pas affiché'}</span>
        {canRetry && (
          <button type="button" className={s.btn} onClick={retry} data-testid="fx3d-retry">Réessayer la 3D</button>
        )}
      </div>
      {last && (
        <p className={s.last} data-testid="fx3d-last">
          Dernier repli : {reasonText(last.reason, last.fps)} — {hhmm(last.at)}
        </p>
      )}
    </div>
  )
}
