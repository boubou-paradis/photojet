// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// Studio : rendu 3D (Three.js) avec secours DOM lisible (pas de WebGL, PC trop lent, « dom » demandé).
// Contexte graphique perdu : secours DOM le temps de relancer la 3D (2 relances au plus en 5 min, ensuite DOM).
// Le mode affiché est signalé à la régie, qui peut « Réessayer la 3D » (lib/fx3d/status.ts).

import { useEffect, useRef, useState } from 'react'
import { onFx3dRetry, reportFx3d, type Fx3dReason } from '@/lib/fx3d/status'
import { layoutBoard, type Cell } from '@/lib/demimot/text'
import type { PublicCell } from '@/lib/demimot/view'
import type { Quality, StudioScene, StudioState } from './three/StudioScene'

export interface StudioProps {
  state: StudioState
  quality: Quality | 'dom'
  reducedMotion: boolean
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const MAX_RESTARTS = 2
const RESTART_WINDOW_MS = 5 * 60_000

const REASON: Record<string, Fx3dReason> = { forced: 'forced', no_webgl: 'no_webgl', init_failed: 'load_failed', too_slow: 'too_slow', context_lost: 'context_lost' }

export function Studio({ state, quality, reducedMotion }: StudioProps) {
  // Secours DOM : pas de WebGL, contexte perdu (relances épuisées), PC trop lent (signalé par la scène) ou « dom » demandé.
  const [fallback, setFallback] = useState<string | null>(() => (quality === 'dom' ? 'forced' : typeof document === 'undefined' || webglAvailable() ? null : 'no_webgl'))
  const [fallbackFps, setFallbackFps] = useState<number | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [pendingFps, setPendingFps] = useState<number | null>(null)
  // relance après perte du contexte : nouveau canevas (l'ancien contexte est perdu pour de bon)
  const [restarting, setRestarting] = useState(false)
  const [gen, setGen] = useState(0)
  const restartsRef = useRef<number[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<StudioScene | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (fallback) reportFx3d('demimot', { mode: '2d', reason: REASON[fallback] ?? 'load_failed', fps: fallbackFps })
    else if (!ready || restarting) reportFx3d('demimot', { mode: 'loading', restarting })
    else reportFx3d('demimot', { mode: '3d', pendingFps: pendingFps ?? undefined })
  }, [fallback, fallbackFps, ready, restarting, pendingFps])
  useEffect(() => () => reportFx3d('demimot', { mode: 'off' }), [])
  // « Réessayer la 3D » depuis la régie (rien à faire si la 3D tourne ou si la 2D est demandée)
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback
  useEffect(() => onFx3dRetry('demimot', () => {
    const f = fallbackRef.current
    if (!f || f === 'forced') return
    restartsRef.current = []
    setFallbackFps(undefined)
    setPendingFps(null)
    setRestarting(false)
    setReady(false)
    setGen((g) => g + 1)
    setFallback(webglAvailable() ? null : 'no_webgl')
  }), [])

  useEffect(() => {
    if (fallback || restarting || !canvasRef.current) return
    let cancelled = false
    let scene: StudioScene | null = null
    void (async () => {
      // three n'est chargé qu'ici, à l'affichage d'À Demi-Mot (jamais sur l'accueil, la régie ni les téléphones).
      const [{ StudioScene }, { fontFamily }] = await Promise.all([import('./three/StudioScene'), import('./three/textures')])
      const fam = fontFamily()
      await Promise.all([document.fonts.load(`800 100px ${fam}`), document.fonts.load(`700 100px ${fam}`), document.fonts.load(`600 100px ${fam}`)]).catch(() => undefined)
      if (cancelled || !canvasRef.current) return
      try {
        scene = new StudioScene(canvasRef.current, {
          quality: quality === 'dom' ? 'low' : quality,
          reducedMotion,
          onPending: (fps) => setPendingFps(fps),
          onFallback: (r, fps) => {
            setReady(false)
            setPendingFps(null)
            if (r !== 'context_lost') { setFallbackFps(fps); setFallback(r); return }
            const now = Date.now()
            const list = restartsRef.current.filter((t) => now - t < RESTART_WINDOW_MS)
            if (list.length >= MAX_RESTARTS) { restartsRef.current = list; setFallback('context_lost'); return }
            restartsRef.current = [...list, now]
            console.warn('[À Demi-Mot] contexte graphique perdu : relance de la 3D')
            setRestarting(true)
          },
        })
        sceneRef.current = scene
        ;(window as unknown as { __demimotStudio?: StudioScene }).__demimotStudio = scene
        scene.setState(stateRef.current)
        setReady(true)
      } catch {
        setReady(false)
        // après une perte de contexte, Chrome peut refuser un nouveau contexte : la cause reste le contexte graphique
        setFallback(restartsRef.current.length ? 'context_lost' : 'init_failed')
      }
    })()
    return () => {
      cancelled = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [fallback, quality, reducedMotion, restarting, gen])

  // relance : secours DOM 1,2 s puis nouveau canevas et nouvelle scène
  useEffect(() => {
    if (!restarting) return
    const t = setTimeout(() => { setGen((g) => g + 1); setRestarting(false) }, 1200)
    return () => clearTimeout(t)
  }, [restarting])

  useEffect(() => {
    sceneRef.current?.setState(state)
  }, [state])

  if (fallback || restarting) return <DomStudio state={state} reducedMotion={reducedMotion} />
  return (
    <>
      <canvas key={gen} ref={canvasRef} className="board-canvas" aria-label="Plateau de jeu À Demi-Mot" role="img" data-testid="board-canvas" />
      {/* Plus de 10 équipes : la scène 3D n'a pas de pupitres, ce tableau (le même qu'en mode sans 3D) les remplace. */}
      {state.showTeams && state.compactScores && (
        <div className="score-board-overlay">
          <ScoreBoard teams={state.teams} />
        </div>
      )}
    </>
  )
}

/**
 * Tableau des scores compact (11 à 20 équipes) : 2 lignes, numéro dans la
 * couleur de l'équipe, nom raccourci, gros score. L'équipe qui a la main
 * s'allume, une équipe bloquée est grisée. Ordre fixe (numéro d'équipe) :
 * chacun retrouve sa case ; le classement trié reste sur la touche C / B.
 */
export function ScoreBoard({ teams }: { teams: StudioState['teams'] }) {
  const cols = Math.ceil(teams.length / 2)
  return (
    <div className="score-board" data-testid="score-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {teams.map((t, i) => (
        <div key={t.id} className={`sb-cell ${t.state}`} style={{ ['--team' as string]: t.color } as React.CSSProperties} data-testid="score-cell">
          <span className="sb-n">{i + 1}</span>
          <span className="sb-nm">{t.name}</span>
          <span className="sb-sc">{t.score}</span>
          {(t.state === 'active' || t.state === 'blocked') && <span className="sb-st">{t.state === 'active' ? 'À vous' : 'Bloquée'}</span>}
        </div>
      ))}
    </div>
  )
}

/** Secours DOM : même hiérarchie (signature, catégorie en titre, mur, pupitres), sans 3D. Couleurs : variables du thème. */
export function DomStudio({ state, reducedMotion }: { state: StudioState; reducedMotion: boolean }) {
  return (
    <div className={`dom-studio${reducedMotion ? ' no-motion' : ''}`} data-testid="dom-board">
      <div className="dom-sig">À Demi-Mot</div>
      <div className="dom-head">
        {state.category && <div className="dom-cat">{state.category}</div>}
        <div className="dom-line">
          {state.line.map((p, i) => (
            <span key={i} style={{ color: p.color }}>{p.text}</span>
          ))}
        </div>
      </div>
      <div className="dom-board-wrap">
        <DomBoard cells={state.board.cells} accent={state.accent} reducedMotion={reducedMotion} />
        {state.gauge && <DomCountdown gauge={state.gauge} clockOffsetMs={state.clockOffsetMs} />}
      </div>
      {state.showTeams && state.compactScores && <ScoreBoard teams={state.teams} />}
      {state.showTeams && !state.compactScores && (
        <div className="dom-lecterns" style={{ gridTemplateColumns: `repeat(${state.teams.length > 6 ? Math.ceil(state.teams.length / 2) : state.teams.length}, minmax(0, 1fr))` }}>
          {state.teams.map((t, i) => (
            <div key={t.id} className={`dom-lectern ${t.state}`} style={{ ['--team' as string]: t.color } as React.CSSProperties}>
              <span className="n">{i + 1}</span>
              <span className="nm">{t.name}</span>
              <i />
              <span className="sc">{t.score}</span>
              {(t.state === 'active' || t.state === 'blocked') && <span className="st">{t.state === 'active' ? 'À vous' : 'Bloquée'}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="dom-code">Capitaines · <b>{state.code}</b></div>
    </div>
  )
}

/** Compte à rebours du secours DOM : nom de l'équipe qui a la main + secondes restantes. */
function DomCountdown({ gauge, clockOffsetMs }: { gauge: NonNullable<StudioState['gauge']>; clockOffsetMs: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [])
  const left = Math.max(0, gauge.endsAt - (now + clockOffsetMs))
  if (left <= 0) return null
  return (
    <div className="dom-countdown" data-testid="countdown" style={{ ['--team' as string]: gauge.color } as React.CSSProperties}>
      <i />
      <span className="lb">{gauge.label}</span>
      <span className="s">
        {Math.ceil(left / 1000)}
        <small> s</small>
      </span>
    </div>
  )
}

export function DomBoard({ cells, accent, reducedMotion, compact }: { cells: PublicCell[]; accent: string | null; reducedMotion: boolean; compact?: boolean }) {
  const layoutCells: Cell[] = cells.map((c) => ({ ch: c.ch ?? 'M', kind: c.kind }))
  const layout = layoutBoard(layoutCells, 3.95)
  const size = compact ? `min(${(layout.tile * 100).toFixed(2)}cqw, 56px)` : `min(${(layout.tile * 80).toFixed(2)}vw, ${(40 / (layout.rows * 1.5)).toFixed(2)}vh)`
  return (
    <div className={`dom-board${reducedMotion ? ' no-motion' : ''}${compact ? ' compact' : ''}`} style={{ ['--tile' as string]: size, ['--accent' as string]: accent ?? 'var(--plate-accent)' }}>
      <div className="dom-board-panel">
        {layout.lines.map((line, r) => (
          <div className="dom-row" key={r}>
            {line.map((i, k) =>
              i < 0 ? (
                <span className="dom-gap" key={`g${k}`} />
              ) : (
                <span className={`dom-tile${cells[i].ch !== null ? ' shown' : ''}`} key={i}>
                  <span className="dom-inner">
                    <span className="dom-face dom-back" />
                    <span className="dom-face dom-front">{cells[i].ch ?? ''}</span>
                  </span>
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
