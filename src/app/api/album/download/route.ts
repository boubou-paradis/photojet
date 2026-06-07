import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@supabase/supabase-js'

// Génération du ZIP : laisser plus de temps pour les gros albums
export const runtime = 'nodejs'
export const maxDuration = 60

// Nombre de photos téléchargées en parallèle (compromis vitesse / mémoire)
const DOWNLOAD_CONCURRENCY = 8

export async function POST(request: NextRequest) {
  try {
    const { sessionCode, photoIds } = await request.json()

    if (!sessionCode) {
      return NextResponse.json({ error: 'Session code required' }, { status: 400 })
    }

    // Create Supabase client with service role for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get session first
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, name, album_enabled')
      .eq('code', sessionCode)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session.album_enabled) {
      return NextResponse.json({ error: 'Album is disabled' }, { status: 403 })
    }

    // Build photos query
    let query = supabase
      .from('photos')
      .select('id, storage_path')
      .eq('session_id', session.id)
      .eq('status', 'approved')

    // Filter by specific photo IDs if provided
    if (photoIds && photoIds.length > 0) {
      query = query.in('id', photoIds)
    }

    const { data: photos, error: photosError } = await query

    if (photosError || !photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos found' }, { status: 404 })
    }

    // Create ZIP file
    const zip = new JSZip()

    // Capture non-null local (le garde ci-dessus a déjà écarté le cas null/vide)
    const items = photos

    // Télécharger les photos en parallèle (par lots) plutôt qu'une par une :
    // gros gain de vitesse. On conserve l'ordre d'origine pour le nommage.
    const buffers: (ArrayBuffer | null)[] = new Array(items.length).fill(null)
    let cursor = 0

    async function worker() {
      while (true) {
        const i = cursor++
        if (i >= items.length) break
        const photo = items[i]

        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('photos')
            .download(photo.storage_path)

          if (downloadError || !fileData) {
            console.error(`Failed to download photo ${photo.id}:`, downloadError)
            continue
          }

          buffers[i] = await fileData.arrayBuffer()
        } catch (err) {
          console.error(`Error processing photo ${photo.id}:`, err)
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, items.length) }, worker)
    )

    // Ajouter au ZIP dans l'ordre d'origine (nommage photo_001, photo_002, ...)
    for (let i = 0; i < items.length; i++) {
      const buffer = buffers[i]
      if (!buffer) continue
      const extension = items[i].storage_path.split('.').pop() || 'jpg'
      zip.file(`photo_${String(i + 1).padStart(3, '0')}.${extension}`, buffer)
    }

    // Generate ZIP buffer — STORE (pas de recompression) : les JPEG/PNG sont
    // déjà compressés, DEFLATE ne gagne ~rien et coûte beaucoup de CPU.
    const arrayBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'STORE',
      streamFiles: true,
    })

    // Create safe filename
    const safeEventName = session.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    const filename = `${safeEventName}_${sessionCode}.zip`

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('ZIP generation error:', error)
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 })
  }
}
