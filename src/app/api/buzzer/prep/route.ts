// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — liste de manches en préparation d'une session (une par
// session, retrouvée après un rechargement). Réservé au propriétaire.
// GET ?sessionId=…  → la liste enregistrée (ou une liste vide).
// PUT { sessionId, draft } → liste validée (textes, limites, médias du
//   compte uniquement) puis enregistrée. La partie en cours n'est jamais
//   modifiée : elle joue la copie figée au lancement.

import { NextResponse } from 'next/server'
import { emptyDraft, parsePrepDraft } from '@/lib/buzzer/prep'
import { getBuzzerAdmin, requireSessionOwner } from '@/lib/buzzer/server'
import { isUuid } from '@/lib/buzzer/validation'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  const userId = await requireSessionOwner(sessionId)
  if (!userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const { data, error } = await getBuzzerAdmin().from('buzzer_prep_sets').select('data').eq('session_id', sessionId).maybeSingle()
  if (error) {
    console.error('[AnimaBuzz] lecture de la liste :', error.message)
    return NextResponse.json({ error: 'Base momentanément indisponible.' }, { status: 503 })
  }
  if (!data) return NextResponse.json({ draft: emptyDraft() }, { headers: noStore })
  // Relue avec les mêmes règles qu'à l'écriture : une donnée abîmée ne casse pas la page.
  const parsed = parsePrepDraft(data.data, userId)
  return NextResponse.json({ draft: parsed.ok ? parsed.value : emptyDraft() }, { headers: noStore })
}

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const { sessionId, draft } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Session invalide.' }, { status: 400 })
  const userId = await requireSessionOwner(sessionId)
  if (!userId) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const parsed = parsePrepDraft(draft, userId)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { error } = await getBuzzerAdmin()
    .from('buzzer_prep_sets')
    .upsert({ session_id: sessionId, data: parsed.value, updated_at: new Date().toISOString() }, { onConflict: 'session_id' })
  if (error) {
    console.error('[AnimaBuzz] enregistrement de la liste :', error.message)
    return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, draft: parsed.value }, { headers: noStore })
}
