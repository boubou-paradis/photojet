// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Paramètres n'a aucun réglage de modération : le tableau de bord en est seul
// maître. Si le champ revient dans le formulaire, chaque sauvegarde auto l'écrase.
describe('Paramètres et modération', () => {
  it('la page ne lit ni n\'écrit moderation_enabled', () => {
    const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8')
    expect(source).not.toContain('moderation_enabled')
  })
})
