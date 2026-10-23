// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBooth : cadre à utiliser par la tablette (route publique, comme la
// borne elle-même). La bibliothèque borne_templates est fermée aux visiteurs
// (RLS) : on ne renvoie ici que les templates choisis pour cette borne, et
// seulement s'ils appartiennent bien au propriétaire de la session.

import { NextResponse } from 'next/server'
import { PHOTOS_BUCKET, getTemplatesAdmin } from '@/lib/borne-templates/server'
import type { BorneFrameConfig, BorneFrameTemplate, PhotoZone } from '@/lib/borne-templates/constants'

const OFF: BorneFrameConfig = { enabled: false, guestChoice: true, portrait: null, landscape: null }
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) return NextResponse.json(OFF, { status: 404, headers: noStore })

  const admin = getTemplatesAdmin()
  const { data: session } = await admin
    .from('sessions')
    .select('user_id, borne_template_enabled, borne_template_portrait_id, borne_template_landscape_id, borne_template_guest_choice')
    .eq('borne_qr_code', code)
    .eq('is_active', true)
    .eq('borne_enabled', true)
    .maybeSingle()
  if (!session) return NextResponse.json(OFF, { status: 404, headers: noStore })

  const ids = [session.borne_template_portrait_id, session.borne_template_landscape_id].filter(Boolean) as string[]
  if (!session.borne_template_enabled || ids.length === 0 || !session.user_id) {
    return NextResponse.json({ ...OFF, guestChoice: session.borne_template_guest_choice }, { headers: noStore })
  }

  const { data: rows } = await admin
    .from('borne_templates')
    .select('id, storage_path, width, height, photo_zones')
    .in('id', ids)
    .eq('user_id', session.user_id)
  const toFrame = (id: string | null): BorneFrameTemplate | null => {
    const t = id ? rows?.find((r) => r.id === id) : null
    const zone = t ? (t.photo_zones as PhotoZone[] | null)?.[0] : null
    if (!t || !zone) return null
    return {
      id: t.id as string,
      url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${t.storage_path as string}`,
      width: t.width as number,
      height: t.height as number,
      zone,
    }
  }

  const config: BorneFrameConfig = {
    enabled: true,
    guestChoice: session.borne_template_guest_choice,
    portrait: toFrame(session.borne_template_portrait_id),
    landscape: toFrame(session.borne_template_landscape_id),
  }
  if (!config.portrait && !config.landscape) config.enabled = false
  return NextResponse.json(config, { headers: noStore })
}
