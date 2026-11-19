// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : bibliothèque de playlists du compte connecté.
// GET                                   → ses playlists (titres, extraits, adresses de lecture)
// POST { action: 'save', id?, name, tracks } → crée ou remplace (validé ici)
// POST { action: 'delete', id }         → supprime (morceaux plus cités effacés)
// Une playlist utilisée par une partie en cours peut être modifiée ou
// supprimée sans risque : la partie joue sa copie figée (bingo_music).

import { NextResponse } from 'next/server'
import { getBingoAdmin } from '@/lib/bingo/server'
import { currentUserId, deletePlaylist, listPlaylists, savePlaylist } from '@/lib/bingo/library'
import { isUuid } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
const UNAUTH = { error: 'Connectez-vous pour gérer vos playlists.' }
const BUSY = { error: 'Réseau saturé, réessayez dans un instant.' }

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return json(UNAUTH, 401)
  try {
    return json({ playlists: await listPlaylists(getBingoAdmin(), userId) })
  } catch (e) {
    console.error('[AnimaBingo] playlists :', e instanceof Error ? e.message : e)
    return json(BUSY, 503)
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    const b = await request.json()
    if (typeof b !== 'object' || b === null) throw new Error()
    body = b as Record<string, unknown>
  } catch {
    return json({ error: 'Requête invalide.' }, 400)
  }
  const userId = await currentUserId()
  if (!userId) return json(UNAUTH, 401)
  const admin = getBingoAdmin()
  try {
    if (body.action === 'save') {
      if (body.id !== undefined && !isUuid(body.id)) return json({ error: 'Playlist introuvable.' }, 404)
      const r = await savePlaylist(admin, userId, body)
      return r.ok ? json({ playlist: r.playlist }) : json({ error: r.error }, r.status)
    }
    if (body.action === 'delete') {
      if (!isUuid(body.id)) return json({ error: 'Playlist introuvable.' }, 404)
      return (await deletePlaylist(admin, userId, body.id)) ? json({ ok: true }) : json({ error: 'Playlist introuvable.' }, 404)
    }
    return json({ error: 'Action inconnue.' }, 400)
  } catch (e) {
    console.error('[AnimaBingo] playlists :', e instanceof Error ? e.message : e)
    return json(BUSY, 503)
  }
}
