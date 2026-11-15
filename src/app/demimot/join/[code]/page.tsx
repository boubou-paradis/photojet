'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - arrivée d'un capitaine (téléphone). On y arrive par le QR de
// la session (/invite redirige ici tant qu'À Demi-Mot est en cours). Le
// capitaine choisit son équipe dans la liste de l'animateur : aucun champ à
// saisir (donc rien que le navigateur puisse proposer de remplir).

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PhoneScreen } from '@/components/demimot/PhoneScreen'
import '@/components/demimot/demimot.css'
import { forgetCaptain, readCaptain, storeCaptain } from '@/lib/demimot/captain-storage'
import type { PublicTeam } from '@/lib/demimot/view'

type Screen = 'checking' | 'choose' | 'closed'

interface StatusTeam {
  id: string
  name: string
  color: string
  taken: boolean
}

const POLL_MS = 3000

export default function DemiMotJoinPage() {
  const params = useParams()
  const router = useRouter()
  const code = String(params.code ?? '').toUpperCase()
  const [screen, setScreen] = useState<Screen>('checking')
  const [teams, setTeams] = useState<StatusTeam[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const photosHref = `/invite/${encodeURIComponent(code)}?photos=1`

  // Déjà capitaine sur ce téléphone : on reprend directement la partie.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      const status = (await fetch(`/api/demimot/status?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as { live?: boolean; teams?: StatusTeam[] } | null
      if (cancelled) return
      if (status?.live === false) setScreen('closed')
      else if (status?.live) {
        setTeams(status.teams ?? [])
        setScreen('choose')
      }
      timer = setTimeout(poll, POLL_MS)
    }
    ;(async () => {
      const stored = readCaptain(code)
      if (stored) {
        const res = await fetch('/api/demimot/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: stored.sessionId, teamId: stored.teamId, token: stored.token }),
        }).catch(() => null)
        if (cancelled) return
        if (res?.ok) {
          router.replace(`/demimot/play/${stored.sessionId}`)
          return
        }
        if (res && (res.status === 403 || res.status === 410)) forgetCaptain(code)
      }
      void poll()
    })()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [code, router])

  const pick = useCallback(async (teamId: string) => {
    if (joining) return
    setJoining(true)
    setNotice(null)
    try {
      const res = await fetch('/api/demimot/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, teamId }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; sessionId?: string; teamId?: string; teamName?: string; token?: string }
      if (!res.ok || !body.sessionId || !body.token || !body.teamId) {
        setNotice(body.error ?? 'Connexion impossible, réessaie.')
        if (res.status === 409 && body.error?.startsWith('Aucune partie')) setScreen('closed')
        return
      }
      storeCaptain({ code, sessionId: body.sessionId, teamId: body.teamId, token: body.token, teamName: body.teamName ?? '' })
      router.push(`/demimot/play/${body.sessionId}`)
    } catch {
      setNotice('Réseau instable : réessaie.')
    } finally {
      setJoining(false)
    }
  }, [code, joining, router])

  if (screen === 'closed') {
    return (
      <div className="dm">
        <main className="home">
          <div className="home-card" data-testid="demimot-closed">
            <div className="title-3d" style={{ fontSize: 34 }}>À Demi-Mot</div>
            <h2 style={{ marginTop: 22 }}>Pas de partie en cours</h2>
            <p className="home-note">L’animateur n’a pas encore lancé À Demi-Mot (ou la partie est terminée).</p>
            <p style={{ marginTop: 18 }}><a className="btn" href={photosHref}>Partager des photos</a></p>
          </div>
        </main>
      </div>
    )
  }

  if (screen === 'checking') {
    return (
      <div className="dm">
        <PhoneScreen status="connecting" team={null} online={false} />
      </div>
    )
  }

  const publicTeams: PublicTeam[] = teams.map((t) => ({ id: t.id, name: t.name, color: t.color, score: 0, connected: t.taken, blocked: false }))
  return (
    <div className="dm" data-testid="demimot-join">
      <PhoneScreen
        status="choose_team"
        team={null}
        teams={publicTeams}
        takenTeamIds={teams.filter((t) => t.taken).map((t) => t.id)}
        online
        onPickTeam={(id) => void pick(id)}
      />
      {teams.length === 0 && <p className="phone-status" style={{ textAlign: 'center' }}>L’animateur prépare les équipes…</p>}
      <p style={{ textAlign: 'center', margin: '18px 0 28px' }}>
        <a href={photosHref} className="home-phone">Je veux juste partager des photos</a>
      </p>
      {notice && (
        <p className="phone-notice" role="alert" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}
    </div>
  )
}
