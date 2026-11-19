'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Double confirmation maison (jamais window.confirm, qui bloque la
// télécommande et les tests) : 1) on explique, 2) on coche « J'ai compris »
// avant que le bouton rouge ne s'active.

import { useEffect, useRef, useState } from 'react'

export interface ConfirmRequest {
  title: string
  message: string
  /** Texte de la case à cocher (seconde confirmation). */
  check: string
  confirm: string
  note?: string
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  // Remise à zéro seulement quand une NOUVELLE demande arrive (pas à chaque rendu du parent).
  useEffect(() => {
    if (!request) return
    setStep(1)
    setChecked(false)
    setBusy(false)
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request])

  if (!request) return null
  return (
    <div className="bgo-modal" data-bingo-modal role="alertdialog" aria-modal="true" aria-labelledby="bgo-confirm-title" data-testid="bingo-confirm">
      <div className="card bgo">
        <h4 id="bgo-confirm-title">{request.title}</h4>
        <p className="warn">{request.message}</p>
        {request.note && <p>{request.note}</p>}
        {step === 2 && (
          <label>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} data-testid="bingo-confirm-check" />
            <span>{request.check}</span>
          </label>
        )}
        <div className="acts">
          <button ref={cancelRef} className="btn ghost" onClick={onClose} disabled={busy}>Annuler</button>
          {step === 1 ? (
            <button className="btn danger" onClick={() => setStep(2)} data-testid="bingo-confirm-next">Continuer</button>
          ) : (
            <button
              className="btn danger"
              disabled={!checked || busy}
              data-testid="bingo-confirm-ok"
              onClick={async () => {
                setBusy(true)
                try {
                  await request.onConfirm()
                } finally {
                  setBusy(false)
                  onClose()
                }
              }}
            >
              {busy ? 'Un instant…' : request.confirm}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
