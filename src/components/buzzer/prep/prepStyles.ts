// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Styles des écrans « manches préparées » (préfixe bzx-), repris de la
// maquette validée. Écran géant : tout en cqw dans la scène 16:9 existante.
// Téléphone : tout en cqw dans le cadre 360-430 px existant.

export const PREP_STAGE_CSS = `
.bzx-chips{display:flex;align-items:center;gap:1.2cqw}
.bzx-chip{display:inline-flex;align-items:center;gap:.7cqw;padding:.5cqw 1.3cqw;border-radius:5cqw;background:rgba(14,10,30,.72);border:1px solid rgba(212,175,55,.45);font:400 1.55cqw var(--font-bz-display),sans-serif;color:#f3d77a;letter-spacing:.04em}
.bzx-chip.violet{border-color:rgba(192,132,252,.55);color:#e9d5ff}
.bzx-q{position:absolute;left:6cqw;right:6cqw;top:7.6cqw;text-align:center;z-index:3;display:flex;flex-direction:column;align-items:center;gap:1.2cqw;animation:bzs-fadeup .45s ease-out both}
.bzx-q .eyebrow{display:inline-flex;align-items:center;gap:1cqw;font:600 1.7cqw var(--font-inter),sans-serif;letter-spacing:.34em;text-transform:uppercase;color:#f3d77a}
.bzx-q .text{font:400 5.4cqw/1.04 var(--font-bz-display),"Arial Black",sans-serif;color:#fff;text-shadow:0 .35cqw 0 #4c1395,0 0 3cqw rgba(217,70,239,.55);text-wrap:balance;overflow-wrap:anywhere}
.bzx-q .text.sm{font-size:4.4cqw}
.bzx-q .text.xs{font-size:3.4cqw}
.bzx-buzz{position:absolute;left:50%;top:57%;transform:translate(-50%,-50%);z-index:2}
.bzx-reveal{position:absolute;left:8cqw;right:6cqw;top:12.5cqw;bottom:8cqw;display:flex;align-items:center;justify-content:center;gap:11cqw;z-index:3}
.bzx-reveal.solo{flex-direction:column;gap:2cqw;text-align:center}
.bzx-cover{position:relative;width:27cqw;height:27cqw;flex:none;animation:bzs-pop .7s cubic-bezier(.25,1.6,.45,1) .15s both}
.bzx-cover .disc{position:absolute;top:1.5cqw;left:13cqw;width:24cqw;height:24cqw;border-radius:50%;z-index:-1;
  background:radial-gradient(circle,#d4af37 0 13%,#1a1222 13.5% 15%,transparent 15.5%),repeating-radial-gradient(circle,#121018 0 .35cqw,#1d1a26 .35cqw .5cqw);box-shadow:0 1cqw 3cqw rgba(0,0,0,.6);animation:bzx-spin 6s linear infinite}
.bzx-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:1.6cqw;background:#160a33;
  box-shadow:0 0 0 .35cqw #f3d77a,0 0 0 .7cqw rgba(212,175,55,.25),0 2.4cqw 5cqw rgba(0,0,0,.6),0 0 6cqw rgba(212,175,55,.35)}
.bzx-cover.photo{width:34cqw;height:34cqw}
.bzx-cover.photo .disc{display:none}
@keyframes bzx-spin{to{transform:rotate(360deg)}}
.bzx-answer{display:flex;flex-direction:column;gap:1.4cqw;min-width:0;max-width:46cqw}
.bzx-reveal.solo .bzx-answer{max-width:84cqw;align-items:center}
.bzx-answer .t{font:400 6.4cqw/1.02 var(--font-bz-display),"Arial Black",sans-serif;background:linear-gradient(180deg,#fff7d6,#d4af37 58%,#9a741b);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 .35cqw 0 #5a3f08) drop-shadow(0 0 2.4cqw rgba(212,175,55,.5));text-wrap:balance;overflow-wrap:anywhere;animation:bzs-pop .7s cubic-bezier(.25,1.6,.45,1) .35s both}
.bzx-answer .t.long{font-size:4.6cqw}
.bzx-answer .t.xl{font-size:3.4cqw}
.bzx-answer .win{display:inline-flex;align-items:center;gap:1cqw;margin-top:1cqw;align-self:flex-start;padding:.9cqw 2cqw;border-radius:5cqw;background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.6);font:600 1.8cqw var(--font-inter),sans-serif;color:#a7f3d0;animation:bzs-fadeup .4s ease-out .9s both}
.bzx-reveal.solo .bzx-answer .win{align-self:center}
.bzx-answer .win svg{width:1.8cqw;height:1.8cqw}
.bzx-choices{position:absolute;left:9cqw;right:9cqw;top:23cqw;display:grid;gap:2.4cqw;z-index:3}
.bzx-choice{position:relative;min-height:11cqw;border-radius:2.2cqw;display:flex;align-items:center;gap:2cqw;padding:1cqw 3cqw;
  background:linear-gradient(180deg,rgba(43,17,88,.85),rgba(20,10,44,.85));border:.18cqw solid rgba(192,132,252,.45);box-shadow:inset 0 .2cqw 0 rgba(255,255,255,.08),0 1.4cqw 3cqw rgba(0,0,0,.45);animation:bzs-fadeup .4s ease-out both}
.bzx-choice .k,.bzx-bar .k{flex:none;width:6.4cqw;height:6.4cqw;border-radius:50%;display:grid;place-items:center;font:400 3cqw var(--font-bz-display),sans-serif}
.bzx-choice .k{color:#0a0a14;background:radial-gradient(circle at 40% 30%,#fff3c4,#d4af37 60%,#8a6516);box-shadow:0 0 1.6cqw rgba(212,175,55,.55)}
.bzx-choice .n{font:400 3.4cqw/1.05 var(--font-bz-display),sans-serif;color:#fff;overflow-wrap:anywhere}
.bzx-count{position:absolute;left:0;right:0;bottom:3.2cqw;display:flex;justify-content:center;align-items:center;gap:2.4cqw;z-index:3}
.bzx-count .ring{width:9.6cqw;height:9.6cqw;border-radius:50%;display:grid;place-items:center;font:400 4cqw var(--font-bz-display),sans-serif;color:#fff;background:radial-gradient(circle,#2b1158,#160a33);box-shadow:0 0 0 .3cqw #d4af37,0 0 3cqw rgba(212,175,55,.5);font-variant-numeric:tabular-nums;animation:bzx-beat 1.6s ease-in-out infinite}
@keyframes bzx-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.bzx-count .lbl{display:flex;flex-direction:column;gap:.4cqw;text-align:left}
.bzx-count .lbl b{font:400 2.4cqw var(--font-bz-display),sans-serif;color:#fff}
.bzx-count .lbl span{font:500 1.6cqw var(--font-inter),sans-serif;color:#a59fc0}
.bzx-bars{position:absolute;left:9cqw;right:9cqw;top:19cqw;bottom:8cqw;display:flex;flex-direction:column;justify-content:center;gap:2.4cqw;z-index:3}
.bzx-bar{display:grid;grid-template-columns:6.4cqw minmax(0,1fr);gap:2cqw;align-items:center}
.bzx-bar .k{color:#c9c2e2;background:rgba(255,255,255,.08);border:.15cqw solid rgba(255,255,255,.2)}
.bzx-bar .row{display:flex;justify-content:space-between;align-items:baseline;gap:2cqw;margin-bottom:.9cqw}
.bzx-bar .n{font:400 3cqw var(--font-bz-display),sans-serif;color:#d8d3ee;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bzx-bar .p{font:400 3cqw var(--font-bz-display),sans-serif;color:#c9c2e2;font-variant-numeric:tabular-nums}
.bzx-bar .track{height:3.2cqw;border-radius:2cqw;background:rgba(255,255,255,.07);overflow:hidden;box-shadow:inset 0 .2cqw .4cqw rgba(0,0,0,.4)}
.bzx-bar .fill{height:100%;border-radius:2cqw;background:linear-gradient(90deg,#4c2a8a,#7c5bb8);transform-origin:left;animation:bzx-grow 1.4s cubic-bezier(.2,.8,.2,1) .3s both}
.bzx-bar.top .k{color:#0a0a14;background:radial-gradient(circle at 40% 30%,#fff3c4,#d4af37 60%,#8a6516);border:0;box-shadow:0 0 1.6cqw rgba(212,175,55,.6)}
.bzx-bar.top .n,.bzx-bar.top .p{color:#f3d77a}
.bzx-bar.top .fill{background:linear-gradient(90deg,#a855f7,#d4af37 70%,#fff3c4);box-shadow:0 0 2.4cqw rgba(212,175,55,.6)}
.bzx-good{display:inline-flex;align-items:center;gap:.6cqw;margin-left:1.4cqw;padding:.4cqw 1.2cqw;border-radius:5cqw;background:#34d399;color:#06281c;font:400 1.4cqw var(--font-bz-display),sans-serif;vertical-align:.5cqw}
.bzx-good svg{width:1.4cqw;height:1.4cqw}
@keyframes bzx-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){.bzx-cover .disc,.bzx-count .ring{animation:none}}
`

export const PREP_PHONE_CSS = `
.bzp-pill.violet{border-color:rgba(192,132,252,.6)}
.bzp-pill.violet i{background:#c084fc;box-shadow:0 0 2cqw #c084fc}
.bzx-vq{text-align:center;padding:5cqw 7cqw 0;display:flex;flex-direction:column;gap:2.4cqw}
.bzx-vq h1{margin:0;font:400 7.4cqw/1.08 var(--font-bz-display),"Arial Black",sans-serif;text-wrap:balance;text-shadow:0 .5cqw 0 #4c1395;overflow-wrap:anywhere}
.bzx-vopts{flex:1;width:100%;box-sizing:border-box;padding:4cqw 6cqw;display:flex;flex-direction:column;justify-content:center;gap:3.4cqw}
.bzx-vopt{display:flex;align-items:center;gap:4cqw;width:100%;min-height:20cqw;padding:2cqw 5cqw;box-sizing:border-box;border-radius:6cqw;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  font:400 6.2cqw/1.1 var(--font-bz-display),sans-serif;color:#fff;background:linear-gradient(180deg,rgba(43,17,88,.9),rgba(20,10,44,.9));border:.6cqw solid rgba(192,132,252,.4);box-shadow:inset 0 .5cqw 0 rgba(255,255,255,.07),0 3cqw 6cqw rgba(0,0,0,.4)}
.bzx-vopt span:last-child{min-width:0;overflow-wrap:anywhere}
.bzx-vopt .k{flex:none;width:12cqw;height:12cqw;border-radius:50%;display:grid;place-items:center;font:400 5.6cqw var(--font-bz-display),sans-serif;color:#c9c2e2;background:rgba(255,255,255,.08);border:.4cqw solid rgba(255,255,255,.2)}
.bzx-vopt[aria-pressed="true"]{border-color:#f3d77a;background:linear-gradient(180deg,rgba(120,80,20,.55),rgba(43,17,88,.9));box-shadow:0 0 0 .4cqw rgba(212,175,55,.3),0 0 8cqw rgba(212,175,55,.35)}
.bzx-vopt[aria-pressed="true"] .k{color:#0a0a14;background:radial-gradient(circle at 40% 30%,#fff3c4,#d4af37 60%,#8a6516);border:0}
.bzx-vopt:disabled{opacity:.6}
.bzx-vopt.good{border-color:#34d399}
.bzx-vhint{margin:0;padding:0 8cqw;text-align:center;font:500 4cqw/1.35 var(--font-inter),sans-serif;color:#a59fc0}
.bzx-seal{position:relative;width:42cqw;height:42cqw;display:grid;place-items:center}
.bzx-seal::before{content:"";position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,.45),rgba(212,175,55,0) 62%)}
.bzx-seal .disc{position:relative;width:100%;height:100%;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 40% 30%,#fff3c4,#d4af37 55%,#7a5c16);box-shadow:inset 0 -1.6cqw 2.4cqw rgba(90,63,8,.6),0 0 0 1.2cqw rgba(212,175,55,.25),0 2cqw 6cqw rgba(0,0,0,.5);animation:bzx-pop .5s cubic-bezier(.25,1.6,.45,1) both}
.bzx-seal .disc svg{width:44%;height:44%}
.bzx-seal.dim .disc{background:radial-gradient(circle at 40% 30%,#e9e5f5,#8b84a6 55%,#4a4560);box-shadow:inset 0 -1.6cqw 2.4cqw rgba(30,25,50,.6),0 0 0 1.2cqw rgba(160,150,200,.2),0 2cqw 6cqw rgba(0,0,0,.5)}
.bzx-seal.dim::before{background:radial-gradient(circle,rgba(160,150,200,.3),rgba(160,150,200,0) 62%)}
@keyframes bzx-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
.bzx-ghost{width:100%;box-sizing:border-box;min-height:13cqw;border-radius:4cqw;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#e6e3ef;font:600 4.4cqw var(--font-inter),sans-serif;cursor:pointer}
.bzx-foot{width:100%;box-sizing:border-box;padding:0 6cqw}
`
