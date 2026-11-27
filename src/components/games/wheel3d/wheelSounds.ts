// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Roue de la Destinée 2.0 — bruitages ElevenLabs figés dans public/sounds/roue (aucun appel réseau externe).
// Ils ÉCOUTENT les événements du moteur de WheelGame (lancement, ralentissement, séparateurs, arrêt, résultat) ;
// ils ne pilotent ni ne retardent rien. Sans interaction préalable avec la page, le navigateur bloque le son :
// la roue tourne alors en silence, rien ne casse.
// Avec une musique personnalisée, le roulement et le roulement de tambour se taisent (la musique les remplace).

const BASE = '/sounds/roue/'
const NOMS = ['cran', 'lancement', 'roulement', 'tension', 'arret', 'fanfare', 'applaudissements', 'scintillement'] as const
type Nom = (typeof NOMS)[number]
/** Volume moyen mesuré de chaque fichier (dB) : tout est ramené vers −20 dB, puis un limiteur évite la saturation. */
const MOY: Record<Nom, number> = { cran: -25.2, lancement: -14.2, roulement: -26.1, tension: -13.4, arret: -22.4, fanfare: -15.2, applaudissements: -16.8, scintillement: -25.7 }
const FREE_SPEED = 450

interface Voix { s: AudioBufferSourceNode; g: GainNode; base: number }

export class WheelSounds {
  private ctx: AudioContext | null = null
  private lim: DynamicsCompressorNode | null = null
  private buf: Partial<Record<Nom, AudioBuffer>> = {}
  private roul: Voix | null = null
  private tens: Voix | null = null
  private dernierCran = 0
  private musique = false
  private unlock = () => { void this.ctx?.resume().catch(() => {}) }
  ready = false

  constructor() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      const ctx = (this.ctx = new Ctor())
      const lim = (this.lim = ctx.createDynamicsCompressor())
      lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.003; lim.release.value = 0.15
      const out = ctx.createGain(); out.gain.value = 0.85
      lim.connect(out).connect(ctx.destination)
    } catch {
      this.ctx = null
      return
    }
    window.addEventListener('pointerdown', this.unlock)
    window.addEventListener('keydown', this.unlock)
    void Promise.all(NOMS.map(async (n) => {
      const r = await fetch(`${BASE}${n}.mp3`)
      if (!r.ok) throw new Error(n)
      this.buf[n] = await this.ctx!.decodeAudioData(await r.arrayBuffer())
    })).then(() => { this.ready = true }, () => { this.ready = false })
  }

  /** Vrai si le son peut sortir maintenant (fichiers chargés + navigateur déverrouillé). */
  get active() { return this.ready && this.ctx?.state === 'running' }

  private jouer(n: Nom, { vol = 1, vitesse = 1, boucle = false, dans = 0 } = {}): Voix | null {
    const ctx = this.ctx, b = this.buf[n]
    if (!ctx || !b || !this.lim || ctx.state !== 'running') return null
    const s = ctx.createBufferSource(); s.buffer = b; s.loop = boucle; s.playbackRate.value = vitesse
    const g = ctx.createGain(); g.gain.value = vol * Math.min(3, 10 ** ((-20 - MOY[n]) / 20))
    s.connect(g).connect(this.lim); s.start(ctx.currentTime + dans)
    return { s, g, base: g.gain.value }
  }

  private couper(v: Voix | null, d = 0.15) {
    if (!v || !this.ctx) return
    const t = this.ctx.currentTime
    try {
      v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + d)
      v.s.stop(t + d + 0.02)
    } catch { /* déjà arrêtée */ }
  }

  lancement(musique: boolean) {
    this.musique = musique
    this.couper(this.roul); this.couper(this.tens); this.roul = this.tens = null
    if (musique) return
    this.jouer('lancement')
    this.roul = this.jouer('roulement', { boucle: true, vol: 0.0001, dans: 0.35 })
  }

  decel() {
    if (!this.musique) this.tens = this.jouer('tension', { vol: 0.75 })
  }

  /** À chaque image : le roulement suit la vitesse réelle de la roue. */
  image(vel: number, phase: string) {
    const roul = this.roul, ctx = this.ctx
    if (!roul || !ctx) return
    const vr = vel / FREE_SPEED
    const cible = phase === 'free' || phase === 'spinup' ? 0.55 : phase === 'decel' ? 0.55 * Math.min(1, vr * 1.6) : 0
    roul.g.gain.setTargetAtTime(roul.base * cible, ctx.currentTime, 0.08)
    roul.s.playbackRate.setTargetAtTime(0.55 + 0.45 * vr, ctx.currentTime, 0.08)
  }

  /** Un séparateur passe sous le pointeur. Sans musique, le roulement couvre la grande vitesse. */
  cran(vel: number, phase: string) {
    const vr = vel / FREE_SPEED
    if (!this.musique && (phase !== 'decel' || vr > 0.55)) return
    const t = performance.now()
    if (t - this.dernierCran < 55) return
    this.dernierCran = t
    const vol = (this.musique ? 0.5 : 1) * (0.45 + 0.55 * (1 - Math.min(1, vr)))
    this.jouer('cran', { vol, vitesse: 0.94 + Math.random() * 0.12 })
  }

  arret() {
    this.couper(this.roul, 0.12); this.roul = null
    this.couper(this.tens, 0.25); this.tens = null
    this.jouer('arret')
  }

  resultat() {
    this.jouer('fanfare')
    this.jouer('scintillement', { dans: 0.15, vol: 0.8 })
    this.jouer('applaudissements', { dans: 0.4, vol: 0.7 })
  }

  dispose() {
    window.removeEventListener('pointerdown', this.unlock)
    window.removeEventListener('keydown', this.unlock)
    this.couper(this.roul); this.couper(this.tens)
    void this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
