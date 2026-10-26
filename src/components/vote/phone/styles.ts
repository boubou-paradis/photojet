// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Écrans téléphone d'AnimaVote (360 à 480 px), repris de la maquette
// validée : grille de cartes photo, cartes sans photo, lignes de texte,
// feuille de confirmation, états « enregistré / déjà voté / terminé ».
// Tout est sous .avp : aucun effet sur les autres pages.

export const PHONE_CSS = `
.avp{min-height:100dvh;overflow-x:clip;color:var(--ivory);font-family:var(--f-ui);font-size:15px;line-height:1.45;background:radial-gradient(120% 50% at 50% 0%,#2a1658,transparent 60%),var(--ink)}
.avp *{box-sizing:border-box}
/* :where() : remise à zéro sans priorité, les boutons stylés gardent leur police et leur couleur. */
.avp :where(button){font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.avp :focus-visible{outline:2px solid var(--champagne);outline-offset:3px}
.avp-in{position:relative;margin:0 auto;max-width:480px;min-height:100dvh;display:flex;flex-direction:column;padding:max(12px,env(safe-area-inset-top)) 0 max(14px,env(safe-area-inset-bottom))}
.avp-head{padding:8px 20px 14px;flex:none}
.avp-head h1{font-family:var(--f-stage);font-weight:800;font-size:20px;line-height:1.15;margin:14px 0 0;text-wrap:balance}
.avp-head p{margin:5px 0 0;color:var(--muted);font-size:15px}
.avp-ribbon{align-self:flex-start;margin:4px 20px 0;font-family:var(--f-stage);font-weight:900;font-size:12px;letter-spacing:.2em;padding:6px 14px;border-radius:99px;background:linear-gradient(90deg,var(--magenta),var(--violet))}
.avp-closing{margin:0 16px 10px;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:rgba(224,64,154,.14);border:1px solid rgba(224,64,154,.55);font-weight:800;font-size:15px}
.avp-closing b{font-family:var(--f-stage);font-variant-numeric:tabular-nums;margin-left:auto;font-size:18px}
.avp-body{flex:1;padding:4px 16px 24px}
.avp-body.sheet-open{padding-bottom:280px}
.avp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.avp-cand{position:relative;border:0;padding:0;text-align:left;background:var(--ink-3);border-radius:20px;overflow:hidden;cursor:pointer;min-height:44px;box-shadow:0 0 0 1px rgba(255,255,255,.07);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,opacity .25s,filter .25s}
.avp-cand .av-ph{border-radius:0}
.avp-cand .av-num{font-size:12px}
.avp-cand .meta{position:absolute;inset:auto 0 0 0;padding:11px 12px;z-index:2}
.avp-cand .meta b{display:block;font-family:var(--f-stage);font-weight:800;font-size:16px;line-height:1.12;overflow-wrap:anywhere}
.avp-cand .meta span{display:block;font-size:12.5px;color:rgba(247,240,227,.78);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avp-chk{position:absolute;top:9px;right:9px;z-index:3;width:32px;height:32px;border-radius:50%;background:var(--gold);display:grid;place-items:center;scale:0;transition:scale .3s cubic-bezier(.3,1.6,.5,1)}
.avp-chk svg{width:18px;height:18px}
.avp-chk path{stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .35s .12s}
.avp-dimmed .avp-cand:not(.sel),.avp-dimmed .avp-card:not(.sel),.avp-dimmed .avp-row:not(.sel){opacity:.42;filter:saturate(.5)}
.avp-cand.sel{transform:translateY(-4px) scale(1.02);box-shadow:0 0 0 2.5px var(--gold),0 0 0 7px rgba(168,85,247,.35),0 14px 30px -8px rgba(124,58,237,.9)}
.avp-cand.sel .avp-chk,.avp-card.sel .avp-chk{scale:1}
.avp-cand.sel .avp-chk path,.avp-card.sel .avp-chk path{stroke-dashoffset:0}
.avp-cand.sel::after{content:"Sélectionné";position:absolute;left:50%;top:44%;translate:-50% -50%;z-index:3;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:99px;background:rgba(10,10,20,.75);color:var(--champagne)}
.avp-duo{display:grid;gap:14px}
.avp-duo .avp-cand{display:grid;grid-template-columns:42% 1fr;align-items:center}
.avp-duo .avp-cand .meta{position:static;padding:16px}
.avp-duo .avp-cand .meta b{font-size:21px}
.avp-list{display:grid;gap:11px}
.avp-card{position:relative;display:flex;align-items:center;gap:13px;width:100%;border:0;text-align:left;padding:11px;border-radius:18px;background:var(--ink-3);box-shadow:0 0 0 1px rgba(255,255,255,.07);cursor:pointer;min-height:70px;transition:box-shadow .25s,opacity .25s,filter .25s}
.avp-card .tile{width:56px;height:56px;flex:none;border-radius:15px;overflow:hidden}
.avp-card .tile .av-ph{height:100%;aspect-ratio:auto}
.avp-card .tile .ini{font-size:26px}
.avp-card .tx{min-width:0;flex:1}
.avp-card b{font-family:var(--f-stage);font-weight:800;font-size:15.5px;display:block;overflow-wrap:anywhere}
.avp-card .tx span{font-size:13px;color:var(--muted);display:block}
.avp-card .n{font-family:var(--f-stage);font-weight:900;color:var(--gold);font-size:14px;flex:none}
.avp-card .avp-chk{position:static;flex:none;width:28px;height:28px}
.avp-card.sel{box-shadow:0 0 0 2px var(--gold),0 0 0 6px rgba(168,85,247,.3)}
.avp-row{display:flex;align-items:center;gap:13px;width:100%;border:0;text-align:left;padding:17px;border-radius:18px;background:var(--ink-3);box-shadow:0 0 0 1px rgba(255,255,255,.07);font-weight:700;font-size:16px;min-height:60px;cursor:pointer;transition:box-shadow .25s,opacity .25s,filter .25s}
.avp-row .rad{width:26px;height:26px;flex:none;border-radius:50%;border:2px solid #4b4473;display:grid;place-items:center}
.avp-row .n{margin-left:auto;font-family:var(--f-stage);font-weight:900;color:var(--gold);font-size:14px}
.avp-row.sel{box-shadow:0 0 0 2px var(--gold),0 0 0 6px rgba(168,85,247,.3)}
.avp-row.sel .rad{border-color:var(--gold);background:var(--gold)}
.avp-row.blank{background:transparent;box-shadow:none;outline:1.5px dashed rgba(255,255,255,.25);outline-offset:-1.5px;color:var(--muted);font-weight:600}
.avp-row.blank.sel{outline-color:var(--gold);color:var(--ivory)}
.avp-blankwrap{margin-top:14px}
.avp-sheet{position:fixed;left:0;right:0;bottom:0;z-index:20;margin:0 auto;max-width:480px;padding:12px 20px max(22px,env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:linear-gradient(180deg,#221a42,#120f22 60%);box-shadow:0 -20px 50px rgba(0,0,0,.6),0 -1px 0 rgba(212,175,55,.5);transform:translateY(105%);transition:transform .38s cubic-bezier(.2,.9,.2,1)}
.avp-sheet.on{transform:none}
.avp-sheet .grab{width:42px;height:5px;border-radius:9px;background:#4b4473;margin:0 auto 12px}
.avp-sheet .ey{font-family:var(--f-stage);font-weight:800;font-size:12px;letter-spacing:.18em;color:var(--champagne)}
.avp-mini{display:flex;gap:13px;align-items:center;margin:10px 0 16px}
.avp-mini .pic{width:64px;flex:none;border-radius:13px;overflow:hidden}
.avp-mini b{font-family:var(--f-stage);font-weight:900;font-size:21px;display:block;line-height:1.1;overflow-wrap:anywhere}
.avp-mini span{color:var(--muted);font-size:14px}
.avp-gold{width:100%;border:0;border-radius:17px;padding:17px;min-height:58px;font-family:var(--f-stage);font-weight:900;font-size:16px;letter-spacing:.04em;color:#1a1306;cursor:pointer;background:linear-gradient(180deg,#fff0b0,#e5bf4a 45%,#c29328);box-shadow:0 10px 30px -8px rgba(212,175,55,.7),inset 0 1px 0 rgba(255,255,255,.7);position:relative;overflow:hidden}
.avp-gold::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);translate:-100% 0;animation:avp-shine 3.2s ease-in-out infinite}
.avp-gold:disabled{opacity:.75}
.avp-gold .av-spin{border-color:rgba(26,19,6,.25);border-top-color:#1a1306}
@keyframes avp-shine{60%,100%{translate:100% 0}}
.avp-ghost{width:100%;border:0;background:none;color:var(--ivory);font-weight:700;padding:13px;min-height:46px;margin-top:4px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(247,240,227,.3)}
.avp-warn{display:flex;gap:6px;justify-content:center;align-items:center;font-size:13px;color:var(--muted);margin-top:8px}
.avp-err{margin:0 0 12px;font-size:14px;line-height:1.35;color:#fde68a;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:12px;padding:10px 12px}
.avp-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px 28px 30px;gap:11px}
.avp-state h2{font-family:var(--f-stage);font-weight:900;font-size:24px;line-height:1.15;margin:8px 0 0;text-wrap:balance}
.avp-state p{margin:0;color:var(--muted);font-size:15.5px;text-wrap:balance}
.avp-state .lead{color:var(--ivory);font-weight:700}
.avp-medal{width:140px;height:140px;position:relative;display:grid;place-items:center}
.avp-medal::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(212,175,55,.35),transparent 65%);animation:av-pulse 2.4s ease-in-out infinite}
.avp-medal svg{width:110px;height:110px;position:relative}
.avp-medal .draw{stroke-dasharray:60;stroke-dashoffset:60;animation:avp-draw .7s .25s cubic-bezier(.6,0,.2,1) forwards}
.avp-medal .ring{stroke-dasharray:290;stroke-dashoffset:290;animation:avp-draw .8s cubic-bezier(.6,0,.2,1) forwards}
@keyframes avp-draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.avp-medal .draw,.avp-medal .ring{stroke-dashoffset:0}}
.avp-locked{display:flex;align-items:center;gap:11px;padding:9px 13px 9px 9px;border-radius:15px;background:var(--ink-3);box-shadow:0 0 0 1px rgba(212,175,55,.35);margin-top:8px;text-align:left;max-width:100%}
.avp-locked .pic{width:44px;border-radius:10px;overflow:hidden;flex:none}
.avp-locked b{font-size:15px;display:block;overflow-wrap:anywhere}
.avp-locked span{font-size:13px;color:var(--muted)}
.avp-locked svg{margin-left:6px;flex:none}
.avp-watch{margin-top:14px;display:flex;gap:9px;align-items:center;font-size:14px;color:var(--champagne);text-align:left}
.avp-thumbs{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;justify-content:center}
.avp-thumbs div{width:50px;border-radius:10px;overflow:hidden}
.avp-link{font-size:14px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;margin-top:14px}
.avp-retry{margin-top:10px;border:1px solid var(--gold);background:rgba(212,175,55,.1);color:var(--champagne);border-radius:12px;padding:12px 20px;font-weight:800;min-height:46px;cursor:pointer}
.avp-foot{flex:none;padding:6px 16px 0;font-size:12.5px;color:var(--muted);text-align:center}
`
