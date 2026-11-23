'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Tableau de bord, onglet « Musique » : demandes regroupées, triées par nombre.
// Relecture par route serveur (20 s onglet ouvert, 60 s sinon, rien quand la
// page est cachée). Aucun temps réel. Tout le texte est affiché comme du texte.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Merge, Music, RotateCcw, Split, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MusicCounts, MusicGroup, MusicStatus } from '@/lib/music/group'

export interface MusicState {
  enabled: boolean
  groups: MusicGroup[]
  counts: MusicCounts
  updatedAt: number
}

const EMPTY: MusicCounts = { pending: 0, played: 0, skipped: 0, requests: 0 }

/**
 * Lit les demandes de la session. Ne relit en boucle que si la fonction est
 * activée ou qu'il existe déjà des demandes : les autres comptes ne paient
 * qu'une lecture au chargement.
 */
export function useMusicRequests(sessionId: string | undefined, tabOpen: boolean) {
  const [state, setState] = useState<MusicState | null>(null)
  const busy = useRef(false)

  const apply = useCallback((data: { available?: boolean; enabled?: boolean; groups?: MusicGroup[]; counts?: MusicCounts }) => {
    if (!data.available) { setState(null); return }
    setState({ enabled: data.enabled === true, groups: data.groups ?? [], counts: data.counts ?? EMPTY, updatedAt: Date.now() })
  }, [])

  const refresh = useCallback(async () => {
    if (!sessionId || busy.current) return
    busy.current = true
    try {
      const r = await fetch(`/api/music/requests?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
      if (r.ok) apply(await r.json())
    } catch {
      /* réseau : on garde la dernière liste */
    } finally {
      busy.current = false
    }
  }, [sessionId, apply])

  useEffect(() => {
    setState(null)
    refresh()
  }, [sessionId, refresh])

  const live = !!state && (state.enabled || state.counts.requests > 0)
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, tabOpen ? 20_000 : 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [live, tabOpen, refresh])

  const act = useCallback(async (payload: Record<string, unknown>) => {
    if (!sessionId) return false
    try {
      const r = await fetch('/api/music/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      })
      if (!r.ok) throw new Error(String(r.status))
      apply(await r.json())
      return true
    } catch {
      toast.error('Action non enregistrée. Réessayez.')
      refresh()
      return false
    }
  }, [sessionId, apply, refresh])

  return { state, refresh, act }
}

type Filter = MusicStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'À traiter' },
  { value: 'played', label: 'Joués' },
  { value: 'skipped', label: 'Écartés' },
]

function hour(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function MusicRequestsPanel({ music }: { music: ReturnType<typeof useMusicRequests> }) {
  const { state, act } = music
  const [filter, setFilter] = useState<Filter>('pending')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  // Seules les lignes encore affichées comptent (regroupées, traitées, autre filtre : ignorées).
  const groups = state?.groups ?? []
  const visible = groups.filter((g) => g.status === filter)
  const selected = new Set(visible.map((g) => g.key).filter((k) => picked.has(k)))

  if (!state) {
    return <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  const counts = state.counts
  const run = async (id: string, payload: Record<string, unknown>) => {
    setPending(id)
    await act(payload)
    setPending(null)
  }
  const toggle = (key: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const target = visible.filter((g) => selected.has(g.key))
    .sort((a, b) => b.count - a.count || a.firstAt.localeCompare(b.firstAt))[0]

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="music-panel">
      <div className="flex items-center justify-between gap-3 mb-2 flex-shrink-0">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setOpen(null) }}
              data-testid={`music-filter-${f.value}`}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filter === f.value
                  ? 'bg-cyan-400/15 border-cyan-400/50 text-cyan-300'
                  : 'bg-[#2E2E33] border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {f.label} · {counts[f.value]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 truncate">
          {!state.enabled && 'Demandes désactivées dans Paramètres · '}
          {counts.requests} demande{counts.requests > 1 ? 's' : ''} reçue{counts.requests > 1 ? 's' : ''} · mise à jour {new Date(state.updatedAt).toLocaleTimeString('fr-FR')}
        </p>
      </div>

      {selected.size >= 2 && target && (
        <div className="flex items-center justify-between gap-3 mb-2 px-3 py-2 rounded-lg border border-dashed border-cyan-400/50 bg-cyan-400/10 text-xs text-cyan-100 flex-shrink-0" data-testid="music-mergebar">
          <span className="min-w-0 truncate">
            {selected.size} lignes sélectionnées. Elles seront regroupées sous « {target.title}{target.artist ? ` · ${target.artist}` : ''} », la plus demandée.
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => { await run('merge', { action: 'merge', keys: [...selected] }); setPicked(new Set()) }}
              disabled={pending !== null}
              data-testid="music-merge"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-cyan-400 text-[#041318] font-bold disabled:opacity-50"
            >
              <Merge className="h-3.5 w-3.5" />Regrouper
            </button>
            <button onClick={() => setPicked(new Set())} className="text-gray-400 hover:text-white">Annuler</button>
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto space-y-1.5 pr-1">
        {visible.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 gap-2 py-8">
            <Music className="h-8 w-8 text-cyan-400/40" />
            <p className="text-sm">
              {filter === 'pending'
                ? (counts.requests === 0
                    ? 'Aucune demande pour l’instant. Les invités demandent leurs morceaux depuis le QR de la session.'
                    : 'Tout est traité. Les nouvelles demandes arriveront ici.')
                : filter === 'played' ? 'Aucun morceau marqué « Joué ».' : 'Aucun morceau écarté.'}
            </p>
          </div>
        ) : visible.map((g, i) => {
          const isSel = selected.has(g.key)
          const variants = g.spellings.length
          return (
            <div key={g.key}>
              <div
                data-testid="music-row"
                className={`grid grid-cols-[20px_22px_minmax(0,1fr)_64px_96px_auto] gap-3 items-center px-3 py-2 rounded-lg border ${
                  isSel ? 'border-cyan-400/55 bg-cyan-400/[0.07]' : 'border-white/5 bg-white/[0.025]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(g.key)}
                  aria-label={`Sélectionner ${g.title}`}
                  className="h-4 w-4 accent-cyan-400 cursor-pointer"
                />
                <span className="text-center font-bold text-gray-500">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate" data-testid="music-title">
                    {g.title}
                    {variants > 1 && (
                      <button
                        onClick={() => setOpen(open === g.key ? null : g.key)}
                        className="ml-2 align-middle text-[10.5px] font-medium text-cyan-300 border border-cyan-400/35 rounded px-1.5"
                      >
                        {variants} écritures
                      </button>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{g.artist ?? '—'}</p>
                </div>
                <span className="text-right text-xl font-extrabold text-cyan-300" data-testid="music-count">×{g.count}</span>
                <span className="text-right text-xs text-gray-400">{g.count > 1 ? `dernière ${hour(g.lastAt)}` : hour(g.lastAt)}</span>
                <div className="flex gap-1.5 justify-end">
                  {g.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => run(g.key, { action: 'decide', key: g.key, status: 'played' })}
                        disabled={pending !== null}
                        data-testid="music-played"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />Joué
                      </button>
                      <button
                        onClick={() => run(g.key, { action: 'decide', key: g.key, status: 'skipped' })}
                        disabled={pending !== null}
                        data-testid="music-skipped"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />Pas ce soir
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => run(g.key, { action: 'decide', key: g.key, status: 'pending' })}
                      disabled={pending !== null}
                      data-testid="music-restore"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />Remettre à traiter
                    </button>
                  )}
                </div>
              </div>
              {open === g.key && (
                <div className="ml-14 mt-1 mb-1 pl-3 py-1.5 border-l-2 border-cyan-400/40 text-xs text-gray-400 flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words">
                    {g.spellings.map((s, k) => (
                      <span key={k}>
                        {k > 0 && ' · '}« {s.title}{s.artist ? ` – ${s.artist}` : ''} » ×{s.count}{s.merged && ' (regroupé)'}
                      </span>
                    ))}
                  </span>
                  {g.hasMerged && (
                    <button
                      onClick={() => run(g.key, { action: 'split', key: g.key })}
                      disabled={pending !== null}
                      data-testid="music-split"
                      className="shrink-0 inline-flex items-center gap-1 text-cyan-300 underline underline-offset-2 disabled:opacity-50"
                    >
                      <Split className="h-3 w-3" />Séparer
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {visible.length > 1 && filter === 'pending' && selected.size < 2 && (
        <p className="text-[11px] text-gray-500 pt-2 flex-shrink-0">Faute de frappe ? Cochez 2 lignes ou plus pour les regrouper.</p>
      )}
    </div>
  )
}
