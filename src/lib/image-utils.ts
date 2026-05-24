import imageCompression from 'browser-image-compression'

export interface CompressionProgress {
  stage: 'reading' | 'compressing' | 'done'
  progress?: number
}

// Magic bytes pour les formats d'image autorisés
const IMAGE_SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a ou GIF89a
  { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WebP)
]

// Taille maximale en octets (25 Mo - les photos sont compressées à 1 Mo avant upload)
export const MAX_FILE_SIZE = 25 * 1024 * 1024

export interface ImageValidationResult {
  valid: boolean
  error?: string
  detectedType?: string
}

/**
 * Valide un fichier image en vérifiant :
 * 1. La taille du fichier
 * 2. Les magic bytes (signature du fichier)
 *
 * Protège contre les fichiers malveillants déguisés en images
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  // Vérifier la taille
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `La taille maximale est de ${formatFileSize(MAX_FILE_SIZE)}`
    }
  }

  // Vérifier la taille minimale (fichier vide ou trop petit)
  if (file.size < 100) {
    return {
      valid: false,
      error: 'Fichier invalide ou corrompu'
    }
  }

  // Lire les premiers octets du fichier
  try {
    const buffer = await file.slice(0, 12).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Vérifier les magic bytes
    for (const sig of IMAGE_SIGNATURES) {
      const matches = sig.bytes.every((byte, index) => bytes[index] === byte)
      if (matches) {
        // Vérification spéciale pour WebP (doit avoir WEBP après RIFF)
        if (sig.type === 'image/webp') {
          const webpMarker = new Uint8Array(await file.slice(8, 12).arrayBuffer())
          if (String.fromCharCode(...webpMarker) !== 'WEBP') {
            continue
          }
        }
        return { valid: true, detectedType: sig.type }
      }
    }

    // Vérification HEIC/HEIF : 'ftyp' aux octets 4-7, marque connue aux octets 8-11
    if (bytes.length >= 12) {
      const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
      if (ftyp === 'ftyp') {
        const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
        const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']
        if (heicBrands.some(b => brand.startsWith(b))) {
          return { valid: true, detectedType: 'image/heic' }
        }
      }
    }

    // Aucune signature reconnue
    return {
      valid: false,
      error: 'Format non supporté. Utilisez JPG, PNG, WebP ou HEIC'
    }
  } catch {
    return {
      valid: false,
      error: 'Impossible de lire le fichier'
    }
  }
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
