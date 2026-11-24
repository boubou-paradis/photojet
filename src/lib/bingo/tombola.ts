// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo · mode Tombola : types et calculs communs (régie, grand écran,
// téléphone, serveur). Aucune dépendance : utilisable partout.
// La tombola vit dans ses propres tables (bingo_tombola*) : rien ici ne
// touche au loto.

/** Plus grand numéro de ticket (papier ou téléphone). */
export const TOMBOLA_MAX_NUMBER = 9999
/** Plages papier au plus. */
export const TOMBOLA_MAX_RANGES = 20
/** Mémoire du téléphone : jeton et ticket, par code de session. */
export const tombolaStoreKey = (code: string) => `animatombola:${code.toUpperCase()}`

export type TombolaOutcome = 'winner' | 'absent' | 'already'

export interface TombolaDraw {
  seq: number
  n: number
  o: TombolaOutcome
  /** Rang parmi les gagnants (null si absent / déjà gagnant). */
  lot: number | null
}

export type TombolaPublicState =
  | { active: false; held?: boolean; serverNow: string }
  | {
      active: true
      mode: 'tombola'
      v: number
      tombolaId: string
      status: 'lobby' | 'running'
      /** Plages papier [premier, dernier] inclus. */
      paper: [number, number][]
      paperCount: number
      phoneFrom: number | null
      phoneCount: number
      phoneOpen: boolean
      total: number
      /** Numéros encore dans la machine. */
      left: number
      /** Numéros sortis dans l'ordre (le dernier reste caché pendant la révélation). */
      draws: TombolaDraw[]
      hidden: boolean
      lastDrawAt: string | null
      revealAt: string | null
      display: Record<string, unknown>
      /** Régie silencieuse depuis plus de 90 s. */
      paused: boolean
      serverNow: string
    }

export type TombolaLive = Extract<TombolaPublicState, { active: true }>

/** Lots attribués (gagnants). */
export const lotsGiven = (s: TombolaLive): number => s.draws.filter((d) => d.o === 'winner').length

/** Plus récent : tombola arrêtée / relancée, autre tombola, ou version supérieure. */
export function isNewerTombola(next: TombolaPublicState, cur: TombolaPublicState | null): boolean {
  if (!cur) return true
  if (next.active !== cur.active) return true
  if (!next.active || !cur.active) return !next.active && !cur.active && next.held !== cur.held
  if (next.tombolaId !== cur.tombolaId) return true
  return next.v > cur.v
}

// ---------------------------------------------------------------- plages

/** Plages triées et fusionnées (contiguës comprises), bornes entières 1…9999. */
export function normalizeRanges(ranges: readonly (readonly [number, number])[]): [number, number][] {
  const ok = ranges
    .filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b <= TOMBOLA_MAX_NUMBER && a <= b)
    .map(([a, b]) => [a, b] as [number, number])
    .sort((x, y) => x[0] - y[0])
  const out: [number, number][] = []
  for (const r of ok) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1])
    else out.push([r[0], r[1]])
  }
  return out
}

export const rangesCount = (ranges: readonly (readonly [number, number])[]): number =>
  normalizeRanges(ranges).reduce((s, [a, b]) => s + b - a + 1, 0)

/** « 1 à 250 », « 1 à 250, 400 à 450 ». */
export function rangesText(ranges: readonly (readonly [number, number])[]): string {
  const r = normalizeRanges(ranges)
  if (!r.length) return 'aucun'
  return r.map(([a, b]) => (a === b ? `n° ${a}` : `${a} à ${b}`)).join(', ')
}

/**
 * Premier numéro téléphone : la centaine suivant le dernier ticket papier
 * (papier jusqu'à 250 → 301 ; jusqu'à 300 → 401 ; sans papier → 1).
 * null si plus aucune place.
 */
export function phoneStartAfter(ranges: readonly (readonly [number, number])[]): number | null {
  const r = normalizeRanges(ranges)
  if (!r.length) return 1
  const max = r[r.length - 1][1]
  const from = (Math.floor(max / 100) + 1) * 100 + 1
  return from <= TOMBOLA_MAX_NUMBER ? from : null
}

/** Une plage touche-t-elle les numéros téléphone (à partir de phoneFrom) ? */
export const overlapsPhones = (ranges: readonly (readonly [number, number])[], phoneFrom: number | null): boolean =>
  phoneFrom !== null && normalizeRanges(ranges).some(([, b]) => b >= phoneFrom)

/** Numéros distribués : papier + téléphone (consécutifs à partir de phoneFrom). */
export function ticketRanges(s: Pick<TombolaLive, 'paper' | 'phoneFrom' | 'phoneCount'>): [number, number][] {
  const out = s.paper.map(([a, b]) => [a, b] as [number, number])
  if (s.phoneFrom !== null && s.phoneCount > 0) out.push([s.phoneFrom, s.phoneFrom + s.phoneCount - 1])
  return normalizeRanges(out)
}

/** Ce numéro est-il un ticket téléphone ? */
export const isPhoneTicket = (s: Pick<TombolaLive, 'phoneFrom'>, n: number): boolean => s.phoneFrom !== null && n >= s.phoneFrom

/**
 * Échantillon stable de numéros ENCORE dans la machine (pour le décor du grand
 * écran) : tirés dans les vraies plages, sans parcourir 10 000 numéros.
 */
export function machineSample(s: Pick<TombolaLive, 'paper' | 'phoneFrom' | 'phoneCount' | 'draws'>, count: number, seed: number): number[] {
  const ranges = ticketRanges(s)
  const out = new Set(s.draws.map((d) => d.n))
  const total = ranges.reduce((t, [a, b]) => t + b - a + 1, 0)
  if (!total) return []
  let x = seed >>> 0 || 1
  const rnd = () => {
    x = (x * 1664525 + 1013904223) >>> 0
    return x / 4294967296
  }
  const at = (i: number) => {
    for (const [a, b] of ranges) {
      if (i <= b - a) return a + i
      i -= b - a + 1
    }
    return ranges[0][0]
  }
  const picked: number[] = []
  const seen = new Set<number>()
  for (let tries = 0; picked.length < count && tries < count * 20; tries++) {
    const n = at(Math.floor(rnd() * total))
    if (out.has(n) || seen.has(n)) continue
    seen.add(n)
    picked.push(n)
  }
  return picked
}

/** Taille du texte d'une boule selon le nombre de chiffres (1 à 90 : inchangé). */
export const digitsClass = (n: number | null | undefined): string => (n && n >= 1000 ? 'd4' : n && n >= 100 ? 'd3' : '')
