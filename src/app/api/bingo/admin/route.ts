// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : régie. Réservée au propriétaire de la session (cookies
// vérifiés côté serveur). Toute la partie vit en base : une régie rouverte
// (PC planté, onglet fermé, coupure) relit l'état exact avec GET et reprend.
//
// GET  ?sessionId=   → état complet de la régie (état public, demandes en
//                      attente avec vérification détaillée, cartons papier).
// POST { sessionId, action, ... } → une commande (voir parseAdmin).
//   launch   : lance OU REPREND la partie existante (rien n'est effacé).
//   new_game : repart de zéro (l'interface demande une double confirmation).
//   exit     : quitte et efface la partie (double confirmation), papier gardé.
//   launch / new_game { playlistId } : loto musical (playlist du compte, figée).
//   reveal   : loto musical, titre en cours affiché.

import { NextResponse } from 'next/server'
import { BingoError, getBingoAdmin, regieSnapshot, requireSessionOwner, runAdmin } from '@/lib/bingo/server'
import { isUuid, parseAdmin } from '@/lib/bingo/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

function fail(e: unknown) {
  if (e instanceof BingoError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: NO_STORE })
  console.error('[AnimaBingo] régie :', e instanceof Error ? e.message : e)
  return NextResponse.json({ error: 'Réseau saturé, réessayez dans un instant.' }, { status: 503, headers: NO_STORE })
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  if (!(await requireSessionOwner(sessionId))) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403, headers: NO_STORE })
  try {
    return NextResponse.json(await regieSnapshot(getBingoAdmin(), sessionId), { headers: NO_STORE })
  } catch (e) {
    return fail(e)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400, headers: NO_STORE })
  }
  const parsed = parseAdmin(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE })
  const { sessionId, command } = parsed.value
  const userId = await requireSessionOwner(sessionId)
  if (!userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403, headers: NO_STORE })
  try {
    return NextResponse.json(await runAdmin(getBingoAdmin(), sessionId, command, userId), { headers: NO_STORE })
  } catch (e) {
    return fail(e)
  }
}
