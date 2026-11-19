// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Carton du téléphone (maquette validée) : 3 lignes × 9 cases, jetons violets
// cerclés d'or, avancement de chaque ligne à droite. `mini` = rappel dans les
// écrans de résultat (sans interaction).

import { rowProgress, rowsOf } from '@/lib/bingo/phone-view'
import type { StoredCard } from '@/lib/bingo/phone-store'
import type { PublicTitle } from '@/lib/bingo/music'

export function PhoneCard({ card, marks, wrong = [], onToggle, mini = false, frozen = false, titles = null }: {
  card: StoredCard
  marks: readonly number[]
  wrong?: readonly number[]
  onToggle?: (n: number) => void
  mini?: boolean
  frozen?: boolean
  /** Loto musical : titres de la partie (case = rang 1…N). */
  titles?: readonly PublicTitle[] | null
}) {
  const m = new Set(marks)
  const w = new Set(wrong)
  const prog = rowProgress(card.cells, marks)
  if (titles) return <MusicCard card={card} m={m} w={w} prog={prog} titles={titles} onToggle={onToggle} mini={mini} frozen={frozen} />
  const rows = (
    <div className="rows">
      {rowsOf(card.cells).map((row, ri) => (
        <div className="row" key={ri}>
          {row.map((n, ci) =>
            n === 0 ? (
              <div key={ci} className="cell empty" aria-hidden />
            ) : mini || !onToggle ? (
              <div key={ci} className={`cell n ${m.has(n) ? 'm' : ''} ${w.has(n) ? 'wrong' : ''}`}><span>{n}</span></div>
            ) : (
              <button
                key={ci}
                type="button"
                className={`cell n ${m.has(n) ? 'm' : ''} ${w.has(n) ? 'wrong' : ''}`}
                aria-pressed={m.has(n)}
                aria-label={`${n}${m.has(n) ? ', jeton posé' : ''}`}
                data-n={n}
                onClick={() => onToggle(n)}
                disabled={frozen}
              >
                <span>{n}</span>
              </button>
            ),
          )}
          {!mini && (
            <div className={`prog ${prog[ri] === 5 ? 'full' : ''}`} aria-label={`Ligne ${ri + 1} : ${prog[ri]} sur 5`}>
              {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < prog[ri] ? 'f' : ''} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
  if (mini) return <div className="mini">{rows}</div>
  return (
    <div className={`card ${frozen ? 'frozen' : ''}`} data-testid="phone-card">
      <div className="card-head"><span>ANIMABINGO</span><b>CARTON N° {card.serial}</b></div>
      {rows}
    </div>
  )
}

/**
 * Carton musical : 3 lignes de 5 titres. Sur un téléphone, 5 titres côte à
 * côte seraient illisibles : chaque ligne est un bloc de 5 boutons pleine
 * largeur (titre en gras, artiste en petit). Même jetons, même avancement.
 */
function MusicCard({ card, m, w, prog, titles, onToggle, mini, frozen }: {
  card: StoredCard
  m: ReadonlySet<number>
  w: ReadonlySet<number>
  prog: number[]
  titles: readonly PublicTitle[]
  onToggle?: (n: number) => void
  mini: boolean
  frozen: boolean
}) {
  const rows = (
    <div className="mrows">
      {rowsOf(card.cells).map((row, ri) => (
        <div className="mrow" key={ri}>
          <div className={`mrow-h ${prog[ri] === 5 ? 'full' : ''}`}>
            <span>Ligne {ri + 1}</span>
            <span className="prog" aria-label={`Ligne ${ri + 1} : ${prog[ri]} sur 5`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < prog[ri] ? 'f' : ''} />)}</span>
          </div>
          {row.filter(Boolean).map((n) => {
            const t = titles[n - 1]
            const cls = `mcell ${m.has(n) ? 'm' : ''} ${w.has(n) ? 'wrong' : ''}`
            const body = <><b>{t?.t ?? `Titre ${n}`}</b>{t?.a ? <small>{t.a}</small> : null}</>
            return mini || !onToggle ? (
              <div key={n} className={cls}>{body}</div>
            ) : (
              <button
                key={n}
                type="button"
                className={cls}
                aria-pressed={m.has(n)}
                aria-label={`${t?.t ?? `Titre ${n}`}${t?.a ? `, ${t.a}` : ''}${m.has(n) ? ', jeton posé' : ''}`}
                data-n={n}
                onClick={() => onToggle(n)}
                disabled={frozen}
              >
                {body}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
  if (mini) return <div className="mini music">{rows}</div>
  return (
    <div className={`card music ${frozen ? 'frozen' : ''}`} data-testid="phone-card">
      <div className="card-head"><span>LOTO MUSICAL</span><b>CARTON N° {card.serial}</b></div>
      {rows}
    </div>
  )
}
