// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Lecteur CSV historique du Quiz (bouton « Importer » avec un fichier .csv).
// Déplacé TEL QUEL depuis src/app/admin/jeux/quiz/page.tsx : seul le retour
// change (un objet au lieu de trois setState). Ne pas « corriger » ce lecteur :
// les abonnés ont des fichiers qui en dépendent, à commencer par ceux faits avec
// ChatGPT. Ses particularités connues sont figées par ses tests : les guillemets
// sont retirés du texte, un retour à la ligne entre guillemets coupe la ligne.

import type { QuizQuestion } from '@/types/database'

export interface LegacyCsvResult {
  questions: QuizQuestion[]
  errors: string[]
}

export function parseLegacyQuizCsv(text: string): LegacyCsvResult {
  const errors: string[] = []
  const parsedQuestions: QuizQuestion[] = []

  // Split lignes et ignorer les vides
  const lines = text.split(/\r?\n/).filter(line => line.trim())

  if (lines.length < 2) {
    errors.push('Le fichier doit contenir au moins une ligne d\'en-tête et une question')
    return { questions: [], errors }
  }

  // Ignorer la première ligne (en-tête)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parser avec point-virgule, gérer les guillemets
    const cols = parseLegacyCsvLine(line)

    if (cols.length < 6) {
      errors.push(`Ligne ${i + 1}: Pas assez de colonnes (${cols.length}/6 minimum)`)
      continue
    }

    const [question, rep1, rep2, rep3, rep4, bonneRepStr, tempsStr, pointsStr, audioFile] = cols

    if (!question || !rep1 || !rep2 || !rep3 || !rep4) {
      errors.push(`Ligne ${i + 1}: Question ou réponses manquantes`)
      continue
    }

    const bonneRep = parseInt(bonneRepStr || '1', 10)
    if (bonneRep < 1 || bonneRep > 4 || isNaN(bonneRep)) {
      errors.push(`Ligne ${i + 1}: Bonne réponse doit être 1, 2, 3 ou 4 (reçu: "${bonneRepStr}")`)
      continue
    }

    const temps = parseInt(tempsStr || '20', 10) || 20
    const points = parseInt(pointsStr || '10', 10) || 10

    parsedQuestions.push({
      id: `csv_${Date.now()}_${i}`,
      question: question.trim(),
      answers: [rep1.trim(), rep2.trim(), rep3.trim(), rep4.trim()],
      correctAnswer: bonneRep - 1, // Index 0-based
      timeLimit: Math.max(5, Math.min(120, temps)),
      points: Math.max(1, points),
      audioUrl: undefined,
      // Stocker le nom du fichier audio pour référence
      ...(audioFile?.trim() ? { audioFileName: audioFile.trim().replace(/\.[^.]+$/, ''), pendingAudioFile: audioFile.trim() } : {}),
    } as QuizQuestion)
  }

  return { questions: parsedQuestions, errors }
}

// Parser une ligne CSV avec gestion des guillemets
export function parseLegacyCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}
