'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : scène de tirage du grand écran (1920×1080).
// Pendant l'extrait : « Morceau n° X », égaliseur, jamais le titre (l'état
// public ne le contient pas). À la révélation : le titre en grand quelques
// secondes, puis la liste des titres de la partie (joués allumés).
// Tout se déduit de l'état public et de l'heure du serveur (rechargement sûr).

import type { CSSProperties } from 'react'
import type { PublicTitle } from '@/lib/bingo/music'
import type { BingoPublicState } from '@/lib/bingo/types'

type Live = Extract<BingoPublicState, { active: true }>

/** Durée du titre en grand après sa révélation. */
const TITLE_HERO_MS = 6000

function Equalizer({ big = false }: { big?: boolean }) {
  return (
    <div className={`meq ${big ? 'big' : ''}`} aria-hidden="true">
      {Array.from({ length: 13 }, (_, i) => <i key={i} style={{ '--k': i } as CSSProperties} />)}
    </div>
  )
}

/** Liste des titres de la partie : joués allumés (numéro d'ordre), dernier en or. */
export function MusicList({ titles, n, drawn, full = false }: { titles: readonly PublicTitle[] | null; n: number; drawn: readonly number[]; full?: boolean }) {
  const order = new Map(drawn.map((x, i) => [x, i + 1]))
  const last = drawn.length ? drawn[drawn.length - 1] : null
  // Tout doit tenir sans défiler (90 titres au plus) : colonnes et taille selon le nombre.
  const cols = full ? (n > 60 ? 5 : n > 40 ? 4 : 3) : n > 40 ? 3 : 2
  const fs = full ? (n > 60 ? 18 : 22) : n > 60 ? 14 : n > 40 ? 16 : n > 30 ? 17 : 20
  const rows = Math.max(1, Math.ceil(n / cols))
  // Hauteur fixe (au-dessus de la barre du bas) partagée en lignes égales : jamais de débordement.
  return (
    <ol className={`mlist ${full ? 'full' : ''}`} style={{ '--cols': cols, '--rows': rows, '--fs': `${fs}px` } as CSSProperties} data-testid="screen-titles">
      {Array.from({ length: n }, (_, i) => {
        const k = i + 1
        const at = order.get(k)
        return (
          <li key={k} className={k === last ? 'last' : at ? 'on' : ''}>
            <span className="k">{at ?? ''}</span>
            <b>{titles?.[i]?.t ?? '…'}</b>
          </li>
        )
      })}
    </ol>
  )
}

export function MusicDrawing({ s, titles, now }: { s: Live; titles: readonly PublicTitle[] | null; now: number }) {
  const n = s.music?.n ?? 0
  const hidden = !!s.hidden
  const reveal = s.revealAt ? Date.parse(s.revealAt) : 0
  const hero = !hidden && !!s.last && now < reveal + TITLE_HERO_MS
  const t = s.last ? titles?.[s.last - 1] ?? null : null

  if (s.display.screen === 'board') {
    return (
      <div className="fullboard">
        <div className="panel">
          <h3><span>TITRES DE LA PARTIE</span><span><b>{s.count}</b> / {n}{hidden ? <> · morceau n° <b>{s.count + 1}</b> en cours</> : null}</span></h3>
          <MusicList titles={titles} n={n} drawn={s.drawn} full />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`mnow ${hidden ? 'listening' : hero ? 'hero' : ''}`} data-testid={hidden ? 'screen-listening' : hero ? 'screen-hero' : 'screen-now'} key={`${s.gameId}-${s.count}-${hidden ? 'h' : 'v'}`}>
        {hidden ? (
          <>
            <div className="tag">MORCEAU N° {s.count + 1}</div>
            <Equalizer big />
            <h2 className="gold-text">Quel est ce titre ?</h2>
            <p>Écoutez bien… et cochez-le si vous l’avez !</p>
          </>
        ) : s.last ? (
          <>
            <div className="tag">{hero ? `MORCEAU N° ${s.count}` : 'DERNIER TITRE'}</div>
            {hero && <Equalizer />}
            <h2 className="gold-text mtitle">{t?.t ?? '…'}</h2>
            {t?.a && <p className="artist">{t.a}</p>}
          </>
        ) : (
          <>
            <div className="tag">LOTO MUSICAL</div>
            <Equalizer />
            <h2 className="gold-text">Le premier morceau arrive…</h2>
          </>
        )}
      </div>
      <div className="panel">
        <h3><span>TITRES DE LA PARTIE</span><span><b>{s.count}</b> / {n}</span></h3>
        <MusicList titles={titles} n={n} drawn={s.drawn} />
      </div>
    </>
  )
}
