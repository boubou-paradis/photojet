export interface AudioCompressionProgress {
  stage: 'reading' | 'decoding' | 'compressing' | 'done'
  progress?: number
}

// 192 kbps : diffusion sur une vraie sono en soirée (mariage/événement), pas
// une simple écoute casque — on garde une marge de qualité, le gain de poids
// entre 128 et 192 étant de toute façon minime sur des extraits courts.
const AUDIO_MP3_KBPS = 192

export function needsAudioCompression(file: File): boolean {
  return file.size > 1024 * 1024
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

interface EncodePayload {
  channels: number
  sampleRate: number
  kbps: number
  left: Int16Array
  right?: Int16Array
}

function encodeInWorker(payload: EncodePayload, onProgress?: (progress: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/vendor/mp3-encoder.worker.js')

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data
      if (data.type === 'progress') {
        onProgress?.(data.progress)
      } else if (data.type === 'done') {
        worker.terminate()
        resolve(data.mp3 as Uint8Array<ArrayBuffer>)
      } else if (data.type === 'error') {
        worker.terminate()
        reject(new Error(data.message))
      }
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Erreur du worker de compression audio'))
    }

    const transfer: Transferable[] = [payload.left.buffer]
    if (payload.right) transfer.push(payload.right.buffer)
    worker.postMessage(payload, transfer)
  })
}

// Ré-encode un fichier audio en MP3 192 kbps (décodage natif via Web Audio API,
// encodage lamejs dans un Web Worker pour ne pas geler l'UI sur un morceau
// long). Ne touche pas au nombre de canaux (mono reste mono, stéréo reste
// stéréo — important pour le rendu sur une sono lors d'un événement).
export async function compressAudio(
  file: File,
  onProgress?: (progress: AudioCompressionProgress) => void
): Promise<File> {
  try {
    onProgress?.({ stage: 'reading' })
    const arrayBuffer = await file.arrayBuffer()

    onProgress?.({ stage: 'decoding' })
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const audioContext = new AudioContextCtor()
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    } finally {
      await audioContext.close()
    }

    const channels = Math.min(audioBuffer.numberOfChannels, 2)
    const left = floatTo16BitPCM(audioBuffer.getChannelData(0))
    const right = channels === 2 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : undefined

    const mp3Bytes = await encodeInWorker(
      { channels, sampleRate: audioBuffer.sampleRate, kbps: AUDIO_MP3_KBPS, left, right },
      (progress) => onProgress?.({ stage: 'compressing', progress })
    )

    onProgress?.({ stage: 'done', progress: 100 })

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([mp3Bytes], `${baseName}.mp3`, { type: 'audio/mpeg' })
  } catch (error) {
    console.error('[Audio] Compression error:', error)
    onProgress?.({ stage: 'done', progress: 100 })
    // La compression a échoué (format non décodable, navigateur incompatible,
    // worker indisponible...) : on renvoie le fichier d'origine intact plutôt
    // que de bloquer l'upload.
    return file
  }
}
