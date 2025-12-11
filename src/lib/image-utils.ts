import imageCompression from 'browser-image-compression'

export interface CompressionProgress {
  stage: 'reading' | 'compressing' | 'done'
  progress?: number
}

export async function compressImage(
  file: File,
  onProgress?: (progress: CompressionProgress) => void
): Promise<File> {
  const options = {
    maxSizeMB: 1,              // Max 1 Mo
    maxWidthOrHeight: 1920,    // Max 1920px
    useWebWorker: true,        // Performance
    fileType: 'image/jpeg' as const,
    initialQuality: 0.85,      // Qualité 85%
    onProgress: (progress: number) => {
      onProgress?.({ stage: 'compressing', progress })
    }
  }

  try {
    onProgress?.({ stage: 'reading' })

    // Log original size for debugging
    const originalSizeMB = file.size / (1024 * 1024)
    console.log(`[Compression] Original: ${originalSizeMB.toFixed(2)} MB`)

    const compressedFile = await imageCompression(file, options)

    // Log compressed size
    const compressedSizeMB = compressedFile.size / (1024 * 1024)
    console.log(`[Compression] Compressed: ${compressedSizeMB.toFixed(2)} MB (${Math.round((1 - compressedSizeMB / originalSizeMB) * 100)}% reduction)`)

    onProgress?.({ stage: 'done', progress: 100 })

    return compressedFile
  } catch (error) {
    console.error('Error compressing image:', error)
    onProgress?.({ stage: 'done', progress: 100 })
    return file
  }
}

// Check if file needs compression (> 1 Mo or > 1920px)
export function needsCompression(file: File): boolean {
  return file.size > 1024 * 1024 // > 1 Mo
}

// Get file size in human readable format
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

export function generateSessionCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export function getPublicUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/photos/${storagePath}`
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
