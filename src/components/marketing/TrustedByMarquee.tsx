// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { CLIENTS_LOGOS, CLIENTS_LOGOS_MIN, type ClientLogo } from '@/lib/clients-logos'

// Dimensions (px) — gardées en un seul endroit pour le calcul de la boucle
const D = { chipW: 176, gap: 20, ctaW: 340, speed: 40 } // ordinateur
const M = { chipW: 128, gap: 12, ctaW: 250, speed: 30 } // téléphone
// Une série (logos + carte de fin) doit couvrir au moins un écran large,
// sinon un vide apparaîtrait avant la boucle : on la répète si besoin.
const MIN_SERIES_WIDTH = 2200

const CTA_TEXT = 'Et vous, qu’attendez-vous pour remplir votre agenda ?'

function seriesWidth(n: number, d: typeof D) {
  return n * (d.chipW + d.gap) + d.ctaW + d.gap
}

function Series({ logos, hidden, load }: { logos: ClientLogo[]; hidden: boolean; load: boolean }) {
  const tab = hidden ? -1 : undefined
  return (
    <div className="tbm-series" aria-hidden={hidden || undefined}>
      {logos.map((logo) => {
        const img = (
          <span className="tbm-logo" role={load ? undefined : 'img'} aria-label={load || hidden ? undefined : logo.nom}>
            {load && (
              <Image
                src={`/clients/${logo.fichier}`}
                alt={hidden ? '' : logo.nom}
                fill
                loading="eager"
                sizes={logo.fond === 'plein' ? '(max-width: 640px) 128px, 176px' : '(max-width: 640px) 116px, 160px'}
                style={{ objectFit: logo.fond === 'plein' ? 'cover' : 'contain' }}
              />
            )}
          </span>
        )
        return (
          <div key={logo.fichier} className={`tbm-chip tbm-chip--${logo.fond ?? 'clair'}`}>
            {logo.lien ? (
              <a href={logo.lien} target="_blank" rel="nofollow noopener" tabIndex={tab} title={logo.nom}>
                {img}
              </a>
            ) : (
              img
            )}
          </div>
        )
      })}
      <div className="tbm-cta">
        <p>{CTA_TEXT}</p>
        <a href="#essai" className="tbm-cta-btn" tabIndex={tab}>
          Essai gratuit 24&nbsp;h <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}

export default function TrustedByMarquee() {
  const [paused, setPaused] = useState(false)
  // Chargement différé fait main : le loading="lazy" natif ne charge jamais les logos
  // qui entrent par le côté dans la piste masquée (constaté sur téléphone).
  // On charge donc toute la série d'un coup quand le bandeau approche de l'écran.
  const [load, setLoad] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const logos = CLIENTS_LOGOS
  if (logos.length < CLIENTS_LOGOS_MIN) return null

  const n = logos.length
  const reps = Math.max(1, Math.ceil(MIN_SERIES_WIDTH / seriesWidth(n, D)))
  // La piste contient 2 × reps séries et glisse de la moitié : boucle sans saut.
  const durD = (reps * seriesWidth(n, D)) / D.speed
  const durM = (reps * seriesWidth(n, M)) / M.speed

  return (
    <section
      ref={ref}
      className={`tbm${paused ? ' tbm--paused' : ''}`}
      aria-labelledby="tbm-title"
      style={{ '--tbm-dur': `${durD.toFixed(1)}s`, '--tbm-dur-m': `${durM.toFixed(1)}s` } as React.CSSProperties}
      onTouchStart={(e) => {
        // Un toucher met en pause, un second relance (sauf sur un lien)
        if (!(e.target as HTMLElement).closest('a')) setPaused((p) => !p)
      }}
    >
      <style>{CSS}</style>
      <h2 id="tbm-title" className="tbm-title">
        Ils nous font <em>déjà confiance</em>
      </h2>
      <div className="tbm-viewport">
        <div className="tbm-track">
          {Array.from({ length: reps * 2 }, (_, i) => (
            <Series key={i} logos={logos} hidden={i > 0} load={load} />
          ))}
        </div>
      </div>
    </section>
  )
}

const CSS = `
.tbm{--chip-w:${D.chipW}px;--chip-h:96px;--logo-w:160px;--logo-h:82px;--gap:${D.gap}px;--cta-w:${D.ctaW}px;
  position:relative;z-index:10;padding:24px 0 28px;
  background:linear-gradient(180deg,rgba(10,10,20,.25),rgba(10,10,20,.6));
  border-top:1px solid rgba(212,175,55,.18);border-bottom:1px solid rgba(212,175,55,.12)}
.tbm-title{font-family:var(--font-playfair),Georgia,serif;font-weight:600;font-size:1.6rem;line-height:1.2;
  text-align:left;color:#fff;margin:0 0 16px;padding:0 24px}
/* Aligné sur la marge gauche du haut de page (px-6 / lg:px-10 / 2xl:px-12) */
@media (min-width:1024px){.tbm-title{padding:0 40px}}
@media (min-width:1536px){.tbm-title{padding:0 48px}}
.tbm-title em{font-style:italic;color:#D4AF37}
.tbm-viewport{overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)}
.tbm-track{display:flex;width:max-content;animation:tbm-defile var(--tbm-dur) linear infinite}
.tbm:hover .tbm-track,.tbm:focus-within .tbm-track,.tbm--paused .tbm-track{animation-play-state:paused}
@keyframes tbm-defile{to{transform:translate3d(-50%,0,0)}}
.tbm-series{display:flex;align-items:center;gap:var(--gap);padding-right:var(--gap)}
.tbm-chip{flex:none;width:var(--chip-w);height:var(--chip-h);border-radius:14px;background:#f6f2e7;
  display:grid;place-items:center;box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 6px 18px rgba(0,0,0,.35)}
.tbm-chip--sombre{background:#0b0b10;box-shadow:0 0 0 1px rgba(212,175,55,.35) inset,0 6px 18px rgba(0,0,0,.35)}
.tbm-chip--plein{overflow:hidden;background:#0b0b10;box-shadow:0 0 0 1px rgba(212,175,55,.35),0 6px 18px rgba(0,0,0,.35)}
.tbm-chip>a{display:grid;place-items:center;width:100%;height:100%;border-radius:inherit}
.tbm-logo{position:relative;display:block;width:var(--logo-w);height:var(--logo-h)}
.tbm-chip--plein .tbm-logo{width:100%;height:100%}
/* Le fond blanc (pastille claire) ou noir (pastille sombre) du fichier se fond dans la pastille */
.tbm-chip--clair .tbm-logo img{mix-blend-mode:multiply}
.tbm-chip--sombre .tbm-logo img{mix-blend-mode:lighten}
.tbm-cta{flex:none;width:var(--cta-w);min-height:var(--chip-h);border-radius:14px;padding:12px 16px;
  background:linear-gradient(135deg,rgba(212,175,55,.16),rgba(212,175,55,.04));border:1px solid rgba(212,175,55,.55);
  display:flex;align-items:center;gap:14px}
.tbm-cta p{margin:0;flex:1;min-width:0;font-family:var(--font-playfair),Georgia,serif;font-weight:600;
  font-size:.98rem;line-height:1.25;color:#fff}
.tbm-cta-btn{flex:none;display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:10px;
  background:#D4AF37;color:#0D0D0F;font-weight:700;font-size:.8rem;white-space:nowrap;text-decoration:none}
.tbm-cta-btn:hover{filter:brightness(1.1)}
.tbm a:focus-visible{outline:2px solid #F4E4BC;outline-offset:2px}
@media (max-width:640px){
  .tbm{--chip-w:${M.chipW}px;--chip-h:72px;--logo-w:116px;--logo-h:60px;--gap:${M.gap}px;--cta-w:${M.ctaW}px;padding:26px 0 28px}
  .tbm-track{animation-duration:var(--tbm-dur-m)}
  .tbm-title{font-size:1.25rem;margin-bottom:16px}
  .tbm-cta{flex-direction:column;align-items:flex-start;gap:8px;padding:10px 12px}
  .tbm-cta p{font-size:.85rem}
  .tbm-cta-btn{padding:7px 11px;font-size:.74rem}
}
@media (prefers-reduced-motion:reduce){
  .tbm-track{animation:none;width:auto}
  .tbm-series{flex-wrap:wrap;justify-content:center;padding:0 16px}
  .tbm-series[aria-hidden]{display:none}
  .tbm-viewport{-webkit-mask-image:none;mask-image:none}
}
`
