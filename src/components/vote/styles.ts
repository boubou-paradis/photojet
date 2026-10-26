// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Styles communs d'AnimaVote (logo, textes or, badges, visuels des choix),
// repris de la maquette validée. Préfixe « av- » : aucun conflit avec les
// autres jeux. Couleurs : nuit #0a0a14, or #d4af37, violet #7c3aed, magenta #e0409a.

export const VOTE_CSS = `
.av-root{--ink:#0a0a14;--ink-2:#120f22;--ink-3:#1b1733;--line:#2c2650;--gold:#d4af37;--champagne:#f3dc9b;--violet:#7c3aed;--violet-2:#a855f7;--magenta:#e0409a;--ivory:#f7f0e3;--muted:#a29cc0;--ok:#3ddc97;
  --f-logo:var(--font-av-logo),"Arial Black",system-ui,sans-serif;--f-script:var(--font-av-script),cursive;--f-stage:var(--font-av-stage),"Arial Black",system-ui,sans-serif;--f-ui:var(--font-av-ui),system-ui,sans-serif;color-scheme:dark}
.av-logo{display:inline-flex;align-items:center;gap:.28em;font-family:var(--f-logo);font-size:var(--s,40px);line-height:1;transform:rotate(-3.5deg);letter-spacing:.01em;white-space:nowrap}
.av-logo b{font-weight:400;position:relative;-webkit-text-stroke:.035em #2a0f5c;paint-order:stroke fill}
.av-logo .a{color:var(--ivory);text-shadow:.04em .05em 0 #6d28d9,.08em .1em 0 #4c1d95,.12em .15em 0 #2e1065,0 0 .5em rgba(168,85,247,.55)}
.av-logo .v{color:#f5c542;background:linear-gradient(180deg,#fff2b8 0%,#f5c542 45%,#e08a1e 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(.04em .05em 0 #6d28d9) drop-shadow(.04em .05em 0 #4c1d95) drop-shadow(0 0 .25em rgba(245,197,66,.45))}
.av-logo .mark{width:1.05em;height:1.05em;flex:none;transform:rotate(3.5deg)}
.av-logo.sm .a{text-shadow:.04em .05em 0 #6d28d9,0 0 .4em rgba(168,85,247,.4)}
.av-tag{font-family:var(--f-script);color:var(--champagne);font-size:calc(var(--s,40px)*.42);transform:rotate(-3.5deg);display:block;margin-top:.15em}
.av-gold{background:linear-gradient(180deg,#fff4c9,#e9c45a 50%,#b8862a);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.av-frame{border:.18cqw solid transparent;background:linear-gradient(var(--ink-2),var(--ink-2)) padding-box,linear-gradient(135deg,#fff1b5,#d4af37 30%,#7a5a12 55%,#f3dc9b 80%,#d4af37) border-box}
.av-num{position:absolute;top:6%;left:7%;z-index:2;min-width:2.4em;height:2.4em;padding:0 .4em;border-radius:99px;display:grid;place-items:center;font-family:var(--f-stage);font-weight:900;color:#1a1306;background:linear-gradient(180deg,#fff0b0,#d4af37);box-shadow:0 2px 8px rgba(0,0,0,.5)}
.av-ph{position:relative;aspect-ratio:4/5;width:100%;overflow:hidden;background:radial-gradient(80% 60% at 50% 35%,hsl(var(--h) 70% 62%),hsl(var(--h) 60% 30%) 60%,hsl(var(--h) 55% 14%))}
.av-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.av-ph .ini{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-stage);font-weight:900;font-size:2.4em;color:rgba(255,255,255,.85);text-shadow:0 .1em .4em rgba(0,0,0,.4)}
.av-ph::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(8,6,18,.85)),radial-gradient(60% 40% at 80% 10%,rgba(255,255,255,.18),transparent 70%);pointer-events:none}
.av-ph.sq{aspect-ratio:1}
.av-ph.clean::after{background:none}
.av-dot{display:inline-block;width:.7em;height:.7em;border-radius:50%;background:var(--magenta);box-shadow:0 0 .8em var(--magenta);animation:av-pulse 1.4s ease-in-out infinite}
.av-dot.ok{background:var(--ok);box-shadow:0 0 .8em var(--ok)}
.av-spin{display:inline-block;width:22px;height:22px;border-radius:50%;border:3px solid rgba(212,175,55,.25);border-top-color:var(--gold);animation:av-rot .8s linear infinite;vertical-align:middle}
@keyframes av-pulse{50%{opacity:.35}}
@keyframes av-rot{to{transform:rotate(360deg)}}
@keyframes av-inup{from{opacity:0;transform:translateY(2cqw) scale(.96);filter:blur(.6cqw)}to{opacity:1;transform:none;filter:none}}
@media (prefers-reduced-motion:reduce){.av-root *,.av-root *::before,.av-root *::after{animation:none!important;transition:none!important}}
`
