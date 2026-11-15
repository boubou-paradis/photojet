'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot sur l'écran géant (/live). Plateau 3D du prototype ; la 3D
// (three) n'est chargée qu'ici, à la demande, et un plateau sans 3D prend
// le relais si le PC n'a pas WebGL ou s'il est trop lent. Ne reçoit que
// l'état public (jamais la solution non dévoilée). Aucun son ici : la sono
// est sur le PC de l'animateur.
// `?plateau=simple` dans l'adresse force le plateau sans 3D.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import { PublicScreen } from '@/components/demimot/PublicScreen'
import '@/components/demimot/demimot.css'
import { useDemiMotChannel } from '@/hooks/useDemiMotChannel'
import type { DemiMotLiveStatus } from '@/hooks/useDemiMotStatus'
import { createPublicClient } from '@/lib/supabase'
import type { LiveSession } from '@/lib/public-api/columns'

interface DemiMotGameProps {
  session: LiveSession
  status: DemiMotLiveStatus
}

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)
const detectSimple = () => new URLSearchParams(window.location.search).get('plateau') === 'simple'
const detectReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export default function DemiMotGame({ session, status }: DemiMotGameProps) {
  const channel = useDemiMotChannel(status.sessionId, { getClient: createPublicClient })
  const state = channel.state?.active && channel.state.view ? channel.state : null
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)
  const simple = useSyncExternalStore(noopSubscribe, detectSimple, () => false)
  const reducedMotion = useSyncExternalStore(noopSubscribe, detectReducedMotion, () => false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Plein écran : même règle que les autres jeux (Mac = faux plein écran).
  const toggleFullscreen = useCallback(async () => {
    if (isMac) {
      setIsFullscreen((prev) => !prev)
      return
    }
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch { /* refusé par le navigateur */ }
  }, [isMac])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!isMac) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isMac])

  return (
    <div className="dm" data-fullscreen={isFullscreen || undefined} data-testid="demimot-live">
      {state?.view ? (
        <PublicScreen view={state.view} clockOffsetMs={channel.clockOffsetMs} quality={simple ? 'dom' : 'auto'} reducedMotion={reducedMotion} />
      ) : (
        <div className="home">
          <div className="home-card">
            <div className="title-3d" style={{ fontSize: 'min(9vw, 96px)' }}>À Demi-Mot</div>
            <p className="home-note" style={{ marginTop: 18 }}>Connexion à la partie… · Code {session.code}</p>
          </div>
        </div>
      )}
      {state?.paused && <div className="screen-offline" role="status">Pause : l’animateur reprend dans un instant</div>}
      <button onClick={toggleFullscreen} className="dm-fs" aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}>
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  )
}
