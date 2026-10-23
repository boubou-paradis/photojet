// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBooth : autorisation d'envoi d'un template. Le fichier part ensuite
// directement du navigateur vers le Storage (Vercel limite le corps d'une
// requête à 4,5 Mo), à un chemin choisi ici : borne-templates/<user_id>/<uuid>.png.
// L'enregistrement dans la bibliothèque passe par POST /api/borne/templates,
// qui contrôle le fichier avant de l'accepter.

import { NextResponse } from 'next/server'
import { TEMPLATES_PER_USER, templatePath } from '@/lib/borne-templates/constants'
import { PHOTOS_BUCKET, getCurrentUserId, getTemplatesAdmin } from '@/lib/borne-templates/server'

export async function POST() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const admin = getTemplatesAdmin()
  const { count, error: countError } = await admin
    .from('borne_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (countError) return NextResponse.json({ error: 'Bibliothèque indisponible, réessayez.' }, { status: 500 })
  if ((count ?? 0) >= TEMPLATES_PER_USER) {
    return NextResponse.json({ error: `Bibliothèque pleine (${TEMPLATES_PER_USER} templates). Supprimez-en un pour en ajouter un autre.` }, { status: 409 })
  }

  const id = crypto.randomUUID()
  const path = templatePath(userId, id)
  const { data, error } = await admin.storage.from(PHOTOS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: "Envoi impossible pour l'instant, réessayez." }, { status: 500 })

  return NextResponse.json({ id, path: data.path, token: data.token })
}
