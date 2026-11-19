// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { describe, expect, it } from 'vitest'
import { checkCard, colOf, makeCards, makeSeries, rowsOf, signatureOf } from '../cards'
import { checkClaim, completeLines } from '../verify'
import { cleanName, parseAdmin, parseMarks, parsePhases, parseSettings, DEFAULT_SETTINGS } from '../validation'
import { claimToSend, loadMemory, reconcile, saveMemory, toggleMark, type KeyValueStore, type PhoneMemory } from '../phone-store'
import { isAnimatorAlive, rpcError } from '../server'

/** Hasard reproductible pour les tests. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Carton fixe : ligne 1 = 1 22 41 63 80, ligne 2 = 12 35 57 74 85, ligne 3 = 5 28 49 66 90.
const CARD = [1, 0, 22, 0, 41, 0, 63, 0, 80, 0, 12, 0, 35, 0, 57, 0, 74, 85, 5, 0, 28, 0, 49, 0, 66, 0, 90]

describe('cartons', () => {
  it('2 000 séries : chaque carton est conforme et chaque série couvre 1..90 une seule fois', () => {
    const rand = seeded(42)
    for (let k = 0; k < 2000; k++) {
      const series = makeSeries(rand)
      expect(series).toHaveLength(6)
      const all: number[] = []
      for (const cells of series) {
        expect(checkCard(cells)).toEqual([])
        all.push(...cells.filter(Boolean))
      }
      expect(all.sort((a, b) => a - b)).toEqual(Array.from({ length: 90 }, (_, i) => i + 1))
    }
  })

  it('1 200 cartons uniques, et les colonnes 1-9 / 80-90 ont parfois 3 numéros', () => {
    const cards = makeCards(1200, seeded(7))
    expect(new Set(cards.map((c) => c.signature)).size).toBe(1200)
    const three = (col: number) => cards.some((c) => [c.cells[col], c.cells[9 + col], c.cells[18 + col]].filter(Boolean).length === 3)
    expect(three(0)).toBe(true)
    expect(three(8)).toBe(true)
    for (const c of cards) expect(c.signature).toBe(signatureOf(c.cells))
  })

  it('exclut les signatures déjà prises', () => {
    const first = makeCards(30, seeded(1))
    const next = makeCards(30, seeded(1), new Set(first.map((c) => c.signature)))
    expect(next.some((c) => first.some((f) => f.signature === c.signature))).toBe(false)
  })

  it('hasard cryptographique par défaut', () => {
    const cards = makeCards(12)
    for (const c of cards) expect(checkCard(c.cells)).toEqual([])
  })

  it('règles : colonne, lignes, 90 dans la 9e colonne', () => {
    expect(colOf(9)).toBe(0)
    expect(colOf(80)).toBe(8)
    expect(colOf(90)).toBe(8)
    expect(checkCard(CARD)).toEqual([])
    expect(rowsOf(CARD)[0]).toEqual([1, 22, 41, 63, 80])
    expect(checkCard([...CARD.slice(0, 26), 0])).not.toEqual([])
  })
})

describe('vérification', () => {
  it('ligne 1 complète : quine valide, double invalide', () => {
    const drawn = [1, 22, 41, 63, 80, 12]
    expect(completeLines(CARD, drawn)).toBe(1)
    expect(checkClaim(CARD, drawn, 'quine').valid).toBe(true)
    expect(checkClaim(CARD, drawn, 'double').valid).toBe(false)
  })

  it('coche fausse : signalée, verdict inchangé (la vérité = les boules sorties)', () => {
    const r = checkClaim(CARD, [1, 22, 41, 63, 80], 'quine', [1, 22, 41, 63, 80, 35])
    expect(r.valid).toBe(true)
    expect(r.markedNotDrawn).toEqual([35])
    const bad = checkClaim(CARD, [1, 22, 41, 63], 'quine', [1, 22, 41, 63, 80])
    expect(bad.valid).toBe(false)
    expect(bad.markedNotDrawn).toEqual([80])
    expect(bad.lines[0].missing).toEqual([80])
  })

  it('numéro sorti non coché : signalé sans effet', () => {
    const r = checkClaim(CARD, [1, 22, 41, 63, 80, 12], 'quine', [1, 22, 41, 63, 80])
    expect(r.drawnNotMarked).toEqual([12])
    expect(r.valid).toBe(true)
  })

  it('rang de la boule qui complète (demande en retard)', () => {
    const filler = [2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34]
    const drawn = [...filler, 1, 22, 41, 63, 80, 50, 51] // 29 boules, puis la ligne : 80 = 34e boule, demande à la 36e
    const r = checkClaim(CARD, drawn, 'quine')
    expect(r.completedAt).toBe(34)
    expect(checkClaim(CARD, [1, 22], 'quine').completedAt).toBeNull()
  })

  it('carton plein = 3 lignes', () => {
    const all = CARD.filter(Boolean)
    expect(checkClaim(CARD, all, 'plein').valid).toBe(true)
    expect(checkClaim(CARD, all.slice(1), 'plein').valid).toBe(false)
  })
})

describe('validation', () => {
  it('prénom nettoyé', () => {
    expect(cleanName('  Émma\u0000 ')).toBe('Émma')
    expect(cleanName('')).toBeNull()
    expect(cleanName('   ')).toBeNull()
    expect(cleanName('a'.repeat(25))).toHaveLength(20)
    expect(cleanName(42)).toBeNull()
  })

  it('phases', () => {
    expect(parsePhases(['quine', 'quine'])).toBeNull()
    expect(parsePhases([])).toBeNull()
    expect(parsePhases(['plein', 'quine'])).toEqual(['plein', 'quine'])
    expect(parsePhases(['loto'])).toBeNull()
  })

  it('coches : uniquement des numéros du carton', () => {
    expect(parseMarks([1, 22], CARD)).toEqual([1, 22])
    expect(parseMarks([1, 2], CARD)).toBeNull()
    expect(parseMarks('1', CARD)).toBeNull()
    expect(parseMarks(Array(16).fill(1), CARD)).toBeNull()
  })

  it('réglages : dernier numéro affiché par défaut', () => {
    expect(DEFAULT_SETTINGS.public.showLast).toBe(true)
    expect(parseSettings({ cardsPerPlayer: 9, public: { showLast: false } })).toMatchObject({ cardsPerPlayer: 1, public: { showLast: false } })
  })

  it('commandes régie', () => {
    const sessionId = '11111111-1111-4111-8111-111111111111'
    expect(parseAdmin({ sessionId, action: 'draw', expect: 3 })).toMatchObject({ ok: true })
    expect(parseAdmin({ sessionId, action: 'draw', expect: -1 }).ok).toBe(false)
    expect(parseAdmin({ sessionId, action: 'new_game' })).toMatchObject({ ok: true, value: { command: { action: 'new_game' } } })
    expect(parseAdmin({ sessionId, action: 'drop_table' }).ok).toBe(false)
    expect(parseAdmin({ sessionId: 'x', action: 'start' }).ok).toBe(false)
  })
})

describe('serveur', () => {
  it('codes d’erreur SQL', () => {
    expect(rpcError({ message: 'too_fast' })).toBe('too_fast')
    expect(rpcError({ message: 'connection reset' })).toBe('unknown')
    expect(rpcError(null)).toBe('unknown')
  })
  it('régie vivante : 3 min', () => {
    const now = Date.parse('2026-11-18T20:00:00Z')
    expect(isAnimatorAlive('2026-11-18T19:58:00Z', now)).toBe(true)
    expect(isAnimatorAlive('2026-11-18T19:56:00Z', now)).toBe(false)
    expect(isAnimatorAlive(null, now)).toBe(false)
  })
})

describe('mémoire du téléphone', () => {
  const mem = (): PhoneMemory => ({
    v: 1, token: 't'.repeat(43), name: 'Emma', gameId: 'g1', round: 1,
    cards: [{ id: 'c1', serial: 1, cells: CARD }], marks: {}, claim: null, savedAt: 0,
  })
  const fakeStore = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>()
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
  }

  it('cartons et coches survivent à un rechargement', () => {
    const store = fakeStore()
    let m = toggleMark(mem(), 'c1', 22)
    m = toggleMark(m, 'c1', 1)
    expect(saveMemory('abc123', m, store, 1000)).toBe(true)
    const back = loadMemory('ABC123', store, 2000)
    expect(back?.marks.c1).toEqual([1, 22])
    expect(back?.cards[0].cells).toEqual(CARD)
  })

  it('coche hors carton ignorée, décoche possible', () => {
    let m = toggleMark(mem(), 'c1', 2)
    expect(m.marks.c1).toBeUndefined()
    m = toggleMark(toggleMark(m, 'c1', 5), 'c1', 5)
    expect(m.marks.c1).toEqual([])
  })

  it('stockage bloqué ou corrompu : aucun plantage', () => {
    const broken: KeyValueStore = { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('plein') }, removeItem: () => {} }
    expect(saveMemory('abc123', mem(), broken)).toBe(false)
    expect(loadMemory('abc123', broken)).toBeNull()
    const store = fakeStore()
    store.data.set('animabingo:ABC123', '{pas du json')
    expect(loadMemory('abc123', store)).toBeNull()
    expect(loadMemory('abc123', null)).toBeNull()
  })

  it('mémoire de plus de 48 h oubliée', () => {
    const store = fakeStore()
    saveMemory('abc123', mem(), store, 0)
    expect(loadMemory('abc123', store, 49 * 3600_000)).toBeNull()
  })

  it('même partie = tout gardé ; nouvelle manche = coches remises à zéro ; autre partie = oubliée', () => {
    const m = toggleMark(mem(), 'c1', 1)
    expect(reconcile(m, 'g1', 1)).toBe(m)
    expect(reconcile(m, 'g1', 2)?.marks).toEqual({})
    expect(reconcile(m, 'g2', 1)).toBeNull()
  })

  it('demande en attente : renvoyée au retour du réseau, jamais pour une autre phase', () => {
    const m: PhoneMemory = { ...mem(), claim: { cardId: 'c1', marks: [1], phaseIndex: 0, round: 1, createdAt: 0, claimId: null } }
    expect(claimToSend(m, { round: 1, phaseIndex: 0, status: 'running' })).toBe('send')
    expect(claimToSend(m, { round: 1, phaseIndex: 0, status: 'checking' })).toBe('send')
    expect(claimToSend(m, { round: 1, phaseIndex: 1, status: 'running' })).toBe('stale')
    expect(claimToSend({ ...m, claim: { ...m.claim!, claimId: 9 } }, { round: 1, phaseIndex: 0, status: 'running' })).toBe('none')
    expect(claimToSend(mem(), { round: 1, phaseIndex: 0, status: 'running' })).toBe('none')
  })
})
