import { describe, expect, it } from 'vitest'
import { generatePlayerToken, hashPlayerToken } from '../token'
import {
  nicknameKey,
  normalizeNickname,
  parseAdminRequest,
  parseAnswerRequest,
  parseJoinRequest,
  suggestNickname,
  validateQuestions,
} from '../validation'

const UUID = '3f1c2a4e-8b7d-4c6e-9a1b-2c3d4e5f6a7b'
const TOKEN = generatePlayerToken()

const question = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `q${i}`,
  text: `Question ${i} ?`,
  answers: ['Oui', 'Non'],
  timeLimit: 20,
  ...extra,
})
const five = () => [1, 2, 3, 4, 5].map((i) => question(i))

describe('pseudos', () => {
  it('compare sans tenir compte de la casse ni des espaces', () => {
    expect(nicknameKey('Luna')).toBe(nicknameKey('  luna '))
    expect(nicknameKey('Lu na')).toBe(nicknameKey('LUNA'))
  })

  it('nettoie les espaces et les caractères invisibles', () => {
    expect(normalizeNickname('  Luna​   Rose ')).toEqual({ ok: true, value: 'Luna Rose' })
  })

  it('refuse un pseudo vide ou trop long', () => {
    expect(normalizeNickname('   ').ok).toBe(false)
    expect(normalizeNickname('x'.repeat(25)).ok).toBe(false)
    expect(normalizeNickname(42).ok).toBe(false)
  })

  it('suggère un pseudo libre', () => {
    expect(suggestNickname('Luna', new Set(['luna']))).toBe('Luna2')
    expect(suggestNickname('Luna', new Set(['luna', 'luna2', 'luna3']))).toBe('Luna4')
    const long = 'x'.repeat(24)
    expect(suggestNickname(long, new Set([long]))).toHaveLength(24)
  })
})

describe('validateQuestions', () => {
  it('accepte 5 à 20 questions de 2 à 4 réponses', () => {
    const result = validateQuestions(five())
    expect(result.ok).toBe(true)
  })

  it('refuse moins de 5 ou plus de 20 questions', () => {
    expect(validateQuestions(five().slice(0, 4)).ok).toBe(false)
    expect(validateQuestions(Array.from({ length: 21 }, (_, i) => question(i))).ok).toBe(false)
  })

  it('refuse 1 ou 5 réponses, une réponse vide ou en double', () => {
    expect(validateQuestions([...five().slice(1), question(9, { answers: ['Seule'] })]).ok).toBe(false)
    expect(validateQuestions([...five().slice(1), question(9, { answers: ['a', 'b', 'c', 'd', 'e'] })]).ok).toBe(false)
    expect(validateQuestions([...five().slice(1), question(9, { answers: ['Oui', '  '] })]).ok).toBe(false)
    expect(validateQuestions([...five().slice(1), question(9, { answers: ['Oui', 'oui'] })]).ok).toBe(false)
  })

  it('refuse un chrono non proposé, accepte l\'infini', () => {
    expect(validateQuestions([...five().slice(1), question(9, { timeLimit: 25 })]).ok).toBe(false)
    expect(validateQuestions([...five().slice(1), question(9, { timeLimit: null })]).ok).toBe(true)
  })

  it('refuse des identifiants en double ou invalides', () => {
    expect(validateQuestions([...five().slice(1), question(2)]).ok).toBe(false)
    expect(validateQuestions([...five().slice(1), question(9, { id: 'a b' })]).ok).toBe(false)
  })

  it('nettoie les textes', () => {
    const result = validateQuestions([...five().slice(1), question(9, { text: '  Mer   ou montagne ? ', answers: [' Mer ', 'Montagne'] })])
    expect(result.ok && result.value[4]).toMatchObject({ text: 'Mer ou montagne ?', answers: ['Mer', 'Montagne'] })
  })
})

describe('requêtes', () => {
  it('inscription : consentement seulement si vraiment coché', () => {
    const base = { code: 'KMRT', nickname: 'Luna', table: '8' }
    expect(parseJoinRequest({ ...base, consent: true })).toMatchObject({ ok: true, value: { consent: true, table: '8' } })
    expect(parseJoinRequest({ ...base, consent: 'true' })).toMatchObject({ ok: true, value: { consent: false } })
    expect(parseJoinRequest({ ...base })).toMatchObject({ ok: true, value: { consent: false } })
    expect(parseJoinRequest({ ...base, code: 'K M' }).ok).toBe(false)
  })

  it('réponse : refuse un index invalide, une question invalide, un jeton mal formé', () => {
    const ok = { sessionId: UUID, playerId: UUID, token: TOKEN, questionId: 'q1', answerIndex: 1 }
    expect(parseAnswerRequest(ok).ok).toBe(true)
    expect(parseAnswerRequest({ ...ok, answerIndex: 4 }).ok).toBe(false)
    expect(parseAnswerRequest({ ...ok, answerIndex: 1.5 }).ok).toBe(false)
    expect(parseAnswerRequest({ ...ok, answerIndex: '1' }).ok).toBe(false)
    expect(parseAnswerRequest({ ...ok, questionId: 'q1; drop' }).ok).toBe(false)
    expect(parseAnswerRequest({ ...ok, token: 'court' }).ok).toBe(false)
    expect(parseAnswerRequest({ ...ok, playerId: 'pas-un-uuid' }).ok).toBe(false)
  })

  it('animateur : refuse une action inconnue', () => {
    expect(parseAdminRequest({ sessionId: UUID, action: 'reveal' }).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: UUID, action: 'drop' }).ok).toBe(false)
  })
})

describe('jeton joueur', () => {
  it('est aléatoire et stocké seulement sous forme d\'empreinte', () => {
    expect(generatePlayerToken()).not.toBe(generatePlayerToken())
    expect(hashPlayerToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashPlayerToken(TOKEN)).toBe(hashPlayerToken(TOKEN))
  })
})
