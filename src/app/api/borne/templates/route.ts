// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBooth : bibliothèque de templates.
// POST   { id, name } : contrôle le PNG déjà envoyé (voir upload-url), puis
//        l'ajoute à la bibliothèque. Refusé → le fichier est supprimé.
// DELETE ?id=…     : retire le template des sessions qui l'utilisent, puis
//        supprime la ligne et le fichier (référencé nulle part ailleurs).
// La lecture de la bibliothèque se fait côté navigateur (RLS).

import { NextResponse } from 'next/server'
import { analyzeTemplate } from '@/lib/borne-templates/analyze'
import { TEMPLATE_MAX_BYTES, TEMPLATE_NAME_MAX, TEMPLATES_PER_USER, templatePath } from '@/lib/borne-templates/constants'
import { PHOTOS_BUCKET, getCurrentUserId, getTemplatesAdmin, isUuid } from '@/lib/borne-templates/server'

export async function POST(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const { id, name } = (body ?? {}) as { id?: unknown; name?: unknown }
  const cleanName = typeof name === 'string' ? name.trim() : ''
  if (!isUuid(id) || cleanName.length === 0 || cleanName.length > TEMPLATE_NAME_MAX) {
    return NextResponse.json({ error: 'Nom du template invalide (1 à 80 caractères).' }, { status: 400 })
  }

  const admin = getTemplatesAdmin()
  // Le chemin est recalculé ici : un utilisateur ne peut enregistrer que
  // son propre dossier, jamais un fichier d'un autre compte.
  const path = templatePath(userId, id)
  const reject = async (error: string, status = 400) => {
    await admin.storage.from(PHOTOS_BUCKET).remove([path])
    return NextResponse.json({ error }, { status })
  }

  const { data: existing } = await admin.from('borne_templates').select('id').eq('storage_path', path).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Ce template est déjà dans votre bibliothèque.' }, { status: 409 })

  const { data: blob, error: downloadError } = await admin.storage.from(PHOTOS_BUCKET).download(path)
  if (downloadError || !blob) return NextResponse.json({ error: "Fichier introuvable : renvoyez-le." }, { status: 400 })
  if (blob.size > TEMPLATE_MAX_BYTES) return reject(`Fichier trop lourd (${Math.round(blob.size / 1024 / 1024)} Mo). Maximum : 15 Mo.`)

  const analysis = analyzeTemplate(Buffer.from(await blob.arrayBuffer()))
  if (!analysis.ok) return reject(analysis.error)

  const { count } = await admin
    .from('borne_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if ((count ?? 0) >= TEMPLATES_PER_USER) {
    return reject(`Bibliothèque pleine (${TEMPLATES_PER_USER} templates). Supprimez-en un pour en ajouter un autre.`, 409)
  }

  const { width, height, orientation, zone, coverage, warnings } = analysis.value
  const { data: row, error: insertError } = await admin
    .from('borne_templates')
    .insert({
      id,
      user_id: userId,
      name: cleanName,
      storage_path: path,
      orientation,
      width,
      height,
      photo_zones: [zone],
      file_size: blob.size,
      source: 'import',
    })
    .select('*')
    .single()
  if (insertError || !row) return reject("Enregistrement impossible pour l'instant, réessayez.", 500)

  return NextResponse.json({ template: row, coverage, warnings })
}

export async function DELETE(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })

  const admin = getTemplatesAdmin()
  const { data: template } = await admin
    .from('borne_templates')
    .select('id, storage_path')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!template) return NextResponse.json({ error: 'Template introuvable.' }, { status: 404 })

  // 1. Retirer le template des sessions (les siennes uniquement) avant tout
  //    effacement : une tablette ne doit jamais pointer vers un fichier supprimé.
  const unlinked = new Set<string>()
  for (const column of ['borne_template_portrait_id', 'borne_template_landscape_id'] as const) {
    const { data, error } = await admin
      .from('sessions')
      .update({ [column]: null })
      .eq('user_id', userId)
      .eq(column, id)
      .select('id')
    if (error) return NextResponse.json({ error: "Suppression impossible pour l'instant, réessayez." }, { status: 500 })
    for (const s of data ?? []) unlinked.add(s.id as string)
  }

  // 2. Ligne puis fichier
  const { error: deleteError } = await admin.from('borne_templates').delete().eq('id', id).eq('user_id', userId)
  if (deleteError) return NextResponse.json({ error: "Suppression impossible pour l'instant, réessayez." }, { status: 500 })
  const { error: removeError } = await admin.storage.from(PHOTOS_BUCKET).remove([template.storage_path as string])
  if (removeError) console.error('[borne-templates] Storage remove error:', removeError.message)

  return NextResponse.json({ deleted: id, sessionsUpdated: unlinked.size })
}
