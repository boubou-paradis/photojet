'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — scènes du grand écran (maquette validée, 1920×1080).
// Tout se déduit de l'état public et de l'heure du serveur : un rechargement
// affiche exactement le même moment, sans rejouer d'animation passée.
//   tirage  : la machine s'emballe jusqu'à revealAt, puis la boule héros
//             s'affiche HERO_MS, puis elle se pose dans le berceau ;
//   B       : tableau des 90 en grand (réglage public.screen = 'board') ;
//   checking / celebrating / phase suivante / fin : moments plein écran.

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import QRCode from '@/components/QRCode'
import { PHASE_LABELS } from '@/lib/bingo/constants'
import { inWords, lotInfo, nextPhase } from '@/lib/bingo/display'
import type { BingoPublicState, BingoWinner, Phase } from '@/lib/bingo/types'
import { getInviteUrl } from '@/lib/utils'
import { Ball, Board } from '../Ball'
import { GoldRings, Machine, rng } from './Machine'
import { MusicDrawing } from './MusicScreen'
import type { PublicTitle } from '@/lib/bingo/music'

export type Live = Extract<BingoPublicState, { active: true }>

/** Durée d'affichage de la boule héros après son apparition. */
export const HERO_MS = 5500

const PHASE_SUB: Record<Phase, string> = { quine: '1 ligne', double: '2 lignes', plein: '15 numéros' }
const ANNOUNCED: Record<Phase, string> = { quine: 'QUINE ANNONCÉE !', double: 'DOUBLE QUINE ANNONCÉE !', plein: 'CARTON PLEIN ANNONCÉ !' }
const PHASE_RULE: Record<Phase, string> = { quine: 'Une ligne complète sur un carton', double: 'Deux lignes complètes sur le même carton', plein: 'Les 15 numéros d’un carton' }

type Beam = [number, number, '' | 'v']
const DEFAULT_BEAMS: Beam[] = [[260, -14, ''], [620, 10, 'v'], [1280, -10, 'v'], [1640, 14, '']]

function Decor({ beams = DEFAULT_BEAMS, opacity = 0.55, dust = false, gold = false }: { beams?: Beam[]; opacity?: number; dust?: boolean; gold?: boolean }) {
  const specks = useMemo(() => {
    if (!dust) return []
    const r = rng(9)
    return Array.from({ length: 40 }, (_, i) => ({ i, left: r() * 1920, top: r() * 900, o: 0.15 + r() * 0.4 }))
  }, [dust])
  return (
    <>
      <div className={`bg ${gold ? 'goldbg' : ''}`} />
      <div className="beams">
        {beams.map(([x, a, v], i) => <div key={i} className={`beam ${v}`} style={{ left: x, transform: `rotate(${a}deg)`, '--bo': opacity } as CSSProperties} />)}
      </div>
      <div className="floor" />
      {specks.map((s) => <i key={s.i} className="dust" style={{ left: s.left, top: s.top, opacity: s.o }} />)}
    </>
  )
}

function Confetti({ n = 140, gold = false }: { n?: number; gold?: boolean }) {
  const pieces = useMemo(() => {
    const r = rng(gold ? 12 : 5)
    const cols = gold ? ['#f6e3a1', '#d4af37', '#fff6d2', '#b8901f', '#a66bff'] : ['#f6e3a1', '#d4af37', '#a66bff', '#8b4dff', '#ffffff', '#e0682a']
    return Array.from({ length: n }, (_, i) => ({
      i,
      style: {
        left: r() * 1920,
        background: cols[Math.floor(r() * cols.length)],
        '--d': `${(4 + r() * 4).toFixed(1)}s`,
        '--w': `${(-r() * 8).toFixed(1)}s`,
        '--x': `${Math.round(r() * 160 - 80)}px`,
        '--r': `${Math.round(r() * 900 - 450)}deg`,
        opacity: 0.5 + r() * 0.5,
        scale: (0.6 + r() * 0.8).toFixed(2),
      } as CSSProperties,
    }))
  }, [n, gold])
  return <div className="confetti">{pieces.map((p) => <i key={p.i} style={p.style} />)}</div>
}

function TopBar({ s, name }: { s: Live; name: string }) {
  const phase = s.phaseIndex < s.phases.length ? s.phases[s.phaseIndex] : null
  const left = phase ? s.phases.length - s.phaseIndex - 1 : 0
  const lot = lotInfo(s)
  return (
    <div className="top">
      <div className="brand">
        <Ball n={77} size={58} label="AnimaBingo" />
        <div><b className="gold-text">ANIMABINGO</b><small>ANIMAJET</small></div>
      </div>
      {phase && (
        <div className="plate phase" data-testid="screen-phase-plate">
          <span className="gold-text">{PHASE_LABELS[phase].toUpperCase()}</span>
          {lot.n > 1 ? <em data-testid="screen-lot">· LOT {lot.now} / {lot.n}</em> : <em>· {PHASE_SUB[phase]}</em>}
        </div>
      )}
      <div className="event">
        <b>{name}</b>
        Partie {s.round} · {left === 0 ? 'dernière étape' : `${left} étape${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`}
      </div>
    </div>
  )
}

function BottomBar({ s, code, count, recentFrom, titles = null }: { s: Live; code: string; count: number; recentFrom: readonly number[]; titles?: readonly PublicTitle[] | null }) {
  const recent = recentFrom.slice(-6, -1).reverse()
  const total = s.music?.n ?? 90
  const status = s.status === 'checking' || s.autoMode === 'paused'
    ? <div className="status pause"><i />EN PAUSE</div>
    : s.autoMode === 'auto'
      ? <div className="status"><i />TIRAGE AUTO · {Math.round(s.autoMs / 1000)} s</div>
      : <div className="status"><i />TIRAGE MANUEL</div>
  return (
    <div className="bottom">
      <div className="count">
        <small>{s.music ? 'MORCEAUX JOUÉS' : 'BOULES SORTIES'}</small>
        <b>{count}</b><span>/ {total}</span>
        <div className="bar"><i style={{ width: `${(count / total) * 100}%` }} /></div>
      </div>
      <div className="recent">
        <small>PRÉCÉDENT{s.music ? 'S' : 'ES'}</small>
        {s.music
          ? recent.slice(0, 3).map((n, i) => <div key={n} className="rtitle" style={{ opacity: 1 - i * 0.2 }}>{titles?.[n - 1]?.t ?? '…'}</div>)
          : recent.map((n, i) => <div key={n} style={{ opacity: 1 - i * 0.14 }}><Ball n={n} size={60} /></div>)}
      </div>
      {status}
      <div className="join">
        <div className="qr-mini"><QRCode value={getInviteUrl(code)} size={128} level="M" fgColor="#0a0a14" style={{ width: '100%', height: 'auto' }} /></div>
        <div>Rejoindre la partie<b>{code}</b></div>
      </div>
    </div>
  )
}

function Panel({ drawn, last }: { drawn: readonly number[]; last: number | null }) {
  return (
    <div className="panel">
      <h3><span>NUMÉROS SORTIS</span><span><b>{drawn.length}</b> / 90</span></h3>
      <Board drawn={drawn} last={last} />
    </div>
  )
}

function winnerLabel(w: BingoWinner, showName: boolean) {
  return showName && w.name ? w.name : w.kind === 'paper' ? 'Carton papier' : `Carton n° ${w.serial}`
}
function winnerSub(w: BingoWinner) {
  return `CARTON ${w.kind === 'paper' ? 'PAPIER ' : ''}N° ${w.serial}`
}

// ------------------------------------------------------------------ scènes

function Lobby({ s, code }: { s: Live; code: string }) {
  const music = !!s.music
  return (
    <>
      <Decor dust />
      <div className="title"><h1 className="gold-text">ANIMABINGO</h1><p>{music ? 'LE LOTO MUSICAL VA COMMENCER' : 'LE GRAND TIRAGE VA COMMENCER'}</p></div>
      <Machine x={640} y={250} scale={0.92} mode="idle" drawn={s.drawn} seed={4} />
      <div className="ready">
        <b className="gold-text" data-testid="screen-players">{s.players}</b>
        <span>{s.players > 1 ? 'JOUEURS PRÊTS' : 'JOUEUR PRÊT'}</span>
        <p>Chacun reçoit son carton sur son téléphone.<br />{music ? 'Reconnaissez les chansons, cochez les titres, criez' : 'Cochez vous-même, criez'} « {PHASE_LABELS[s.phases[0] ?? 'quine'].toUpperCase()} ! » avant les autres.</p>
        <div className="pills">{s.phases.map((p) => <span key={p}>{PHASE_LABELS[p]}</span>)}</div>
      </div>
      <div className="qrcard">
        <div className="qr"><QRCode value={getInviteUrl(code)} size={300} level="M" fgColor="#0a0a14" style={{ width: '100%', height: 'auto' }} /></div>
        <h2>Scannez pour recevoir<br />votre carton</h2>
        <div className="code">Code de la soirée : <b>{code}</b></div>
      </div>
    </>
  )
}

function Drawing({ s, name, code, now, titles }: { s: Live; name: string; code: string; now: number; titles: readonly PublicTitle[] | null }) {
  if (s.music) {
    return (
      <>
        <Decor opacity={s.hidden ? 0.9 : 0.6} />
        <TopBar s={s} name={name} />
        <MusicDrawing s={s} titles={titles} now={now} />
        <BottomBar s={s} code={code} count={s.count} recentFrom={s.drawn} titles={titles} />
      </>
    )
  }
  const reveal = s.revealAt ? Date.parse(s.revealAt) : 0
  const spinning = !!s.last && now < reveal
  const hero = !!s.last && now >= reveal && now < reveal + HERO_MS
  // Pendant que la machine tourne, la nouvelle boule n'est pas encore « sortie » à l'écran.
  const shown = spinning ? s.drawn.slice(0, -1) : s.drawn
  const shownLast = spinning ? (shown[shown.length - 1] ?? null) : s.last
  const nextAt = s.autoMode === 'auto' && s.status === 'running' && s.lastDrawAt ? Date.parse(s.lastDrawAt) + s.autoMs : null
  const secs = nextAt ? Math.max(0, Math.ceil((nextAt - now) / 1000)) : null

  if (s.display.screen === 'board') {
    return (
      <>
        <Decor opacity={0.4} />
        <TopBar s={s} name={name} />
        <div className="fullboard">
          <div className="panel">
            <h3><span>NUMÉROS SORTIS</span><span><b>{shown.length}</b> / 90{shownLast ? <> · dernier : <b>{shownLast}</b></> : null}</span></h3>
            <Board drawn={shown} last={shownLast} />
          </div>
        </div>
        <BottomBar s={s} code={code} count={shown.length} recentFrom={shown} />
      </>
    )
  }

  return (
    <>
      <Decor opacity={spinning ? 0.9 : hero ? 0.8 : 0.55} />
      <TopBar s={s} name={name} />
      {hero && s.last ? (
        <>
          <Machine x={230} y={330} scale={0.78} mode="idle" drawn={s.drawn} seed={3} style={{ opacity: 0.14, filter: 'saturate(.6)' }} />
          <div className="hero" data-testid="screen-hero" key={`${s.gameId}-${s.count}`}>
            <div className="rays" /><div className="halo" />
            <div style={{ position: 'relative' }}><Ball n={s.last} size={520} /></div>
            <div className="words gold-text">{inWords(s.last)}</div>
          </div>
        </>
      ) : (
        <>
          <Machine x={250} y={150} mode={spinning ? 'hot' : 'idle'} drawn={s.drawn} seed={spinning ? 8 : 3} cradle={spinning ? null : s.last} />
          {secs !== null && !spinning && <div className="next">PROCHAINE BOULE DANS <b>{secs}</b></div>}
        </>
      )}
      <Panel drawn={shown} last={shownLast} />
      <BottomBar s={s} code={code} count={shown.length} recentFrom={shown} />
    </>
  )
}

function Checking({ s, code, titles }: { s: Live; code: string; titles: readonly PublicTitle[] | null }) {
  const phase = s.phases[s.phaseIndex] ?? 'quine'
  return (
    <>
      <Decor opacity={0.25} />
      <Machine x={640} y={210} mode="freeze" drawn={s.drawn} seed={3} style={{ opacity: 0.5 }} />
      <div className="veil" />
      <div className="pulse-ring" />
      <div className="moment" data-testid="screen-checking">
        {s.last && <div className="tag amber">{s.music ? `MORCEAU N° ${s.count}` : `BOULE N° ${s.count} · LE ${s.last}`}</div>}
        <h2 style={{ color: '#ffe3ae' }}>{ANNOUNCED[phase]}</h2>
        <div className="sub">Vérification en cours…</div>
        <div className="dots"><i /><i /><i /></div>
      </div>
      <BottomBar s={s} code={code} count={s.count} recentFrom={s.drawn} titles={titles} />
    </>
  )
}

function Celebrating({ s }: { s: Live }) {
  const phase = s.phases[s.phaseIndex] ?? 'quine'
  const all = s.winners.filter((w) => w.phase === phase)
  // Quine suivie : on fête le lot qui vient de tomber ; les lots d'avant restent listés en bas.
  const top = Math.max(0, ...all.map((w) => w.lot ?? 0))
  const winners = top ? all.filter((w) => (w.lot ?? 0) === top) : all
  const earlier = top ? all.filter((w) => (w.lot ?? 0) < top) : []
  const lot = lotInfo(s)
  const next = nextPhase(s)
  const showName = s.display.showName !== false
  const at = winners[winners.length - 1]?.drawCount ?? s.count
  const ball = s.drawn[at - 1]
  const plein = phase === 'plein'
  const title = `${PHASE_LABELS[phase].toUpperCase()} !`
  return (
    <>
      <Decor gold={plein} opacity={1} beams={[[200, -18, ''], [520, -6, ''], [860, 0, 'v'], [1180, 6, ''], [1500, 16, '']]} />
      {plein && <Machine x={640} y={170} mode="gold" drawn={s.drawn} seed={5} style={{ opacity: 0.55 }} />}
      <div className="veil" style={{ opacity: 0.6 }} />
      <Confetti n={plein ? 220 : 140} gold={plein} />
      <div className="moment" data-testid="screen-winner">
        <div className={`tag ${plein ? 'gold' : ''}`}>
          {plein ? 'GRAND FINAL · ' : ''}{lot.n > 1 ? `LOT ${top || lot.now} / ${lot.n} · ` : ''}{s.music ? `MORCEAU N° ${at}` : `BOULE N° ${at}${ball ? ` · LE ${ball}` : ''}`}{winners.length > 1 ? ` · ${winners.length} GAGNANTS` : ''}
        </div>
        <h1 className="gold-text" style={{ marginTop: 22, fontSize: plein ? 176 : winners.length > 1 ? 170 : 200 }}>{title}</h1>
        {winners.length <= 1 ? (
          winners[0] && (
            <div className="winner" style={plein ? { boxShadow: '0 0 0 3px #f6e3a1, 0 0 140px rgba(246,210,110,.6)' } : undefined}>
              <b>{winnerLabel(winners[0], showName)}</b>
              <span>{winnerSub(winners[0])}</span>
            </div>
          )
        ) : (
          <div className="wgrid">
            {winners.slice(0, 8).map((w, i) => (
              <div key={i} className="wcard" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                <b>{winnerLabel(w, showName)}</b><span>{winnerSub(w)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="sub" data-testid="screen-next">
          {lot.done && next
            ? <>Prochaine étape : <b className="gold-text">{PHASE_LABELS[next].toUpperCase()}</b></>
            : !lot.done && lot.n > 1
              ? `Félicitations ! Prochain lot : ${Math.min(lot.n, lot.used + 1)} / ${lot.n}`
              : plein || !next ? 'Bravo, et merci à tous d’avoir joué !' : winners.length > 1 ? 'Félicitations aux gagnants !' : 'Félicitations !'}
        </div>
        {earlier.length > 0 && (
          <div className="wlist" data-testid="screen-earlier">
            {earlier.slice(-8).map((w, i) => <span key={i}><small>LOT {w.lot}</small>{winnerLabel(w, showName)}</span>)}
          </div>
        )}
      </div>
    </>
  )
}

function NextPhase({ s }: { s: Live }) {
  const phase = s.phases[s.phaseIndex]
  const prev = s.phases[s.phaseIndex - 1]
  if (!phase) return null
  return (
    <>
      <Decor opacity={0.7} />
      <div className="veil" style={{ opacity: 0.5 }} />
      <div className="rings-big"><GoldRings w={1300} h={1000} tilt1={-12} tilt2={78} /></div>
      <div className="moment" data-testid="screen-phase">
        <div className="tag">{prev ? `${PHASE_LABELS[prev].toUpperCase()} TERMINÉE · ` : ''}PROCHAINE ÉTAPE</div>
        <div className="plate" style={{ marginTop: 40, padding: '26px 80px' }}>
          <h1 className="gold-text" style={{ fontSize: 150, filter: 'none' }}>{PHASE_LABELS[phase].toUpperCase()}</h1>
        </div>
        <div className="sub" style={{ marginTop: 34 }}>{PHASE_RULE[phase]}</div>
      </div>
    </>
  )
}

function Finished({ s }: { s: Live }) {
  const showName = s.display.showName !== false
  return (
    <>
      <Decor opacity={0.8} />
      <div className="veil" style={{ opacity: 0.55 }} />
      <Confetti n={90} gold />
      <div className="moment" data-testid="screen-finished">
        <div className="tag gold">PARTIE TERMINÉE · {s.count} {s.music ? 'MORCEAUX' : 'BOULES'}</div>
        <h1 className="gold-text" style={{ marginTop: 22, fontSize: 150 }}>MERCI À TOUS !</h1>
        {s.winners.length > 0 && (
          <div className="wgrid">
            {s.winners.slice(0, 12).map((w, i) => (
              <div key={i} className="wcard" style={{ animationDelay: `${0.2 + i * 0.1}s`, minWidth: 320 }}>
                <small>{PHASE_LABELS[w.phase]}{w.lot && (s.lots?.[s.phases.indexOf(w.phase)] ?? 1) > 1 ? ` · LOT ${w.lot}` : ''}</small>
                <b style={{ fontSize: 44 }}>{winnerLabel(w, showName)}</b>
                <span>{winnerSub(w)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function BingoScreen({ s, name, code, now, phaseIntro, titles = null }: {
  s: Live
  name: string
  code: string
  /** Heure du serveur (ms). */
  now: number
  /** Changement de phase vu en direct : écran « prochaine étape » quelques secondes. */
  phaseIntro: boolean
  /** Loto musical : titres de la partie (null = numéros ou pas encore chargés). */
  titles?: readonly PublicTitle[] | null
}) {
  let scene: ReactNode
  if (s.status === 'lobby') scene = <Lobby s={s} code={code} />
  else if (s.status === 'checking') scene = <Checking s={s} code={code} titles={titles} />
  else if (s.status === 'celebrating') scene = <Celebrating s={s} />
  else if (s.status === 'finished') scene = <Finished s={s} />
  else if (phaseIntro) scene = <NextPhase s={s} />
  else scene = <Drawing s={s} name={name} code={code} now={now} titles={titles} />
  return <div className="stage" data-scene={s.status}>{scene}</div>
}
