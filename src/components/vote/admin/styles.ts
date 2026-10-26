// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Page animateur AnimaVote : éditeur et pilotage de la maquette validée
// (cartes sombres, segments, interrupteurs, un seul grand bouton à la fois).
// Tout est sous .ava : aucun effet sur les autres pages.

export const ADMIN_CSS = `
.ava{font-family:var(--f-ui);color:var(--ivory)}
.ava *{box-sizing:border-box}
.ava :where(button){font:inherit;color:inherit}
.ava :focus-visible{outline:2px solid var(--champagne);outline-offset:3px}
.ava-grid{display:grid;gap:16px}
.ava-box{border-radius:14px;background:var(--ink-2);border:1px solid #241f40;padding:16px;min-width:0}
.ava-box h4{margin:0 0 12px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--champagne);font-weight:800;display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.ava-box h4 small{letter-spacing:0;text-transform:none;color:var(--muted);font-weight:600;font-size:12px}
.ava-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:16px;align-items:start}
.ava-ed{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.9fr);gap:16px;align-items:start}
.ava-ed .ava-fld:last-child{margin-bottom:0}
.ava-ed .c1{display:grid;gap:16px;min-width:0}
.ava-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.ava-top .ava-act-row{flex-wrap:nowrap}
.ava-top .ava-sub{text-align:right;max-width:340px}
.ava-top .ava-act{min-height:48px;padding:12px 24px}
.ava-fld{display:grid;gap:5px;margin-bottom:12px}
.ava-fld label,.ava-fld .lbl{font-size:12.5px;font-weight:700;color:var(--muted)}
.ava-in{width:100%;background:#0b0918;border:1px solid #2e2852;border-radius:10px;padding:10px 12px;color:var(--ivory);font:inherit;font-size:14px;min-height:42px}
.ava-in:focus{border-color:var(--gold);outline:none}
textarea.ava-in{min-height:58px;resize:vertical}
.ava-in.sm{min-height:36px;padding:7px 10px;font-size:13.5px}
.ava-seg{display:flex;padding:3px;border-radius:12px;background:#0b0918;border:1px solid #2e2852;gap:3px}
.ava-seg button{flex:1;border:0;background:none;padding:9px 6px;border-radius:9px;font-weight:700;font-size:13px;color:var(--muted);cursor:pointer;min-height:40px;white-space:nowrap}
.ava-seg button[aria-pressed="true"]{background:linear-gradient(180deg,#3a2470,#24164a);color:var(--ivory);box-shadow:inset 0 0 0 1px rgba(212,175,55,.5)}
.ava-seg button:disabled{opacity:.5;cursor:not-allowed}
.ava-opt{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #1f1a38;font-size:14px}
.ava-opt small{display:block;color:var(--muted);font-size:12px}
.ava-opt .ava-seg{flex:none}
.ava-sw{width:44px;height:26px;border-radius:99px;background:#2b2550;position:relative;flex:none;border:0;cursor:pointer;padding:0}
.ava-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#8b84ad;transition:.2s}
.ava-sw[aria-checked="true"]{background:var(--violet)}
.ava-sw[aria-checked="true"]::after{left:21px;background:#fff}
.ava-reco{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);background:var(--gold);border-radius:99px;padding:1px 7px;margin-left:6px;vertical-align:2px}
.ava-clist{display:grid;gap:6px}
.ava-ci{display:grid;grid-template-columns:14px 46px minmax(0,1fr) auto;gap:10px;align-items:center;padding:6px 10px;border-radius:12px;background:#0b0918;border:1px solid #241f40;transition:border-color .15s,background .15s}
.ava-ci.drag{border-color:var(--gold);background:#17123a;box-shadow:0 12px 30px -10px rgba(124,58,237,.8)}
.ava-ci .hd{color:#5c5590;cursor:grab;font-size:14px;line-height:1;letter-spacing:-2px;user-select:none}
.ava-ci .pic{position:relative;width:46px;border:0;padding:0;border-radius:9px;overflow:hidden;cursor:pointer;background:none}
.ava-ci .pic .ini{font-size:20px}
.ava-ci .pic .ov{position:absolute;inset:auto 0 0 0;z-index:2;font-size:10px;font-weight:800;text-align:center;padding:3px 0;background:rgba(10,10,20,.75);color:var(--champagne)}
.ava-ci .pic.busy::before{content:"";position:absolute;inset:0;z-index:3;background:rgba(10,10,20,.6)}
.ava-ci .nb{width:58px;flex:none;text-align:center;font-family:var(--f-stage);font-weight:900;color:var(--gold)}
.ava-ci .tx{min-width:0;display:grid;gap:5px}
.ava-ci .l1{display:flex;gap:6px;min-width:0}
.ava-ci .extra{display:flex;gap:6px;align-items:center}
.ava-ci .extra .desc{flex:1;min-width:0}
.ava-ci .extra .emo{width:64px;flex:none;text-align:center}
.ava-color{width:36px;height:36px;border-radius:9px;border:1px solid #2e2852;padding:2px;background:#0b0918;cursor:pointer}
.ava-color.auto{opacity:.35}
.ava-ci .ac{display:grid;grid-template-columns:repeat(2,32px);gap:4px}
.ava-ic{width:32px;height:32px;border-radius:8px;border:1px solid #2e2852;background:none;display:grid;place-items:center;color:var(--muted);cursor:pointer}
.ava-ic:hover{color:var(--ivory);border-color:#4b4473}
.ava-ic:disabled{opacity:.35;cursor:not-allowed}
.ava-ic.danger:hover{color:#ff7aa8;border-color:#ff7aa8}
.ava-add{width:100%;margin-top:10px;border:1.5px dashed #3d3670;border-radius:12px;padding:12px;text-align:center;color:var(--champagne);font-weight:700;font-size:14px;background:none;cursor:pointer}
.ava-add:disabled{opacity:.4;cursor:not-allowed}
.ava-note{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--muted);margin-top:10px;flex-wrap:wrap}
.ava-note .warn{color:var(--champagne)}
.ava-steps{display:flex;gap:6px;flex-wrap:wrap}
.ava-steps span{display:flex;gap:7px;align-items:center;font-size:12.5px;font-weight:700;padding:7px 12px;border-radius:99px;background:#0b0918;border:1px solid #241f40;color:#6f6894}
.ava-steps span.done{color:var(--muted)}
.ava-steps span.done::before{content:"✓";color:var(--ok)}
.ava-steps span.now{color:var(--ivory);border-color:var(--gold);background:rgba(212,175,55,.1)}
.ava-steps span.now::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--magenta);box-shadow:0 0 8px var(--magenta)}
.ava-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ava-kpi{border-radius:14px;background:var(--ink-2);border:1px solid #241f40;padding:14px 16px}
.ava-kpi small{font-size:12px;color:var(--muted);font-weight:700}
.ava-kpi b{display:block;font-family:var(--f-stage);font-size:28px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.2}
.ava-kpi .bar{height:6px;border-radius:9px;background:#221d40;margin-top:8px;overflow:hidden}
.ava-kpi .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--violet),var(--gold));border-radius:9px;transition:width .6s}
.ava-act-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.ava-act{border:0;border-radius:14px;padding:16px 26px;min-height:56px;font-family:var(--f-stage);font-weight:900;font-size:15px;letter-spacing:.04em;cursor:pointer;color:#fff}
.ava-act.go{background:linear-gradient(180deg,#9b5cff,#6d28d9);box-shadow:0 10px 30px -10px rgba(124,58,237,.9)}
.ava-act.stop{background:linear-gradient(180deg,#ff5fae,#c0267a);box-shadow:0 10px 30px -10px rgba(224,64,154,.8)}
.ava-act.gold{color:#1a1306;background:linear-gradient(180deg,#fff0b0,#d4af37);box-shadow:0 10px 30px -10px rgba(212,175,55,.8)}
.ava-act:disabled{background:#221d40;color:#8b84ad;box-shadow:none;cursor:not-allowed}
.ava-sub{font-size:13px;color:var(--muted)}
.ava-board{display:grid;gap:7px}
.ava-mb{display:grid;grid-template-columns:22px 30px minmax(0,1fr) 46px 40px;gap:10px;align-items:center;font-size:13.5px}
.ava-mb .pic{width:30px;border-radius:6px;overflow:hidden}
.ava-mb .pic .ini{font-size:13px}
.ava-mb .t{height:8px;border-radius:9px;background:#221d40;overflow:hidden;margin-top:3px}
.ava-mb .t i{display:block;height:100%;border-radius:9px;background:var(--violet-2);transition:width .6s}
.ava-mb.first .t i{background:var(--gold)}
.ava-mb .r{font-family:var(--f-stage);font-weight:900;color:var(--muted);text-align:center;font-size:12px}
.ava-mb .p{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.ava-mb .c{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums;font-size:12.5px}
.ava-mb .nm{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ava-blank{font-size:12.5px;color:var(--muted);margin-top:6px}
.ava-masked{position:relative}
.ava-masked .ava-board{filter:blur(7px);opacity:.5;pointer-events:none;user-select:none}
.ava-masked.peek .ava-board{filter:none;opacity:1}
.ava-peek{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:8px;text-align:center;padding:12px}
.ava-masked.peek .ava-peek{inset:auto 0 -6px 0;place-content:end center}
.ava-peek button{border:1px solid var(--gold);background:rgba(10,10,20,.8);color:var(--champagne);border-radius:12px;padding:10px 16px;font-weight:800;min-height:44px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}
.ava-peek small{color:var(--muted);font-size:12px}
.ava-masked.peek .ava-peek small{display:none}
.ava-say{display:flex;gap:10px;align-items:center;font-size:13px;color:var(--muted);padding:10px 12px;border-radius:12px;background:#0b0918;border:1px dashed #2e2852}
.ava-say b{color:var(--ivory)}
.ava-chk{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:#0b0918;border:1px solid #241f40;font-size:14px;cursor:pointer;width:100%;text-align:left}
.ava-chk .bx{width:22px;height:22px;border-radius:6px;border:2px solid #4b4473;display:grid;place-items:center;flex:none}
.ava-chk[aria-checked="true"]{border-color:var(--gold)}
.ava-chk[aria-checked="true"] .bx{background:var(--gold);border-color:var(--gold)}
.ava-chk .pic{width:34px;border-radius:7px;overflow:hidden;flex:none}
.ava-chk .pic .ini{font-size:14px}
.ava-chk .c{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums;font-size:13px;white-space:nowrap}
.ava-tie{font-size:11px;font-weight:800;letter-spacing:.08em;color:#fff;background:var(--magenta);border-radius:99px;padding:2px 8px;margin-left:6px}
.ava-after{display:flex;gap:8px;flex-wrap:wrap}
.ava-after button{border:1px solid #2e2852;background:#0b0918;border-radius:11px;padding:10px 14px;font-weight:700;font-size:13px;min-height:44px;cursor:pointer}
.ava-after button:hover{border-color:var(--gold)}
.ava-ring{display:flex;align-items:center;gap:16px}
.ava-ring svg{width:82px;height:82px;transform:rotate(-90deg);flex:none}
.ava-ring circle.p{transition:stroke-dashoffset .3s linear}
.ava-ring .big{font-family:var(--f-stage);font-weight:900;font-size:22px}
.ava-cancel{border:1px solid #4b4473;background:none;border-radius:12px;padding:12px 18px;font-weight:800;min-height:48px;cursor:pointer}
.ava-cancel:hover{border-color:var(--ivory)}
@media (max-width:1280px){.ava-ed{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr)}.ava-ed .chx{grid-column:2;grid-row:1 / span 2}}
@media (max-width:900px){.ava-cols,.ava-ed{grid-template-columns:1fr}.ava-ed .chx{grid-column:auto;grid-row:auto}.ava-kpis{grid-template-columns:1fr 1fr}.ava-top .ava-sub{text-align:left}}
@media (max-width:520px){.ava-ci{grid-template-columns:46px minmax(0,1fr) auto}.ava-ci .hd{display:none}.ava-ci .extra{flex-wrap:wrap}}
`
