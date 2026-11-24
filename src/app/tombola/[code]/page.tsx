'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · Tombola — téléphone de l'invité. On y arrive par le QR de la
// soirée (/invite redirige ici). Aucune saisie : le téléphone reçoit un
// numéro de ticket, gardé avec un jeton secret (même jeton = même numéro,
// même après un rechargement, une panne ou la fin de la distribution).
// Pas de temps réel : état public relu toutes les 3 s (cache 1 s).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import '@/components/bingo/bingo.css'
import '@/components/bingo/tombola/tombola.css'
import { BINGO_PHONE_POLL_MS } from '@/lib/bingo/constants'
import { lotsGiven, tombolaStoreKey, type TombolaPublicState } from '@/lib/bingo/tombola'

interface Stored { token?: string; tombolaId?: string; number?: number }

function readStore(code: string): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(tombolaStoreKey(code)) ?? '{}') as Stored
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}
function writeStore(code: string, v: Stored) {
  try { localStorage.setItem(tombolaStoreKey(code), JSON.stringify(v)) } catch { /* stockage bloqué */ }
}

export default function TombolaPhonePage() {
  const params = useParams()
  const code = String(params.code ?? '').toUpperCase()
  const [pub, setPub] = useState<TombolaPublicState | null>(null)
  const [online, setOnline] = useState(true)
  const [mine, setMine] = useState<Stored>({})
  const [refused, setRefused] = useState<string | null>(null)
  const asking = useRef<string | null>(null)

  useEffect(() => {
    setMine(readStore(code))
  }, [code])

  // Relecture de l'état public (3 s), comme AnimaBingo.
  useEffect(() => {
    let off = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const res = await fetch(`/api/bingo/tombola/state?code=${encodeURIComponent(code)}`)
        if (res.ok) {
          const data = (await res.json()) as TombolaPublicState
          if (!off) {
            setPub(data)
            setOnline(true)
          }
        } else if (!off) setOnline(false)
      } catch {
        if (!off) setOnline(false)
      }
      if (!off) timer = setTimeout(load, BINGO_PHONE_POLL_MS)
    }
    void load()
    return () => {
      off = true
      if (timer) clearTimeout(timer)
    }
  }, [code])

  const live = pub?.active ? pub : null
  const hasTicket = !!live && mine.tombolaId === live.tombolaId && typeof mine.number === 'number'

  // Ticket : demandé une fois par tombola (et de nouveau si l'animateur rouvre la distribution).
  const askTicket = useCallback(async (key: string) => {
    if (asking.current === key) return
    asking.current = key
    try {
      const res = await fetch('/api/bingo/tombola/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ...(mine.token ? { token: mine.token } : {}) }),
      })
      const data = (await res.json().catch(() => ({}))) as { token?: string; tombolaId?: string; number?: number; code?: string; error?: string }
      if (res.ok && data.token && data.tombolaId && typeof data.number === 'number') {
        const next = { token: data.token, tombolaId: data.tombolaId, number: data.number }
        writeStore(code, next)
        setMine(next)
        setRefused(null)
      } else {
        setRefused(data.code ?? 'error')
        if (res.status >= 500 || res.status === 429) asking.current = null // panne passagère : on réessaiera
      }
    } catch {
      asking.current = null
    }
  }, [code, mine.token])

  useEffect(() => {
    if (!live || hasTicket || live.phoneFrom === null) return
    // Distribution fermée : seul un téléphone qui a déjà un jeton peut retrouver son numéro.
    if (!live.phoneOpen && !mine.token) return
    void askTicket(`${live.tombolaId}|${live.phoneOpen}`)
  }, [live, hasTicket, mine.token, askTicket])

  const myNumber = hasTicket ? mine.number! : null
  const myDraw = live && myNumber !== null ? live.draws.find((d) => d.n === myNumber) ?? null : null
  const last = live && !live.hidden ? live.draws[live.draws.length - 1] ?? null : null

  // Vibration quand son numéro sort (une fois).
  const buzzed = useRef<string | null>(null)
  useEffect(() => {
    if (!myDraw || myDraw.o !== 'winner' || !live) return
    const k = `${live.tombolaId}|${myDraw.seq}`
    if (buzzed.current === k) return
    buzzed.current = k
    try { navigator.vibrate?.([200, 100, 200, 100, 400]) } catch { /* non pris en charge */ }
  }, [myDraw, live])

  // Heure qui tourne sur le ticket : une capture d'écran se repère.
  const [clock, setClock] = useState('')
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('fr-FR'))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const photos = <a className="link" href={`/invite/${encodeURIComponent(code)}?photos=1`}>Partager des photos</a>

  return (
    <main className="bgo tmb-phone" data-testid="tombola-phone">
      <div className="app">
        <div className="brand">ANIMABINGO · TOMBOLA</div>

        {myNumber !== null && (
          <div className="ticket" data-testid="phone-ticket">
            <i className="shine" />
            <div className="lbl">VOTRE TICKET</div>
            <div className="num gold-text" data-testid="phone-number">n° {myNumber}</div>
            <div className="foot">{myDraw?.o === 'winner' ? `Lot ${myDraw.lot} · ` : ''}Gardez cette page ouverte · {clock}</div>
          </div>
        )}

        {!pub ? (
          <p className="msg">Chargement de la tombola…</p>
        ) : !live ? (
          <div className="card msg" data-testid="phone-off">
            {pub.active === false && pub.held
              ? 'La tombola est en pause : elle reprend dans un instant.'
              : mine.number !== undefined ? 'La tombola est terminée. Merci et bonne soirée !' : 'Pas de tombola en cours pour le moment.'}
            <div style={{ marginTop: 12 }}>{photos}</div>
          </div>
        ) : myDraw ? (
          myDraw.o === 'winner' ? (
            <div className="win" data-testid="phone-win" role="status">
              <h2>🎉 Votre numéro est sorti !</h2>
              <p>Présentez-vous auprès de l’animateur avec ce téléphone.</p>
            </div>
          ) : (
            <div className="win off" data-testid="phone-absent" role="status">
              <p>{myDraw.o === 'absent' ? 'Votre numéro est sorti mais a été déclaré absent.' : 'Votre numéro est sorti, mais vous avez déjà gagné un lot.'}</p>
            </div>
          )
        ) : myNumber !== null ? (
          <p className="msg" data-testid="phone-wait">
            {live.draws.length === 0 && !live.hidden
              ? <>Le tirage n’a pas encore commencé.<br />Si votre numéro sort, ce téléphone vous prévient.</>
              : <>Tirage en cours : <b>{lotsGiven(live)} lot{lotsGiven(live) > 1 ? 's' : ''}</b> attribué{lotsGiven(live) > 1 ? 's' : ''}.{last && <><br />Dernier numéro sorti : <b>{last.n}</b></>}</>}
          </p>
        ) : live.phoneFrom === null ? (
          <div className="card msg" data-testid="phone-paper-only">
            Tombola avec tickets papier : suivez le tirage sur l’écran géant.
            {last && <><br />Dernier numéro sorti : <b>{last.n}</b></>}
            <div style={{ marginTop: 12 }}>{photos}</div>
          </div>
        ) : !live.phoneOpen || refused === 'closed' ? (
          <div className="card msg" data-testid="phone-closed">
            Le tirage a commencé : la distribution des tickets est terminée.<br />Bonne soirée ! 🎶
            <div style={{ marginTop: 12 }}>{photos}</div>
          </div>
        ) : refused === 'full' ? (
          <div className="card msg">Plus aucun ticket disponible.</div>
        ) : (
          <p className="msg">Votre ticket arrive…</p>
        )}

        {!online && <div className="reco" role="status">Reconnexion…</div>}
      </div>
    </main>
  )
}
