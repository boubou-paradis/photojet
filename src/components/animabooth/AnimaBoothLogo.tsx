// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Logo AnimaBooth, de la même famille qu'AnimaBuzz (même police, même
// inclinaison, même relief violet) : « ANIMA » crème, « BOOTH » or-orange,
// éclats en flash d'appareil photo, sous-titre manuscrit.
// `full` : complet avec sous-titre. `small` : simplifié pour l'en-tête.
// Polices : poser `buzzerFontVars` sur un parent (Lilita One + Kaushan Script).

import type { CSSProperties } from 'react'

interface AnimaBoothLogoProps {
  variant?: 'full' | 'small'
  /** Afficher « La borne photo d'AnimaJet » sous le titre. */
  subtitle?: boolean
  /** Taille du titre (ex. « 22px »). */
  size: string
  className?: string
}

const CSS = `
.abt{position:relative;display:inline-flex;flex-direction:column;align-items:center;line-height:1;font-size:var(--fs,64px);isolation:isolate}
.abt-t{font-family:var(--font-bz-title),"Arial Black",sans-serif;text-transform:uppercase;white-space:nowrap;display:flex;align-items:flex-end;transform:rotate(-3.5deg);letter-spacing:.01em}
.abt .a,.abt .b{position:relative;display:inline-block;-webkit-text-stroke:.06em #fff8ea}
.abt .b{font-size:1.1em;margin-left:.03em}
.abt .a{color:#fff3e6;text-shadow:.014em .03em 0 #e9d5ff,.028em .06em 0 #b77cf7,.042em .09em 0 #8b47ee,.056em .12em 0 #6425c9,.07em .15em 0 #43108f,.084em .18em 0 #2a0a5e,.1em .24em .14em rgba(0,0,0,.6),0 0 .4em rgba(168,85,247,.55)}
.abt .b{color:#ffb12e;text-shadow:.014em .03em 0 #ffd9a0,.028em .06em 0 #c785f5,.042em .09em 0 #9a4ff0,.056em .12em 0 #6c28cf,.07em .15em 0 #481193,.084em .18em 0 #2c0a62,.1em .24em .14em rgba(0,0,0,.6),0 0 .45em rgba(255,170,40,.55)}
.abt .a::after,.abt .b::after{content:attr(data-t);position:absolute;left:0;top:0;-webkit-text-stroke:0;text-shadow:none;color:transparent;-webkit-background-clip:text;background-clip:text}
.abt .a::after{background-image:linear-gradient(180deg,#ffffff 0%,#fffaf0 42%,#ffe2c4 100%)}
.abt .b::after{background-image:linear-gradient(180deg,#fff58a 0%,#ffd23b 34%,#ffa726 70%,#ff7d14 100%)}
.abt .flash{position:absolute;right:-.55em;top:-.45em;width:.62em;height:.62em;overflow:visible}
.abt .flash path{stroke:#ffd25a;stroke-width:7;stroke-linecap:round;fill:none;filter:drop-shadow(0 0 3px rgba(255,190,60,.9))}
.abt .flash circle{fill:#fff6d5;filter:drop-shadow(0 0 4px #ffc940)}
.abt .swoosh{position:absolute;left:-6%;top:28%;width:111%;height:86%;z-index:-1;overflow:visible}
.abt .swoosh ellipse{fill:none;stroke:#e7b84a;stroke-width:1.4;opacity:.75;filter:drop-shadow(0 0 3px rgba(231,184,74,.7))}
.abt-s{font-family:var(--font-bz-script),"Brush Script MT",cursive;font-size:.44em;line-height:1.1;color:#f3c75a;transform:rotate(-3.5deg) translate(.3em,-.06em);text-shadow:0 .03em 0 #7a4f0c,0 0 .3em rgba(243,199,90,.45);white-space:nowrap;padding:0 .2em}
.abt.sm .a,.abt.sm .b{-webkit-text-stroke:.022em #fff8ea}
.abt.sm .a{text-shadow:.025em .05em 0 #8b47ee,.05em .1em 0 #43108f}
.abt.sm .b{text-shadow:.025em .05em 0 #9a4ff0,.05em .1em 0 #481193}
.abt.sm .flash,.abt.sm .swoosh{display:none}
.abt.sm .abt-t{transform:rotate(-2.5deg)}
.abt.sm .abt-s{text-shadow:0 .03em 0 #7a4f0c;transform:rotate(-2.5deg)}
.abt.nosub .abt-s{display:none}
`

export default function AnimaBoothLogo({ variant = 'full', subtitle = variant === 'full', size, className }: AnimaBoothLogoProps) {
  const classes = ['abt', variant === 'small' ? 'sm' : '', subtitle ? '' : 'nosub', className ?? ''].filter(Boolean).join(' ')
  return (
    <span className={classes} style={{ '--fs': size } as CSSProperties} role="img" aria-label="AnimaBooth, la borne photo d’AnimaJet">
      <style>{CSS}</style>
      <svg className="swoosh" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="100" cy="32" rx="98" ry="22" transform="rotate(-3 100 32)" />
      </svg>
      <span className="abt-t" aria-hidden>
        <span className="a" data-t="ANIMA">ANIMA</span>
        <span className="b" data-t="BOOTH">
          BOOTH
          <svg className="flash" viewBox="0 0 60 60">
            <path d="M8 40 L22 32" />
            <path d="M22 22 L30 8" />
            <path d="M38 26 L54 16" />
            <path d="M40 40 L56 42" />
            <circle cx="50" cy="6" r="3" />
          </svg>
        </span>
      </span>
      <span className="abt-s" aria-hidden>La borne photo d’AnimaJet</span>
    </span>
  )
}
