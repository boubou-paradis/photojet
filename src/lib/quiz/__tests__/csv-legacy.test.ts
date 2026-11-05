// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Le lecteur CSV historique doit rendre exactement ce que rendait le code de la
// page avant son déplacement. Les résultats attendus ont été produits en
// exécutant le code d'origine de page.tsx sur ces mêmes fichiers.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLegacyQuizCsv, parseLegacyCsvLine } from '../csv-legacy'

const FIXTURES = join(__dirname, 'fixtures')
const expected: Record<string, unknown> = JSON.parse(
  readFileSync(join(FIXTURES, 'attendu-avant-deplacement.json'), 'utf8')
)

// Même décodage que FileReader.readAsText(file, 'UTF-8') : le BOM est retiré.
function readAsBrowser(name: string): string {
  return new TextDecoder('utf-8').decode(readFileSync(join(FIXTURES, name)))
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseLegacyQuizCsv : même résultat qu’avant le déplacement', () => {
  for (const name of Object.keys(expected)) {
    it(name, () => {
      expect(JSON.stringify(parseLegacyQuizCsv(readAsBrowser(name)))).toBe(JSON.stringify(expected[name]))
    })
  }

  it('fins de ligne Windows (CRLF)', () => {
    const result = parseLegacyQuizCsv('question;r1;r2;r3;r4;bonne;temps;points\r\nCRLF question ?;A;B;C;D;2;10;5\r\n\r\n')
    expect(JSON.stringify(result)).toBe(
      JSON.stringify({
        questions: [
          {
            id: 'csv_1700000000000_1',
            question: 'CRLF question ?',
            answers: ['A', 'B', 'C', 'D'],
            correctAnswer: 1,
            timeLimit: 10,
            points: 5,
          },
        ],
        errors: [],
      })
    )
  })

  it('accents, apostrophes et guillemets d’un CSV ChatGPT', () => {
    const { questions } = parseLegacyQuizCsv(readAsBrowser('chatgpt-series-guillemets.csv'))
    // Comportement historique conservé : les guillemets disparaissent du texte.
    expect(questions[0].question).toBe('Dans quelle année la série Friends a-t-elle débuté ?')
    const films = parseLegacyQuizCsv(readAsBrowser('chatgpt-films-bom.csv')).questions
    expect(films[0].question).toBe("Qui interprète Amélie Poulain dans Le Fabuleux Destin d'Amélie Poulain ?")
  })

  it('le nom de fichier audio reste une référence à ajouter à la main', () => {
    const [first] = parseLegacyQuizCsv(readAsBrowser('blindtest-audio.csv')).questions
    expect(first).toMatchObject({ audioFileName: 'les_visiteurs', pendingAudioFile: 'les_visiteurs.mp3' })
  })
})

describe('parseLegacyCsvLine', () => {
  it('point-virgule entre guillemets conservé, guillemets retirés', () => {
    expect(parseLegacyCsvLine('"a;b";c')).toEqual(['a;b', 'c'])
    expect(parseLegacyCsvLine('"x ""y"" z";1')).toEqual(['x y z', '1'])
  })
})
