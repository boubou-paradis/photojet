'use client'

import { useState, useCallback } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { motion } from 'framer-motion'
import { Loader2, X, ZoomIn, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCroppedImageBlob } from '@/lib/image-utils'

interface PhotoCropModalProps {
  imageSrc: string
  gridCols: number
  gridRows: number
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

// Hauteur fixe du cadre de recadrage (react-easy-crop exige un conteneur de
// taille explicite). La largeur du cadre se déduit du ratio cols/rows du
// quadrillage de tuiles actuel, pour que l'aperçu soit exactement ce que le
// jeu affichera (object-fit: cover n'aura plus rien à recadrer derrière).
const PREVIEW_HEIGHT = 360

export default function PhotoCropModal({ imageSrc, gridCols, gridRows, onCancel, onConfirm }: PhotoCropModalProps) {
  const aspect = gridCols / gridRows
  const previewWidth = Math.min(640, PREVIEW_HEIGHT * aspect)
  const previewHeight = previewWidth / aspect

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleValidate() {
    if (!croppedAreaPixels) return
    setExporting(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, rotation)
      onConfirm(blob)
    } finally {
      setExporting(false)
    }
  }

  // Lignes de grille superposées, mêmes proportions que les tuiles du jeu —
  // ce que le DJ voit ici est exactement le découpage qu'il obtiendra en jeu.
  const verticalLines = Array.from({ length: gridCols - 1 }, (_, i) => ((i + 1) / gridCols) * 100)
  const horizontalLines = Array.from({ length: gridRows - 1 }, (_, i) => ((i + 1) / gridRows) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-2xl w-full overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.1)]">
          <div>
            <h3 className="text-lg font-bold text-white">Recadrer la photo</h3>
            <p className="text-sm text-gray-400">Ajustez le cadrage — l'aperçu montre le découpage exact du jeu ({gridCols}×{gridRows})</p>
          </div>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          <div
            className="relative bg-black rounded-lg overflow-hidden"
            style={{ width: previewWidth, height: previewHeight }}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropSize={{ width: previewWidth, height: previewHeight }}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={handleCropComplete}
              minZoom={1}
              maxZoom={3}
            />
            {/* Overlay grille de tuiles, purement visuel, ne capte aucun clic */}
            <div className="absolute inset-0 pointer-events-none">
              {verticalLines.map((pct) => (
                <div key={`v-${pct}`} className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${pct}%` }} />
              ))}
              {horizontalLines.map((pct) => (
                <div key={`h-${pct}`} className="absolute left-0 right-0 h-px bg-white/40" style={{ top: `${pct}%` }} />
              ))}
            </div>
          </div>

          <div className="w-full flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
          </div>
          <div className="w-full flex items-center gap-3">
            <RotateCw className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{rotation}°</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
            Annuler
          </button>
          <Button
            onClick={handleValidate}
            disabled={exporting || !croppedAreaPixels}
            className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold hover:from-[#F4D03F] hover:to-[#D4AF37]"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Valider le cadrage
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
