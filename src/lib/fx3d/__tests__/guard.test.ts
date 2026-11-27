import { describe, expect, it } from 'vitest'
import { RenderGuard } from '../guard'

/** Fait tourner le garde à `hz` images/s (navigateur) pendant `seconds`, rendu limité à `renderMs` par image. */
function run(g: RenderGuard, t0: number, seconds: number, hz: number, opts: { idle?: boolean; renderMs?: number; canFail?: boolean; busy?: () => boolean } = {}) {
  const step = 1000 / hz
  let now = t0
  let rendered = 0
  const windows: number[] = []
  let failedAt: number | null = null
  const end = t0 + seconds * 1000
  while (now < end) {
    // un rendu lent retarde l'image suivante
    now += Math.max(step, opts.renderMs ?? 0)
    const dt = g.frame(now, !!opts.idle)
    if (dt === null) continue
    rendered++
    const w = g.window(now)
    if (w) { windows.push(w.fps); g.judge(w, opts.canFail ?? true) }
    if (failedAt === null && g.fallbackNow(opts.busy?.() ?? false)) failedAt = now
  }
  return { now, rendered, windows, failedAt }
}

describe('RenderGuard', () => {
  it('au repos, limite le rendu à ~30 images/s sur un écran 60 Hz', () => {
    const g = new RenderGuard(0, { warmupMs: 0 })
    const r = run(g, 0, 10, 60, { idle: true })
    expect(r.rendered).toBeGreaterThanOrEqual(295)
    expect(r.rendered).toBeLessThanOrEqual(305)
  })

  it('au repos sur 144 Hz et 75 Hz, reste entre 28 et 38 images/s', () => {
    for (const hz of [144, 75, 120]) {
      const r = run(new RenderGuard(0, { warmupMs: 0 }), 0, 10, hz, { idle: true })
      expect(r.rendered / 10).toBeGreaterThanOrEqual(28)
      expect(r.rendered / 10).toBeLessThanOrEqual(38)
    }
  })

  it('en animation, rend toutes les images', () => {
    const r = run(new RenderGuard(0, { warmupMs: 0 }), 0, 5, 60)
    expect(r.rendered).toBeGreaterThanOrEqual(299)
  })

  it('affichage bloqué à 30 images/s (économie d’énergie, télé 30 Hz) : jamais de repli, même 10 minutes', () => {
    const g = new RenderGuard(0)
    const busy = run(g, 0, 300, 30)
    const idle = run(g, busy.now, 300, 30, { idle: true })
    expect(busy.failedAt).toBeNull()
    expect(idle.failedAt).toBeNull()
    expect(g.pendingFps).toBeNull()
  })

  it('PC vraiment lent (15 images/s) : repli après ~10 s de lenteur continue', () => {
    const g = new RenderGuard(0)
    const r = run(g, 0, 30, 60, { renderMs: 66 })
    expect(r.failedAt).not.toBeNull()
    // 3 s de démarrage + 10 fenêtres d'une seconde
    expect(r.failedAt!).toBeGreaterThan(12_000)
    expect(r.failedAt!).toBeLessThan(15_500)
    expect(g.pendingFps!).toBeLessThan(16)
  })

  it('pas de repli tant que la qualité peut encore baisser', () => {
    const g = new RenderGuard(0)
    const r = run(g, 0, 30, 60, { renderMs: 66, canFail: false })
    expect(r.failedAt).toBeNull()
  })

  it('un ralentissement passager (moins de 10 s) ne déclenche rien', () => {
    const g = new RenderGuard(0)
    const a = run(g, 0, 10, 60, { renderMs: 66 })
    const b = run(g, a.now, 5, 60)
    const c = run(g, b.now, 8, 60, { renderMs: 66 })
    expect(a.failedAt ?? b.failedAt ?? c.failedAt).toBeNull()
  })

  it('repli décidé pendant un lancer : attend la fin du lancer', () => {
    const g = new RenderGuard(0)
    let spinning = true
    const r = run(g, 0, 20, 60, { renderMs: 66, busy: () => spinning })
    expect(g.pendingFps).not.toBeNull()
    expect(r.failedAt).toBeNull()
    spinning = false
    expect(g.fallbackNow(spinning)).toBe(true)
  })

  it('onglet caché (images très espacées) : rien n’est compté comme lent', () => {
    const g = new RenderGuard(0)
    let now = 0
    for (let i = 0; i < 200; i++) { now += 1000; g.frame(now, false); const w = g.window(now); if (w) g.judge(w, true) }
    expect(g.pendingFps).toBeNull()
  })
})
