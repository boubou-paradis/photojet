// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot, src/live/sfx.ts), qui reste la référence (sons validés le 15/11, buzz Arcade).

// Sons « jeu télé » synthétisés localement (WebAudio) : aucun fichier, aucune licence tierce.
// Petit synthé : cuivres (scies filtrées), cloches FM, bruit filtré (souffle, caisse claire, applaudissements),
// réverbération générée, compresseur. Joués par la régie (PC animateur) après un premier geste (clic ou touche).

export type SoundName =
  | 'reveal' | 'buzz' | 'correct' | 'wrong' | 'timeout' | 'round' | 'turn' | 'letterHit' | 'letterMiss' | 'nobody' | 'tick' | 'tickLast' | 'podium'

const PREF = 'animajet-demimot-sons'
export const BUZZ_STYLES = ['corne', 'comptoir', 'arcade', 'quiz', 'classique'] as const
export type BuzzStyle = (typeof BUZZ_STYLES)[number]
export const BUZZ_LABELS: Record<BuzzStyle, [string, string]> = {
  corne: ['Corne de fête', 'Klaxon de supporters « POUÊÊÊT », très festif'],
  comptoir: ['Sonnette de comptoir', '« Ding ! » de la clochette du bar, net et clair'],
  arcade: ['Arcade', 'Éclair électronique qui monte, façon jeu vidéo'],
  quiz: ['Quiz télé', 'Double gong lumineux « ding-dong ! »'],
  classique: ['Buzzer classique', 'L’ancien : grave et râpeux'],
}
export interface SoundPrefs {
  on: boolean
  volume: number
  buzz: BuzzStyle
}
/** Buzz par défaut, choisi par l'utilisateur le 15/11 : « Arcade ». */
export const DEFAULT_BUZZ: BuzzStyle = 'arcade'
export function readSound(): SoundPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) ?? '')
    return { on: v.on !== false, volume: Math.min(1, Math.max(0, Number(v.volume) || 0.8)), buzz: BUZZ_STYLES.includes(v.buzz) ? v.buzz : DEFAULT_BUZZ }
  } catch {
    return { on: true, volume: 0.8, buzz: DEFAULT_BUZZ }
  }
}
/** Enregistre seulement les champs fournis (deux pages ouvertes ne s'écrasent pas mutuellement).
 *  Les valeurs par défaut ne sont pas figées : un buzz jamais choisi suit DEFAULT_BUZZ. */
export function writeSound(p: Partial<SoundPrefs>) {
  try {
    let saved: Record<string, unknown> = {}
    try {
      const v = JSON.parse(localStorage.getItem(PREF) ?? '')
      if (v && typeof v === 'object') saved = v
    } catch {
      /* rien d'enregistré */
    }
    localStorage.setItem(PREF, JSON.stringify({ ...saved, ...p }))
  } catch {
    /* préférence non conservée */
  }
}

let ctx: BaseAudioContext | null = null
let master: GainNode | null = null
let dry: GainNode | null = null
let wet: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function build(c: BaseAudioContext) {
  master = c.createGain()
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 10
  comp.ratio.value = 4
  comp.attack.value = 0.003
  comp.release.value = 0.2
  master.connect(comp).connect(c.destination)
  dry = c.createGain()
  dry.connect(master)
  // Réverbération de « plateau » : réponse impulsionnelle générée (bruit qui décroît).
  const len = Math.floor(c.sampleRate * 1.8)
  const ir = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  }
  const conv = c.createConvolver()
  conv.buffer = ir
  wet = c.createGain()
  wet.gain.value = 0.22
  wet.connect(conv).connect(master)
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const n = noiseBuf.getChannelData(0)
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1
}

/** À appeler depuis un geste de l'utilisateur (clic). */
export async function unlock(volume: number) {
  if (!ctx) {
    ctx = new AudioContext()
    build(ctx)
  }
  master!.gain.value = volume
  if (ctx.state !== 'running') await (ctx as AudioContext).resume()
  return ctx.state === 'running'
}
export function setVolume(v: number) {
  if (master) master.gain.value = v
}
export const audioReady = () => !!ctx && ctx.state === 'running'

// ---------------------------------------------------------------- briques
const NOTE = (n: string) => {
  const m = n.match(/^([A-G])(#|b)?(\d)$/)!
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * Math.pow(2, (semi + (Number(m[3]) - 4) * 12 - 9) / 12)
}

function out(node: AudioNode, reverb: number) {
  node.connect(dry!)
  if (reverb > 0) {
    const s = ctx!.createGain()
    s.gain.value = reverb
    node.connect(s).connect(wet!)
  }
}

function envelope(g: GainNode, t: number, peak: number, a: number, dur: number, r: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + a)
  g.gain.setValueAtTime(peak, t + Math.max(a, dur - r))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}

/** Cuivre : deux scies désaccordées, filtre qui s'ouvre (« attaque » de trompette), vibrato optionnel. */
function brass(freq: number, t: number, dur: number, o: { gain?: number; vibrato?: number; slideTo?: number; bright?: number; reverb?: number } = {}) {
  const c = ctx!
  const g = c.createGain()
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 2
  const bright = o.bright ?? 2600
  f.frequency.setValueAtTime(350, t)
  f.frequency.exponentialRampToValueAtTime(bright, t + 0.06)
  f.frequency.exponentialRampToValueAtTime(bright * 0.55, t + dur)
  envelope(g, t, o.gain ?? 0.18, 0.025, dur, Math.min(0.18, dur / 2))
  f.connect(g)
  out(g, o.reverb ?? 0.5)
  for (const det of [-9, 9, 0]) {
    const osc = c.createOscillator()
    osc.type = det === 0 ? 'square' : 'sawtooth'
    osc.frequency.setValueAtTime(det === 0 ? freq / 2 : freq, t)
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(det === 0 ? o.slideTo / 2 : o.slideTo, t + dur)
    osc.detune.value = det
    if (o.vibrato) {
      const lfo = c.createOscillator()
      const lg = c.createGain()
      lfo.frequency.value = 5.5
      lg.gain.setValueAtTime(0, t)
      lg.gain.linearRampToValueAtTime(o.vibrato, t + dur * 0.5)
      lfo.connect(lg).connect(osc.detune)
      lfo.start(t)
      lfo.stop(t + dur + 0.1)
    }
    const og = c.createGain()
    og.gain.value = det === 0 ? 0.35 : 0.5
    osc.connect(og).connect(f)
    osc.start(t)
    osc.stop(t + dur + 0.1)
  }
}

/** Cloche FM (porteuse + modulatrice inharmonique) : scintillements, ding-dong. */
function bell(freq: number, t: number, dur = 1.2, gain = 0.12, reverb = 0.6) {
  const c = ctx!
  const car = c.createOscillator()
  const mod = c.createOscillator()
  const mg = c.createGain()
  const g = c.createGain()
  car.frequency.value = freq
  mod.frequency.value = freq * 3.5
  mg.gain.setValueAtTime(freq * 2.2, t)
  mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur)
  mod.connect(mg).connect(car.frequency)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  car.connect(g)
  out(g, reverb)
  car.start(t)
  mod.start(t)
  car.stop(t + dur + 0.05)
  mod.stop(t + dur + 0.05)
}

function noise(t: number, dur: number, o: { gain?: number; type?: BiquadFilterType; f0: number; f1?: number; q?: number; attack?: number; reverb?: number }) {
  const c = ctx!
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = o.type ?? 'bandpass'
  f.Q.value = o.q ?? 1
  f.frequency.setValueAtTime(o.f0, t)
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.2, t + (o.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g)
  out(g, o.reverb ?? 0.2)
  src.start(t, Math.random())
  src.stop(t + dur + 0.05)
}

function tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, reverb = 0.15) {
  const c = ctx!
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  out(g, reverb)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Applaudissements : nombreuses frappes de bruit aléatoires, enveloppe gonflée puis retombée. */
function applause(t: number, dur: number, gain = 0.5) {
  const claps = Math.floor(dur * 55)
  for (let i = 0; i < claps; i++) {
    const at = t + Math.random() * dur
    const x = (at - t) / dur
    const shape = Math.min(1, x * 5) * (1 - Math.pow(x, 2.2))
    noise(at, 0.03 + Math.random() * 0.04, { gain: gain * shape * (0.3 + Math.random() * 0.7), f0: 900 + Math.random() * 1800, q: 1.4, attack: 0.002, reverb: 0.5 })
  }
}

function snareRoll(t: number, dur: number) {
  const hits = Math.floor(dur * 28)
  for (let i = 0; i < hits; i++) {
    const at = t + (i / hits) * dur
    noise(at, 0.06, { gain: 0.05 + 0.25 * (i / hits), f0: 2400, q: 0.7, attack: 0.002, reverb: 0.3 })
  }
}

function whoosh(t: number, dur = 0.55, up = true) {
  noise(t, dur, { gain: 0.22, f0: up ? 250 : 4000, f1: up ? 5000 : 250, q: 2.5, attack: dur * 0.6, reverb: 0.4 })
}

// ---------------------------------------------------------------- sons du jeu
const PENTA = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7', 'A7'].map(NOTE)
let revealStep = 0

export function play(name: SoundName) {
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime + 0.02
  switch (name) {
    case 'reveal': {
      // Chaque lettre monte d'une note : le dévoilement devient une petite mélodie qui fait monter la tension.
      const f = PENTA[revealStep++ % PENTA.length]
      bell(f, t, 0.5, 0.2, 0.5)
      tone(f * 2, t, 0.06, 'triangle', 0.07)
      break
    }
    case 'buzz':
      playBuzz(readSound().buzz, t)
      break
    case 'correct': {
      // « Ta-da-da-DAAA » de cuivres, accord final, pluie de cloches et applaudissements.
      const seq: [string, number, number][] = [['G4', 0, 0.12], ['C5', 0.12, 0.12], ['E5', 0.24, 0.12], ['G5', 0.36, 1.1]]
      for (const [n, at, d] of seq) brass(NOTE(n), t + at, d, { gain: 0.16, bright: 3200 })
      for (const n of ['C5', 'E5', 'G5', 'C6']) brass(NOTE(n), t + 0.36, 1.1, { gain: 0.07, bright: 2400 })
      ;['C7', 'E7', 'G7', 'C8', 'G7', 'C8'].forEach((n, i) => bell(NOTE(n), t + 0.42 + i * 0.06, 0.9, 0.05))
      noise(t + 0.36, 0.25, { gain: 0.25, type: 'highpass', f0: 6000, attack: 0.002, reverb: 0.6 })
      applause(t + 0.4, 2.2, 0.35)
      break
    }
    case 'wrong':
      // Trombone triste « wah wah wah waaah ».
      ;(['D4', 'C#4', 'C4'] as const).forEach((n, i) => brass(NOTE(n), t + i * 0.42, 0.38, { gain: 0.16, bright: 1300, reverb: 0.3 }))
      brass(NOTE('B3'), t + 1.26, 1.1, { gain: 0.16, bright: 1300, vibrato: 45, reverb: 0.3 })
      break
    case 'timeout':
      // Klaxon « pouet-pouet » : temps écoulé.
      for (const at of [0, 0.22]) {
        tone(233, t + at, 0.18, 'sawtooth', 0.12)
        tone(220, t + at, 0.18, 'square', 0.1)
      }
      brass(NOTE('E3'), t + 0.46, 0.5, { gain: 0.15, bright: 900, slideTo: NOTE('A2') })
      break
    case 'nobody':
      // Énigme terminée sans gagnant : petit « bwoop » descendant.
      tone(NOTE('G4'), t, 0.18, 'triangle', 0.15, NOTE('D4'))
      tone(NOTE('D4'), t + 0.2, 0.45, 'triangle', 0.15, NOTE('G3'))
      break
    case 'round':
      // Nouvelle énigme : souffle montant puis éclat de cloches.
      whoosh(t, 0.55)
      bell(NOTE('E6'), t + 0.5, 1.4, 0.1)
      bell(NOTE('B6'), t + 0.5, 1.4, 0.07)
      bell(NOTE('E7'), t + 0.58, 1.2, 0.05)
      revealStep = 0
      break
    case 'turn':
      // Ding-dong : à l'équipe suivante.
      bell(NOTE('E6'), t, 1, 0.12)
      bell(NOTE('C6'), t + 0.28, 1.3, 0.12)
      break
    case 'letterHit':
      bell(NOTE('A6'), t, 0.6, 0.18)
      bell(NOTE('E7'), t + 0.07, 0.7, 0.13)
      break
    case 'letterMiss':
      // « Bonk » : lettre absente.
      tone(190, t, 0.22, 'sine', 0.3, 80, 0.05)
      noise(t, 0.05, { gain: 0.15, f0: 600, q: 2 })
      break
    case 'tick':
      // Bloc de bois : compte à rebours.
      tone(1250, t, 0.07, 'sine', 0.4, 900, 0.05)
      noise(t, 0.03, { gain: 0.16, f0: 2500, q: 4 })
      break
    case 'tickLast':
      tone(1650, t, 0.09, 'sine', 0.48, 1200, 0.05)
      noise(t, 0.03, { gain: 0.2, f0: 3000, q: 4 })
      break
    case 'podium': {
      // Roulement de tambour, coup de cymbale, grande fanfare, applaudissements nourris.
      snareRoll(t, 1.6)
      const h = t + 1.6
      noise(h, 1.6, { gain: 0.3, type: 'highpass', f0: 5000, attack: 0.003, reverb: 0.7 })
      tone(55, h, 0.6, 'sine', 0.4, 40, 0.1)
      const fan: [string, number, number][] = [['C5', 0, 0.16], ['C5', 0.18, 0.1], ['C5', 0.3, 0.1], ['E5', 0.42, 0.22], ['G5', 0.66, 0.22], ['C6', 0.9, 1.6]]
      for (const [n, at, d] of fan) brass(NOTE(n), h + at, d, { gain: 0.17, bright: 3400 })
      for (const n of ['C5', 'E5', 'G5']) brass(NOTE(n), h + 0.9, 1.6, { gain: 0.07, bright: 2600 })
      ;['C7', 'E7', 'G7', 'C8', 'E8'].forEach((n, i) => bell(NOTE(n), h + 0.95 + i * 0.07, 1.2, 0.05))
      applause(h + 0.6, 4.5, 0.45)
      break
    }
  }
}

/** Événements du moteur (« type » ou « type:valeur ») → sons. Un seul son principal par message. */
export function playEvents(events: string[]) {
  const ev = events.map((e) => e.split(':'))
  const has = (k: string) => ev.find(([t]) => t === k)
  if (has('podium')) return play('podium')
  if (has('correct')) return play('correct')
  if (has('timeout')) return play('timeout')
  if (has('wrong')) return play('wrong')
  const res = has('resolved')
  if (res && res[1] === '0') return play('nobody')
  if (has('buzz')) return play('buzz')
  if (has('round')) return play('round')
  const letter = has('letter')
  if (letter) play(Number(letter[1]) > 0 ? 'letterHit' : 'letterMiss')
  if (has('turn')) return play('turn')
  if (has('reveal')) play('reveal')
}

/** Rendu hors ligne d'un son (contrôle qualité : niveau crête et efficace, absence de silence ou de saturation). */
export async function renderOffline(name: SoundName | `buzz:${BuzzStyle}`, seconds = 7) {
  const saved = { ctx, master, dry, wet, noiseBuf, revealStep }
  const off = new OfflineAudioContext(2, Math.floor(44100 * seconds), 44100)
  ctx = off
  build(off)
  master!.gain.value = 0.8
  Object.defineProperty(off, 'state', { value: 'running', configurable: true })
  if (name.startsWith('buzz:')) playBuzz(name.slice(5) as BuzzStyle)
  else play(name as SoundName)
  ctx = saved.ctx
  master = saved.master
  dry = saved.dry
  wet = saved.wet
  noiseBuf = saved.noiseBuf
  revealStep = saved.revealStep
  const buf = await off.startRendering()
  const d = buf.getChannelData(0)
  let peak = 0
  let sum = 0
  let lastLoud = 0
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i])
    if (a > peak) peak = a
    sum += d[i] * d[i]
    if (a > 0.01) lastLoud = i
  }
  return { peak, rms: Math.sqrt(sum / d.length), durationS: lastLoud / 44100 }
}

/** Les différents buzz au choix (réglage retenu sur ce poste, page /sons). */
export function playBuzz(style: BuzzStyle, at?: number) {
  if (!ctx || ctx.state !== 'running') return
  const t = at ?? ctx.currentTime + 0.02
  const c = ctx
  switch (style) {
    case 'corne': {
      // Corne de supporters : trois anches désaccordées, attaque qui « crache », hauteur qui monte un peu.
      noise(t, 0.1, { gain: 0.3, f0: 1200, q: 0.8, attack: 0.002 })
      for (const [f, det] of [[415, -18], [415, 14], [622, 0], [207, 6]] as const) {
        const o = c.createOscillator()
        const g = c.createGain()
        const lp = c.createBiquadFilter()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f * 0.94, t)
        o.frequency.exponentialRampToValueAtTime(f, t + 0.08)
        o.detune.value = det
        lp.type = 'lowpass'
        lp.Q.value = 3
        lp.frequency.setValueAtTime(900, t)
        lp.frequency.exponentialRampToValueAtTime(4200, t + 0.05)
        lp.frequency.exponentialRampToValueAtTime(2600, t + 0.8)
        envelope(g, t, f > 600 ? 0.06 : 0.1, 0.015, 0.85, 0.12)
        o.connect(lp).connect(g)
        out(g, 0.35)
        o.start(t)
        o.stop(t + 0.95)
      }
      break
    }
    case 'comptoir':
      // Clochette de comptoir : impact métallique + longue résonance inharmonique.
      noise(t, 0.02, { gain: 0.4, type: 'highpass', f0: 4000, attack: 0.001, reverb: 0.3 })
      for (const [r, g, d] of [[1, 0.3, 1.6], [2.76, 0.16, 1.1], [5.4, 0.1, 0.7], [8.93, 0.05, 0.4]] as const) tone(2093 * r * 0.5, t, d, 'sine', g, undefined, 0.6)
      break
    case 'arcade': {
      // Éclair électronique : balayage montant en carré + accord brillant final.
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'square'
      o.frequency.setValueAtTime(180, t)
      o.frequency.exponentialRampToValueAtTime(1600, t + 0.22)
      envelope(g, t, 0.16, 0.005, 0.24, 0.04)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 5000
      o.connect(lp).connect(g)
      out(g, 0.2)
      o.start(t)
      o.stop(t + 0.3)
      for (const n of ['C6', 'E6', 'G6', 'C7']) tone(NOTE(n), t + 0.22, 0.45, 'square', 0.06, undefined, 0.4)
      noise(t + 0.22, 0.25, { gain: 0.15, type: 'highpass', f0: 6000, attack: 0.002, reverb: 0.5 })
      break
    }
    case 'quiz':
      // Double gong lumineux, appuyé par un cuivre court.
      bell(NOTE('G6'), t, 1.1, 0.3)
      bell(NOTE('D7'), t, 1.1, 0.16)
      bell(NOTE('B6'), t + 0.16, 1.3, 0.3)
      bell(NOTE('F#7'), t + 0.16, 1.3, 0.14)
      brass(NOTE('G4'), t, 0.3, { gain: 0.12, bright: 3000 })
      break
    case 'classique':
      noise(t, 0.08, { gain: 0.35, f0: 1500, q: 0.6, attack: 0.002 })
      for (const [f, ty] of [[146.8, 'square'], [155.6, 'sawtooth'], [293.7, 'square']] as const) {
        const o = c.createOscillator()
        const g = c.createGain()
        const trem = c.createOscillator()
        const tg = c.createGain()
        o.type = ty
        o.frequency.value = f
        trem.frequency.value = 32
        tg.gain.value = 0.06
        trem.connect(tg).connect(g.gain)
        envelope(g, t, 0.13, 0.01, 0.62, 0.08)
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 2400
        o.connect(lp).connect(g)
        out(g, 0.15)
        o.start(t)
        trem.start(t)
        o.stop(t + 0.7)
        trem.stop(t + 0.7)
      }
      break
  }
}
