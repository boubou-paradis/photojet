'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Cartons papier : fabrication (PDF 6 par A4, numérotés), réimpression à
// tout moment (tout est en base, même après une panne) et vérification d'un
// numéro annoncé dans la salle.

import { useState } from 'react'
import { BINGO_PAPER_MAX_PER_BATCH } from '@/lib/bingo/constants'
import { verdictText } from '@/lib/bingo/display'
import { MUSIC_CARDS_PER_PAGE, buildMusicPaperPdf, buildPaperPdf, pagesFor, type PaperCard } from '@/lib/bingo/paper-pdf'
import type { PaperCheck } from '@/lib/bingo/server'
import type { BingoPublicState } from '@/lib/bingo/types'
import { callAdmin, type AdminResult } from './api'
import type { ConfirmRequest } from './ConfirmDialog'
import { MiniCard } from './MiniCard'

function download(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function PaperPanel({ sessionId, title, paper, state, onChanged, notify, askConfirm, canWin, titles = null, drawnFull, compact = false }: {
  /** Régie Direct : vérification seule ; fabrication et réimpression dans une fenêtre. */
  compact?: boolean
  sessionId: string
  title: string
  paper: { count: number; first: number | null; last: number | null }
  state: BingoPublicState | null
  onChanged: () => void
  notify: (text: string, kind?: 'error' | 'info') => void
  askConfirm: (r: ConfirmRequest) => void
  /** Une phase est en jeu : un carton papier valable peut être déclaré gagnant. */
  canWin: boolean
  /** Loto musical en cours : titres (cartons et PDF par titres, 4 par page). */
  titles?: readonly { t: string; a: string }[] | null
  /** Tirage complet vu par la régie (titre encore caché au public compris). */
  drawnFull?: readonly number[]
}) {
  const pages = (n: number) => (titles ? Math.ceil(n / MUSIC_CARDS_PER_PAGE) : pagesFor(n))
  const [count, setCount] = useState('60')
  const [busy, setBusy] = useState<string | null>(null)
  const [serial, setSerial] = useState('')
  const [result, setResult] = useState<PaperCheck | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)

  async function pdfOf(filter?: (c: PaperCard) => boolean, label = 'cartons') {
    const list = await callAdmin<{ cards: PaperCard[]; titles?: { t: string; a: string }[] | null }>(sessionId, { action: 'paper_list' })
    if (!list.ok || !list.data) {
      notify(list.error ?? 'Lecture des cartons impossible', 'error')
      return
    }
    const cards = filter ? list.data.cards.filter(filter) : list.data.cards
    if (!cards.length) {
      notify('Aucun carton papier à imprimer.', 'error')
      return
    }
    const t = list.data.titles
    download(t?.length ? await buildMusicPaperPdf(cards, t, title) : await buildPaperPdf(cards, title), `animabingo-${t?.length ? 'musical-' : ''}${label}.pdf`)
  }

  async function generate() {
    const n = Math.floor(Number(count))
    if (!Number.isFinite(n) || n < 1 || n > BINGO_PAPER_MAX_PER_BATCH) {
      notify(`Entre 1 et ${BINGO_PAPER_MAX_PER_BATCH} cartons à la fois.`, 'error')
      return
    }
    setBusy('add')
    try {
      const r = await callAdmin<{ first: number; last: number }>(sessionId, { action: 'paper_add', count: n })
      if (!r.ok || !r.data) {
        notify(r.error ?? 'Fabrication impossible', 'error')
        return
      }
      const { first, last } = r.data
      onChanged()
      await pdfOf((c) => c.serial >= first && c.serial <= last, `${first}-${last}`)
      notify(`${n} cartons créés (n° ${first} à ${last}).`)
    } finally {
      setBusy(null)
    }
  }

  async function check() {
    const n = Number(serial.trim())
    if (!Number.isInteger(n) || n < 1) return
    setBusy('check')
    const r: AdminResult<PaperCheck> = await callAdmin<PaperCheck>(sessionId, { action: 'paper_check', serial: n })
    setBusy(null)
    if (!r.ok || !r.data) {
      setResult(null)
      notify(r.status === 403 ? `Le carton n° ${n} n’existe pas dans cette session.` : (r.error ?? 'Vérification impossible'), 'error')
      return
    }
    setResult(r.data)
  }

  async function declare() {
    if (!result) return
    setBusy('win')
    const r = await callAdmin(sessionId, { action: 'paper_win', serial: result.serial })
    setBusy(null)
    if (!r.ok) notify(r.code === 'not_valid' ? 'Ce carton n’a pas la combinaison demandée.' : (r.error ?? 'Action impossible'), 'error')
    else {
      notify(`Carton n° ${result.serial} déclaré gagnant.`)
      setResult(null)
      setSerial('')
      onChanged()
    }
  }

  const drawn = drawnFull ?? (state?.active ? state.drawn : [])
  const verdict = result?.check && result.phase ? verdictText(result.check, result.phase) : null
  const tools = (
    <>
      <div className="field" style={{ marginTop: 14 }}>
        <input
          inputMode="numeric"
          autoComplete="off"
          name="nombre-cartons"
          aria-label="Nombre de cartons papier à fabriquer"
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 3))}
          style={{ maxWidth: 90, textAlign: 'center', fontWeight: 700 }}
          data-testid="paper-count"
        />
        <button className="btn" onClick={() => void generate()} disabled={busy !== null} data-testid="paper-add">
          {busy === 'add' ? 'Fabrication…' : `Fabriquer (PDF, ${pages(Number(count) || 0)} page${pages(Number(count) || 0) > 1 ? 's' : ''})`}
        </button>
      </div>
      <p className="note">
        {titles
          ? '4 cartons musicaux par feuille A4 (titres de la playlist en cours), tous différents, numérotés. Valables pour cette playlist seulement.'
          : '6 cartons par feuille A4, tous différents, numérotés à partir de 5001.'}{' '}
        Gardés avec la session : réimprimables à tout moment.
      </p>
      {paper.count > 0 && (
        <div className="row-actions">
          <button className="btn sm ghost" onClick={() => void pdfOf()} disabled={busy !== null}>Réimprimer les {paper.count} cartons (PDF)</button>
          <button
            className="btn sm danger"
            disabled={busy !== null}
            onClick={() => askConfirm({
              title: 'Supprimer les cartons papier ?',
              message: `Les ${paper.count} cartons papier de cette session ne pourront plus être vérifiés.`,
              check: 'J’ai compris : les cartons imprimés deviennent invalides.',
              confirm: 'Supprimer les cartons papier',
              onConfirm: async () => {
                const r = await callAdmin(sessionId, { action: 'paper_clear' })
                if (!r.ok) notify(r.error ?? 'Suppression impossible', 'error')
                else {
                  setResult(null)
                  onChanged()
                }
              },
            })}
          >
            Supprimer
          </button>
        </div>
      )}
    </>
  )
  return (
    <div className={`box${compact ? ' paper-mini' : ''}`} data-testid="paper-panel">
      <h2><span>Cartons papier</span><span>{paper.count ? `n° ${paper.first} à ${paper.last}` : 'aucun'}</span></h2>
      {paper.count > 0 && (
        <>
          <div className="field">
            <input
              className="big"
              inputMode="numeric"
              autoComplete="off"
              name="numero-carton"
              placeholder="N° DU CARTON"
              aria-label="Numéro du carton papier à vérifier"
              value={serial}
              onChange={(e) => setSerial(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => { if (e.key === 'Enter') void check() }}
              data-testid="paper-serial"
            />
            <button className="btn gold" onClick={() => void check()} disabled={!serial || busy !== null} data-testid="paper-check">Vérifier</button>
          </div>
          {result && (
            <div className="bgo-modal" role="dialog" aria-modal="true" aria-label={`Carton papier n° ${result.serial}`}>
              <div className="card bgo" style={{ boxShadow: '0 0 0 1px rgba(139,77,255,.3), 0 30px 60px rgba(0,0,0,.6)' }} data-testid="paper-result">
                <h4>Carton papier n° {result.serial}</h4>
                {verdict
                  ? <div className={`verdict ${verdict.tone}`}>{verdict.tone === 'ko' ? '✗ ' : '✓ '}{verdict.text}</div>
                  : <div className="verdict ko">Aucune étape en jeu</div>}
                <MiniCard cells={result.cells} drawn={drawn} marks={drawn} check={result.check} titles={titles} legend />
                <div className="acts">
                  <button className="btn ghost" onClick={() => setResult(null)} data-testid="paper-close">Fermer</button>
                  {result.check?.valid && canWin && (
                    <button className="btn ok" onClick={() => void declare()} disabled={busy !== null} data-testid="paper-win">✓ Déclarer gagnant</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {compact ? (
        <div className="row-actions" style={{ marginTop: paper.count ? 10 : 0 }}>
          <button className="btn sm ghost" onClick={() => setToolsOpen(true)} data-testid="paper-tools">{paper.count ? 'Fabriquer · réimprimer' : 'Fabriquer des cartons papier'}</button>
        </div>
      ) : tools}
      {compact && toolsOpen && (
        <div className="bgo-modal" role="dialog" aria-modal="true" aria-label="Cartons papier">
          <div className="card bgo" style={{ boxShadow: '0 0 0 1px rgba(139,77,255,.3), 0 30px 60px rgba(0,0,0,.6)' }}>
            <h4>Cartons papier</h4>
            {tools}
            <div className="acts"><button className="btn ghost" onClick={() => setToolsOpen(false)}>Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
