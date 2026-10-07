// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Packs de questions de Matching. Le MVP n'en contient qu'un ; la structure
// accueillera les suivants (bar, célibataires, mariage, afterwork, camping,
// EVJF/EVG, team building…) sans changer l'éditeur.

import { AFFINITY_DEFAULT_TIME_LIMIT } from '@/lib/affinity/constants'
import type { AffinityQuestion } from '@/lib/affinity/types'

export interface AffinityPack {
  id: string
  name: string
  description: string
  questions: AffinityQuestion[]
}

const q = (n: number, text: string, answers: string[]): AffinityQuestion => ({
  id: `soiree-${String(n).padStart(2, '0')}`,
  text,
  answers,
  timeLimit: AFFINITY_DEFAULT_TIME_LIMIT,
})

export const AFFINITY_PACKS: AffinityPack[] = [
  {
    id: 'soiree',
    name: 'Pack soirée / convivialité',
    description: '20 questions légères pour lancer la conversation, entièrement modifiables.',
    questions: [
      q(1, 'Plutôt mer ou montagne ?', ['Mer 🌊', 'Montagne ⛰️']),
      q(2, 'Ton apéro idéal ?', ['Terrasse au soleil', 'Canapé entre amis', 'Bar animé', 'Pique-nique']),
      q(3, 'Team sucré ou salé ?', ['Sucré', 'Salé']),
      q(4, 'Ta boisson de soirée ?', ['Bière', 'Vin', 'Cocktail', 'Sans alcool']),
      q(5, 'Le week-end parfait ?', ['Grasse mat\'', 'Rando', 'Festival', 'Brunch entre potes']),
      q(6, 'L\'ananas sur la pizza ?', ['Oui, sans honte', 'Jamais de la vie']),
      q(7, 'Sur la piste de danse, tu es…', ['Le premier à y aller', 'Je me fais prier', 'Je danse assis', 'Je filme les autres']),
      q(8, 'Tes vacances idéales ?', ['Road trip', 'Club tout compris', 'City trip', 'Camping']),
      q(9, 'Lève-tôt ou couche-tard ?', ['Lève-tôt', 'Couche-tard']),
      q(10, 'Le karaoké ?', ['J\'adore', 'Seulement après minuit', 'Jamais']),
      q(11, 'Chat ou chien ?', ['Chat', 'Chien', 'Les deux', 'Aucun']),
      q(12, 'Série ou film ?', ['Série', 'Film']),
      q(13, 'Au resto, tu prends…', ['Toujours le même plat', 'Le plat que je ne connais pas', 'Comme mon voisin', 'Le dessert d\'abord']),
      q(14, 'Ta playlist en voiture ?', ['Années 80', 'Rap', 'Rock', 'Variété française']),
      q(15, 'Un super-pouvoir ?', ['Voler', 'Téléportation', 'Invisibilité', 'Lire dans les pensées']),
      q(16, 'Tu gagnes au loto, premier réflexe ?', ['Une maison', 'Un tour du monde', 'Gâter mes proches', 'Ne rien dire à personne']),
      q(17, 'La batterie de ton téléphone ?', ['Toujours à 100 %', 'Je vis à 3 %']),
      q(18, 'Message vocal ou écrit ?', ['Vocal', 'Écrit']),
      q(19, 'Concert ou théâtre ?', ['Concert', 'Théâtre']),
      q(20, 'Fondue, raclette ou tartiflette ?', ['Fondue', 'Raclette', 'Tartiflette']),
    ],
  },
]
