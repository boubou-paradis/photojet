import { describe, expect, it } from 'vitest'
import { AFFINITY_PACKS } from '@/data/affinity-packs'
import { validateQuestions } from '../validation'

describe('packs de démarrage', () => {
  it.each(AFFINITY_PACKS.map((pack) => [pack.name, pack] as const))('%s passe la validation serveur', (_, pack) => {
    const result = validateQuestions(pack.questions)
    expect(result).toMatchObject({ ok: true })
    // La validation ne doit rien modifier : le pack est déjà propre.
    expect(result.ok && result.value).toEqual(pack.questions)
  })

  it('le pack soirée contient 20 questions', () => {
    expect(AFFINITY_PACKS.find((p) => p.id === 'soiree')?.questions).toHaveLength(20)
  })
})
