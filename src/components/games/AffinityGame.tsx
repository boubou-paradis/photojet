'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Matching sur l'écran géant (/live). Lisible à 10 m : très gros textes, une
// information principale par écran. Ne reçoit que des données publiques et
// agrégées (ligne sessions + /api/affinity/status).
// L'écran suit la phase de la ligne sessions (temps réel) ; le statut serveur
// apporte les compteurs et le décalage d'horloge.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import QRCode from 'react-qr-code'
import FinalScreen from '@/components/affinity/live/FinalScreen'
import QuestionScreen from '@/components/affinity/live/QuestionScreen'
import RevealScreen from '@/components/affinity/live/RevealScreen'
import type { AffinityLiveStatus } from '@/hooks/useAffinityStatus'
import { getInviteUrl } from '@/lib/utils'
import type { Session } from '@/types/database'

interface AffinityGameProps {
  session: Session
  status: AffinityLiveStatus
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
  const phase = session.affinity_phase ?? status.phase
  const questions = session.affinity_questions ?? []
  const index = session.affinity_current_question ?? 0
  const question = questions[index]
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

      {phase === 'lobby' ? (
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
      ) : phase === 'finished' ? (
        <FinalScreen stats={session.affinity_final_stats} />
      ) : phase === 'revealed' && question && session.affinity_reveal?.questionId === question.id ? (
        <RevealScreen question={question} index={index} total={questions.length} reveal={session.affinity_reveal} />
      ) : (phase === 'question' || phase === 'closed' || phase === 'revealed') && question ? (
        <QuestionScreen
          question={question}
          index={index}
          total={questions.length}
          closed={phase !== 'question'}
          deadline={session.affinity_deadline ?? null}
          clockOffsetMs={status.clockOffsetMs}
          answeredCount={status.answeredCount}
        />
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
/* Écrans de jeu : unité --u = 1 % de la largeur d'un écran 16:9 (s'adapte aux autres formats). */
.aff-screen{container-type:size}
.aff-stage{position:absolute;inset:0;--u:min(1cqw,1.778cqh)}
.aff-brand{position:absolute;top:calc(var(--u)*3.2);left:calc(var(--u)*4);display:flex;align-items:center;gap:calc(var(--u)*1);font-family:var(--font-playfair),Georgia,serif;font-weight:800;font-size:calc(var(--u)*1.9)}
.aff-brand small{font-family:var(--font-inter),system-ui,sans-serif;font-weight:400;font-size:calc(var(--u)*1.3);color:var(--aff-muted);margin-left:calc(var(--u)*.5)}
.aff-qnum{position:absolute;top:calc(var(--u)*3.4);right:calc(var(--u)*4);font-size:calc(var(--u)*1.5);color:var(--aff-muted);font-weight:600}
.aff-qnum b{color:var(--aff-ivory)}
.aff-qwrap{position:absolute;top:calc(var(--u)*9);bottom:calc(var(--u)*4);left:calc(var(--u)*5);right:calc(var(--u)*5);display:flex;flex-direction:column}
.aff-question{font-family:var(--font-playfair),Georgia,serif;font-weight:800;font-size:calc(var(--u)*4.6);line-height:1.05;max-width:22ch;letter-spacing:-.01em;text-wrap:balance}
.aff-question-sm{font-size:calc(var(--u)*3.8);max-width:none}
.aff-note{font-size:calc(var(--u)*1.4);color:var(--aff-muted);margin-top:calc(var(--u)*1.2)}
.aff-answers{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*1.6);margin-top:auto}
.aff-ans{display:flex;align-items:center;gap:calc(var(--u)*1.6);min-width:0;background:rgba(255,255,255,.045);border:calc(var(--u)*.15) solid rgba(255,255,255,.08);border-radius:calc(var(--u)*1.6);padding:calc(var(--u)*3.4) calc(var(--u)*2.8);font-size:calc(var(--u)*3.6);font-weight:700;line-height:1.15}
.aff-answers-4 .aff-ans{padding:calc(var(--u)*2.4) calc(var(--u)*2.6);font-size:calc(var(--u)*3)}
.aff-ans span{min-width:0;overflow-wrap:anywhere}
.aff-k{flex:none;width:calc(var(--u)*1.4);height:calc(var(--u)*1.4);border-radius:50%;border:calc(var(--u)*.3) solid var(--aff-gold)}
.aff-k-1{border-color:var(--aff-violet)}.aff-k-2{border-color:var(--aff-ivory)}.aff-k-3{border-color:var(--aff-muted)}
.aff-live{position:absolute;top:calc(var(--u)*8.8);right:calc(var(--u)*5);display:flex;align-items:center;gap:calc(var(--u)*2);z-index:1}
.aff-answered{text-align:right}
.aff-answered b{display:block;font-family:var(--font-playfair),Georgia,serif;font-size:calc(var(--u)*5);font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.aff-answered span{font-size:calc(var(--u)*1.4);color:var(--aff-muted)}
.aff-chrono{position:relative;width:calc(var(--u)*9);height:calc(var(--u)*9)}
.aff-chrono svg{width:100%;height:100%;transform:rotate(-90deg)}
.aff-chrono circle{fill:none;stroke-width:6}
.aff-chrono-track{stroke:rgba(255,255,255,.1)}
.aff-chrono-prog{stroke:var(--aff-gold);stroke-linecap:round;transition:stroke-dashoffset .25s linear}
.aff-chrono b{position:absolute;inset:0;display:grid;place-items:center;font-size:calc(var(--u)*2.8);font-weight:800;font-variant-numeric:tabular-nums}
.aff-closed{font-size:calc(var(--u)*1.8);font-weight:700;color:var(--aff-gold);border:calc(var(--u)*.15) solid rgba(212,175,55,.5);border-radius:999px;padding:calc(var(--u)*.8) calc(var(--u)*1.8)}
.aff-bars{display:flex;flex-direction:column;gap:calc(var(--u)*1.1);margin-top:calc(var(--u)*2.2)}
.aff-bar-lbl{display:flex;align-items:baseline;justify-content:space-between;gap:calc(var(--u)*2);font-size:calc(var(--u)*2.6);font-weight:700;line-height:1.1;margin-bottom:calc(var(--u)*.8)}
.aff-bar-lbl>span:first-child{min-width:0;overflow-wrap:anywhere}
.aff-pct{flex:none;font-family:var(--font-playfair),Georgia,serif;font-weight:900;font-size:calc(var(--u)*3.2);font-variant-numeric:tabular-nums}
.aff-bar-win .aff-bar-lbl{color:#f4d03f}
.aff-bar-track{position:relative;height:calc(var(--u)*1.6);border-radius:calc(var(--u)*1);background:rgba(255,255,255,.07);overflow:hidden}
.aff-bar-fill{position:absolute;inset:0;transform-origin:left center;transform:scaleX(0);border-radius:inherit;background:linear-gradient(90deg,#6d4fc2,var(--aff-violet));transition:transform 1.4s cubic-bezier(.2,.8,.2,1)}
.aff-bar-win .aff-bar-fill{background:linear-gradient(90deg,#a8862a,var(--aff-gold) 60%,#f4d03f);box-shadow:0 0 calc(var(--u)*3) rgba(212,175,55,.5)}
.aff-played .aff-bar-fill{transform:scaleX(var(--p))}
.aff-punch{margin-top:auto;padding-top:calc(var(--u)*1.2);font-family:var(--font-playfair),Georgia,serif;font-style:italic;font-size:calc(var(--u)*3.2);color:#f4d03f;opacity:0;transform:translateY(calc(var(--u)*1));transition:opacity .6s 1.5s,transform .6s 1.5s}
.aff-played .aff-punch{opacity:1;transform:none}
.aff-stats{position:absolute;top:calc(var(--u)*9);bottom:calc(var(--u)*6.5);left:calc(var(--u)*5);right:calc(var(--u)*5);display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:minmax(0,1fr) auto;gap:calc(var(--u)*1.6)}
.aff-stats-solo{grid-template-columns:1fr}
.aff-stat{border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.6) calc(var(--u)*2.2);background:rgba(255,255,255,.045);border:calc(var(--u)*.15) solid rgba(255,255,255,.08);display:flex;flex-direction:column;justify-content:flex-end;min-width:0;min-height:0;flex:1}
.aff-stat h3{font-size:calc(var(--u)*1.5);color:var(--aff-muted);font-weight:600}
.aff-stat p{font-family:var(--font-playfair),Georgia,serif;font-weight:800;font-size:calc(var(--u)*2.1);line-height:1.15;margin-top:calc(var(--u)*.6);overflow-wrap:anywhere}
.aff-stat-hero{background:radial-gradient(90% 80% at 20% 100%,rgba(212,175,55,.22),transparent 70%),rgba(255,255,255,.045);border-color:rgba(212,175,55,.35)}
.aff-stat-hero p{font-size:calc(var(--u)*4.2);color:#f4d03f;line-height:1.05}
.aff-stat-col{display:flex;flex-direction:column;gap:calc(var(--u)*1.6);min-height:0}
.aff-cta{grid-column:1/-1;text-align:center;font-family:var(--font-playfair),Georgia,serif;font-size:calc(var(--u)*3);font-weight:800}
.aff-cta span{color:#f4d03f}
.aff-cta-only{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 calc(var(--u)*8)}
.aff-cta-only .aff-cta{font-size:calc(var(--u)*4.4);line-height:1.2}
@media (prefers-reduced-motion:reduce){.aff-ring,.aff-dot{animation:none}.aff-dot{display:none}.aff-bar-fill,.aff-punch{transition:none}}
`
