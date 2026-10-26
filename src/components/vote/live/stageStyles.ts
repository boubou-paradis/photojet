// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écran géant AnimaVote : scènes de la maquette validée (plateau TV de gala :
// sol brillant, spots, cadres or). Scène 16:9 centrée, tout en cqw : lisible
// à 10 m et identique en plein écran. Préfixe « avs- ».

export const STAGE_CSS = `
.avs{position:fixed;inset:0;overflow:hidden;background:#000;color:var(--ivory);font-family:var(--f-ui)}
.avs-stage{position:absolute;inset:0;margin:auto;width:min(100vw,177.78vh);height:min(100vh,56.25vw);container-type:inline-size;isolation:isolate;overflow:hidden;
  background:radial-gradient(60% 55% at 50% 0%,rgba(124,58,237,.42),transparent 70%),radial-gradient(40% 35% at 15% 10%,rgba(224,64,154,.22),transparent 70%),radial-gradient(40% 35% at 85% 10%,rgba(79,124,255,.2),transparent 70%),var(--ink)}
.avs-stage::before{content:"";position:absolute;inset:auto 0 0 0;height:34%;z-index:-1;background:linear-gradient(180deg,transparent,rgba(124,58,237,.10) 30%,rgba(10,10,20,.9)),repeating-linear-gradient(90deg,transparent 0 6.2cqw,rgba(255,255,255,.035) 6.2cqw calc(6.2cqw + 1px));transform:perspective(40cqw) rotateX(58deg);transform-origin:bottom;opacity:.9}
.avs-stage::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:conic-gradient(from 200deg at 12% -8%,transparent 0 8deg,rgba(243,220,155,.10) 14deg,transparent 22deg),conic-gradient(from 140deg at 88% -8%,transparent 0 8deg,rgba(168,85,247,.14) 14deg,transparent 22deg);animation:avs-sweep 9s ease-in-out infinite alternate}
@keyframes avs-sweep{to{transform:translateX(2cqw)}}
.avs-brand{position:absolute;top:2.4cqw;left:2.8cqw;z-index:4}
.avs-chip{position:absolute;top:2.6cqw;right:2.8cqw;z-index:4;font-family:var(--f-stage);font-size:1.05cqw;letter-spacing:.14em;text-transform:uppercase;padding:.55cqw 1.1cqw;border-radius:99px;border:1px solid rgba(212,175,55,.5);color:var(--champagne);background:rgba(10,10,20,.5);display:flex;gap:.6cqw;align-items:center}
.avs-title{font-family:var(--f-stage);font-weight:900;text-transform:uppercase;letter-spacing:.02em;line-height:1.02;text-wrap:balance}
.avs-stage .av-num{font-size:1.1cqw}
.avs-scene{position:absolute;inset:0;animation:avs-fade .5s ease-out both}
@keyframes avs-fade{from{opacity:0}to{opacity:1}}

/* Lobby */
.avs-lobby{display:grid;grid-template-columns:1.25fr 1fr;align-items:center;height:100%;padding:7cqw 5cqw 4cqw;gap:3cqw}
.avs-lobby .av-tag{font-size:2.3cqw}
.avs-lobby h2{font-family:var(--f-stage);font-weight:800;font-size:2.7cqw;margin:2.4cqw 0 0;color:var(--ivory);line-height:1.15;text-wrap:balance}
.avs-lobby .sub{font-size:1.6cqw;color:var(--muted);margin-top:.6cqw}
.avs-lobby .cta{font-size:1.6cqw;color:var(--champagne);margin-top:.8cqw}
.avs-count{display:inline-flex;align-items:baseline;gap:.8cqw;margin-top:2.6cqw;padding:1cqw 1.8cqw;border-radius:1.4cqw;background:rgba(124,58,237,.18);border:1px solid rgba(168,85,247,.45)}
.avs-count b{font-family:var(--f-stage);font-size:3.6cqw;font-weight:900;font-variant-numeric:tabular-nums}
.avs-count span{font-size:1.4cqw;color:var(--muted)}
.avs-qr{justify-self:center;padding:1.4cqw;border-radius:2cqw;background:#fff;width:24cqw;box-shadow:0 0 0 .5cqw rgba(212,175,55,.9),0 0 6cqw rgba(168,85,247,.6)}
.avs-qr svg{display:block;width:100%;height:auto}
.avs-qr-url{text-align:center;font-family:var(--f-stage);font-size:1.15cqw;letter-spacing:.06em;margin-top:1.2cqw;color:var(--champagne)}
.avs-floats{position:absolute;inset:auto 0 3cqw 0;display:flex;justify-content:center;gap:1.4cqw;z-index:-1;opacity:.28;filter:blur(.12cqw)}
.avs-floats .mini{width:7cqw;border-radius:1cqw;overflow:hidden;transform:translateY(calc(var(--i)*.6cqw)) rotate(calc((var(--i) - 3.5)*2deg));animation:avs-floaty 6s ease-in-out infinite;animation-delay:calc(var(--i)*-.7s)}
@keyframes avs-floaty{50%{translate:0 -1cqw}}

/* Classement en direct */
.avs-live{position:absolute;inset:7.5cqw 5cqw 3.5cqw}
.avs-live-h{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:1.8cqw;gap:2cqw}
.avs-live-h .avs-title{font-size:3.3cqw}
.avs-live-h .meta{font-size:1.35cqw;color:var(--muted);text-align:right;white-space:nowrap}
.avs-live-h .meta b{font-family:var(--f-stage);color:var(--ivory);font-size:2.2cqw;display:block;font-variant-numeric:tabular-nums}
.avs-board{position:relative}
.avs-row{position:absolute;left:0;right:0;display:grid;grid-template-columns:3.4cqw var(--rh) 1fr;gap:1.2cqw;align-items:center;transition:transform .9s cubic-bezier(.2,.8,.2,1)}
.avs-row .rk{font-family:var(--f-stage);font-weight:900;font-size:calc(var(--rh)*.45);text-align:center;color:var(--muted)}
.avs-row.first .rk{color:var(--gold)}
.avs-row .av{border-radius:.9cqw;overflow:hidden;height:var(--rh);width:var(--rh)}
.avs-row .av .av-ph{height:100%}
.avs-row .av .ini{font-size:calc(var(--rh)*.45)}
.avs-barw{position:relative;height:100%;border-radius:1cqw;background:rgba(255,255,255,.04);overflow:hidden;border:1px solid rgba(255,255,255,.06)}
.avs-bar{position:absolute;inset:0 auto 0 0;border-radius:1cqw;background:linear-gradient(90deg,#4c1d95,var(--violet) 40%,var(--violet-2));box-shadow:inset 0 1px 0 rgba(255,255,255,.25);transition:width .9s cubic-bezier(.2,.8,.2,1)}
.avs-row.first .avs-bart{color:#1a1306}
.avs-row.first .avs-bart small{color:rgba(26,19,6,.7)}
.avs-row.first .avs-bar{background:linear-gradient(90deg,#7a5a12,var(--gold) 55%,#ffe9a3);box-shadow:0 0 2.4cqw rgba(212,175,55,.45),inset 0 1px 0 rgba(255,255,255,.4)}
.avs-bart{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;gap:1cqw;padding:0 1.5cqw;font-size:calc(var(--rh)*.36);font-weight:800;white-space:nowrap}
.avs-bart .nm{overflow:hidden;text-overflow:ellipsis}
.avs-bart small{font-weight:600;color:rgba(247,240,227,.7);font-size:calc(var(--rh)*.24);margin-left:.6cqw}
.avs-bart .pc{font-family:var(--f-stage);font-variant-numeric:tabular-nums}
.avs-more{position:absolute;left:4.6cqw;bottom:-2.6cqw;font-size:1.3cqw;color:var(--muted)}

/* Mode caché */
.avs-hidden{height:100%;display:grid;place-items:center;text-align:center;padding:6cqw 4cqw 4cqw}
.avs-hidden .avs-title{font-size:4.2cqw}
.avs-ring{position:relative;width:21cqw;margin:2.4cqw auto 0}
.avs-ring svg{width:100%;height:auto;display:block;transform:rotate(-90deg)}
.avs-ring circle.p{transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)}
.avs-ring-c{position:absolute;inset:0;display:grid;place-content:center}
.avs-ring-c b{font-family:var(--f-stage);font-size:6.4cqw;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.avs-ring-c span{font-size:1.35cqw;color:var(--muted);margin-top:.5cqw}
.avs-note{margin-top:1.6cqw;font-size:1.4cqw;color:var(--champagne)}
.avs-ballots{position:absolute;inset:0;z-index:-1;overflow:hidden}
.avs-ballots i{position:absolute;bottom:-4cqw;width:2.2cqw;height:2.8cqw;border-radius:.3cqw;border:1px solid rgba(243,220,155,.5);background:linear-gradient(180deg,rgba(243,220,155,.18),rgba(124,58,237,.12));animation:avs-rise 7s linear infinite;opacity:0}
@keyframes avs-rise{10%{opacity:.7}100%{transform:translateY(-60cqw) rotate(25deg);opacity:0}}

/* Compte à rebours (par-dessus la scène du vote) */
.avs-cd{position:absolute;inset:0;z-index:5;display:grid;place-items:center;text-align:center;padding:5cqw;background:radial-gradient(60% 55% at 50% 0%,rgba(224,64,154,.22),transparent 70%),var(--ink);animation:avs-fade .35s ease-out both}
.avs-cd .lbl{font-family:var(--f-stage);font-weight:800;letter-spacing:.2em;font-size:1.7cqw;color:var(--champagne)}
.avs-cd-ring{position:relative;width:24cqw;margin:1.8cqw auto 0}
.avs-cd-ring svg{display:block;width:100%;height:auto;transform:rotate(-90deg)}
.avs-cd-ring circle.p{transition:stroke-dashoffset .3s linear}
.avs-cd-n{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-stage);font-weight:900;font-size:11cqw;line-height:1;animation:avs-tick 1s ease-out}
@keyframes avs-tick{0%{transform:scale(1.35);opacity:.3}30%{transform:scale(1);opacity:1}}
.avs-cd .hint{font-size:1.35cqw;color:var(--muted);margin-top:1.4cqw}
.avs-done{font-family:var(--f-stage);font-weight:900;font-size:5.2cqw;line-height:1.05;animation:av-inup .9s cubic-bezier(.2,.8,.2,1) both}

/* Révélation : montée */
.avs-rv{height:100%;display:grid;place-content:center;gap:2.2cqw;text-align:center;padding:5cqw}
.avs-rv .l1{font-family:var(--f-stage);font-weight:900;font-size:4.6cqw}
.avs-rv .l2{font-family:var(--f-stage);font-weight:800;font-size:3cqw}
.avs-rv .l2 b{font-size:5cqw;display:block;line-height:1.05}
.avs-rv .l3{font-family:var(--f-script);font-size:3.4cqw;color:var(--champagne)}
.avs-rv .l1,.avs-rv .l2,.avs-rv .l3{opacity:0;animation:av-inup .9s cubic-bezier(.2,.8,.2,1) forwards}
.avs-rv .l2{animation-delay:1.6s}.avs-rv .l3{animation-delay:3.2s}

/* Podium */
.avs-spot{position:absolute;left:50%;top:-6cqw;width:34cqw;height:64cqw;translate:-50% 0;z-index:-1;background:conic-gradient(from 165deg at 50% 0,transparent 0,rgba(255,236,170,.22) 15deg,transparent 30deg);filter:blur(.4cqw)}
.avs-podium{position:absolute;inset:6cqw 4cqw 0;display:grid;grid-template-columns:1fr 1.25fr 1fr;align-items:end;gap:2.2cqw}
.avs-pd{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}
.avs-pd.hide{visibility:hidden}
.avs-pd.in{animation:av-inup 1s cubic-bezier(.2,.8,.2,1) both}
.avs-pd .cards{display:flex;justify-content:center;gap:1cqw;width:62%}
.avs-pd .card{flex:1;border-radius:1.4cqw;overflow:hidden;position:relative;min-width:0}
.avs-pd .who{margin-top:1cqw;font-family:var(--f-stage);font-weight:900;font-size:2.1cqw;text-transform:uppercase;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avs-pd .pc{font-family:var(--f-stage);font-size:1.6cqw;color:var(--champagne);font-variant-numeric:tabular-nums}
.avs-pd .place{font-size:1.15cqw;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:.8cqw;font-weight:800}
.avs-pd .step{width:100%;margin-top:1.2cqw;border-radius:1cqw 1cqw 0 0;display:grid;place-items:center;font-family:var(--f-stage);font-weight:900;font-size:4.4cqw;color:rgba(255,255,255,.18);background:linear-gradient(180deg,rgba(124,58,237,.45),rgba(124,58,237,.08));border-top:.2cqw solid rgba(168,85,247,.8)}
.avs-pd.p1 .step{height:9cqw;background:linear-gradient(180deg,rgba(212,175,55,.5),rgba(212,175,55,.06));border-top-color:var(--gold);color:rgba(255,240,190,.4)}
.avs-pd.p2 .step{height:6cqw}.avs-pd.p3 .step{height:4.2cqw}
.avs-pd.p1 .cards{width:66%}
.avs-pd.p1 .card{box-shadow:0 0 0 .25cqw var(--gold),0 0 6cqw rgba(212,175,55,.55)}
.avs-crown{font-family:var(--f-stage);font-weight:900;font-size:1.25cqw;letter-spacing:.2em;color:var(--ink);background:linear-gradient(90deg,#f3dc9b,#d4af37);padding:.45cqw 1.2cqw;border-radius:99px;margin-bottom:1cqw}
.avs-pd.p1 .who{font-size:3cqw}

/* Gagnant seul */
.avs-winner{position:absolute;inset:5cqw 5cqw 3cqw;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5cqw;padding:0 6cqw}
.avs-winner .card{width:22cqw;border-radius:1.8cqw;overflow:hidden;position:relative;box-shadow:0 0 0 .3cqw var(--gold),0 0 7cqw rgba(212,175,55,.55);animation:av-inup 1.1s cubic-bezier(.2,.8,.2,1) .2s both}
.avs-winner .txt{animation:av-inup 1s cubic-bezier(.2,.8,.2,1) .9s both;min-width:0}
.avs-winner .name{font-family:var(--f-stage);font-weight:900;font-size:6cqw;line-height:1.02;text-transform:uppercase;overflow-wrap:anywhere;margin-top:1.4cqw}
.avs-winner .pc{font-family:var(--f-stage);font-size:2.2cqw;color:var(--champagne);margin-top:1cqw;font-variant-numeric:tabular-nums}
.avs-winner.textonly{grid-template-columns:1fr;text-align:center}
.avs-winner.textonly .avs-crown{justify-self:center;display:inline-block}

/* Égalité */
.avs-tie{position:absolute;inset:5.5cqw 5cqw 3cqw;display:flex;justify-content:center;align-items:center;gap:3cqw}
.avs-tie .side{text-align:center;flex:1;max-width:24cqw;min-width:0;animation:av-inup 1s cubic-bezier(.2,.8,.2,1) both}
.avs-tie .card{width:70%;margin:0 auto;border-radius:1.4cqw;overflow:hidden;position:relative}
.avs-tie .who{font-family:var(--f-stage);font-weight:900;font-size:2.4cqw;margin-top:1.2cqw;overflow-wrap:anywhere}
.avs-tie .v{font-size:1.7cqw;color:var(--champagne);font-variant-numeric:tabular-nums}
.avs-tie .mid{text-align:center;flex:none}
.avs-tie .eq{font-family:var(--f-stage);font-weight:900;font-size:5cqw;letter-spacing:.04em;animation:avs-breathe 2.4s ease-in-out infinite}
@keyframes avs-breathe{50%{filter:drop-shadow(0 0 1.5cqw rgba(224,64,154,.8))}}
.avs-tie .vs{width:7cqw;height:7cqw;margin:1.6cqw auto;border-radius:50%;display:grid;place-items:center;font-family:var(--f-stage);font-weight:900;font-size:2.2cqw;border:.25cqw solid var(--gold);box-shadow:0 0 3cqw rgba(212,175,55,.5)}
.avs-tie .next{font-size:1.4cqw;color:var(--muted)}

/* Second tour */
.avs-r2{position:absolute;inset:5.5cqw 5cqw 3cqw;display:grid;grid-template-rows:auto 1fr;gap:2cqw;text-align:center}
.avs-ribbon{justify-self:center;display:inline-block;font-family:var(--f-stage);font-weight:900;font-size:1.4cqw;letter-spacing:.24em;padding:.6cqw 2cqw;border-radius:99px;background:linear-gradient(90deg,var(--magenta),var(--violet));box-shadow:0 0 3cqw rgba(224,64,154,.5)}
.avs-r2 .avs-title{font-size:4cqw;margin-top:1cqw}
.avs-r2 .sub{font-size:1.6cqw;color:var(--champagne)}
.avs-r2 .duo{display:flex;justify-content:center;gap:4cqw;align-items:end}
.avs-r2 .duo .c{width:15cqw;border-radius:1.4cqw;overflow:hidden;position:relative}
.avs-r2 .duo .nm{font-family:var(--f-stage);font-weight:800;font-size:1.8cqw;margin-top:.8cqw}
.avs-r2 .count{font-size:1.5cqw;color:var(--muted)}
.avs-r2 .count b{font-family:var(--f-stage);color:var(--ivory);font-size:2.4cqw;font-variant-numeric:tabular-nums;margin-right:.6cqw}
.avs-noscan{position:absolute;right:0;bottom:0;display:flex;gap:1cqw;align-items:center;font-size:1.2cqw;color:var(--muted);text-align:left}
.avs-noscan .q{width:6cqw;background:#fff;padding:.4cqw;border-radius:.6cqw}
.avs-noscan .q svg{display:block;width:100%;height:auto}

/* Classement complet */
.avs-full{position:absolute;inset:6.5cqw 5cqw 3cqw;display:grid;grid-template-rows:auto 1fr;gap:1.6cqw}
.avs-full .avs-title{font-size:3cqw;text-align:center}
.avs-full-list{display:grid;grid-auto-flow:column;grid-template-rows:repeat(var(--rows),var(--rowh));grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:.8cqw 2.4cqw;align-content:start}
.avs-fr{display:grid;grid-template-columns:3cqw 3.6cqw minmax(0,1fr) auto;gap:1cqw;align-items:center;padding:.5cqw 1cqw;border-radius:1cqw;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);animation:av-inup .7s cubic-bezier(.2,.8,.2,1) both;min-height:0}
.avs-fr .rk{font-family:var(--f-stage);font-weight:900;font-size:1.7cqw;text-align:center;color:var(--muted)}
.avs-fr.first{border-color:rgba(212,175,55,.7);background:rgba(212,175,55,.12)}
.avs-fr.first .rk{color:var(--gold)}
.avs-fr .av{width:3.6cqw;border-radius:.6cqw;overflow:hidden}
.avs-fr .av .ini{font-size:1.6cqw}
.avs-fr .nm{font-weight:800;font-size:1.6cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.avs-fr .pc{font-family:var(--f-stage);font-size:1.5cqw;font-variant-numeric:tabular-nums;color:var(--champagne);white-space:nowrap}
.avs-fr .pc small{font-family:var(--f-ui);font-size:1.1cqw;color:var(--muted);margin-left:.6cqw}

/* Aucun vote / vote fermé */
.avs-center{height:100%;display:grid;place-content:center;text-align:center;gap:1.6cqw;padding:5cqw}
.avs-center .avs-title{font-size:5cqw}
.avs-center p{margin:0;font-size:1.8cqw;color:var(--muted)}
.avs-center .count{font-family:var(--f-stage);font-size:2.4cqw;color:var(--champagne)}

.avs-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:3}
.avs-confetti i{position:absolute;top:-3cqw;width:.8cqw;height:1.3cqw;border-radius:.15cqw;animation:avs-fall linear infinite}
@keyframes avs-fall{to{transform:translateY(62cqw) rotate(720deg)}}
.avs-fs{position:absolute;bottom:16px;right:16px;z-index:50;padding:12px;background:rgba(0,0,0,.5);border:1px solid rgba(212,175,55,.3);border-radius:999px;color:#d4af37;cursor:pointer}
@media (prefers-reduced-motion:reduce){.avs-confetti,.avs-ballots{display:none}}
`
