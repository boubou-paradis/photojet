// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Carton vu par la régie pendant une vérification : sorti + coché, sorti
// pas coché, coché à tort, lignes complètes entourées d'or.

import type { Cells, ClaimCheck } from '@/lib/bingo/types'

export function MiniCard({ cells, drawn, marks, check, legend = false, titles = null }: {
  cells: Cells
  drawn: readonly number[]
  marks: readonly number[]
  check: ClaimCheck | null
  legend?: boolean
  /** Loto musical : titres de la partie (case = rang 1…N). Les cases vides sont masquées. */
  titles?: readonly { t: string; a: string }[] | null
}) {
  const out = new Set(drawn)
  const mk = new Set(marks)
  return (
    <>
      <div className={`mc${titles ? ' music' : ''}`} aria-label="Carton vérifié">
        {[0, 1, 2].map((row) => (
          <div key={row} className={`r ${check?.lines[row]?.complete ? 'win' : ''}`}>
            {cells.slice(row * 9, row * 9 + 9).map((n, i) => {
              if (!n) return titles ? null : <div key={i} className="c e" />
              const cls = out.has(n) ? (mk.has(n) ? 'dm' : 'd') : mk.has(n) ? 'x' : 'n'
              const t = titles?.[n - 1]
              return <div key={i} className={`c ${cls}`} title={t ? `${t.t} · ${t.a}` : undefined}>{t ? t.t : n}</div>
            })}
          </div>
        ))}
      </div>
      {legend && (
        <div className="keys">
          <span className="k1">sorti + coché</span>
          <span className="k2">sorti, pas coché</span>
          <span className="k3">coché à tort</span>
          <span className="k4">ligne complète</span>
        </div>
      )}
    </>
  )
}
