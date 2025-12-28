// ===========================================
// DEMO QUESTIONS - 10 questions FR pour mode démo
// ===========================================

import { QuizQuestion } from '../realtime/types'

export const DEMO_QUESTIONS: QuizQuestion[] = [
  {
    id: 'demo-1',
    question: 'Quelle est la capitale de la France ?',
    answers: {
      A: 'Lyon',
      B: 'Marseille',
      C: 'Paris',
      D: 'Bordeaux',
    },
    correctKey: 'C',
    durationMs: 20000,
    points: 1000,
  },
  {
    id: 'demo-2',
    question: 'Combien de joueurs composent une équipe de football sur le terrain ?',
    answers: {
      A: '9 joueurs',
      B: '10 joueurs',
      C: '11 joueurs',
      D: '12 joueurs',
    },
    correctKey: 'C',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-3',
    question: 'Quel animal est le symbole de la marque Lacoste ?',
    answers: {
      A: 'Un crocodile',
      B: 'Un alligator',
      C: 'Un lézard',
      D: 'Un serpent',
    },
    correctKey: 'A',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-4',
    question: 'En quelle année a eu lieu la Révolution française ?',
    answers: {
      A: '1776',
      B: '1789',
      C: '1804',
      D: '1815',
    },
    correctKey: 'B',
    durationMs: 20000,
    points: 1000,
  },
  {
    id: 'demo-5',
    question: 'Quel est le plus grand océan du monde ?',
    answers: {
      A: 'Océan Atlantique',
      B: 'Océan Indien',
      C: 'Océan Arctique',
      D: 'Océan Pacifique',
    },
    correctKey: 'D',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-6',
    question: 'Qui a peint "La Joconde" ?',
    answers: {
      A: 'Michel-Ange',
      B: 'Raphaël',
      C: 'Léonard de Vinci',
      D: 'Botticelli',
    },
    correctKey: 'C',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-7',
    question: 'Quelle planète est surnommée "la planète rouge" ?',
    answers: {
      A: 'Vénus',
      B: 'Mars',
      C: 'Jupiter',
      D: 'Saturne',
    },
    correctKey: 'B',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-8',
    question: 'Combien de côtés possède un hexagone ?',
    answers: {
      A: '5 côtés',
      B: '6 côtés',
      C: '7 côtés',
      D: '8 côtés',
    },
    correctKey: 'B',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-9',
    question: 'Quel est l\'élément chimique symbolisé par "O" ?',
    answers: {
      A: 'Or',
      B: 'Osmium',
      C: 'Oxygène',
      D: 'Oganesson',
    },
    correctKey: 'C',
    durationMs: 15000,
    points: 1000,
  },
  {
    id: 'demo-10',
    question: 'Dans quel pays se trouve la tour de Pise ?',
    answers: {
      A: 'Espagne',
      B: 'France',
      C: 'Grèce',
      D: 'Italie',
    },
    correctKey: 'D',
    durationMs: 15000,
    points: 1000,
  },
]

/**
 * Get shuffled demo questions
 */
export function getShuffledDemoQuestions(): QuizQuestion[] {
  return [...DEMO_QUESTIONS].sort(() => Math.random() - 0.5)
}

/**
 * Get a subset of demo questions
 */
export function getDemoQuestions(count: number = 10): QuizQuestion[] {
  return DEMO_QUESTIONS.slice(0, Math.min(count, DEMO_QUESTIONS.length))
}
