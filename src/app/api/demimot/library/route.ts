// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot : bibliothèque d'énigmes du compte connecté (gardée d'une
// soirée à l'autre). Tables fermées : tout passe par cette route, qui ne lit
// et n'écrit que les lignes de l'utilisateur connecté.
// GET : bibliothèque (ou fichier d'export avec ?export=1[&sets=id,id]).
// POST : savePuzzle, deletePuzzle, saveSet, deleteSet, importStarter, import.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DEMIMOT_LIBRARY_LIMITS } from '@/lib/demimot/constants'
import {
  LibraryError,
  deletePuzzle,
  deleteSet,
  exportLibrary,
  importIntoLibrary,
  importStarter,
  loadLibrary,
  savePuzzle,
  saveSet,
} from '@/lib/demimot/library'
import { getDemiMotAdmin } from '@/lib/demimot/server'
import { isUuid } from '@/lib/demimot/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

async function currentUser(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function fail(e: unknown, label: string) {
  if (e instanceof LibraryError) return NextResponse.json({ error: e.message, issues: e.issues.slice(0, 50) }, { status: e.status, headers: NO_STORE })
  console.error(`[À Demi-Mot] bibliothèque (${label}) :`, e instanceof Error ? e.message : e)
  return NextResponse.json({ error: 'Bibliothèque momentanément indisponible, réessayez.' }, { status: 500, headers: NO_STORE })
}

export async function GET(request: Request) {
  const userId = await currentUser()
  if (!userId) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 })
  const params = new URL(request.url).searchParams
  try {
    const admin = getDemiMotAdmin()
    if (params.get('export') === '1') {
      const sets = (params.get('sets') ?? '').split(',').filter(isUuid)
      const file = await exportLibrary(admin, userId, sets)
      return new NextResponse(JSON.stringify(file, null, 2), {
        headers: { ...NO_STORE, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="a-demi-mot-enigmes.json"' },
      })
    }
    const bank = await loadLibrary(admin, userId)
    return NextResponse.json({ sets: bank.sets, puzzles: bank.puzzles, limits: DEMIMOT_LIBRARY_LIMITS }, { headers: NO_STORE })
  } catch (e) {
    return fail(e, 'lecture')
  }
}

export async function POST(request: Request) {
  const userId = await currentUser()
  if (!userId) return NextResponse.json({ error: 'Connectez-vous.' }, { status: 401 })
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > DEMIMOT_LIBRARY_LIMITS.maxImportBytes) return NextResponse.json({ error: 'Fichier trop volumineux (1 Mo maximum).' }, { status: 413 })

  let body: Record<string, unknown>
  try {
    const raw = await request.json()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('objet attendu')
    body = raw as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const admin = getDemiMotAdmin()
  try {
    switch (body.action) {
      case 'savePuzzle': {
        const puzzle = body.puzzle
        if (!puzzle || typeof puzzle !== 'object') return NextResponse.json({ error: 'Énigme invalide.' }, { status: 400 })
        const p = puzzle as Record<string, unknown>
        if (p.id !== undefined && p.id !== null && !isUuid(p.id)) return NextResponse.json({ error: 'Énigme invalide.' }, { status: 400 })
        const setId = body.setId === null || body.setId === undefined ? null : isUuid(body.setId) ? body.setId : undefined
        if (setId === undefined) return NextResponse.json({ error: 'Jeu d’énigmes invalide.' }, { status: 400 })
        const id = await savePuzzle(admin, userId, p, setId)
        return NextResponse.json({ ok: true, id }, { headers: NO_STORE })
      }
      case 'deletePuzzle':
        if (!isUuid(body.id)) return NextResponse.json({ error: 'Énigme invalide.' }, { status: 400 })
        await deletePuzzle(admin, userId, body.id)
        return NextResponse.json({ ok: true }, { headers: NO_STORE })
      case 'saveSet': {
        if (typeof body.name !== 'string') return NextResponse.json({ error: 'Nom manquant.' }, { status: 400 })
        if (body.id !== undefined && body.id !== null && !isUuid(body.id)) return NextResponse.json({ error: 'Jeu d’énigmes invalide.' }, { status: 400 })
        const id = await saveSet(admin, userId, (body.id as string | null | undefined) ?? null, body.name)
        return NextResponse.json({ ok: true, id }, { headers: NO_STORE })
      }
      case 'deleteSet':
        if (!isUuid(body.id)) return NextResponse.json({ error: 'Jeu d’énigmes invalide.' }, { status: 400 })
        await deleteSet(admin, userId, body.id)
        return NextResponse.json({ ok: true }, { headers: NO_STORE })
      case 'importStarter':
        return NextResponse.json({ ok: true, ...(await importStarter(admin, userId)) }, { headers: NO_STORE })
      case 'import': {
        const mode = body.mode === 'replace' ? 'replace' : body.mode === 'merge' ? 'merge' : null
        if (!mode) return NextResponse.json({ error: 'Mode d’import invalide.' }, { status: 400 })
        return NextResponse.json({ ok: true, ...(await importIntoLibrary(admin, userId, body.file, mode)) }, { headers: NO_STORE })
      }
      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
    }
  } catch (e) {
    return fail(e, String(body.action))
  }
}
