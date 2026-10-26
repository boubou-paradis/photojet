// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaVote : actions de l'animateur. Réservées au propriétaire de la
// session (cookies vérifiés côté serveur). Les changements d'étape sont faits
// par la fonction SQL vote_admin, sous le verrou de la partie : chaque action
// n'est acceptée qu'à l'étape prévue, donc un double appui (souris ou
// télécommande) ne s'applique qu'une fois.
// `snapshot` (lecture seule) : état, totaux complets (même en mode caché,
//   l'animateur seul) et brouillon de l'éditeur.
// `save_draft` : sauvegarde du brouillon de l'éditeur.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  VoteActionError,
  getVoteAdmin,
  loadPublicState,
  loadTally,
  mapAdminError,
  requireSessionOwner,
  votePhotoBase,
} from '@/lib/vote/server'
import type { VoteDraft } from '@/lib/vote/types'
import { parseAdminRequest, parseDraft } from '@/lib/vote/validation'

const NO_STORE = { 'Cache-Control': 'no-store' }

async function saveDraft(admin: SupabaseClient, sessionId: string, draft: VoteDraft) {
  const { error } = await admin
    .from('vote_drafts')
    .upsert({ session_id: sessionId, data: draft, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

async function snapshot(admin: SupabaseClient, sessionId: string) {
  const [state, draftRes] = await Promise.all([
    loadPublicState(admin, sessionId, false),
    admin.from('vote_drafts').select('data').eq('session_id', sessionId).maybeSingle(),
  ])
  if (draftRes.error) throw new Error(draftRes.error.message)

  // Brouillon relu à travers la validation : une photo supprimée ou un
  // format ancien ne casse pas l'éditeur (brouillon ignoré).
  let draft: VoteDraft | null = null
  if (draftRes.data) {
    const parsed = parseDraft(draftRes.data.data, { sessionId, photoBase: votePhotoBase(), partial: true })
    if (parsed.ok) draft = parsed.value
  }

  const tally = state.active && state.event ? await loadTally(admin, state.event.id) : null
  return { state, tally, draft }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const parsed = parseAdminRequest(body, votePhotoBase())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { sessionId, action, args } = parsed.value

  if (!(await requireSessionOwner(sessionId))) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const admin = getVoteAdmin()
  try {
    if (action === 'snapshot') {
      return NextResponse.json({ ok: true, ...(await snapshot(admin, sessionId)) }, { headers: NO_STORE })
    }
    if (action === 'save_draft') {
      await saveDraft(admin, sessionId, args as VoteDraft)
      return NextResponse.json({ ok: true }, { headers: NO_STORE })
    }

    const { data, error } = await admin.rpc('vote_admin', { p_session_id: sessionId, p_action: action, p_args: args })
    if (error) {
      const mapped = mapAdminError(error.message)
      if (mapped) throw mapped
      throw new Error(error.message)
    }
    // Le scrutin lancé devient le brouillon de l'éditeur (retrouvé au rechargement).
    if (action === 'launch' || action === 'edit' || action === 'new_vote') {
      await saveDraft(admin, sessionId, args as VoteDraft).catch((e) =>
        console.error('[AnimaVote] brouillon :', e instanceof Error ? e.message : e),
      )
    }
    return NextResponse.json({ ok: true, state: data }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof VoteActionError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error(`[AnimaVote] action ${action} :`, e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Action impossible, réessayez.' }, { status: 500 })
  }
}
