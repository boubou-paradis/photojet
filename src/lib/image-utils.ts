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
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.85,
    onProgress: (progress: number) => {
      onProgress?.({ stage: 'compressing', progress })
    }
  }

  try {
    onProgress?.({ stage: 'reading' })
    const compressedFile = await imageCompression(file, options)
    onProgress?.({ stage: 'done', progress: 100 })
    return compressedFile
  } catch (error) {
    console.error('[Image] Compression error:', error)
    onProgress?.({ stage: 'done', progress: 100 })
    return file
  }
}

export function needsCompression(file: File): boolean {
  return file.size > 1024 * 1024
}

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
