// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Colonnes de `sessions` ajoutées par une migration indépendante du code
// (ex. demimot_active). Si la base ne les connaît pas encore (migration pas
// appliquée, ou retirée), la lecture est refaite sans elles : le jeu concerné
// est alors simplement considéré comme inactif et tous les autres jeux
// continuent de fonctionner normalement. Toute autre erreur reste une erreur.

/** Colonnes facultatives : leur absence ne doit jamais casser une lecture. */
export const OPTIONAL_SESSION_COLUMNS: readonly string[] = ['demimot_active']

interface DbError {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

/** Erreur « colonne inconnue » (Postgres 42703 ou cache de schéma PostgREST) visant une colonne facultative. */
export function isMissingOptionalColumn(error: DbError | null | undefined): boolean {
  if (!error) return false
  const text = [error.message, error.details, error.hint].filter(Boolean).join(' ')
  if (!OPTIONAL_SESSION_COLUMNS.some((column) => text.includes(column))) return false
  return error.code === '42703' || error.code === 'PGRST204' || /does not exist|could not find|schema cache/i.test(text)
}

/** La liste sans les colonnes facultatives. */
export function withoutOptionalColumns(columns: readonly string[]): string[] {
  return columns.filter((column) => !OPTIONAL_SESSION_COLUMNS.includes(column))
}

/**
 * Lance la lecture avec toutes les colonnes ; si seule une colonne facultative
 * manque, la relance sans elle (une seule fois). Le résultat a la même forme.
 */
export async function selectWithOptionalColumns<R extends { error: DbError | null }>(
  columns: readonly string[],
  run: (select: string) => PromiseLike<R>,
): Promise<R> {
  const first = await run(columns.join(', '))
  if (!isMissingOptionalColumn(first.error)) return first
  console.warn('[public-api] Colonne facultative absente de la base, lecture sans elle :', first.error?.message)
  return run(withoutOptionalColumns(columns).join(', '))
}
