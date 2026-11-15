// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot : actions de la régie. Réservées au propriétaire de la session
// (cookies vérifiés côté serveur). Le déroulé est calculé par le moteur puis
// enregistré sous contrôle de version (demimot_commit) : un double appui
// (souris ou télécommande) est refusé par le moteur, et un buzz arrivé
// pendant l'action n'est jamais perdu (relecture puis nouvel essai).
// Les énigmes d'une partie sont tirées ICI, dans la bibliothèque du compte :
// le navigateur n'en envoie jamais.
// `snapshot` (lecture seule) : vue de la régie, avec la solution.

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { apply, restoreSafe } from '@/lib/demimot/engine'
import { drawPuzzles } from '@/lib/demimot/library'
import { DemiMotActionError, act, getDemiMotAdmin, launchGame, regieSnapshot, requireSessionOwner } from '@/lib/demimot/server'
import { parseAdminRequest, type RegieCommand } from '@/lib/demimot/validation'
import { DEMIMOT_DEFAULT_TEAM_COUNT } from '@/lib/demimot/constants'
import { defaultTeams } from '@/lib/demimot/view'
import type { SupabaseClient } from '@supabase/supabase-js'

const NO_STORE = { 'Cache-Control': 'no-store' }

async function runCommand(admin: SupabaseClient, sessionId: string, userId: string, command: RegieCommand) {
  return act(admin, sessionId, async (s, now) => {
    if (command.type === 'tick') return null
    if (command.type === 'startGame') {
      const finaleCount = s.settings.finale.enabled ? s.settings.finale.puzzles : 0
      const { puzzles } = await drawPuzzles(admin, userId, {
        setIds: s.settings.setIds,
        count: s.settings.puzzleCount + finaleCount,
        exclude: s.usedPuzzleIds,
        seed: (s.seed + s.usedPuzzleIds.length) >>> 0,
      })
      if (!puzzles.length) return { ok: false, error: 'no_puzzle', message: 'Aucune énigme disponible pour cette partie.' }
      const main = puzzles.slice(0, Math.max(1, puzzles.length - finaleCount))
      const finale = puzzles.slice(main.length)
      return apply(s, { type: 'startGame', puzzles: main, finale }, now)
    }
    if (command.type === 'tiebreak') {
      const { puzzles } = await drawPuzzles(admin, userId, {
        setIds: s.settings.setIds,
        count: 1,
        exclude: s.usedPuzzleIds,
        seed: (s.seed + 7919 + s.usedPuzzleIds.length) >>> 0,
      })
      if (!puzzles.length) return { ok: false, error: 'no_puzzle', message: 'Aucune énigme disponible pour le départage.' }
      return apply(s, { type: 'tiebreak', puzzle: puzzles[0] }, now)
    }
    if (command.type === 'setTeams') {
      // Identifiants des équipes = uuid de demimot_teams, attribués ici (jamais par le navigateur).
      const known = new Set(s.teams.map((t) => t.id))
      const teams = command.teams.map((t) => ({ ...t, id: t.id && known.has(t.id) ? t.id : randomUUID() }))
      return apply(s, { type: 'setTeams', teams }, now)
    }
    return apply(s, command, now)
  }, { skipIfUnchanged: command.type === 'tick' })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const parsed = parseAdminRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const req = parsed.value
  const { sessionId } = req

  const userId = await requireSessionOwner(sessionId)
  if (!userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const admin = getDemiMotAdmin()
  try {
    switch (req.action) {
      case 'snapshot': {
        const { publicState, regie } = await regieSnapshot(admin, sessionId)
        return NextResponse.json({ ok: true, state: publicState, regie }, { headers: NO_STORE })
      }
      case 'launch': {
        const { data: session, error } = await admin.from('sessions').select('code').eq('id', sessionId).maybeSingle()
        if (error || !session) throw new Error(error?.message ?? 'session introuvable')
        await launchGame(admin, sessionId, session.code as string)
        // DEMIMOT_DEFAULT_TEAM_COUNT équipes prêtes d'emblée (nombre, noms et couleurs réglables en Préparation) : les capitaines peuvent rejoindre aussitôt.
        await act(admin, sessionId, (s, now) =>
          apply(s, { type: 'setTeams', teams: defaultTeams(DEMIMOT_DEFAULT_TEAM_COUNT).map((t) => ({ id: randomUUID(), name: t.name, color: t.color })) }, now),
        )
        const { publicState, regie } = await regieSnapshot(admin, sessionId)
        return NextResponse.json({ ok: true, state: publicState, regie }, { headers: NO_STORE })
      }
      case 'exit': {
        const { data, error } = await admin.rpc('demimot_exit', { p_session_id: sessionId })
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true, state: data, regie: null }, { headers: NO_STORE })
      }
      case 'heartbeat': {
        const { data, error } = await admin.rpc('demimot_heartbeat', { p_session_id: sessionId })
        if (error) {
          if (error.message.includes('no_game')) throw new DemiMotActionError('Aucune partie À Demi-Mot lancée.', 409, 'no_game')
          throw new Error(error.message)
        }
        // Retour après plus de 90 s d'absence : la manche en cours est mise en pause.
        if ((data as { resumed?: boolean }).resumed) {
          const out = await act(admin, sessionId, (s, now) => {
            const paused = restoreSafe(s, now)
            return paused === s ? null : { ok: true, state: paused, events: [] }
          })
          return NextResponse.json({ ok: true, resumed: true, state: out.publicState, regie: out.regie }, { headers: NO_STORE })
        }
        return NextResponse.json({ ok: true, resumed: false }, { headers: NO_STORE })
      }
      case 'release': {
        const { error } = await admin.rpc('demimot_release_captain', { p_session_id: sessionId, p_team_id: req.teamId })
        if (error) {
          if (error.message.includes('invalid')) throw new DemiMotActionError('Équipe introuvable.', 404, 'unknown_team')
          if (error.message.includes('no_game')) throw new DemiMotActionError('Aucune partie À Demi-Mot lancée.', 409, 'no_game')
          throw new Error(error.message)
        }
        const out = await act(admin, sessionId, () => null)
        return NextResponse.json({ ok: true, state: out.publicState, regie: out.regie }, { headers: NO_STORE })
      }
      case 'command': {
        const out = await runCommand(admin, sessionId, userId, req.command)
        return NextResponse.json({ ok: true, state: out.publicState, regie: out.regie, events: out.events }, { headers: NO_STORE })
      }
    }
  } catch (e) {
    if (e instanceof DemiMotActionError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE })
    console.error(`[À Demi-Mot] action ${req.action} :`, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Action impossible, réessayez.' }, { status: 500, headers: NO_STORE })
  }
}
