// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createWatermarkAdminClient, isTrialAccount } from '@/lib/watermark/access'
import { WATERMARK_LAYER_PATH } from '@/lib/watermark/constants'
import { applyWatermark } from '@/lib/watermark/render'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WIDTHS = [800, 1920]

let calqueCache: Buffer | null = null

async function loadCalque(origin: string): Promise<Buffer> {
  if (calqueCache) return calqueCache
  const response = await fetch(new URL(WATERMARK_LAYER_PATH, origin))
  if (!response.ok) throw new Error(`Calque indisponible (${response.status})`)
  calqueCache = Buffer.from(await response.arrayBuffer())
  return calqueCache
}

// Compte d'essai : copie filigranée, générée à la volée. Autres comptes, ou statut
// incertain : redirection vers la photo d'origine. Un compte reconnu en essai dont la
// photo ne peut pas être filigranée reçoit une erreur, jamais la photo propre.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Invalid photo id' }, { status: 400 })
  }

  try {
    const admin = createWatermarkAdminClient()

    const { data: photo, error: photoError } = await admin
      .from('photos')
      .select('storage_path, status, session_id')
      .eq('id', id)
      .maybeSingle()

    if (photoError) throw photoError

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .select('user_id')
      .eq('id', photo.session_id)
      .single()

    if (sessionError) throw sessionError

    // Une photo non approuvée n'est visible que du propriétaire de la session (modération)
    if (photo.status !== 'approved') {
      const supabase = await createServerSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.id !== session.user_id) {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
      }
    }

    if (!(await isTrialAccount(admin, session.user_id))) {
      const { data } = admin.storage.from('photos').getPublicUrl(photo.storage_path)
      return NextResponse.redirect(data.publicUrl, {
        status: 302,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const { data: file, error: downloadError } = await admin.storage
      .from('photos')
      .download(photo.storage_path)

    if (downloadError || !file) throw downloadError ?? new Error('Fichier introuvable')

    const largeur = Number(request.nextUrl.searchParams.get('w'))
    const image = await applyWatermark(
      Buffer.from(await file.arrayBuffer()),
      await loadCalque(request.nextUrl.origin),
      WIDTHS.includes(largeur) ? largeur : undefined
    )

    return new NextResponse(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': image.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Watermark render error:', error)
    return NextResponse.json({ error: 'Watermark failed' }, { status: 503 })
  }
}
