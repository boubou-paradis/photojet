import { describe, expect, it } from 'vitest'
import {
  PREP_LIMITS, collectMediaPaths, emptyRound, isBuzzerMediaPath, parsePrepDraft, parseRoundsForLaunch,
} from '../prep'
import { selectOrphanMedia } from '../prep-server'

const USER = '0b6c1a52-1f0e-4f43-9a51-6d1d6a3c2f10'
const OTHER = '9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f'
const SESSION = '11111111-2222-4333-8444-555555555555'
const audio = `buzzer-media/${USER}/${SESSION}/1793120000000-0123456789ab.mp3`
const image = `buzzer-media/${USER}/${SESSION}/1793120000000-abcdef012345.jpg`

describe('isBuzzerMediaPath', () => {
  it('accepte un chemin du compte, du bon type', () => {
    expect(isBuzzerMediaPath(audio, USER, 'audio')).toBe(true)
    expect(isBuzzerMediaPath(image, USER, 'image')).toBe(true)
  })
  it('refuse le média d’un autre compte', () => {
    expect(isBuzzerMediaPath(audio, OTHER)).toBe(false)
  })
  it('refuse un type croisé (image déclarée audio)', () => {
    expect(isBuzzerMediaPath(image, USER, 'audio')).toBe(false)
  })
  it('refuse les remontées de dossier et autres dossiers', () => {
    expect(isBuzzerMediaPath(`buzzer-media/${USER}/../x/1793120000000-0123456789ab.mp3`, USER)).toBe(false)
    expect(isBuzzerMediaPath(`quiz-audio/${USER}/${SESSION}/1793120000000-0123456789ab.mp3`, USER)).toBe(false)
    expect(isBuzzerMediaPath(`buzzer-media/${USER}/${SESSION}/autre.mp3`, USER)).toBe(false)
    expect(isBuzzerMediaPath(`buzzer-media/${USER}/${SESSION}/1793120000000-0123456789ab.exe`, USER)).toBe(false)
  })
})

describe('parsePrepDraft (liste en préparation)', () => {
  it('nettoie les textes et garde une manche vide', () => {
    const r = parsePrepDraft({ enabled: true, name: '  Mariage  ', rounds: [{ ...emptyRound(), question: '  Qui   chante ?​ ' }, emptyRound()] }, USER)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.enabled).toBe(true)
    expect(r.value.name).toBe('Mariage')
    expect(r.value.rounds[0].question).toBe('Qui chante ?')
    expect(r.value.rounds).toHaveLength(2)
  })
  it('garde un vote en cours de saisie (question et choix vides)', () => {
    const r = parsePrepDraft({ rounds: [{ ...emptyRound(), vote: { question: '', choices: ['', ''], correct: null } }] }, USER)
    expect(r.ok && r.value.rounds[0].vote).toEqual({ question: '', choices: ['', ''], correct: null })
  })
  it('refuse plus de 100 manches', () => {
    const rounds = Array.from({ length: PREP_LIMITS.maxRounds + 1 }, () => emptyRound())
    expect(parsePrepDraft({ rounds }, USER).ok).toBe(false)
  })
  it('refuse plus de 4 choix', () => {
    const r = parsePrepDraft({ rounds: [{ ...emptyRound(), vote: { question: 'Q', choices: ['a', 'b', 'c', 'd', 'e'] } }] }, USER)
    expect(r.ok).toBe(false)
  })
  it('refuse le média d’un autre compte', () => {
    const r = parsePrepDraft({ rounds: [{ ...emptyRound(), audioPath: audio }] }, OTHER)
    expect(r.ok).toBe(false)
  })
  it('refuse une découpe à l’envers', () => {
    const r = parsePrepDraft({ rounds: [{ ...emptyRound(), audioPath: audio, audioStart: 30, audioEnd: 10 }] }, USER)
    expect(r.ok).toBe(false)
  })
  it('efface la découpe quand il n’y a plus d’audio', () => {
    const r = parsePrepDraft({ rounds: [{ ...emptyRound(), audioStart: 3, audioEnd: 10, audioName: 'x.mp3' }] }, USER)
    expect(r.ok && r.value.rounds[0]).toMatchObject({ audioStart: null, audioEnd: null, audioName: null })
  })
  it('refuse un texte trop long', () => {
    const r = parsePrepDraft({ rounds: [{ ...emptyRound(), question: 'x'.repeat(PREP_LIMITS.questionMaxLength + 1) }] }, USER)
    expect(r.ok).toBe(false)
  })
  it('redonne un identifiant neuf à une manche en double', () => {
    const a = emptyRound()
    const r = parsePrepDraft({ rounds: [a, { ...a }] }, USER)
    expect(r.ok && r.value.rounds[0].id !== r.value.rounds[1].id).toBe(true)
  })
  it('réglage par défaut : la musique reprend après une bonne réponse', () => {
    const r = parsePrepDraft({ rounds: [] }, USER)
    expect(r.ok && r.value.settings.resumeAfterRight).toBe(true)
  })
})

describe('parseRoundsForLaunch (au lancement)', () => {
  const vote = (v: object) => [{ ...emptyRound(), vote: v }]
  it('exige au moins une manche', () => {
    expect(parseRoundsForLaunch([], USER).ok).toBe(false)
  })
  it('exige la question du vote', () => {
    expect(parseRoundsForLaunch(vote({ question: ' ', choices: ['A', 'B'] }), USER).ok).toBe(false)
  })
  it('refuse un choix vide (l’index de la bonne réponse resterait faux)', () => {
    expect(parseRoundsForLaunch(vote({ question: 'Q', choices: ['A', '', 'C'], correct: 2 }), USER).ok).toBe(false)
  })
  it('refuse deux choix identiques', () => {
    expect(parseRoundsForLaunch(vote({ question: 'Q', choices: ['Le marié', 'le MARIÉ'] }), USER).ok).toBe(false)
  })
  it('refuse une bonne réponse hors des choix', () => {
    expect(parseRoundsForLaunch(vote({ question: 'Q', choices: ['A', 'B'], correct: 2 }), USER).ok).toBe(false)
  })
  it('accepte un vote complet, bonne réponse facultative', () => {
    const r = parseRoundsForLaunch(vote({ question: 'Q', choices: ['A', 'B'], correct: 1 }), USER)
    expect(r.ok && r.value[0].vote).toEqual({ question: 'Q', choices: ['A', 'B'], correct: 1 })
    expect(parseRoundsForLaunch(vote({ question: 'Q', choices: ['A', 'B'] }), USER).ok).toBe(true)
  })
})

describe('balayage des médias', () => {
  it('retrouve les chemins cités dans une liste', () => {
    expect(collectMediaPaths({ rounds: [{ audioPath: audio, imagePath: image }] }).sort()).toEqual([audio, image].sort())
  })
  it('n’efface que les fichiers non cités et anciens', () => {
    const now = Date.parse('2026-10-28T12:00:00Z')
    const day = 24 * 60 * 60_000
    const files = [
      { path: audio, createdAt: now - 2 * day }, // cité : gardé
      { path: 'buzzer-media/u/s/vieux.mp3', createdAt: now - 2 * day }, // orphelin ancien : effacé
      { path: 'buzzer-media/u/s/recent.mp3', createdAt: now - 60_000 }, // envoi en cours : gardé
      { path: 'buzzer-media/u/s/sans-date.mp3', createdAt: 0 }, // date inconnue : gardé
    ]
    expect(selectOrphanMedia(files, new Set([audio]), now, day)).toEqual(['buzzer-media/u/s/vieux.mp3'])
  })
})
