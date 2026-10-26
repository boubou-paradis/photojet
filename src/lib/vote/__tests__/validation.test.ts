import { describe, expect, it } from 'vitest'
import { isVotePhotoUrl, parseAdminRequest, parseDraft, parseJoinRequest, parseParticipantAuth } from '../validation'

const SID = '11111111-2222-4333-8444-555555555555'
const BASE = 'https://abc.supabase.co/storage/v1/object/public/photos'
const PHOTO = `${BASE}/vote-photos/${SID}/1761508800000-a1b2c3d4e5f6.webp`
const ctx = { sessionId: SID, photoBase: BASE }

const draft = (patch: Record<string, unknown> = {}) => ({
  title: 'Élection Miss Camping 2026', subtitle: '', intro: null, thanks: 'Merci !',
  displayMode: 'photo', resultsMode: 'hidden', allowBlank: false, shuffle: true, countdownS: 10, revealMode: 'podium',
  candidates: [
    { label: 'Emma', number: '4', description: 'Candidate n°4', imageUrl: PHOTO },
    { label: 'Luna', number: '7' },
  ],
  ...patch,
})

describe('scrutin de l’éditeur', () => {
  it('accepte un scrutin complet et nettoie les textes', () => {
    const r = parseDraft(draft({ title: '  Miss   Camping​ 2026 ' }), ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.title).toBe('Miss Camping 2026')
    expect(r.value.subtitle).toBeNull()
    expect(r.value.candidates[1]).toEqual({ label: 'Luna', number: '7', description: null, imageUrl: null, emoji: null, color: null })
  })
  it('titre obligatoire et au moins 2 choix pour lancer', () => {
    expect(parseDraft(draft({ title: '  ' }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ candidates: [{ label: 'Seule' }] }), ctx).ok).toBe(false)
  })
  it('brouillon : titre vide et choix incomplets acceptés', () => {
    expect(parseDraft(draft({ title: '', candidates: [{ label: '' }] }), { ...ctx, partial: true }).ok).toBe(true)
  })
  it('nom de choix obligatoire et longueurs bornées', () => {
    expect(parseDraft(draft({ candidates: [{ label: 'A' }, { label: '' }] }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ candidates: [{ label: 'A' }, { label: 'B'.repeat(41) }] }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ title: 'T'.repeat(81) }), ctx).ok).toBe(false)
  })
  it('30 choix au maximum', () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ label: `C${i}` }))
    expect(parseDraft(draft({ candidates: many }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ candidates: many.slice(0, 30) }), ctx).ok).toBe(true)
  })
  it('réglages hors liste refusés', () => {
    expect(parseDraft(draft({ countdownS: 7 }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ resultsMode: 'secret' }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ displayMode: 'video' }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ revealMode: 'random' }), ctx).ok).toBe(false)
    expect(parseDraft(draft({ allowBlank: 'oui' }), ctx).ok).toBe(false)
  })
  it('couleur au format #rrggbb', () => {
    expect(parseDraft(draft({ candidates: [{ label: 'A', color: '#A855F7' }, { label: 'B' }] }), ctx).ok).toBe(true)
    expect(parseDraft(draft({ candidates: [{ label: 'A', color: 'red' }, { label: 'B' }] }), ctx).ok).toBe(false)
  })
})

describe('photos des candidats', () => {
  it('seulement celles déposées par AnimaVote pour cette session', () => {
    expect(isVotePhotoUrl(PHOTO, BASE, SID)).toBe(true)
    expect(isVotePhotoUrl('https://ailleurs.com/x.webp', BASE, SID)).toBe(false)
    expect(isVotePhotoUrl(PHOTO.replace(SID, '99999999-2222-4333-8444-555555555555'), BASE, SID)).toBe(false)
    expect(isVotePhotoUrl(`${BASE}/vote-photos/${SID}/../promos/x.webp`, BASE, SID)).toBe(false)
    expect(isVotePhotoUrl(`${BASE}/vote-photos/${SID}/x.svg`, BASE, SID)).toBe(false)
  })
  it('photo d’une autre session refusée dans le scrutin', () => {
    const other = PHOTO.replace(SID, '99999999-2222-4333-8444-555555555555')
    expect(parseDraft(draft({ candidates: [{ label: 'A', imageUrl: other }, { label: 'B' }] }), ctx).ok).toBe(false)
  })
})

describe('actions de l’animateur', () => {
  it('action inconnue ou session invalide refusées', () => {
    expect(parseAdminRequest({ sessionId: SID, action: 'drop_all' }, BASE).ok).toBe(false)
    expect(parseAdminRequest({ sessionId: 'x', action: 'open' }, BASE).ok).toBe(false)
  })
  it('lancement : scrutin complet exigé', () => {
    expect(parseAdminRequest({ sessionId: SID, action: 'launch', args: draft() }, BASE).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: SID, action: 'launch', args: draft({ candidates: [] }) }, BASE).ok).toBe(false)
    expect(parseAdminRequest({ sessionId: SID, action: 'save_draft', args: draft({ candidates: [] }) }, BASE).ok).toBe(true)
  })
  it('second tour : au moins 2 finalistes distincts', () => {
    const a = '11111111-1111-4111-8111-111111111111'
    const b = '22222222-2222-4222-8222-222222222222'
    expect(parseAdminRequest({ sessionId: SID, action: 'second_round', args: { candidateIds: [a, b] } }, BASE).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: SID, action: 'second_round', args: { candidateIds: [a, a] } }, BASE).ok).toBe(false)
    expect(parseAdminRequest({ sessionId: SID, action: 'second_round', args: { candidateIds: [a, 'x'] } }, BASE).ok).toBe(false)
  })
  it('étape de révélation : entier attendu', () => {
    expect(parseAdminRequest({ sessionId: SID, action: 'reveal_next', args: { from: 0 } }, BASE).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: SID, action: 'reveal_next', args: { from: 1.5 } }, BASE).ok).toBe(false)
    expect(parseAdminRequest({ sessionId: SID, action: 'reveal_next', args: {} }, BASE).ok).toBe(false)
  })
  it('les autres actions ignorent les arguments envoyés', () => {
    const r = parseAdminRequest({ sessionId: SID, action: 'open', args: { hack: true } }, BASE)
    expect(r.ok && r.value.args).toEqual({})
  })
})

describe('téléphone', () => {
  const token = 'a'.repeat(43)
  it('identité complète exigée', () => {
    expect(parseParticipantAuth({ sessionId: SID, participantId: SID, token }).ok).toBe(true)
    expect(parseParticipantAuth({ sessionId: SID, participantId: SID, token: 'court' }).ok).toBe(false)
  })
  it('arrivée : identité précédente gardée seulement si elle est bien formée', () => {
    const r1 = parseJoinRequest({ code: 'K7PA', participantId: SID, token })
    expect(r1.ok && r1.value.previous).toEqual({ participantId: SID, token })
    const r2 = parseJoinRequest({ code: 'K7PA', participantId: 'x', token })
    expect(r2.ok && r2.value.previous).toBeNull()
    expect(parseJoinRequest({ code: 'K7 PA' }).ok).toBe(false)
  })
})
