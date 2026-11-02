// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Frein contre l'essai de tous les codes : une adresse qui tente trop de codes
// différents et inexistants est refusée quelques minutes. Seuls les codes
// distincts comptent : un écran qui relit le même mauvais code toutes les
// 5 secondes ne compte qu'une fois. Le seuil reste large, car toute une salle
// partage souvent la même adresse. Une panne laisse toujours passer.

import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import { NO_STORE, getPublicAdmin } from '@/lib/public-api/server'

export const CODE_FAILURE_LIMIT = 50
export const CODE_FAILURE_WINDOW_MS = 10 * 60 * 1000
const RETENTION_MS = 60 * 60 * 1000
const CACHE_MS = 30 * 1000
const CACHE_MAX_ENTRIES = 1000

// Évite une lecture par relecture de téléphone pendant une partie.
const cache = new Map<string, { blocked: boolean; until: number }>()

export function resetCodeGuardCache(): void {
  cache.clear()
}

function fingerprint(value: string): string {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(value).digest('hex')
}

/** Adresse vue par Vercel, jamais conservée en clair. Null si inconnue : pas de frein. */
function clientKey(request: Request): string | null {
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip ? fingerprint(ip) : null
}

export async function isCodeLookupBlocked(request: Request): Promise<boolean> {
  const key = clientKey(request)
  if (!key) return false

  const known = cache.get(key)
  if (known && known.until > Date.now()) return known.blocked

  try {
    const { count, error } = await getPublicAdmin()
      .from('code_failures')
      .select('code_hash', { count: 'exact', head: true })
      .eq('ip_hash', key)
      .gt('failed_at', new Date(Date.now() - CODE_FAILURE_WINDOW_MS).toISOString())
    if (error) throw new Error(error.message)

    const blocked = (count ?? 0) >= CODE_FAILURE_LIMIT
    if (cache.size >= CACHE_MAX_ENTRIES) cache.clear()
    cache.set(key, { blocked, until: Date.now() + CACHE_MS })
    return blocked
  } catch (e) {
    console.error('[code-guard] lecture :', e instanceof Error ? e.message : e)
    return false
  }
}

export async function recordCodeFailure(request: Request, scope: 'session' | 'borne' | 'pin', value: string): Promise<void> {
  const key = clientKey(request)
  if (!key) return

  cache.delete(key)
  try {
    const admin = getPublicAdmin()
    const { error } = await admin
      .from('code_failures')
      .upsert({ ip_hash: key, code_hash: fingerprint(`${scope}:${value}`), failed_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    await admin.from('code_failures').delete().lt('failed_at', new Date(Date.now() - RETENTION_MS).toISOString())
  } catch (e) {
    console.error('[code-guard] écriture :', e instanceof Error ? e.message : e)
  }
}

export function tooManyCodeAttempts(): NextResponse {
  return NextResponse.json(
    { error: 'Trop d’essais. Réessaie dans quelques minutes.' },
    { status: 429, headers: { ...NO_STORE, 'Retry-After': String(CODE_FAILURE_WINDOW_MS / 1000) } },
  )
}
