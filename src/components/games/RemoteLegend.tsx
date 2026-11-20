// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

// Légende de la télécommande (régie uniquement, jamais l'écran géant ni les
// téléphones). Elle n'est JAMAIS écrite à la main : chaque régie la calcule
// avec la même fonction de décision que celle qu'exécutent ses touches
// (useRemoteControl), pour l'état en cours. Panneau flottant : aucun décalage
// de la page, aucun défilement. Ouvert / replié : mémorisé sur ce navigateur.

import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Keyboard } from 'lucide-react'

/** Libellé de l'action de chaque touche maintenant. null = la touche ne fait rien dans cet état. */
export interface RemoteLegendData {
  /** Mêmes conditions que `active` de useRemoteControl. */
  active: boolean
  /** Mêmes conditions que `isBlocked` de useRemoteControl (fenêtre ouverte). */
  blocked?: boolean
  next: string | null
  prev: string | null
  /** undefined = la touche B n'est pas utilisée dans ce jeu. */
  secondary?: string | null
  /** Pourquoi les touches sont coupées (partie pas lancée, terminée…). */
  inactiveReason?: string
}

const KEYS: { id: 'next' | 'prev' | 'secondary'; kbd: string }[] = [
  { id: 'next', kbd: 'Page ↓' },
  { id: 'prev', kbd: 'Page ↑' },
  { id: 'secondary', kbd: 'B' },
]

// ---------- Ouvert / replié, mémorisé (ouvert par défaut) ----------
const OPEN_KEY = 'animajet-remote-legend'
let memoryOpen = true
const listeners = new Set<() => void>()
function readOpen(): boolean {
  try {
    const v = window.localStorage.getItem(OPEN_KEY)
    return v === null ? memoryOpen : v === 'open'
  } catch {
    return memoryOpen
  }
}
function writeOpen(open: boolean) {
  memoryOpen = open
  try {
    window.localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed')
  } catch {
    // stockage indisponible : on garde la valeur en mémoire
  }
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  window.addEventListener('storage', l)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', l)
  }
}

/** Texte de la touche : libellé, ou raison pour laquelle elle ne fait rien. */
export function legendText(data: RemoteLegendData, id: 'next' | 'prev' | 'secondary'): { text: string; on: boolean } | null {
  const label = data[id]
  if (id === 'secondary' && label === undefined) return null
  if (label) return { text: label, on: true }
  return { text: 'ne fait rien maintenant', on: false }
}

/** compact : en-tête très chargé (AnimaBingo) → icône seule sous 1500 px de large, le mot reste en info-bulle. */
export default function RemoteLegend({ data, compact = false }: { data: RemoteLegendData; compact?: boolean }) {
  const open = useSyncExternalStore(subscribe, readOpen, () => false)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Panneau collé sous le bouton (position appliquée directement, sans re-rendu).
  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect()
    const el = panel.current
    if (!r || !el) return
    el.style.top = `${r.bottom + 8}px`
    el.style.right = `${Math.max(8, window.innerWidth - r.right)}px`
    el.style.visibility = 'visible'
  }, [])
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  let status: string | null = null
  if (!data.active) status = data.inactiveReason ?? 'Les touches agissent une fois la partie lancée.'
  else if (data.blocked) status = 'Touches en attente : fermez la fenêtre ouverte.'

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          writeOpen(!open)
          e.currentTarget.blur() // sinon la télécommande resterait captée par ce bouton
        }}
        data-testid="remote-legend-toggle"
        title="Touches de la télécommande"
        className={`flex items-center gap-1 rounded-xl text-xs border border-white/10 text-gray-300 hover:border-[#D4AF37]/40 transition-colors ${compact ? 'px-2.5 py-2' : 'px-3 py-2'}`}
      >
        {compact && <Keyboard className="h-4 w-4 min-[1500px]:hidden" aria-hidden />}
        <span className={compact ? 'max-[1499px]:sr-only' : undefined}>Touches</span> <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && createPortal(
        <div
          role="note"
          aria-label="Touches de la télécommande"
          data-testid="remote-legend"
          data-active={data.active ? '1' : '0'}
          ref={panel}
          style={{ position: 'fixed', top: 0, right: 8, visibility: 'hidden', zIndex: 70, width: 330, maxWidth: 'calc(100vw - 16px)' }}
          className="rounded-2xl border border-[#D4AF37]/35 bg-[#17171b] px-3.5 py-3 text-[13px] text-gray-300 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-gray-400">Télécommande · maintenant</div>
          {status && <div className="mb-2 text-xs text-orange-300" data-testid="remote-legend-status">{status}</div>}
          {KEYS.map(({ id, kbd }) => {
            const t = legendText(data, id)
            if (!t) return null
            const on = t.on && data.active && !data.blocked
            return (
              <div key={id} className={`flex items-baseline gap-2.5 py-1 ${on ? '' : 'opacity-45'}`} data-testid={`remote-legend-${id}`} data-on={on ? '1' : '0'}>
                <kbd className="min-w-[62px] text-center font-mono text-xs font-semibold text-white bg-[#26262c] border border-white/15 border-b-2 rounded-md px-1.5 py-0.5">{kbd}</kbd>
                <span>{t.text}</span>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
