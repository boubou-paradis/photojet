// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Surveillance commune des plateaux 3D du grand écran (Roue, À Demi-Mot, machine AnimaBingo).
//   - Au repos (rien ne bouge vite), le rendu est limité à ~30 images/s : le PC chauffe moins.
//   - Un affichage bloqué à 30 images/s (Chrome en économie d'énergie, télé à 30 Hz) n'est JAMAIS un motif de repli.
//   - Repli 2D seulement si le rendu reste sous FAIL_FPS pendant FAIL_WINDOWS secondes de suite
//     (et au niveau de qualité le plus bas pour les jeux qui en ont plusieurs).
//   - Le repli décidé pendant une animation (lancer, tirage, révélation) attend la fin de l'animation.
// Pur calcul sur les horodatages : aucune dépendance au navigateur (testé dans guard.test.ts).

export const FX3D_FAIL_FPS = 22
export const FX3D_FAIL_WINDOWS = 10
export const FX3D_IDLE_FPS = 30

export interface GuardWindow {
  /** Images rendues par seconde sur la fenêtre écoulée. */
  fps: number
  /** Vrai si au moins une image de la fenêtre a été rendue au rythme réduit du repos. */
  idle: boolean
}

export interface GuardOptions {
  warmupMs?: number
  failFps?: number
  failWindows?: number
  idleFps?: number
}

export class RenderGuard {
  private last: number
  private lastRender: number
  private readonly start: number
  private winStart: number
  private winFrames = 0
  private winIdle = false
  private slow = 0
  private slowSum = 0
  private pending: number | null = null
  private readonly warmupMs: number
  private readonly failFps: number
  private readonly failWindows: number
  private readonly idleMs: number

  constructor(now: number, opts: GuardOptions = {}) {
    this.last = now
    this.lastRender = now
    this.start = now
    this.winStart = now
    this.warmupMs = opts.warmupMs ?? 3000
    this.failFps = opts.failFps ?? FX3D_FAIL_FPS
    this.failWindows = opts.failWindows ?? FX3D_FAIL_WINDOWS
    this.idleMs = 1000 / (opts.idleFps ?? FX3D_IDLE_FPS)
  }

  /**
   * À appeler à chaque image du navigateur. Renvoie le temps écoulé (s) depuis la dernière image RENDUE,
   * ou null si cette image doit être sautée (repos limité à 30 images/s, onglet caché, pause du navigateur).
   */
  frame(now: number, idle: boolean): number | null {
    const gap = now - this.last
    if (gap <= 0) return null
    this.last = now
    // onglet caché, fenêtre recouverte, PC en veille : rien n'est compté (ni lent ni rapide)
    if (gap > 250) {
      this.lastRender = now
      this.winStart = now
      this.winFrames = 0
      this.winIdle = false
      return null
    }
    // au repos : une image sur deux à 60 Hz (rendue dès que l'image suivante dépasserait l'intervalle visé)
    if (idle && now - this.lastRender + gap / 2 < this.idleMs) return null
    const dt = (now - this.lastRender) / 1000
    this.lastRender = now
    if (now - this.start < this.warmupMs) {
      this.winStart = now
      this.winFrames = 0
      this.winIdle = false
      return dt
    }
    this.winFrames++
    if (idle) this.winIdle = true
    return dt
  }

  /** Fenêtre d'une seconde terminée (à appeler juste après le rendu) ; null tant qu'elle n'est pas finie. */
  window(now: number): GuardWindow | null {
    if (now - this.start < this.warmupMs || now - this.winStart < 1000) return null
    const w = { fps: (this.winFrames * 1000) / (now - this.winStart), idle: this.winIdle }
    this.winStart = now
    this.winFrames = 0
    this.winIdle = false
    return w
  }

  /**
   * Juge une fenêtre. `canFail` = le jeu ne peut plus alléger son rendu (qualité minimale atteinte).
   * Une fois décidé, le repli reste en attente jusqu'à ce que `fallbackNow(false)` soit appelé hors animation.
   */
  judge(w: GuardWindow, canFail: boolean) {
    if (this.pending !== null) return
    if (canFail && w.fps < this.failFps) {
      this.slow++
      this.slowSum += w.fps
      if (this.slow >= this.failWindows) this.pending = this.slowSum / this.slow
    } else {
      this.slow = 0
      this.slowSum = 0
    }
  }

  /** Images/s moyennes ayant décidé le repli (en attente), sinon null. */
  get pendingFps(): number | null {
    return this.pending
  }

  /** Vrai quand le repli décidé peut se faire maintenant (aucune animation en cours). */
  fallbackNow(busy: boolean): boolean {
    return this.pending !== null && !busy
  }
}
