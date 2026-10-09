// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Mouvement de la Roue de la Destinée (écran géant), en logique pure et
// testée. La roue tourne librement à vitesse constante, puis décélère pour
// s'arrêter sur la case tirée. La décélération démarre EXACTEMENT à la vitesse
// en cours (aucun à-coup) et se termine par un long ralentissement où l'on voit
// défiler les dernières cases : c'est là que se joue le suspense.
//
// Courbe : position(t) = S × (1 − (1 − t/D)^n). Vitesse au départ = S·n/D,
// donc pour partir de la vitesse v il faut S·n = v·D. On choisit la distance
// S (qui doit faire tomber la roue sur la case) et l'exposant n (plus n est
// grand, plus la fin est lente) pour respecter cette égalité.

/** Vitesse de rotation libre, en degrés par seconde (identique à l'ancienne roue). */
export const FREE_SPEED_DEG_S = 450
/** Montée en vitesse au lancement. */
export const SPIN_UP_MS = 500

const N_MIN = 1.8
const N_MAX = 7.5
const N_IDEAL = 3.6
/** Durée minimale de décélération acceptable (s). */
const D_MIN = 1.8

export interface DecelPlan {
  /** Distance à parcourir (degrés, positive). */
  distance: number
  /** Durée (secondes). */
  duration: number
  /** Exposant de la courbe (n ≥ 1). */
  power: number
}

export const mod360 = (a: number) => ((a % 360) + 360) % 360

/**
 * Plan de décélération : partir de `angle` à la vitesse `velocity` (°/s) et
 * s'arrêter sur un angle équivalent (modulo 360) à `targetAngle`, en au plus
 * `maxDuration` secondes.
 */
export function planDeceleration(angle: number, velocity: number, targetAngle: number, maxDuration: number): DecelPlan {
  const v = Math.max(velocity, 60)
  const dMax = Math.max(maxDuration, 0.8)
  const base = mod360(targetAngle - mod360(angle))
  const distances = Array.from({ length: 6 }, (_, k) => base + k * 360).filter((s) => s > 1)

  // 1. Meilleur compromis : la durée la plus longue possible (suspense) et un
  //    exposant proche de l'idéal (fin lente mais pas interminable).
  let best: DecelPlan | null = null
  let bestCost = Infinity
  for (let d = dMax; d >= Math.min(D_MIN, dMax) - 1e-9; d -= 0.02) {
    for (const s of distances) {
      const n = (v * d) / s
      if (n < N_MIN || n > N_MAX) continue
      const cost = (dMax - d) * 1.5 + Math.abs(n - N_IDEAL) * 0.6
      if (cost < bestCost) { bestCost = cost; best = { distance: s, duration: d, power: n } }
    }
  }
  if (best) return best

  // 2. Repli (très rare) : durée maximale, exposant le plus proche de l'idéal, borné.
  let fallback: DecelPlan = { distance: distances[0] ?? 360, duration: dMax, power: N_IDEAL }
  for (const s of distances) {
    const n = Math.min(8, Math.max(1.4, (v * dMax) / s))
    if (Math.abs(n - N_IDEAL) < Math.abs(fallback.power - N_IDEAL)) fallback = { distance: s, duration: dMax, power: n }
  }
  return fallback
}

/** Progression de la décélération (0 → distance) à l'instant t (secondes). */
export function decelPosition(plan: DecelPlan, t: number): number {
  if (t <= 0) return 0
  if (t >= plan.duration) return plan.distance
  return plan.distance * (1 - Math.pow(1 - t / plan.duration, plan.power))
}

/** Vitesse instantanée de la décélération (°/s) à l'instant t. */
export function decelVelocity(plan: DecelPlan, t: number): number {
  if (t >= plan.duration) return 0
  return ((plan.distance * plan.power) / plan.duration) * Math.pow(1 - Math.max(0, t) / plan.duration, plan.power - 1)
}

/**
 * Angle d'arrêt pour qu'une case soit sous le pointeur (en haut). La case
 * d'index `index` (parmi `count` cases) occupe [index·α, (index+1)·α] depuis
 * le haut, dans le sens horaire. `jitter` ∈ [−1, 1] décale l'arrêt dans la
 * case (jamais au-delà de 32 % de la demi-case : la case reste lisible).
 */
export function targetAngleFor(index: number, count: number, jitter = 0): number {
  const seg = 360 / count
  const offset = Math.max(-1, Math.min(1, jitter)) * seg * 0.32
  return mod360(360 - index * seg - seg / 2 + offset)
}

/** Index de la case sous le pointeur pour une rotation donnée. */
export function indexUnderPointer(angle: number, count: number): number {
  const seg = 360 / count
  return Math.floor(mod360(360 - mod360(angle)) / seg) % count
}
