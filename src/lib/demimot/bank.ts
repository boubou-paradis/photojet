// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// Banque d'énigmes : jeux réutilisables, validation structurée, import/export JSON versionné, tirage sans répétition.

import { permutation } from './engine'
import type { Difficulty, Puzzle } from './types'
import { cleanText, normalizeForCompare, validateSolution } from './text'

export const BANK_SCHEMA = 1
export const EXPORT_FORMAT = 'a-demi-mot/enigmes'

export interface PuzzleSet {
  id: string
  name: string
  /** Ordre d'affichage (réorganisable). */
  puzzleIds: string[]
}

export interface Bank {
  schema: number
  /** Révision : +1 à chaque enregistrement (contrôle des écritures concurrentes). */
  rev: number
  sets: PuzzleSet[]
  puzzles: Puzzle[]
}

export interface Issue {
  path: string
  message: string
}

const DIFFS: Difficulty[] = ['facile', 'moyen', 'difficile']
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export function validatePuzzle(p: unknown, path: string): Issue[] {
  const out: Issue[] = []
  if (!p || typeof p !== 'object') return [{ path, message: 'Énigme invalide (objet attendu).' }]
  const o = p as Record<string, unknown>
  if (typeof o.id !== 'string' || !ID_RE.test(o.id)) out.push({ path: `${path}.id`, message: 'Identifiant manquant ou invalide (minuscules, chiffres, tirets).' })
  if (typeof o.category !== 'string' || !o.category.trim() || o.category.length > 40) out.push({ path: `${path}.category`, message: 'Catégorie de 1 à 40 caractères.' })
  if (typeof o.solution !== 'string') out.push({ path: `${path}.solution`, message: 'Solution manquante.' })
  else for (const i of validateSolution(o.solution)) out.push({ path: `${path}.solution`, message: i.message })
  if (o.variants !== undefined && (!Array.isArray(o.variants) || o.variants.some((v) => typeof v !== 'string' || v.length > 80))) out.push({ path: `${path}.variants`, message: 'Variantes : liste de textes (80 caractères max).' })
  if (o.difficulty !== undefined && !DIFFS.includes(o.difficulty as Difficulty)) out.push({ path: `${path}.difficulty`, message: 'Difficulté : facile, moyen ou difficile.' })
  if (o.points !== undefined && o.points !== null && (typeof o.points !== 'number' || !Number.isInteger(o.points) || o.points < 0 || o.points > 10000)) out.push({ path: `${path}.points`, message: 'Points : entier de 0 à 10 000, ou null.' })
  if (o.active !== undefined && typeof o.active !== 'boolean') out.push({ path: `${path}.active`, message: 'Activation : vrai ou faux.' })
  return out
}

export function normalizePuzzle(o: Record<string, unknown>): Puzzle {
  return {
    id: String(o.id),
    category: cleanText(String(o.category)),
    solution: cleanText(String(o.solution)),
    variants: Array.isArray(o.variants) ? o.variants.map((v) => cleanText(String(v))).filter(Boolean) : [],
    difficulty: DIFFS.includes(o.difficulty as Difficulty) ? (o.difficulty as Difficulty) : 'moyen',
    points: typeof o.points === 'number' ? o.points : null,
    active: o.active !== false,
  }
}

/** Valide une banque complète (ou un fichier d'export). Renvoie la banque normalisée ou la liste des problèmes. */
export function validateBank(raw: unknown): { ok: true; sets: PuzzleSet[]; puzzles: Puzzle[]; warnings: Issue[] } | { ok: false; issues: Issue[] } {
  const issues: Issue[] = []
  const warnings: Issue[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, issues: [{ path: '$', message: 'Fichier JSON attendu (objet).' }] }
  const o = raw as Record<string, unknown>
  if ('format' in o && o.format !== EXPORT_FORMAT) issues.push({ path: 'format', message: `Format inattendu (attendu : ${EXPORT_FORMAT}).` })
  const version = (o.version ?? o.schema) as unknown
  if (version !== BANK_SCHEMA) issues.push({ path: 'version', message: `Version de schéma non prise en charge : ${String(version)} (attendue : ${BANK_SCHEMA}).` })
  if (!Array.isArray(o.puzzles)) issues.push({ path: 'puzzles', message: 'Liste « puzzles » manquante.' })
  if (!Array.isArray(o.sets)) issues.push({ path: 'sets', message: 'Liste « sets » manquante.' })
  if (issues.length) return { ok: false, issues }
  const puzzles: Puzzle[] = []
  const ids = new Set<string>()
  const texts = new Map<string, string>()
  ;(o.puzzles as unknown[]).forEach((p, i) => {
    const pi = validatePuzzle(p, `puzzles[${i}]`)
    if (pi.length) {
      issues.push(...pi)
      return
    }
    const n = normalizePuzzle(p as Record<string, unknown>)
    if (ids.has(n.id)) issues.push({ path: `puzzles[${i}].id`, message: `Identifiant en double : ${n.id}.` })
    ids.add(n.id)
    const key = normalizeForCompare(n.solution)
    if (texts.has(key)) warnings.push({ path: `puzzles[${i}].solution`, message: `Doublon de « ${texts.get(key)} ».` })
    texts.set(key, n.id)
    puzzles.push(n)
  })
  const sets: PuzzleSet[] = []
  ;(o.sets as unknown[]).forEach((s, i) => {
    const so = s as Record<string, unknown>
    if (!so || typeof so.id !== 'string' || !ID_RE.test(so.id) || typeof so.name !== 'string' || !so.name.trim() || !Array.isArray(so.puzzleIds)) {
      issues.push({ path: `sets[${i}]`, message: 'Jeu invalide (id, name, puzzleIds attendus).' })
      return
    }
    const missing = (so.puzzleIds as unknown[]).filter((id) => typeof id !== 'string' || !ids.has(id))
    if (missing.length) issues.push({ path: `sets[${i}].puzzleIds`, message: `Énigmes inconnues : ${missing.join(', ')}.` })
    sets.push({ id: so.id, name: so.name.trim().slice(0, 50), puzzleIds: (so.puzzleIds as string[]).filter((id) => ids.has(id)) })
  })
  if (new Set(sets.map((s) => s.id)).size !== sets.length) issues.push({ path: 'sets', message: 'Identifiants de jeux en double.' })
  return issues.length ? { ok: false, issues } : { ok: true, sets, puzzles, warnings }
}

export function exportBank(b: Bank, setIds?: string[]) {
  const sets = setIds?.length ? b.sets.filter((s) => setIds.includes(s.id)) : b.sets
  const keep = new Set(setIds?.length ? sets.flatMap((s) => s.puzzleIds) : b.puzzles.map((p) => p.id))
  return { format: EXPORT_FORMAT, version: BANK_SCHEMA, exportedAt: new Date().toISOString(), sets, puzzles: b.puzzles.filter((p) => keep.has(p.id)) }
}

/** Import : « merge » ajoute/remplace par identifiant, « replace » remplace tout. Rien ne change si le fichier est invalide. */
export function importBank(b: Bank, raw: unknown, mode: 'merge' | 'replace'): { ok: true; bank: Bank; added: number; updated: number; warnings: Issue[] } | { ok: false; issues: Issue[] } {
  const v = validateBank(raw)
  if (!v.ok) return v
  if (mode === 'replace') return { ok: true, bank: { schema: BANK_SCHEMA, rev: b.rev + 1, sets: v.sets, puzzles: v.puzzles }, added: v.puzzles.length, updated: 0, warnings: v.warnings }
  const puzzles = [...b.puzzles]
  let added = 0
  let updated = 0
  for (const p of v.puzzles) {
    const i = puzzles.findIndex((x) => x.id === p.id)
    if (i >= 0) {
      puzzles[i] = p
      updated++
    } else {
      puzzles.push(p)
      added++
    }
  }
  const sets = [...b.sets]
  for (const s of v.sets) {
    const i = sets.findIndex((x) => x.id === s.id)
    if (i >= 0) sets[i] = { ...sets[i], name: s.name, puzzleIds: [...new Set([...sets[i].puzzleIds, ...s.puzzleIds])] }
    else sets.push(s)
  }
  return { ok: true, bank: { schema: BANK_SCHEMA, rev: b.rev + 1, sets, puzzles }, added, updated, warnings: v.warnings }
}

/** Tirage sans répétition dans la session (puis, si la banque s'épuise, parmi les énigmes déjà jouées). */
export function draw(b: Bank, opts: { setIds: string[]; count: number; exclude: string[]; seed: number }): Puzzle[] {
  const inSets = opts.setIds.length ? new Set(b.sets.filter((s) => opts.setIds.includes(s.id)).flatMap((s) => s.puzzleIds)) : null
  const pool = b.puzzles.filter((p) => p.active && (!inSets || inSets.has(p.id)) && validateSolution(p.solution).length === 0)
  const fresh = permutation(pool.filter((p) => !opts.exclude.includes(p.id)), opts.seed)
  const again = permutation(pool.filter((p) => opts.exclude.includes(p.id)), opts.seed + 1)
  return [...fresh, ...again].slice(0, opts.count)
}
