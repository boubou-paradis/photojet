// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Styles du buzzer et du logo AnimaBuzz : reprise exacte de la maquette
// validée (Phase 0). Un seul objet pour le téléphone, l'écran géant et la
// page animateur ; la taille vient de --s, l'état de data-state.
// Animations uniquement sur transform et opacity ; prefers-reduced-motion respecté.

export const BUZZER_CSS = `
.bz{--s:240px;position:relative;width:var(--s);height:var(--s);font-size:calc(var(--s) / 10);flex:none;
  --hc:168,85,247;--halo:0;--neon:.12;--shade:1;--gold:0;--goldR:.6;--lab:.42;--domeY:0em;--domeS:1;
  --neonA:#f0abfc;--neonB:#a855f7;--shadeC:8,5,22;
  -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.bz>*{position:absolute;pointer-events:none}
.bz-halo{inset:-40%;border-radius:50%;background:radial-gradient(circle,rgba(var(--hc),.62) 0%,rgba(var(--hc),.26) 30%,rgba(var(--hc),0) 62%);opacity:var(--halo);transition:opacity .45s ease .22s}
.bz-orbit{left:-32%;top:-32%;width:164%;height:164%;overflow:visible;opacity:calc(.22 + var(--halo) * .78);transition:opacity .45s ease .1s}
.bz-orbit ellipse{fill:none;vector-effect:non-scaling-stroke}
.bz-orbit .t1{stroke:rgba(212,175,55,.35);stroke-width:1}
.bz-orbit .t2{stroke:rgba(192,132,252,.35);stroke-width:1}
.bz-orbit .f1{stroke:#f3d77a;stroke-width:2;stroke-dasharray:46 330;stroke-linecap:round;opacity:0}
.bz-orbit .f2{stroke:#e879f9;stroke-width:2;stroke-dasharray:30 330;stroke-linecap:round;opacity:0}
.bz-plinth{left:1.5%;right:1.5%;top:9%;bottom:-9%;border-radius:50%;background:linear-gradient(180deg,#1d1534 0%,#0b0814 58%,#030207 100%);box-shadow:inset 0 -.1em 0 rgba(212,175,55,.6),inset 0 -.22em .2em rgba(212,175,55,.12),0 .55em 1.1em rgba(0,0,0,.8)}
.bz-base{inset:0;border-radius:50%;background:radial-gradient(circle at 50% 26%,#30264c 0%,#171030 42%,#08060f 74%);box-shadow:inset 0 0 0 .06em #e9c96a,inset 0 0 0 .13em #241a08,inset 0 .22em .35em rgba(255,255,255,.12)}
.bz-gold{inset:7%;border-radius:50%;background:conic-gradient(from 215deg,#fff3c4,#d4af37 11%,#6e5112 29%,#e9c96a 44%,#a8821f 61%,#fbe7a3 77%,#7a5c16 90%,#fff3c4);-webkit-mask:radial-gradient(circle,transparent 79.5%,#000 81%);mask:radial-gradient(circle,transparent 79.5%,#000 81%);opacity:var(--goldR);transition:opacity .3s}
.bz-goldglow{inset:7%;border-radius:50%;box-shadow:0 0 .55em .06em rgba(243,215,122,.8),inset 0 0 .45em rgba(243,215,122,.55);opacity:var(--gold);transition:opacity .3s}
.bz-neon{inset:12.5%;border-radius:50%;background:radial-gradient(circle,transparent 85%,var(--neonA) 89.5%,var(--neonB) 93.5%,transparent 98.5%);opacity:var(--neon);transition:opacity .3s ease .08s}
.bz-scan{inset:3.5%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 68%,rgba(255,255,255,.95) 83%,transparent 87%);-webkit-mask:radial-gradient(circle,transparent 90%,#000 91%,#000 97%,transparent 98%);mask:radial-gradient(circle,transparent 90%,#000 91%,#000 97%,transparent 98%);opacity:0}
.bz-dome{inset:16.5%;border-radius:50%;overflow:hidden;
  background:radial-gradient(circle at 72% 82%,rgba(236,72,153,.55),rgba(236,72,153,0) 46%),radial-gradient(circle at 40% 30%,#fff 0%,#f6dcff 7%,#dcaaff 18%,#b56cf7 36%,#8b3cf0 56%,#5b1bb8 77%,#260954 100%);
  box-shadow:inset 0 -.5em .8em rgba(25,0,55,.6),inset 0 .2em .35em rgba(255,255,255,.4),0 .2em .3em rgba(0,0,0,.6);
  transform:translateY(var(--domeY)) scale(var(--domeS));transition:transform .14s cubic-bezier(.3,1.7,.5,1)}
.bz-spec{position:absolute;left:17%;top:8%;width:48%;height:27%;border-radius:50%;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.78),rgba(255,255,255,0) 70%);transform:rotate(-18deg)}
.bz-shade{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 42% 32%,rgba(var(--shadeC),.5),rgba(var(--shadeC),.9));opacity:var(--shade);transition:opacity .5s ease .3s}
.bz-flash{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,#fff 0%,rgba(255,255,255,.5) 35%,rgba(255,255,255,0) 70%);opacity:0}
.bz-label{inset:16.5%;display:grid;place-items:center;color:#fff;opacity:var(--lab);transform:translateY(var(--domeY)) scale(var(--domeS));transition:opacity .4s ease .38s,transform .14s cubic-bezier(.3,1.7,.5,1)}
.bz-label span{display:block;font-family:var(--font-bz-display),"Arial Black",sans-serif;font-size:1.42em;line-height:1;letter-spacing:.01em;transform:rotate(-9deg);text-shadow:0 .05em 0 #4c1395,0 0 .35em rgba(255,255,255,.55);white-space:nowrap}
.bz-label svg{position:absolute;left:28%;top:16%;width:30%;height:auto;overflow:visible;transform:rotate(-9deg)}
.bz-label svg path{stroke:#fff;stroke-width:2.4;stroke-linecap:round;fill:none}
.bz-wave{inset:0;border-radius:50%;border:.1em solid #f3d77a;box-shadow:0 0 .5em rgba(var(--hc),.8);opacity:0}
.bz-sparks{inset:0}
.bz-sparks i{position:absolute;left:50%;top:50%;width:.11em;height:.11em;margin:-.055em;border-radius:50%;background:#fff;box-shadow:0 0 .22em .07em rgba(var(--hc),.95);transform:rotate(var(--a)) translateY(calc(var(--r) * -1));opacity:0}
.bz[data-state="off"] .bz-halo{animation:bz-breathe 4.6s ease-in-out infinite}
.bz[data-state="open"],.bz[data-state="test"],.bz[data-state="sent"],.bz[data-state="pressed"]{--halo:1;--neon:1;--shade:0;--gold:1;--goldR:1;--lab:1}
.bz[data-state="open"] .bz-halo,.bz[data-state="test"] .bz-halo{animation:bz-pulse 1.7s ease-in-out .7s infinite}
.bz[data-state="open"] .bz-wave,.bz[data-state="test"] .bz-wave{animation:bz-ignite .85s ease-out .3s 1 both}
.bz[data-state="open"] .bz-sparks i,.bz[data-state="test"] .bz-sparks i,.bz[data-state="win"] .bz-sparks i{animation:bz-twinkle 2.6s ease-in-out var(--d) infinite}
.bz[data-state="open"] .f1,.bz[data-state="open"] .f2,.bz[data-state="test"] .f1,.bz[data-state="win"] .f1,.bz[data-state="win"] .f2{opacity:1;animation:bz-flow 3.2s linear infinite}
.bz[data-state="open"] .f2,.bz[data-state="win"] .f2{animation-duration:2.4s;animation-direction:reverse}
.bz[data-state="pressed"],.bz.is-press{--domeS:.92;--domeY:.16em}
.bz[data-state="pressed"] .bz-flash,.bz.is-press .bz-flash{animation:bz-flash .32s ease-out 1 both}
.bz.is-press .bz-halo{transform:scale(.9);transition:transform .1s}
.bz[data-state="sent"] .bz-halo{opacity:.75}
.bz[data-state="sent"] .bz-scan{opacity:1;animation:bz-spin .9s linear infinite}
.bz[data-state="win"]{--hc:236,196,84;--halo:1;--neon:1;--shade:0;--gold:1;--goldR:1;--lab:1;--neonA:#fff3c4;--neonB:#d4af37;--domeY:-.1em}
.bz[data-state="win"] .bz-wave{animation:bz-ignite 1.1s ease-out .05s 2 both}
.bz[data-state="win"] .bz-halo{animation:bz-pulse 1.2s ease-in-out .4s infinite}
.bz[data-state="rank"]{--halo:.55;--neon:.8;--shade:.12;--gold:.7;--goldR:1;--lab:1}
.bz[data-state="late"]{--hc:110,124,170;--halo:.14;--neon:.2;--neonA:#94a3c4;--neonB:#64748b;--shade:.82;--shadeC:30,36,58;--goldR:.45;--lab:.5}
.bz[data-state="wrong"]{--hc:217,119,6;--halo:.16;--neon:.95;--neonA:#fde68a;--neonB:#f59e0b;--shade:.7;--goldR:.5;--lab:.5}
.bz[data-state="tested"]{--hc:212,175,55;--halo:.5;--neon:.7;--neonA:#fff3c4;--neonB:#d4af37;--shade:.1;--gold:.8;--goldR:1;--lab:1}
.bz.bz-mini .bz-orbit,.bz.bz-mini .bz-sparks{display:none}
.bz.bz-mini .bz-halo{inset:-14%}
@keyframes bz-breathe{0%,100%{opacity:.04}50%{opacity:.17}}
@keyframes bz-pulse{0%,100%{transform:scale(1);opacity:.82}50%{transform:scale(1.09);opacity:1}}
@keyframes bz-ignite{0%{transform:scale(.85);opacity:.95}100%{transform:scale(1.75);opacity:0}}
@keyframes bz-twinkle{0%,100%{opacity:0;scale:.4}45%{opacity:1;scale:1.25}}
@keyframes bz-flow{to{stroke-dashoffset:-376}}
@keyframes bz-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes bz-spin{to{transform:rotate(360deg)}}

/* Logo validé : titre de la carte, Lilita One + Kaushan Script */
.abz{position:relative;display:inline-flex;flex-direction:column;align-items:center;line-height:1;font-size:var(--fs,64px);isolation:isolate}
.abz-t{font-family:var(--font-bz-title),"Arial Black",sans-serif;text-transform:uppercase;white-space:nowrap;display:flex;align-items:flex-end;transform:rotate(-3.5deg);letter-spacing:.01em}
.abz .a,.abz .b{position:relative;display:inline-block;-webkit-text-stroke:.06em #fff8ea}
.abz .b{font-size:1.1em;margin-left:.03em}
.abz .a{color:#fff3e6;text-shadow:.014em .03em 0 #e9d5ff,.028em .06em 0 #b77cf7,.042em .09em 0 #8b47ee,.056em .12em 0 #6425c9,.07em .15em 0 #43108f,.084em .18em 0 #2a0a5e,.1em .24em .14em rgba(0,0,0,.6),0 0 .4em rgba(168,85,247,.55)}
.abz .b{color:#ffb12e;text-shadow:.014em .03em 0 #ffd9a0,.028em .06em 0 #c785f5,.042em .09em 0 #9a4ff0,.056em .12em 0 #6c28cf,.07em .15em 0 #481193,.084em .18em 0 #2c0a62,.1em .24em .14em rgba(0,0,0,.6),0 0 .45em rgba(255,170,40,.55)}
.abz .a::after,.abz .b::after{content:attr(data-t);position:absolute;left:0;top:0;-webkit-text-stroke:0;text-shadow:none;color:transparent;-webkit-background-clip:text;background-clip:text}
.abz .a::after{background-image:linear-gradient(180deg,#ffffff 0%,#fffaf0 42%,#ffe2c4 100%)}
.abz .b::after{background-image:linear-gradient(180deg,#fff58a 0%,#ffd23b 34%,#ffa726 70%,#ff7d14 100%)}
.abz .rays{position:absolute;right:-.5em;top:-.42em;width:.62em;height:.62em;overflow:visible}
.abz .rays path{stroke:#ffd25a;stroke-width:7;stroke-linecap:round;fill:none;filter:drop-shadow(0 0 3px rgba(255,190,60,.9))}
.abz .rays circle{fill:#fff6d5;filter:drop-shadow(0 0 4px #ffc940)}
.abz .swoosh{position:absolute;left:-6%;top:28%;width:111%;height:86%;z-index:-1;overflow:visible}
.abz .swoosh ellipse{fill:none;stroke:#e7b84a;stroke-width:1.4;opacity:.75;filter:drop-shadow(0 0 3px rgba(231,184,74,.7))}
.abz-s{font-family:var(--font-bz-script),"Brush Script MT",cursive;font-size:.44em;line-height:1.1;color:#f3c75a;transform:rotate(-3.5deg) translate(.3em,-.06em);text-shadow:0 .03em 0 #7a4f0c,0 0 .3em rgba(243,199,90,.45);white-space:nowrap;padding:0 .2em}
.abz.sm .a,.abz.sm .b{-webkit-text-stroke:.022em #fff8ea}
.abz.sm .a{text-shadow:.025em .05em 0 #8b47ee,.05em .1em 0 #43108f}
.abz.sm .b{text-shadow:.025em .05em 0 #9a4ff0,.05em .1em 0 #481193}
.abz.sm .rays,.abz.sm .swoosh{display:none}
.abz.sm .abz-t{transform:rotate(-2.5deg)}
.abz.sm .abz-s{text-shadow:0 .03em 0 #7a4f0c;transform:rotate(-2.5deg)}
.abz.nosub .abz-s{display:none}

@media (prefers-reduced-motion:reduce){
  .bz *,.bzs *{animation:none!important;transition-duration:.01s!important}
}
`
