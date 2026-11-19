// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
import { describe, expect, it } from 'vitest'
import { familyOf, inWords, verdictText } from '../display'
import { checkClaim } from '../verify'
import { isNewerBingo } from '@/hooks/useBingoChannel'
import type { BingoPublicState } from '../types'

describe('affichage AnimaBingo', () => {
  it('nombres en lettres (orthographe traditionnelle)', () => {
    expect(inWords(1)).toBe('un')
    expect(inWords(17)).toBe('dix-sept')
    expect(inWords(21)).toBe('vingt-et-un')
    expect(inWords(71)).toBe('soixante-et-onze')
    expect(inWords(77)).toBe('soixante-dix-sept')
    expect(inWords(80)).toBe('quatre-vingts')
    expect(inWords(81)).toBe('quatre-vingt-un')
    expect(inWords(90)).toBe('quatre-vingt-dix')
  })
  it('une couleur par dizaine (90 dans la dernière)', () => {
    expect(familyOf(1).name).toBe(familyOf(9).name)
    expect(familyOf(10).name).not.toBe(familyOf(9).name)
    expect(familyOf(90).name).toBe(familyOf(80).name)
  })
  it('verdict : compatible, coché à tort, pas encore', () => {
    const cells = [1, 0, 21, 0, 41, 0, 61, 0, 81, 0, 12, 0, 32, 0, 52, 0, 72, 83, 3, 13, 0, 33, 0, 53, 0, 73, 0]
    const ok = checkClaim(cells, [1, 21, 41, 61, 81], 'quine', [1, 21, 41, 61, 81])
    expect(verdictText(ok, 'quine').tone).toBe('ok')
    const wrong = checkClaim(cells, [1, 21, 41, 61, 81], 'quine', [1, 21, 41, 61, 81, 12])
    expect(verdictText(wrong, 'quine').tone).toBe('warn')
    const ko = checkClaim(cells, [1, 21], 'quine', [1, 21])
    const v = verdictText(ko, 'quine')
    expect(v.tone).toBe('ko')
    expect(v.text).toContain('il manque 3')
  })
  it('canal : un état plus ancien est ignoré, une autre partie passe', () => {
    const base = { active: true, v: 5, gameId: 'a' } as unknown as BingoPublicState
    expect(isNewerBingo({ ...base, v: 4 } as BingoPublicState, base)).toBe(false)
    expect(isNewerBingo({ ...base, v: 6 } as BingoPublicState, base)).toBe(true)
    expect(isNewerBingo({ ...base, v: 1, gameId: 'b' } as BingoPublicState, base)).toBe(true)
    expect(isNewerBingo({ active: false, serverNow: '' }, base)).toBe(true)
  })
})
