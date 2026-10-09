// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran géant AnimaBuzz : reprise des scènes de la maquette validée. Scène
// 16:9 centrée (bandes noires si l'écran a un autre format), tout en cqw :
// lisible à 10 m et identique en plein écran.

export const STAGE_CSS = `
.bzs{position:fixed;inset:0;overflow:hidden;background:#0a0a14;color:#f4f1ff;font-family:var(--font-inter),system-ui,sans-serif}
.bzs-stage{position:absolute;inset:0;margin:auto;width:min(100vw,177.78vh);height:min(100vh,56.25vw);container-type:inline-size;isolation:isolate;overflow:hidden;
  background:radial-gradient(60% 75% at 50% 52%,#2b1158 0%,#160a33 42%,#0a0a14 100%)}
.bzs-stage::before{content:"";position:absolute;inset:0;z-index:-1;opacity:.8;background-image:
  radial-gradient(.18cqw .18cqw at 8% 18%,#fff,transparent),radial-gradient(.14cqw .14cqw at 22% 72%,#fff,transparent),radial-gradient(.2cqw .2cqw at 38% 12%,#e9d5ff,transparent),radial-gradient(.14cqw .14cqw at 63% 84%,#fff,transparent),radial-gradient(.18cqw .18cqw at 78% 22%,#fde68a,transparent),radial-gradient(.14cqw .14cqw at 91% 58%,#fff,transparent),radial-gradient(.12cqw .12cqw at 52% 36%,#fff,transparent)}
.bzs-stage::after{content:"";position:absolute;left:15%;right:15%;bottom:-10%;height:30%;z-index:-1;border-radius:50%;background:radial-gradient(closest-side,rgba(168,85,247,.35),transparent)}
.bzs-top{position:absolute;left:3cqw;right:3cqw;top:2.4cqw;display:flex;justify-content:space-between;align-items:center;font:600 1.5cqw var(--font-inter),sans-serif;color:#a59fc0;z-index:3}
.bzs-top .round{margin-left:1.6cqw}
.bzs-center{position:absolute;inset:0;display:grid;place-items:center;z-index:1}
.bzs-banner{position:absolute;left:0;right:0;text-align:center;z-index:3}
.bzs-banner.top{top:5cqw}
.bzs-banner.bottom{bottom:4.2cqw}
.bzs-headline{font:400 4.6cqw/1 var(--font-bz-display),"Arial Black",sans-serif;letter-spacing:.02em;color:#fff;text-shadow:0 0 2cqw rgba(168,85,247,.7)}
.bzs-headline.dim{color:#c9c2e2;text-shadow:none;opacity:.85}
.bzs-sub{margin-top:1cqw;font:500 1.8cqw var(--font-inter),sans-serif;color:#a59fc0}
.bzs-dot{display:inline-block;width:1.4cqw;height:1.4cqw;border-radius:50%;background:#34d399;box-shadow:0 0 1.4cqw #34d399;margin-right:1.2cqw;vertical-align:.25cqw}
.bzs-chrono{position:absolute;right:5cqw;top:50%;width:12cqw;height:12cqw;margin-top:-6cqw;z-index:3}
.bzs-chrono svg{width:100%;height:100%;transform:rotate(-90deg)}
.bzs-chrono circle{fill:none;stroke-width:6}
.bzs-chrono .bg{stroke:rgba(255,255,255,.1)}
.bzs-chrono .fg{stroke:#d4af37;stroke-linecap:round;stroke-dasharray:283;transition:stroke-dashoffset .25s linear}
.bzs-chrono span{position:absolute;inset:0;display:grid;place-items:center;font:400 4.4cqw var(--font-bz-display),sans-serif}
.bzs-gauge{width:44cqw;margin:1.4cqw auto 0;height:1.3cqw;border-radius:1cqw;background:rgba(255,255,255,.1);overflow:hidden}
.bzs-gauge i{display:block;height:100%;background:linear-gradient(90deg,#a855f7,#d4af37);border-radius:1cqw;transition:width .6s ease}
.bzs-lobby{position:absolute;inset:0;display:grid;grid-template-columns:42% minmax(0,1fr);gap:4cqw;padding:7cqw 5cqw 4cqw;z-index:2}
.bzs-lobby .l{display:flex;flex-direction:column;align-items:flex-start;gap:1.4cqw}
.bzs-lobby .title{padding-bottom:1cqw}
.bzs-qr{margin-top:1.6cqw;display:flex;gap:2cqw;align-items:center}
.bzs-qr .code{width:15cqw;height:15cqw;padding:.9cqw;background:#fff;border-radius:1.2cqw;box-shadow:0 0 0 .3cqw #d4af37,0 0 3cqw rgba(212,175,55,.35)}
.bzs-qr .code svg{width:100%;height:100%;display:block}
.bzs-qr .how{font:600 1.7cqw/1.35 var(--font-inter),sans-serif;color:#a59fc0}
.bzs-qr .how b{display:block;font:400 2.2cqw var(--font-bz-display),sans-serif;color:#fff}
.bzs-lobby .r{display:flex;flex-direction:column;gap:1.6cqw;min-width:0}
.bzs-count{font:400 5cqw/1 var(--font-bz-display),sans-serif}
.bzs-count small{font:600 1.8cqw var(--font-inter),sans-serif;color:#a59fc0;margin-left:1cqw}
.bzs-names{display:flex;flex-wrap:wrap;gap:.9cqw;align-content:flex-start}
.bzs-names span{font:600 1.65cqw var(--font-inter),sans-serif;padding:.6cqw 1.4cqw;border-radius:5cqw;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);max-width:22cqw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bzs-names span.new{border-color:#d4af37;background:rgba(212,175,55,.16);animation:bzs-pop .6s cubic-bezier(.3,1.6,.5,1) both}
.bzs-names span.more{color:#a59fc0;border-style:dashed}
.bzs-empty{font:500 1.9cqw var(--font-inter),sans-serif;color:#a59fc0}
.bzs-lobby .sleep{position:absolute;right:4cqw;bottom:3cqw}
.bzs-recede{animation:bzs-recede .7s cubic-bezier(.5,0,.2,1) .55s both}
@keyframes bzs-recede{to{transform:translateY(9cqw) scale(.5);opacity:.3}}
.bzs-shock{position:absolute;left:50%;top:50%;width:29cqw;height:29cqw;margin:-14.5cqw;border-radius:50%;border:.5cqw solid rgba(243,215,122,.95);box-shadow:0 0 3cqw rgba(168,85,247,.9),inset 0 0 3cqw rgba(217,70,239,.6);z-index:2;animation:bzs-shock 1s cubic-bezier(.2,.6,.3,1) .08s both}
.bzs-shock.s2{animation-delay:.24s;border-color:rgba(232,121,249,.8)}
@keyframes bzs-shock{from{transform:scale(.95);opacity:1}to{transform:scale(5.4);opacity:0}}
.bzs-flash{position:absolute;inset:0;z-index:4;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.95),rgba(232,180,255,.45) 35%,rgba(255,255,255,0) 70%);pointer-events:none;animation:bzs-flashfx .55s ease-out both}
@keyframes bzs-flashfx{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
.bzs-callout{position:absolute;left:0;right:0;top:15cqw;text-align:center;z-index:3}
.bzs-callout .eyebrow{font:600 1.9cqw var(--font-inter),sans-serif;letter-spacing:.32em;text-transform:uppercase;color:#f3d77a;animation:bzs-fadeup .4s ease-out .5s both}
.bzs-callout .name{font:400 13cqw/1 var(--font-bz-display),"Arial Black",sans-serif;color:#fff;text-shadow:0 .4cqw 0 #4c1395,0 0 4cqw rgba(217,70,239,.7);animation:bzs-pop .7s cubic-bezier(.25,1.6,.45,1) .48s both;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4cqw}
.bzs-callout .name.long{font-size:9cqw}
.bzs-callout .name.gold{background:linear-gradient(180deg,#fff7d6,#d4af37 58%,#9a741b);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 .4cqw 0 #5a3f08) drop-shadow(0 0 3cqw rgba(212,175,55,.6))}
.bzs-callout .meta{margin-top:.6cqw;font:600 2.2cqw var(--font-inter),sans-serif;color:#a59fc0;animation:bzs-fadeup .4s ease-out .8s both}
.bzs-next{position:absolute;left:0;right:0;bottom:4cqw;display:flex;justify-content:center;gap:1.6cqw;z-index:3}
.bzs-next div{display:flex;align-items:baseline;gap:1.2cqw;padding:1.1cqw 2.2cqw;border-radius:1.4cqw;background:rgba(14,10,30,.78);border:1px solid rgba(168,85,247,.45);animation:bzs-fadeup .45s ease-out both;max-width:28cqw}
/* Les suivants arrivent après la fenêtre (relecture) : apparition rapide. */
.bzs-next div:nth-child(1){animation-delay:.1s}.bzs-next div:nth-child(2){animation-delay:.25s}.bzs-next div:nth-child(3){animation-delay:.4s}
.bzs-next .r{font:400 1.8cqw var(--font-bz-display),sans-serif;color:#d4af37}
.bzs-next .n{font:600 2.3cqw var(--font-inter),sans-serif;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bzs-next .g{font:600 1.9cqw var(--font-inter),sans-serif;color:#a59fc0;font-variant-numeric:tabular-nums;white-space:nowrap}
@keyframes bzs-pop{0%{opacity:0;transform:scale(.55)}60%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes bzs-fadeup{from{opacity:0;transform:translateY(1.5cqw)}to{opacity:1;transform:none}}
.bzs-confetti{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none}
.bzs-confetti i{position:absolute;top:-4%;width:.8cqw;height:1.4cqw;border-radius:.2cqw;animation:bzs-fall var(--t) cubic-bezier(.3,.2,.5,1) var(--d) both}
@keyframes bzs-fall{from{transform:translateY(0) rotate(0)}to{transform:translateY(62cqw) rotate(var(--rot));opacity:.2}}
.bzs-wrongA{position:absolute;left:0;right:0;top:16cqw;text-align:center;z-index:3;animation:bzs-wrongA 1.6s ease-out both}
.bzs-wrongA .bzs-headline{color:#fde68a;text-shadow:0 0 2cqw rgba(245,158,11,.6)}
@keyframes bzs-wrongA{0%{opacity:0;transform:scale(1.15)}12%{opacity:1;transform:scale(1)}78%{opacity:1}100%{opacity:0;transform:translateY(-2cqw)}}
.bzs-amber{position:absolute;inset:0;z-index:1;background:radial-gradient(circle at 50% 50%,rgba(245,158,11,.28),transparent 60%);animation:bzs-wash 1.6s ease-out both}
@keyframes bzs-wash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
.bzs-delay{animation:bzs-fadeup .4s ease-out 1.65s both}
.bzs-delay .eyebrow,.bzs-delay .name{animation-delay:1.7s}
.bzs-delay .meta{animation-delay:2s}
.bzs-fs{position:absolute;bottom:16px;right:16px;z-index:50;padding:12px;background:rgba(0,0,0,.5);border:1px solid rgba(212,175,55,.3);border-radius:999px;color:#d4af37;cursor:pointer}
@media (prefers-reduced-motion:reduce){
  .bzs-shock,.bzs-flash,.bzs-confetti,.bzs-amber,.bzs-wrongA{display:none}
  .bzs-recede{transform:translateY(9cqw) scale(.5);opacity:.3}
}
`
