import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@supabase/supabase-js'

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

    // Download and add each photo to ZIP
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('photos')
          .download(photo.storage_path)

        if (downloadError || !fileData) {
          console.error(`Failed to download photo ${photo.id}:`, downloadError)
          continue
        }

        const arrayBuffer = await fileData.arrayBuffer()
        const extension = photo.storage_path.split('.').pop() || 'jpg'
        zip.file(`photo_${String(i + 1).padStart(3, '0')}.${extension}`, arrayBuffer)
      } catch (err) {
        console.error(`Error processing photo ${photo.id}:`, err)
      }
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // Convert blob to array buffer for response
    const arrayBuffer = await zipBlob.arrayBuffer()

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
