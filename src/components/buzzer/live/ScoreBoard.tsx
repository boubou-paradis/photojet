// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — classement sur l'écran géant : affiché quand l'animateur le
// demande (hors buzzers ouverts) et à la fin des manches préparées s'il y a
// des points. Les 10 premiers, lisibles à 10 m (tout en cqw, scène 16:9).

import AnimaBuzzLogo from '@/components/buzzer/AnimaBuzzLogo'
import { formatPoints, type ScoresActiveState } from '@/lib/buzzer/scores'

export const SCOREBOARD_CSS = `
.bzb{position:absolute;left:14cqw;right:14cqw;top:9.5cqw;bottom:3.5cqw;display:flex;flex-direction:column;gap:.75cqw;z-index:2}
.bzb-title{text-align:center;font:400 3.6cqw var(--font-bz-display),sans-serif;color:#f3d77a;letter-spacing:.06em;text-shadow:0 0 2cqw rgba(212,175,55,.45);margin-bottom:.6cqw;animation:bzs-fadeup .5s ease-out both}
.bzb-row{display:grid;grid-template-columns:5cqw 1fr auto;align-items:center;gap:1.6cqw;padding:.55cqw 1.8cqw;border-radius:1.2cqw;background:rgba(255,255,255,.05);border:.12cqw solid rgba(255,255,255,.08);animation:bzs-fadeup .45s ease-out both}
.bzb-row .r{font:400 2.4cqw var(--font-bz-display),sans-serif;color:#a59fc0;text-align:center}
.bzb-row .n{font:700 2.3cqw var(--font-inter),sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bzb-row .p{font:400 2.3cqw var(--font-bz-display),sans-serif;color:#fff;font-variant-numeric:tabular-nums}
.bzb-row.g1{background:linear-gradient(90deg,rgba(212,175,55,.32),rgba(212,175,55,.08));border-color:#d4af37;padding:.9cqw 1.8cqw}
.bzb-row.g1 .r,.bzb-row.g1 .p{color:#f3d77a}.bzb-row.g1 .n{font-size:2.9cqw}.bzb-row.g1 .r,.bzb-row.g1 .p{font-size:2.9cqw}
.bzb-row.g2{border-color:rgba(226,232,240,.6)}.bzb-row.g2 .r{color:#e2e8f0}
.bzb-row.g3{border-color:rgba(205,127,50,.7)}.bzb-row.g3 .r{color:#e0a46a}
.bzb-empty{text-align:center;font:500 2cqw var(--font-inter),sans-serif;color:#a59fc0;margin-top:4cqw}
`

export default function ScoreBoard({ scores, title }: { scores: ScoresActiveState; title: string }) {
  const top = scores.scores.slice(0, 10)
  return (
    <div key={`board-${title}`} style={{ display: 'contents' }}>
      <div className="bzs-top"><AnimaBuzzLogo variant="small" subtitle={false} size="2.3cqw" /><span /></div>
      <div className="bzb" data-testid="scoreboard">
        <div className="bzb-title">{title}</div>
        {top.length === 0 ? (
          <p className="bzb-empty">Aucun joueur pour l’instant.</p>
        ) : (
          top.map((s, i) => (
            <div key={s.unit} className={`bzb-row${s.rank <= 3 ? ` g${s.rank}` : ''}`} style={{ animationDelay: `${0.08 * i}s` }}>
              <span className="r">{s.rank}</span>
              <span className="n">{s.label}</span>
              <span className="p">{formatPoints(s.points)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
