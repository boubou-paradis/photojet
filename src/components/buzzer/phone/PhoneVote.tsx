'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — vote de la salle sur le téléphone (manches préparées).
// Le vote part directement vers la base (fonction buzzer_vote, jeton du
// joueur vérifié) : un vote par téléphone, modifiable jusqu'à la clôture.
// Après un rechargement, le vote déjà fait est relu (choix NULL).
// Aucun résultat ici pendant le vote : ils s'affichent sur l'écran géant.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PREP_PHONE_CSS } from '@/components/buzzer/prep/prepStyles'
import { VOTE_LETTERS, type PrepPublicVote, type PrepStep } from '@/lib/buzzer/prep-flow'
import { createClient } from '@/lib/supabase'

interface VotePlayer {
  sessionId: string
  playerId: string
  token: string
}

type VoteReply = { ok: true; voteId: string | null; choice: number | null } | { ok: false; reason: string }

interface PhoneVoteProps {
  player: VotePlayer
  vote: PrepPublicVote
  step: Extract<PrepStep, 'vote_open' | 'vote_closed'>
  /** Joueur refusé ou partie terminée : la page relit l'identité. */
  onGone: () => void
  refresh: () => Promise<void>
}

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* non supporté */
  }
}

const CheckIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
)

export default function PhoneVote({ player, vote, step, onGone, refresh }: PhoneVoteProps) {
  const supabase = useMemo(() => createClient(), [])
  // Mon vote confirmé par le serveur, pour CE scrutin.
  const [mine, setMine] = useState<{ voteId: string; choice: number | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const [sending, setSending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(async (choice: number | null): Promise<VoteReply | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error: rpcError } = await supabase.rpc('buzzer_vote', {
        p_session_id: player.sessionId,
        p_player_id: player.playerId,
        p_token: player.token,
        p_choice: choice,
      })
      if (!rpcError && data) return data as VoteReply
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
    }
    return null
  }, [supabase, player])

  // Nouveau scrutin (ou rechargement) : relecture de mon vote.
  useEffect(() => {
    let cancelled = false
    void call(null).then((reply) => {
      if (cancelled || !reply) return
      if (reply.ok && reply.voteId === vote.id) setMine({ voteId: vote.id, choice: reply.choice })
      else if (!reply.ok && ['removed', 'unknown_player', 'no_game'].includes(reply.reason)) onGone()
    })
    return () => {
      cancelled = true
    }
  }, [vote.id, call, onGone])

  const myChoice = mine?.voteId === vote.id ? mine.choice : null

  async function choose(i: number) {
    if (sending !== null || step !== 'vote_open') return
    setSending(i)
    setError(null)
    vibrate(25)
    const reply = await call(i)
    setSending(null)
    if (!reply) {
      setError('Connexion difficile : ton vote n’est pas parti. Réessaie.')
      return
    }
    if (reply.ok) {
      setMine({ voteId: vote.id, choice: i })
      setEditing(false)
      vibrate([40, 50, 90])
      return
    }
    if (reply.reason === 'closed') {
      setError('Le vote est terminé.')
      void refresh()
    } else if (reply.reason === 'paused') {
      setError('Partie en pause : l’animateur revient dans un instant.')
    } else if (['removed', 'unknown_player', 'no_game'].includes(reply.reason)) {
      onGone()
    } else {
      setError('Vote refusé. Réessaie.')
    }
  }

  const choiceLabel = (i: number | null) => (i === null ? null : `${VOTE_LETTERS[i]} · ${vote.choices[i]}`)

  // ---------- Vote terminé ----------
  if (step === 'vote_closed') {
    const correct = vote.correct
    const good = correct !== null && myChoice === correct
    const title = myChoice === null ? 'Vote terminé' : correct === null ? 'Merci pour ton vote !' : good ? 'Bien vu !' : 'Raté !'
    return (
      <>
        <style>{PREP_PHONE_CSS}</style>
        <span className="bzp-pill" role="status"><i />Vote terminé</span>
        <div className="bzp-stage">
          <div className={`bzx-seal${good || (correct === null && myChoice !== null) ? '' : ' dim'}`}>
            <div className="disc"><CheckIcon color={good || (correct === null && myChoice !== null) ? '#3b2a06' : '#2a2540'} /></div>
          </div>
        </div>
        <div className="bzp-cap" aria-live="polite">
          <h1 className={good ? 'gold' : 'dim'}>{title}</h1>
          <p>{myChoice === null ? 'Tu n’as pas voté cette fois.' : <>Ton choix : <b>{choiceLabel(myChoice)}</b></>}</p>
          {correct !== null && <p>Bonne réponse : <b>{choiceLabel(correct)}</b></p>}
          <p style={{ fontSize: '3.8cqw' }}>Les résultats sont sur l’écran géant.</p>
        </div>
      </>
    )
  }

  // ---------- Vote enregistré ----------
  if (myChoice !== null && !editing) {
    return (
      <>
        <style>{PREP_PHONE_CSS}</style>
        <span className="bzp-pill gold" role="status"><i />Vote enregistré</span>
        <div className="bzp-stage">
          <div className="bzx-seal"><div className="disc"><CheckIcon color="#3b2a06" /></div></div>
        </div>
        <div className="bzp-cap" aria-live="polite">
          <h1 className="gold">C’est noté !</h1>
          <p>Ton choix : <b>{choiceLabel(myChoice)}</b></p>
          <p style={{ fontSize: '3.8cqw' }}>Les résultats s’affichent sur l’écran géant à la fin du vote.</p>
        </div>
        <div className="bzx-foot">
          <button type="button" className="bzx-ghost" onClick={() => setEditing(true)}>Changer mon choix</button>
        </div>
      </>
    )
  }

  // ---------- Choix ----------
  return (
    <>
      <style>{PREP_PHONE_CSS}</style>
      <span className="bzp-pill violet" role="status"><i />Vote de la salle</span>
      <div className="bzx-vq"><h1>{vote.question}</h1></div>
      <div className="bzx-vopts" role="group" aria-label="Choix du vote">
        {vote.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            className="bzx-vopt"
            aria-pressed={myChoice === i || sending === i}
            disabled={sending !== null}
            onClick={() => void choose(i)}
          >
            <span className="k">{VOTE_LETTERS[i]}</span>
            <span>{c}</span>
          </button>
        ))}
      </div>
      {error ? <p className="bzx-vhint" style={{ color: '#fde68a' }} role="alert">{error}</p> : <p className="bzx-vhint">Touche ton choix. Tu peux changer d’avis jusqu’à la fin du vote.</p>}
    </>
  )
}
