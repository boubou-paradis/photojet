// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// À Demi-Mot - bibliothèque d'énigmes d'un compte (tables demimot_sets et
// demimot_puzzles, fermées : lues et écrites ici, par le serveur, après
// vérification de l'utilisateur connecté). Format d'échange = celui du
// prototype (« a-demi-mot/enigmes », version 1).
// Serveur uniquement.

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { draw, exportBank, validateBank, validatePuzzle, normalizePuzzle, type Bank, type Issue } from './bank'
import { DEMIMOT_LIBRARY_LIMITS } from './constants'
import starter from './starter-puzzles.json'
import type { Puzzle } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SetRow {
  id: string
  name: string
  position: number
}

interface PuzzleRow {
  id: string
  set_id: string | null
  category: string
  solution: string
  variants: string[]
  difficulty: Puzzle['difficulty']
  points: number | null
  active: boolean
  position: number
}

export class LibraryError extends Error {
  constructor(message: string, readonly status: number, readonly issues: Issue[] = []) {
    super(message)
  }
}

/** Les 129 énigmes de départ (contenu du prototype), validées une fois. */
export function starterBank(): Bank {
  const v = validateBank(starter)
  if (!v.ok) throw new Error(`Énigmes de départ invalides : ${v.issues[0]?.message}`)
  return { schema: 1, rev: 0, sets: v.sets, puzzles: v.puzzles }
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Bibliothèque complète d'un compte, au format du prototype (identifiants = uuid). */
export async function loadLibrary(admin: SupabaseClient, userId: string): Promise<Bank> {
  const [sets, puzzles] = await Promise.all([
    admin.from('demimot_sets').select('id, name, position').eq('user_id', userId).order('position').order('created_at').then(must<SetRow[]>),
    admin
      .from('demimot_puzzles')
      .select('id, set_id, category, solution, variants, difficulty, points, active, position')
      .eq('user_id', userId)
      .order('position')
      .order('created_at')
      .limit(DEMIMOT_LIBRARY_LIMITS.maxPuzzles)
      .then(must<PuzzleRow[]>),
  ])
  return {
    schema: 1,
    rev: 0,
    sets: sets.map((s) => ({ id: s.id, name: s.name, puzzleIds: puzzles.filter((p) => p.set_id === s.id).map((p) => p.id) })),
    puzzles: puzzles.map((p) => ({ id: p.id, category: p.category, solution: p.solution, variants: p.variants, difficulty: p.difficulty, points: p.points, active: p.active })),
  }
}

/**
 * Ajoute (ou remplace) des énigmes dans la bibliothèque. `mode` :
 * « merge » ajoute, et met à jour une énigme déjà à ce compte (même uuid) ;
 * « replace » vide d'abord la bibliothèque. Un fichier invalide ne change rien.
 */
export async function importIntoLibrary(admin: SupabaseClient, userId: string, raw: unknown, mode: 'merge' | 'replace') {
  const v = validateBank(raw)
  if (!v.ok) throw new LibraryError('Fichier invalide : rien n’a été importé.', 400, v.issues)

  const current = mode === 'replace' ? { sets: [], puzzles: [] } : await loadLibrary(admin, userId)
  const ownPuzzles = new Set(current.puzzles.map((p) => p.id))
  const ownSets = new Set(current.sets.map((s) => s.id))
  if ((mode === 'replace' ? 0 : current.puzzles.length) + v.puzzles.filter((p) => !ownPuzzles.has(p.id)).length > DEMIMOT_LIBRARY_LIMITS.maxPuzzles)
    throw new LibraryError(`Bibliothèque pleine (${DEMIMOT_LIBRARY_LIMITS.maxPuzzles} énigmes maximum).`, 409)
  if ((mode === 'replace' ? 0 : current.sets.length) + v.sets.filter((s) => !ownSets.has(s.id)).length > DEMIMOT_LIBRARY_LIMITS.maxSets)
    throw new LibraryError(`Trop de jeux d’énigmes (${DEMIMOT_LIBRARY_LIMITS.maxSets} maximum).`, 409)

  // Identifiants : on garde un uuid déjà à ce compte, sinon on en crée un.
  const setId = new Map(v.sets.map((s) => [s.id, UUID_RE.test(s.id) && ownSets.has(s.id) ? s.id : randomUUID()]))
  const puzzleId = new Map(v.puzzles.map((p) => [p.id, UUID_RE.test(p.id) && ownPuzzles.has(p.id) ? p.id : randomUUID()]))
  const setOf = new Map<string, string>()
  for (const s of v.sets) for (const pid of s.puzzleIds) if (!setOf.has(pid)) setOf.set(pid, setId.get(s.id)!)

  if (mode === 'replace') {
    must(await admin.from('demimot_puzzles').delete().eq('user_id', userId))
    must(await admin.from('demimot_sets').delete().eq('user_id', userId))
  }
  const now = new Date().toISOString()
  if (v.sets.length) {
    must(
      await admin.from('demimot_sets').upsert(
        v.sets.map((s, i) => ({ id: setId.get(s.id)!, user_id: userId, name: s.name.slice(0, 60), position: current.sets.length + i, updated_at: now })),
      ),
    )
  }
  if (v.puzzles.length) {
    must(
      await admin.from('demimot_puzzles').upsert(
        v.puzzles.map((p, i) => ({
          id: puzzleId.get(p.id)!,
          user_id: userId,
          set_id: setOf.get(p.id) ?? null,
          category: p.category.slice(0, 60),
          solution: p.solution,
          variants: p.variants.slice(0, 10),
          difficulty: p.difficulty,
          points: p.points,
          active: p.active,
          position: current.puzzles.length + i,
          updated_at: now,
        })),
      ),
    )
  }
  const added = v.puzzles.filter((p) => !ownPuzzles.has(puzzleId.get(p.id)!)).length
  return { added, updated: v.puzzles.length - added, warnings: v.warnings }
}

/** Ajoute les énigmes de départ (déjà présentes : rien n'est dupliqué, on compare les solutions). */
export async function importStarter(admin: SupabaseClient, userId: string) {
  const bank = starterBank()
  const current = await loadLibrary(admin, userId)
  const known = new Set(current.puzzles.map((p) => p.solution.toLocaleLowerCase('fr-FR')))
  const puzzles = bank.puzzles.filter((p) => !known.has(p.solution.toLocaleLowerCase('fr-FR')))
  const keep = new Set(puzzles.map((p) => p.id))
  const sets = bank.sets.map((s) => ({ ...s, puzzleIds: s.puzzleIds.filter((id) => keep.has(id)) })).filter((s) => s.puzzleIds.length)
  if (!puzzles.length) return { added: 0, updated: 0, warnings: [] as Issue[] }
  return importIntoLibrary(admin, userId, { format: 'a-demi-mot/enigmes', version: 1, sets, puzzles }, 'merge')
}

export async function exportLibrary(admin: SupabaseClient, userId: string, setIds?: string[]) {
  return exportBank(await loadLibrary(admin, userId), setIds)
}

/** Crée ou modifie une énigme. Renvoie son identifiant. */
export async function savePuzzle(admin: SupabaseClient, userId: string, raw: Record<string, unknown>, setId: string | null): Promise<string> {
  const isNew = raw.id === undefined || raw.id === null
  const id = isNew ? randomUUID() : String(raw.id)
  const issues = validatePuzzle({ ...raw, id }, 'énigme')
  if (issues.length) throw new LibraryError(issues[0].message, 400, issues)
  const p = normalizePuzzle({ ...raw, id })
  if (setId) {
    const own = must(await admin.from('demimot_sets').select('id').eq('id', setId).eq('user_id', userId).maybeSingle())
    if (!own) throw new LibraryError('Jeu d’énigmes introuvable.', 404)
  }
  const row = {
    user_id: userId,
    set_id: setId,
    category: p.category.slice(0, 60),
    solution: p.solution,
    variants: p.variants.slice(0, 10),
    difficulty: p.difficulty,
    points: p.points,
    active: p.active,
    updated_at: new Date().toISOString(),
  }
  if (isNew) {
    const { count } = await admin.from('demimot_puzzles').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if ((count ?? 0) >= DEMIMOT_LIBRARY_LIMITS.maxPuzzles) throw new LibraryError(`Bibliothèque pleine (${DEMIMOT_LIBRARY_LIMITS.maxPuzzles} énigmes maximum).`, 409)
    must(await admin.from('demimot_puzzles').insert({ id, ...row, position: count ?? 0 }))
  } else {
    const updated = must(await admin.from('demimot_puzzles').update(row).eq('id', id).eq('user_id', userId).select('id'))
    if (!updated.length) throw new LibraryError('Énigme introuvable.', 404)
  }
  return id
}

export async function deletePuzzle(admin: SupabaseClient, userId: string, id: string) {
  must(await admin.from('demimot_puzzles').delete().eq('id', id).eq('user_id', userId))
}

export async function saveSet(admin: SupabaseClient, userId: string, id: string | null, name: string): Promise<string> {
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new LibraryError('Donnez un nom au jeu d’énigmes.', 400)
  if (!id) {
    const { count } = await admin.from('demimot_sets').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if ((count ?? 0) >= DEMIMOT_LIBRARY_LIMITS.maxSets) throw new LibraryError(`Trop de jeux d’énigmes (${DEMIMOT_LIBRARY_LIMITS.maxSets} maximum).`, 409)
    const newId = randomUUID()
    must(await admin.from('demimot_sets').insert({ id: newId, user_id: userId, name: clean, position: count ?? 0 }))
    return newId
  }
  const updated = must(await admin.from('demimot_sets').update({ name: clean, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select('id'))
  if (!updated.length) throw new LibraryError('Jeu d’énigmes introuvable.', 404)
  return id
}

/** Supprime un jeu d'énigmes ET ses énigmes. */
export async function deleteSet(admin: SupabaseClient, userId: string, id: string) {
  must(await admin.from('demimot_sets').delete().eq('id', id).eq('user_id', userId))
}

/**
 * Tirage des énigmes d'une partie dans la bibliothèque du compte. Bibliothèque
 * vide (ou sans énigme active dans les jeux choisis) : énigmes de départ, pour
 * qu'une première partie fonctionne sans préparation.
 */
export async function drawPuzzles(
  admin: SupabaseClient,
  userId: string,
  opts: { setIds: string[]; count: number; exclude: string[]; seed: number },
): Promise<{ puzzles: Puzzle[]; fromStarter: boolean }> {
  const own = await loadLibrary(admin, userId)
  const picked = draw(own, opts)
  if (picked.length) return { puzzles: picked, fromStarter: false }
  return { puzzles: draw(starterBank(), { ...opts, setIds: [] }), fromStarter: true }
}
