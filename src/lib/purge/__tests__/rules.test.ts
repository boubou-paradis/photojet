import { describe, it, expect } from 'vitest'
import {
  collectPhotosPaths, decideAccess, effectivePurgeAt, parsePurgeMode, pathBelongsTo, planFiles, purgeAllowed, toPhotosPath, warningDue,
  type SubscriptionRow,
} from '../rules'

const DAY = 864e5
const NOW = Date.parse('2026-11-18T03:00:00Z')
const iso = (t: number) => new Date(t).toISOString()
const sub = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  status: 'expired', trial_end: null, current_period_end: null, pass_validity_until: null, stripe_subscription_id: null, stripe_customer_id: null, ...o,
})
const U = '11111111-1111-4111-8111-111111111111'
const S = '22222222-2222-4222-8222-222222222222'
const OTHER_S = '33333333-3333-4333-8333-333333333333'

describe('parsePurgeMode', () => {
  it('dry-run par défaut, live et warn seulement si écrits exactement', () => {
    expect(parsePurgeMode(undefined)).toBe('dry-run')
    expect(parsePurgeMode('')).toBe('dry-run')
    expect(parsePurgeMode('Live ')).toBe('live')
    expect(parsePurgeMode('warn')).toBe('warn')
    expect(parsePurgeMode('lives')).toBe('dry-run')
    expect(parsePurgeMode('true')).toBe('dry-run')
  })
})

describe('decideAccess', () => {
  const user = { role: 'user' }
  it('jamais : accès à vie, ou une ligne active / essai / pass', () => {
    expect(decideAccess({ role: 'owner' }, [], NOW).state).toBe('never')
    expect(decideAccess(user, [sub({ current_period_end: iso(NOW - 90 * DAY) }), sub({ status: 'active' })], NOW).state).toBe('never')
    expect(decideAccess(user, [sub({ status: 'trialing' })], NOW).state).toBe('never')
    expect(decideAccess(user, [sub({ status: 'weekend_pass' })], NOW).state).toBe('never')
  })
  it('doute : lecture impossible, aucune ligne, statut inconnu, date manquante', () => {
    expect(decideAccess(null, [sub({})], NOW).state).toBe('doubt')
    expect(decideAccess(user, null, NOW).state).toBe('doubt')
    expect(decideAccess(user, [], NOW).state).toBe('doubt')
    expect(decideAccess(user, [sub({ status: 'paused', current_period_end: iso(NOW - 90 * DAY) })], NOW).state).toBe('doubt')
    expect(decideAccess(user, [sub({ status: null, current_period_end: iso(NOW - 90 * DAY) })], NOW).state).toBe('doubt')
    expect(decideAccess(user, [sub({ current_period_end: iso(NOW - 90 * DAY) }), sub({})], NOW).state).toBe('doubt')
    expect(decideAccess(user, [sub({ current_period_end: 'pas une date' })], NOW).state).toBe('doubt')
  })
  it('abonnement résilié : 29 jours = en attente, 31 jours = échu', () => {
    expect(decideAccess(user, [sub({ status: 'canceled', current_period_end: iso(NOW - 29 * DAY), stripe_subscription_id: 'sub_1' })], NOW).state).toBe('waiting')
    const d = decideAccess(user, [sub({ status: 'canceled', current_period_end: iso(NOW - 31 * DAY), stripe_subscription_id: 'sub_1' })], NOW)
    expect(d).toMatchObject({ state: 'due', type: 'abonnement' })
  })
  it('essai : 30 jours après la fin de l’essai (plus 7)', () => {
    expect(decideAccess(user, [sub({ trial_end: iso(NOW - 8 * DAY) })], NOW).state).toBe('waiting')
    expect(decideAccess(user, [sub({ trial_end: iso(NOW - 31 * DAY) })], NOW)).toMatchObject({ state: 'due', type: 'essai' })
  })
  it('pass : 30 jours après la fin du pass', () => {
    expect(decideAccess(user, [sub({ pass_validity_until: iso(NOW - 31 * DAY), current_period_end: iso(NOW - 31 * DAY) })], NOW)).toMatchObject({ state: 'due', type: 'pass' })
  })
  it('la fin d’accès la plus tardive l’emporte (réabonné puis re-résilié)', () => {
    const d = decideAccess(user, [sub({ trial_end: iso(NOW - 200 * DAY) }), sub({ current_period_end: iso(NOW - 10 * DAY), stripe_subscription_id: 's' })], NOW)
    expect(d).toMatchObject({ state: 'waiting', type: 'abonnement' })
    if (d.state === 'waiting') expect(d.endAt).toBe(NOW - 10 * DAY)
  })
})

describe('e-mail J-7 et date effective', () => {
  const purgeAt = NOW
  it('l’e-mail part à J-7, pas avant', () => {
    expect(warningDue(purgeAt, null, purgeAt - 8 * DAY)).toBe(false)
    expect(warningDue(purgeAt, null, purgeAt - 7 * DAY)).toBe(true)
    expect(warningDue(purgeAt, purgeAt - 7 * DAY, purgeAt)).toBe(false)
  })
  it('jamais de suppression sans e-mail, ni moins de 7 jours après', () => {
    expect(purgeAllowed(purgeAt, null, purgeAt + 100 * DAY)).toBe(false)
    expect(purgeAllowed(purgeAt, purgeAt - 7 * DAY, purgeAt)).toBe(true)
    const late = purgeAt + 2 * DAY // e-mail parti en retard
    expect(effectivePurgeAt(purgeAt, late)).toBe(late + 7 * DAY)
    expect(purgeAllowed(purgeAt, late, late + 6 * DAY)).toBe(false)
    expect(purgeAllowed(purgeAt, late, late + 7 * DAY)).toBe(true)
  })
})

describe('chemins et propriétaires', () => {
  it('toPhotosPath', () => {
    expect(toPhotosPath(`https://x.supabase.co/storage/v1/object/public/photos/quiz-photos/${S}_1.jpg?t=1`)).toBe(`quiz-photos/${S}_1.jpg`)
    expect(toPhotosPath('https://autre.site/img.png')).toBeNull()
    expect(toPhotosPath(`${S}/a%20b.jpg`)).toBe(`${S}/a b.jpg`)
  })
  it('collectPhotosPaths : JSON texte, objets imbriqués, jamais du texte libre', () => {
    const quiz = JSON.stringify([{ question: 'Combien font backgrounds/1.png ?', photoUrl: `https://x.supabase.co/storage/v1/object/public/photos/quiz-photos/${S}_1.jpg` }])
    const found = collectPhotosPaths({ quiz, other: { url: `buzzer-media/${U}/${S}/a.mp3` }, txt: 'Paris/Lyon.fr', bg: `backgrounds/${S}-9.jpg` })
    expect([...found].sort()).toEqual([`backgrounds/${S}-9.jpg`, `buzzer-media/${U}/${S}/a.mp3`, `quiz-photos/${S}_1.jpg`])
  })
  it('pathBelongsTo', () => {
    const sids = new Set([S])
    for (const p of [`${S}/x.jpg`, `quiz-audio/${S}_q_1.mp3`, `mystery-photos/mystery_${S}_0_1.jpg`, `mystery-audio/mystery_reveal_${S}_1.mp3`,
      `backgrounds/${S}-1.jpg`, `logos/defaults-${U}-1.png`, `promos/${S}/1.jpg`, `promos/defaults-${U}/1.jpg`, `vote-photos/${S}/a.jpg`,
      `buzzer-media/${U}/${OTHER_S}/a.mp3`, `borne-templates/${U}/t.png`]) expect(pathBelongsTo(p, U, sids)).toBe(true)
    for (const p of [`${OTHER_S}/x.jpg`, `quiz-audio/${OTHER_S}_q_1.mp3`, 'backgrounds/ancien.jpg', `logos/defaults-${OTHER_S}-1.png`]) expect(pathBelongsTo(p, U, sids)).toBe(false)
  })
})

describe('planFiles', () => {
  const owned = [{ path: `${S}/a.jpg`, size: 10 }, { path: `quiz-photos/${S}_1.jpg`, size: 20 }]
  it('supprime les fichiers du compte et ses anciens fichiers référencés', () => {
    const p = planFiles(owned, new Set(['backgrounds/ancien.jpg']), new Map(), U, () => false)
    expect(p.toDelete.map((f) => f.path)).toEqual([`${S}/a.jpg`, 'backgrounds/ancien.jpg', `quiz-photos/${S}_1.jpg`].sort())
    expect(p.bytes).toBe(30)
  })
  it('garde un fichier utilisé par un autre compte', () => {
    const refs = new Map([[`quiz-photos/${S}_1.jpg`, new Set([U, 'autre'])]])
    const p = planFiles(owned, new Set(), refs, U, () => false)
    expect(p.toDelete.map((f) => f.path)).toEqual([`${S}/a.jpg`])
    expect(p.keptShared).toEqual([`quiz-photos/${S}_1.jpg`])
  })
  it('ne supprime jamais un fichier référencé dont le chemin désigne un autre compte', () => {
    const p = planFiles([], new Set([`${OTHER_S}/photo.jpg`]), new Map(), U, (x) => x.startsWith(OTHER_S))
    expect(p.toDelete).toEqual([])
    expect(p.keptShared).toEqual([`${OTHER_S}/photo.jpg`])
  })
})
