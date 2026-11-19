import { describe, expect, it } from 'vitest'
import { completeLines } from '../verify'
import { checkMusicCard, guessFromFilename, makeMusicCards, parsePlaylist, parseTrack, playlistProblem, titleAt } from '../music'

const USER = '11111111-2222-3333-4444-555555555555'
const track = (i: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  title: `Titre ${i}`, artist: `Artiste ${i}`,
  path: `bingo-music/${USER}/1763500000000-${'a'.repeat(11)}${i % 10}.mp3`,
  start: 10, end: 30, ...over,
})

// Hasard reproductible pour les tests.
const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

describe('loto musical : cartons', () => {
  it('15 titres différents, 5 par ligne, tous dans la playlist', () => {
    for (const pool of [30, 45, 90]) {
      for (const c of makeMusicCards(20, pool, seeded(pool))) {
        expect(checkMusicCard(c.cells, pool)).toEqual([])
        expect(c.signature.split('.')).toHaveLength(15)
      }
    }
  })
  it('jamais deux cartons identiques, même avec la playlist minimale', () => {
    const cards = makeMusicCards(300, 30, seeded(7))
    expect(new Set(cards.map((c) => c.signature)).size).toBe(300)
  })
  it('les cartons d’un même joueur ne partagent aucun titre si la playlist le permet', () => {
    const [a, b, c] = makeMusicCards(3, 45, seeded(3))
    const all = [...a.cells, ...b.cells, ...c.cells].filter(Boolean)
    expect(new Set(all).size).toBe(45)
  })
  it('signatures exclues respectées', () => {
    const first = makeMusicCards(5, 30, seeded(11))
    const next = makeMusicCards(5, 30, seeded(11), new Set(first.map((c) => c.signature)))
    expect(next.some((c) => first.some((f) => f.signature === c.signature))).toBe(false)
  })
  it('la vérification des lignes est celle du loto numéros', () => {
    const [card] = makeMusicCards(1, 30, seeded(5))
    const row1 = card.cells.slice(0, 9).filter(Boolean)
    const row2 = card.cells.slice(9, 18).filter(Boolean)
    expect(completeLines(card.cells, row1)).toBe(1)
    expect(completeLines(card.cells, [...row1, ...row2])).toBe(2)
    expect(completeLines(card.cells, row1.slice(0, 4))).toBe(0)
  })
  it('carton non conforme détecté', () => {
    const cells = Array(27).fill(0)
    for (let i = 0; i < 5; i++) { cells[i] = 1; cells[9 + i] = i + 2; cells[18 + i] = 40 + i }
    expect(checkMusicCard(cells, 30)).toEqual(expect.arrayContaining(['titre en double', 'titre hors de la playlist']))
  })
})

describe('loto musical : playlists', () => {
  it('titre accepté seulement avec son propre fichier et un extrait valable', () => {
    expect(parseTrack(track(1), USER)).not.toBeNull()
    expect(parseTrack(track(1), '99999999-2222-3333-4444-555555555555')).toBeNull()
    expect(parseTrack(track(1, { path: `bingo-music/${USER}/../x.mp3` }), USER)).toBeNull()
    expect(parseTrack(track(1, { end: 11 }), USER)).toBeNull()
    expect(parseTrack(track(1, { end: 200 }), USER)).toBeNull()
    expect(parseTrack(track(1, { title: '   ' }), USER)).toBeNull()
  })
  it('titres nettoyés et raccourcis', () => {
    const t = parseTrack(track(1, { title: '  Je  veux\n' + 'x'.repeat(80), artist: 'Zaz' }), USER)
    expect(t?.title.length).toBe(60)
    expect(t?.title.startsWith('Je veux x')).toBe(true)
  })
  it('playlist : 90 titres au plus, pas de doublon', () => {
    const many = Array.from({ length: 91 }, (_, i) => track(i + 1))
    expect(parsePlaylist({ name: 'Soirée', tracks: many }, USER).ok).toBe(false)
    expect(parsePlaylist({ name: 'Soirée', tracks: [track(1), track(1)] }, USER).ok).toBe(false)
    expect(parsePlaylist({ name: '', tracks: [] }, USER).ok).toBe(false)
    const ok = parsePlaylist({ name: 'Années 80', tracks: [track(1), track(2)] }, USER)
    expect(ok.ok && ok.value.tracks.length).toBe(2)
  })
  it('jouable à partir de 30 titres distincts', () => {
    const t = (n: number) => Array.from({ length: n }, (_, i) => parseTrack(track(i + 1), USER)!)
    expect(playlistProblem(t(29))).toMatch(/au moins 30/)
    expect(playlistProblem(t(30))).toBeNull()
    const dup = t(30); dup[5] = { ...dup[5], title: dup[0].title, artist: dup[0].artist }
    expect(playlistProblem(dup)).toMatch(/deux fois/)
  })
  it('titre et artiste devinés d’après le fichier', () => {
    expect(guessFromFilename('03 - Queen - Bohemian Rhapsody.mp3')).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody' })
    expect(guessFromFilename('Alexandrie_Alexandra.m4a')).toEqual({ title: 'Alexandrie Alexandra', artist: '' })
  })
  it('titre d’après son rang', () => {
    expect(titleAt([{ t: 'A', a: '' }, { t: 'B', a: '' }], 2)?.t).toBe('B')
    expect(titleAt([{ t: 'A', a: '' }], 0)).toBeNull()
  })
})
