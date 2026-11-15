// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// À Demi-Mot jusqu'à 20 équipes : palette, équipes par défaut, limites moteur et validation.
import { describe, expect, it } from 'vitest'
import { apply, createGame, MAX_TEAMS, MIN_TEAMS, type Command } from '../engine'
import { parseAdminRequest } from '../validation'
import { DEMIMOT_DEFAULT_TEAM_COUNT, DEMIMOT_LECTERN_MAX } from '../constants'
import { defaultTeams, nextFreeTeam, TEAM_PALETTE } from '../view'
import type { GameState, Puzzle } from '../types'

// ---- Mesure des couleurs (CIEDE2000 + contraste WCAG sur le fond du plateau) ----
const hex2rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function lab(h: string): [number, number, number] {
  const [r, g, b] = hex2rgb(h).map(lin)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
function de2000([L1, a1, b1]: number[], [L2, a2, b2]: number[]) {
  const rad = Math.PI / 180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const hue = (b: number, a: number) => { const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v }
  const h1 = hue(b1, a1p), h2 = hue(b2, a2p)
  const dL = L2 - L1, dC = C2p - C1p
  let dh = h2 - h1
  if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad)
  const Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2
  let hb = h1 + h2
  if (C1p * C2p !== 0) hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad)
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T
  const Rt = -2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad)
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}
const lum = (h: string) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (h: string) => (lum(h) + 0.05) / (lum('#0D0D0F') + 0.05)

describe('palette des 20 équipes', () => {
  it('20 entrées, noms et couleurs uniques', () => {
    expect(TEAM_PALETTE).toHaveLength(MAX_TEAMS)
    expect(new Set(TEAM_PALETTE.map((p) => p.name.toLocaleLowerCase('fr-FR'))).size).toBe(20)
    expect(new Set(TEAM_PALETTE.map((p) => p.color.toUpperCase())).size).toBe(20)
    for (const p of TEAM_PALETTE) {
      expect(p.color).toMatch(/^#[0-9A-F]{6}$/i)
      expect(p.name.length).toBeLessThanOrEqual(28)
    }
  })
  it('couleurs distinctes deux à deux (CIEDE2000 ≥ 15)', () => {
    let min = Infinity
    for (let i = 0; i < TEAM_PALETTE.length; i++)
      for (let j = i + 1; j < TEAM_PALETTE.length; j++)
        min = Math.min(min, de2000(lab(TEAM_PALETTE[i].color), lab(TEAM_PALETTE[j].color)))
    expect(min).toBeGreaterThanOrEqual(15)
  })
  it('lisibles sur le fond sombre (contraste ≥ 3,6)', () => {
    for (const p of TEAM_PALETTE) expect(contrast(p.color)).toBeGreaterThanOrEqual(3.6)
  })
  it('les 6 premières couleurs d’origine ne bougent pas', () => {
    expect(TEAM_PALETTE.slice(0, 6).map((p) => p.color)).toEqual(['#3B82F6', '#F97316', '#A855F7', '#EC4899', '#22D3EE', '#FACC15'])
  })
})

describe('équipes par défaut', () => {
  it('lancement à 4 équipes, plateau 3D jusqu’à 10', () => {
    expect(DEMIMOT_DEFAULT_TEAM_COUNT).toBe(4)
    expect(DEMIMOT_LECTERN_MAX).toBe(10)
    expect(defaultTeams(DEMIMOT_DEFAULT_TEAM_COUNT).map((t) => t.name)).toEqual(['Azur', 'Mandarine', 'Améthyste', 'Framboise'])
  })
  it('defaultTeams borne entre 0 et 20 et renvoie des copies', () => {
    expect(defaultTeams(20)).toHaveLength(20)
    expect(defaultTeams(25)).toHaveLength(20)
    expect(defaultTeams(-1)).toHaveLength(0)
    const a = defaultTeams(2)
    a[0].name = 'X'
    expect(TEAM_PALETTE[0].name).toBe('Azur')
  })
  it('nextFreeTeam saute les noms et couleurs déjà pris', () => {
    expect(nextFreeTeam([]).name).toBe('Azur')
    expect(nextFreeTeam(defaultTeams(4)).name).toBe('Lagon')
    // Nom pris sous une autre couleur, couleur prise sous un autre nom : les deux sont sautés.
    expect(nextFreeTeam([{ name: 'azur', color: '#000000' }, { name: 'Les rouges', color: '#f97316' }]).name).toBe('Améthyste')
  })
  it('nextFreeTeam numérote quand la palette est épuisée', () => {
    const taken = TEAM_PALETTE.map((p, i) => ({ name: p.name, color: i % 2 ? p.color : '#000000' }))
    const t = nextFreeTeam(taken)
    expect(t.name).toBe('Équipe 21')
    expect(taken.some((d) => d.name === t.name)).toBe(false)
  })
})

// ---- Moteur ----
const T0 = 1_000_000
const pz = (id: string, solution: string): Puzzle => ({ id, category: 'Test', solution, variants: [], difficulty: 'facile', points: null, active: true })
const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Équipe ${i + 1}`, color: '#fff', score: 0 }))
const newGame = (n: number) => createGame('TEST', teams(n), 42, T0, { lettersRounds: 0, finale: { enabled: false, puzzles: 3, base: 100, bonusPerHidden: 10 } })
function ok(s: GameState, cmd: Command, now: number): GameState {
  const r = apply(s, cmd, now)
  if (!r.ok) throw new Error(`${cmd.type}: ${r.error} ${r.message}`)
  return r.state
}
const setTeams = (n: number): Command => ({ type: 'setTeams', teams: defaultTeams(20).concat(Array.from({ length: Math.max(0, n - 20) }, (_, i) => ({ name: `Extra ${i}`, color: '#123456' }))).slice(0, n) })

describe('moteur : 2 à 20 équipes', () => {
  it(`accepte ${MIN_TEAMS}, 4, 10 et 20 équipes, refuse 1 et 21`, () => {
    for (const n of [2, 4, 10, 20]) {
      const r = apply(newGame(4), setTeams(n), T0)
      expect(r.ok, `n=${n}`).toBe(true)
      if (r.ok) expect(r.state.teams).toHaveLength(n)
    }
    for (const n of [1, 21]) {
      const r = apply(newGame(4), setTeams(n), T0)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toBe('team_count')
    }
  })
  it('20 équipes : 19 bloquées une à une, la 20e peut encore buzzer et marquer', () => {
    let s = ok(newGame(20), { type: 'startGame', puzzles: [pz('a', 'Il pleut des cordes tous les jours'), pz('b', 'Café crème')], finale: [] }, T0)
    s = ok(s, { type: 'startReveal' }, T0)
    let now = T0
    for (let i = 1; i <= 19; i++) {
      now += 10
      s = ok(s, { type: 'buzz', teamId: `t${i}`, windowId: s.round!.windowId }, now)
      // Les 19 autres équipes au même instant sont refusées : une seule main.
      for (let j = 1; j <= 20; j++) if (j !== i) expect(apply(s, { type: 'buzz', teamId: `t${j}`, windowId: s.round!.buzz!.windowId }, now).ok).toBe(false)
      now += 10
      s = ok(s, { type: 'judge', correct: false, windowId: s.round!.buzz!.windowId }, now)
    }
    expect(s.round!.blocked).toHaveLength(19)
    now += 10
    s = ok(s, { type: 'buzz', teamId: 't20', windowId: s.round!.windowId }, now)
    s = ok(s, { type: 'judge', correct: true, windowId: s.round!.buzz!.windowId }, now + 10)
    expect(s.teams.find((t) => t.id === 't20')!.score).toBeGreaterThan(0)
    expect(s.teams.filter((t) => t.score > 0)).toHaveLength(1)
  })
})

describe('validation : setTeams', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111'
  const req = (n: number) => ({ sessionId, action: 'command', command: setTeams(n) })
  it('20 équipes acceptées, 21 refusées', () => {
    expect(parseAdminRequest(req(20)).ok).toBe(true)
    expect(parseAdminRequest(req(21)).ok).toBe(false)
  })
})
