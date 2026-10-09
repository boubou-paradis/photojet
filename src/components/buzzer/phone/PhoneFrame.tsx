// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Cadre des écrans téléphone d'AnimaBuzz (360 à 430 px) : fond nuit
// violet, logo validé en petit, pseudo à droite. Mêmes proportions que la
// maquette : le buzzer occupe l'essentiel de l'écran, loin des bords.

import type { ReactNode } from 'react'
import AnimaBuzzLogo from '@/components/buzzer/AnimaBuzzLogo'
import { buzzerFontVars } from '@/components/buzzer/fonts'
import { BUZZER_CSS } from '@/components/buzzer/styles'

export const PHONE_CSS = `
.bzp{min-height:100dvh;overflow-x:clip;color:#f4f1ff;background:radial-gradient(120% 70% at 50% 46%,#2a1252 0%,#140a2c 45%,#0a0a14 100%);font-family:var(--font-inter),system-ui,sans-serif}
.bzp-in{position:relative;margin:0 auto;max-width:430px;min-height:100dvh;display:flex;flex-direction:column;align-items:center;container-type:inline-size;padding:max(14px,env(safe-area-inset-top)) 0 max(18px,env(safe-area-inset-bottom))}
.bzp-head{width:100%;display:flex;justify-content:space-between;align-items:center;padding:2cqw 6cqw 0;gap:2cqw}
.bzp-me{font:600 4.2cqw var(--font-inter),sans-serif;max-width:45cqw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1cqw 3.4cqw}
.bzp-pill{margin-top:4cqw;display:inline-flex;align-items:center;gap:2.2cqw;font:600 4.4cqw var(--font-inter),sans-serif;background:rgba(10,8,22,.7);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:2cqw 4.4cqw}
.bzp-pill i{width:2.6cqw;height:2.6cqw;border-radius:50%;background:#64748b}
.bzp-pill.on i{background:#34d399;box-shadow:0 0 2cqw #34d399}
.bzp-pill.gold{border-color:rgba(212,175,55,.6)}
.bzp-pill.gold i{background:#d4af37;box-shadow:0 0 2cqw #d4af37}
.bzp-pill.amber i{background:#f59e0b}
.bzp-stage{flex:1;display:grid;place-items:center;width:100%;position:relative;min-height:60cqw}
.bzp-hit{position:absolute;inset:4% 4%;border-radius:40px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;outline:none}
.bzp-hit:focus-visible{box-shadow:0 0 0 3px #f3d77a}
.bzp-cap{text-align:center;padding:0 7cqw 4cqw;display:flex;flex-direction:column;gap:1.6cqw;min-height:30cqw}
.bzp-cap h1{margin:0;font:400 8.4cqw/1.05 var(--font-bz-display),"Arial Black",sans-serif;letter-spacing:.01em;text-wrap:balance}
.bzp-cap h1.gold{background:linear-gradient(180deg,#fff3c4,#d4af37 60%,#a7801f);-webkit-background-clip:text;background-clip:text;color:transparent}
.bzp-cap h1.dim{color:#c8c2dd}
.bzp-cap p{margin:0;font:500 4.6cqw/1.35 var(--font-inter),sans-serif;color:#a59fc0;text-wrap:balance}
.bzp-cap p b{color:#f4f1ff}
.bzp-link{font:500 4cqw var(--font-inter),sans-serif;color:#a59fc0;text-decoration:underline;text-underline-offset:3px}
.bzp-form{flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4.5cqw;padding:0 8cqw 6cqw}
.bzp-form label,.bzp-form .lbl{align-self:stretch;font:600 4cqw var(--font-inter),sans-serif;color:#a59fc0;text-transform:uppercase;letter-spacing:.08em}
.bzp-input{align-self:stretch;font:600 5.6cqw var(--font-inter),sans-serif;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(212,175,55,.55);border-radius:3.5cqw;padding:3.2cqw 4cqw;outline:none}
.bzp-input:focus{border-color:#f3d77a;box-shadow:0 0 0 2px rgba(243,215,122,.35)}
.bzp-cta{align-self:stretch;text-align:center;font:400 5.6cqw var(--font-bz-display),"Arial Black",sans-serif;color:#0a0a14;background:linear-gradient(180deg,#fbe7a3,#d4af37);border:0;border-radius:3.5cqw;padding:3.6cqw;box-shadow:0 1.2cqw 4cqw rgba(212,175,55,.35);cursor:pointer}
.bzp-cta:disabled{opacity:.5}
.bzp-teams{align-self:stretch;display:grid;grid-template-columns:1fr 1fr;gap:2.4cqw}
.bzp-teams button{font:600 4.4cqw var(--font-inter),sans-serif;color:#f4f1ff;text-align:center;border:1px solid rgba(255,255,255,.14);border-radius:3cqw;padding:3cqw 1cqw;background:rgba(255,255,255,.04);cursor:pointer;overflow:hidden;text-overflow:ellipsis}
.bzp-teams button[aria-pressed="true"]{border-color:#a855f7;background:rgba(168,85,247,.22);box-shadow:0 0 0 1px #a855f7 inset}
.bzp-error{align-self:stretch;font:500 4.2cqw/1.35 var(--font-inter),sans-serif;color:#fde68a;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:3cqw;padding:2.6cqw 3.4cqw}
.bzp-error button{font:inherit;color:#fff;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer}
`

interface PhoneFrameProps {
  /** Pseudo ou équipe affiché en haut à droite. */
  me?: string | null
  children: ReactNode
}

export default function PhoneFrame({ me, children }: PhoneFrameProps) {
  return (
    <div className={`bzp ${buzzerFontVars}`}>
      <style>{BUZZER_CSS + PHONE_CSS}</style>
      <div className="bzp-in">
        <div className="bzp-head">
          <AnimaBuzzLogo variant="small" subtitle={false} size="7cqw" />
          {me && <span className="bzp-me">{me}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}
