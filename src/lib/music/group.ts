// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Demandes de musique : regroupement pour le tableau de bord (logique pure).
// Une ligne = une clé normalisée, plus les clés que le DJ y a regroupées.

export type MusicStatus = 'pending' | 'played' | 'skipped'

export interface MusicRequestRow {
  title: string
  artist: string | null
  norm_key: string
  created_at: string
}

export interface MusicAliasRow {
  from_key: string
  to_key: string
}

export interface MusicDecisionRow {
  group_key: string
  status: 'played' | 'skipped'
}

export interface MusicSpelling {
  title: string
  artist: string | null
  count: number
  /** Écriture venue d'une autre clé, regroupée à la main par le DJ. */
  merged: boolean
}

export interface MusicGroup {
  key: string
  title: string
  artist: string | null
  count: number
  firstAt: string
  lastAt: string
  status: MusicStatus
  /** Écritures exactes de la ligne, de la plus fréquente à la moins fréquente. */
  spellings: MusicSpelling[]
  /** La ligne contient des clés regroupées à la main (« Séparer » possible). */
  hasMerged: boolean
}

export interface MusicCounts {
  pending: number
  played: number
  skipped: number
  /** Nombre total de demandes reçues (envois). */
  requests: number
}

/** Clé finale d'une clé (suit les regroupements, sans boucle). */
export function resolveKey(key: string, aliases: Map<string, string>): string {
  let current = key
  for (let i = 0; i < 20; i++) {
    const next = aliases.get(current)
    if (!next || next === key) return current
    current = next
  }
  return current
}

function aliasMap(aliases: MusicAliasRow[]): Map<string, string> {
  return new Map(aliases.map((a) => [a.from_key, a.to_key]))
}

interface Spell { title: string; artist: string | null; key: string; count: number; firstAt: string }

export function groupMusicRequests(
  rows: MusicRequestRow[],
  aliases: MusicAliasRow[],
  decisions: MusicDecisionRow[],
): MusicGroup[] {
  const map = aliasMap(aliases)
  const status = new Map(decisions.map((d) => [d.group_key, d.status]))
  const groups = new Map<string, { count: number; firstAt: string; lastAt: string; spells: Map<string, Spell> }>()

  for (const row of rows) {
    const key = resolveKey(row.norm_key, map)
    let g = groups.get(key)
    if (!g) {
      g = { count: 0, firstAt: row.created_at, lastAt: row.created_at, spells: new Map() }
      groups.set(key, g)
    }
    g.count++
    if (row.created_at < g.firstAt) g.firstAt = row.created_at
    if (row.created_at > g.lastAt) g.lastAt = row.created_at
    const id = `${row.norm_key}\u0000${row.title}\u0000${row.artist ?? ''}`
    const s = g.spells.get(id)
    if (s) {
      s.count++
      if (row.created_at < s.firstAt) s.firstAt = row.created_at
    } else {
      g.spells.set(id, { title: row.title, artist: row.artist, key: row.norm_key, count: 1, firstAt: row.created_at })
    }
  }

  const bySpell = (a: Spell, b: Spell) => b.count - a.count || a.firstAt.localeCompare(b.firstAt)
  const result: MusicGroup[] = []
  for (const [key, g] of groups) {
    const spells = [...g.spells.values()].sort(bySpell)
    // Libellé : l'écriture la plus fréquente de la clé de la ligne elle-même.
    const label = spells.find((s) => s.key === key) ?? spells[0]
    result.push({
      key,
      title: label.title,
      artist: label.artist,
      count: g.count,
      firstAt: g.firstAt,
      lastAt: g.lastAt,
      status: status.get(key) ?? 'pending',
      spellings: spells.map((s) => ({ title: s.title, artist: s.artist, count: s.count, merged: s.key !== key })),
      hasMerged: spells.some((s) => s.key !== key),
    })
  }
  return result.sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
}

export function countMusicGroups(groups: MusicGroup[]): MusicCounts {
  const counts: MusicCounts = { pending: 0, played: 0, skipped: 0, requests: 0 }
  for (const g of groups) {
    counts[g.status]++
    counts.requests += g.count
  }
  return counts
}

export interface MergePlan {
  target: string
  /** Regroupements à écrire (from → target), anciens compris pour éviter les chaînes. */
  aliases: MusicAliasRow[]
  /** Décisions des lignes absorbées, à effacer. */
  dropDecisions: string[]
}

/**
 * Regroupe des lignes : tout part dans la plus demandée (à égalité, la plus
 * ancienne). Les regroupements qui visaient une ligne absorbée sont repointés
 * vers la cible. Null si moins de 2 lignes connues.
 */
export function planMerge(groups: MusicGroup[], keys: string[], aliases: MusicAliasRow[]): MergePlan | null {
  const wanted = new Set(keys)
  const chosen = groups.filter((g) => wanted.has(g.key))
  if (chosen.length < 2) return null
  const target = [...chosen].sort((a, b) => b.count - a.count || a.firstAt.localeCompare(b.firstAt))[0].key
  const sources = new Set(chosen.map((g) => g.key).filter((k) => k !== target))
  const rows: MusicAliasRow[] = [...sources].map((k) => ({ from_key: k, to_key: target }))
  for (const a of aliases) {
    if (sources.has(a.to_key) && a.from_key !== target) rows.push({ from_key: a.from_key, to_key: target })
  }
  return { target, aliases: rows, dropDecisions: [...sources] }
}
