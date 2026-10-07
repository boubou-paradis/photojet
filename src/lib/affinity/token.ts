// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Jeton secret d'un joueur : remis une seule fois au téléphone, seule son
// empreinte SHA-256 est stockée en base. Côté serveur uniquement.

import { createHash, randomBytes } from 'node:crypto'

export function generatePlayerToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashPlayerToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
