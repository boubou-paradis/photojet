'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching sur l'écran géant (/live). Lisible à 10 m : très gros textes, une
// information principale par écran. Ne reçoit que des données publiques et
// agrégées (ligne sessions + /api/affinity/status).
// Phase 2 : lobby. Les écrans question / révélation / fin arrivent ensuite.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import QRCode from 'react-qr-code'
import { getInviteUrl } from '@/lib/utils'
import type { AffinityStatus } from '@/lib/affinity/types'
import type { Session } from '@/types/database'

interface AffinityGameProps {
  session: Session
  status: AffinityStatus
}

// Points de lumière qui rejoignent le centre (positions fixes : pas de hasard au rendu).
const DOTS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2
  const radius = 26 + (i % 3) * 4
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, delay: i * 0.32 }
})

const noopSubscribe = () => () => {}
const detectMac = () => /Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent)

export default function AffinityGame({ session, status }: AffinityGameProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Détection Mac côté client (navigator absent au rendu serveur → false).
  const isMac = useSyncExternalStore(noopSubscribe, detectMac, () => false)

  // Plein écran : même règle que les autres jeux. Mac = faux plein écran (le
  // conteneur est déjà fixed inset-0) : jamais l'API native qui crée un Space.
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
    <div className="aff-screen fixed inset-0 overflow-hidden">
      <style>{AFFINITY_SCREEN_CSS}</style>

      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 border border-[#D4AF37]/30 rounded-full transition-colors backdrop-blur-sm"
        title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
      >
        {isFullscreen ? <Minimize className="h-6 w-6 text-[#D4AF37]" /> : <Maximize className="h-6 w-6 text-[#D4AF37]" />}
      </button>

      {status.phase === 'lobby' ? (
        <div className="aff-lobby">
          <div className="aff-lobby-text">
            <h1 className="aff-title">Matching</h1>
            <p className="aff-sub">Le jeu des points communs</p>
            <div className="aff-join">
              <div className="aff-qr">
                <QRCode value={getInviteUrl(session.code)} size={256} level="M" bgColor="#ffffff" fgColor="#0a0a14" style={{ width: '100%', height: '100%' }} />
              </div>
              <p className="aff-join-text">
                <span className="aff-join-cta">Scannez pour jouer</span>
                <span className="aff-code">#{session.code}</span>
                Sans compte, sans appli
              </p>
            </div>
          </div>

          <div className="aff-rings" aria-hidden="true">
            <div className="aff-ring aff-ring-a" />
            <div className="aff-ring aff-ring-b" />
            {DOTS.map((dot, i) => (
              <i
                key={i}
                className="aff-dot"
                style={{ '--x': `${dot.x}vmin`, '--y': `${dot.y}vmin`, animationDelay: `${dot.delay}s` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="aff-count">
            <b>{status.playerCount}</b>
          </div>
          <p className="aff-count-label">{status.playerCount > 1 ? 'joueurs connectés' : 'joueur connecté'}</p>

          <p className="aff-hint">
            Déjà sur la page photos ? <b>Rescannez le QR</b> pour jouer.
          </p>
        </div>
      ) : (
        <div className="aff-wait">
          <h1 className="aff-title">Matching</h1>
          <p className="aff-sub">La partie est en cours</p>
        </div>
      )}
    </div>
  )
}

const AFFINITY_SCREEN_CSS = `
.aff-screen{
  --aff-night:#0a0a14; --aff-deep:#150d2b; --aff-violet:#8b5cf6; --aff-gold:#d4af37; --aff-ivory:#f4efe3; --aff-muted:#9a94b5;
  background:radial-gradient(120% 90% at 50% 110%,#2a1757 0%,var(--aff-deep) 38%,var(--aff-night) 75%);
  color:var(--aff-ivory); font-family:var(--font-inter),system-ui,sans-serif;
}
.aff-lobby{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:0 7vw}
.aff-title{font-family:var(--font-playfair),Georgia,serif;font-weight:900;font-size:min(13vw,19vh);line-height:.95;letter-spacing:-.02em}
.aff-sub{font-family:var(--font-playfair),Georgia,serif;font-style:italic;color:var(--aff-gold);font-size:min(3.4vw,5vh);margin-top:1.5vh}
.aff-join{display:flex;align-items:center;gap:2.5vw;margin-top:6vh}
.aff-qr{flex:none;width:min(21vw,34vh);height:min(21vw,34vh);background:#fff;border-radius:1.4vmin;padding:1.4vmin}
.aff-join-text{display:flex;flex-direction:column;font-size:min(2.2vw,3.4vh);color:var(--aff-muted);line-height:1.35}
.aff-join-cta{color:var(--aff-ivory);font-weight:600;font-size:min(2.8vw,4.2vh)}
.aff-code{color:var(--aff-gold);font-weight:800;letter-spacing:.08em;font-size:min(4.8vw,7.4vh)}
.aff-rings{position:relative;height:60vmin}
.aff-ring{position:absolute;top:50%;width:40vmin;height:40vmin;border-radius:50%;translate:0 -50%}
.aff-ring-a{left:calc(50% - 30vmin);border:.6vmin solid var(--aff-gold);box-shadow:0 0 6vmin rgba(212,175,55,.25),inset 0 0 6vmin rgba(212,175,55,.12);animation:aff-drift-a 6s ease-in-out infinite}
.aff-ring-b{left:calc(50% - 10vmin);border:.6vmin solid var(--aff-violet);box-shadow:0 0 6vmin rgba(139,92,246,.3),inset 0 0 6vmin rgba(139,92,246,.15);animation:aff-drift-b 6s ease-in-out infinite}
@keyframes aff-drift-a{50%{transform:translateX(3.5vmin)}}
@keyframes aff-drift-b{50%{transform:translateX(-3.5vmin)}}
.aff-dot{position:absolute;left:50%;top:50%;width:1.1vmin;height:1.1vmin;border-radius:50%;background:var(--aff-ivory);opacity:0;animation:aff-converge 4.5s ease-in infinite}
@keyframes aff-converge{0%{opacity:0;transform:translate(var(--x),var(--y)) scale(.6)}15%{opacity:.9}85%{opacity:.9}100%{opacity:0;transform:translate(0,0) scale(1)}}
.aff-count{position:absolute;right:7vw;top:50%;width:calc((100vw - 14vw)/2);translate:0 -50%;text-align:center;pointer-events:none}
.aff-count b{display:block;font-family:var(--font-playfair),Georgia,serif;font-weight:900;font-size:min(10vw,15vh);line-height:1;font-variant-numeric:tabular-nums}
.aff-count-label{position:absolute;right:7vw;top:calc(50% + 23vmin);width:calc((100vw - 14vw)/2);text-align:center;font-size:min(2.6vw,3.8vh);color:var(--aff-muted)}
.aff-hint{position:absolute;left:0;right:0;bottom:4vh;text-align:center;font-size:min(2vw,3vh);color:var(--aff-muted)}
.aff-hint b{color:var(--aff-ivory);font-weight:600}
.aff-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
@media (prefers-reduced-motion:reduce){.aff-ring,.aff-dot{animation:none}.aff-dot{display:none}}
`
