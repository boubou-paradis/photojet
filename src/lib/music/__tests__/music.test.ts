import { describe, expect, it } from 'vitest'
import { cleanMusicField, musicKey, normalizeMusicPart, parseMusicInput } from '../normalize'
import { countMusicGroups, groupMusicRequests, planMerge, resolveKey, type MusicAliasRow, type MusicRequestRow } from '../group'

const at = (m: number) => new Date(Date.UTC(2026, 10, 23, 21, m)).toISOString()
const req = (title: string, artist: string | null, m: number): MusicRequestRow => ({
  title, artist, norm_key: musicKey(title, artist), created_at: at(m),
})

describe('normalisation', () => {
  it('ignore majuscules, accents, ponctuation et espaces', () => {
    expect(musicKey('Umbrella', 'RIHANNA')).toBe('umbrella|rihanna')
    expect(musicKey('  umbrella!! ', 'Rihanna.')).toBe('umbrella|rihanna')
    expect(musicKey('Les lacs du Connemara', 'Michel Sardou')).toBe(musicKey('les LACS  du   connémara', 'michel-sardou'))
    expect(normalizeMusicPart('Cœur de pirate')).toBe('coeur de pirate')
    expect(normalizeMusicPart("L'été indien")).toBe('l ete indien')
  })

  it('titre seul et titre + artiste restent distincts', () => {
    expect(musicKey('Umbrella', null)).toBe('umbrella|')
    expect(musicKey('Umbrella', '')).toBe('umbrella|')
    expect(musicKey('Umbrella', null)).not.toBe(musicKey('Umbrella', 'Rihanna'))
  })

  it('un titre fait de ponctuation garde une clé propre', () => {
    expect(musicKey('???', null)).toBe('???|')
    expect(musicKey('!!!', null)).not.toBe(musicKey('???', null))
  })

  it('nettoie les retours à la ligne et caractères de contrôle', () => {
    expect(cleanMusicField('Um\nbrella\t\u0000 ')).toBe('Um brella')
    expect(cleanMusicField(42)).toBe('')
    expect(cleanMusicField('<b>x</b>')).toBe('<b>x</b>') // gardé tel quel, affiché comme du texte
  })

  it('contrôle le formulaire', () => {
    expect(parseMusicInput('', 'x')).toEqual({ ok: false, error: 'title_required' })
    expect(parseMusicInput('   ', null)).toEqual({ ok: false, error: 'title_required' })
    expect(parseMusicInput('a'.repeat(81), null)).toEqual({ ok: false, error: 'title_too_long' })
    expect(parseMusicInput('a'.repeat(80), 'b'.repeat(61))).toEqual({ ok: false, error: 'artist_too_long' })
    expect(parseMusicInput('a'.repeat(80), 'b'.repeat(60)).ok).toBe(true)
    expect(parseMusicInput(' Umbrella ', '  ')).toEqual({ ok: true, title: 'Umbrella', artist: null, key: 'umbrella|' })
  })
})

describe('regroupement', () => {
  it('10 envois du même morceau = une ligne ×10', () => {
    const rows = Array.from({ length: 10 }, (_, i) => req('Umbrella', 'Rihanna', i))
    const groups = groupMusicRequests(rows, [], [])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'umbrella|rihanna', count: 10, title: 'Umbrella', artist: 'Rihanna', status: 'pending' })
    expect(groups[0].lastAt).toBe(at(9))
  })

  it('écritures différentes regroupées, libellé = la plus fréquente', () => {
    const rows = [req('umbrella', 'rihanna', 1), req('Umbrella', 'RIHANNA', 2), req('Umbrella', 'RIHANNA', 3)]
    const [g] = groupMusicRequests(rows, [], [])
    expect(g.count).toBe(3)
    expect(g.title).toBe('Umbrella')
    expect(g.artist).toBe('RIHANNA')
    expect(g.spellings.map((s) => s.count)).toEqual([2, 1])
    expect(g.hasMerged).toBe(false)
  })

  it('tri par nombre puis par demande la plus récente', () => {
    const rows = [req('A', null, 1), req('B', null, 2), req('B', null, 3), req('C', null, 5), req('D', null, 4)]
    expect(groupMusicRequests(rows, [], []).map((g) => g.title)).toEqual(['B', 'C', 'D', 'A'])
  })

  it('décisions et compteurs', () => {
    const rows = [req('A', null, 1), req('B', null, 2), req('C', null, 3)]
    const groups = groupMusicRequests(rows, [], [{ group_key: 'a|', status: 'played' }, { group_key: 'b|', status: 'skipped' }])
    expect(countMusicGroups(groups)).toEqual({ pending: 1, played: 1, skipped: 1, requests: 3 })
  })

  it('Regrouper : tout part dans la ligne la plus demandée, futures demandes comprises', () => {
    const rows = [req('Umbrella', 'Rihanna', 1), req('Umbrella', 'Rihanna', 2), req('Umbrela', null, 3)]
    const groups = groupMusicRequests(rows, [], [{ group_key: 'umbrela|', status: 'skipped' }])
    const plan = planMerge(groups, ['umbrela|', 'umbrella|rihanna'], [])!
    expect(plan.target).toBe('umbrella|rihanna')
    expect(plan.aliases).toEqual([{ from_key: 'umbrela|', to_key: 'umbrella|rihanna' }])
    expect(plan.dropDecisions).toEqual(['umbrela|'])

    const later = [...rows, req('UMBRELA', null, 9)]
    const after = groupMusicRequests(later, plan.aliases, [])
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ key: 'umbrella|rihanna', count: 4, title: 'Umbrella', hasMerged: true })
    expect(after[0].spellings.filter((s) => s.merged).map((s) => s.count)).toEqual([1, 1])
  })

  it('Regrouper à égalité : la ligne la plus ancienne gagne', () => {
    const groups = groupMusicRequests([req('B', null, 5), req('A', null, 1)], [], [])
    expect(planMerge(groups, ['b|', 'a|'], [])!.target).toBe('a|')
  })

  it('Regrouper repointe les anciens regroupements (pas de chaîne)', () => {
    const aliases: MusicAliasRow[] = [{ from_key: 'x|', to_key: 'b|' }]
    const rows = [req('A', null, 1), req('A', null, 2), req('B', null, 3), req('X', null, 4)]
    const groups = groupMusicRequests(rows, aliases, [])
    const plan = planMerge(groups, ['a|', 'b|'], aliases)!
    expect(plan.aliases).toEqual([{ from_key: 'b|', to_key: 'a|' }, { from_key: 'x|', to_key: 'a|' }])
  })

  it('moins de 2 lignes connues : rien à regrouper', () => {
    const groups = groupMusicRequests([req('A', null, 1)], [], [])
    expect(planMerge(groups, ['a|'], [])).toBeNull()
    expect(planMerge(groups, ['a|', 'inconnue|'], [])).toBeNull()
  })

  it('resolveKey ne boucle jamais', () => {
    const map = new Map([['a', 'b'], ['b', 'a']])
    expect(['a', 'b']).toContain(resolveKey('a', map))
    expect(resolveKey('z', map)).toBe('z')
  })
})
