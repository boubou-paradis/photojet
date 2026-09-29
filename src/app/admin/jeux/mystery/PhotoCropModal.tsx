'use client'

import { useState, useCallback, useEffect } from 'react'
import Cropper, { Area, MediaSize } from 'react-easy-crop'
import { motion } from 'framer-motion'
import { Loader2, X, ZoomIn, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCroppedImageBlob } from '@/lib/image-utils'
import { toast } from 'sonner'

interface PhotoCropModalProps {
  imageSrc: string
  gridCols: number
  gridRows: number
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

// react-easy-crop exige un conteneur de taille explicite (pas de %/CSS pur).
// Le cadre est calculé à partir de la fenêtre du navigateur (voir
// computePreviewSize) pour rester confortable aussi bien sur un grand écran
// de bureau que sur un petit laptop, plutôt qu'une taille fixe qui donnait
// l'impression d'une photo "réduite" une fois le fix d'image entière en place.
const MAX_PREVIEW_WIDTH = 900
const MAX_PREVIEW_HEIGHT = 640
const MIN_PREVIEW_WIDTH = 320
const MIN_PREVIEW_HEIGHT = 220
// Espace vertical/horizontal réservé au reste de la modale (en-tête, sliders
// zoom/rotation, pied de page, marges) — estimé, pas mesuré dynamiquement.
const RESERVED_VERTICAL_SPACE = 340
const RESERVED_HORIZONTAL_SPACE = 120

function computePreviewSize(aspect: number): { width: number; height: number } {
  if (typeof window === 'undefined') {
    // Rendu serveur impossible ici (modale affichée uniquement côté client),
    // mais garde une valeur de repli cohérente si jamais évalué hors navigateur.
    return { width: 540, height: 360 }
  }

  const availableWidth = Math.min(window.innerWidth - RESERVED_HORIZONTAL_SPACE, MAX_PREVIEW_WIDTH)
  const availableHeight = Math.min(window.innerHeight - RESERVED_VERTICAL_SPACE, MAX_PREVIEW_HEIGHT)

  let width = availableWidth
  let height = width / aspect
  if (height > availableHeight) {
    height = availableHeight
    width = height * aspect
  }

  width = Math.max(width, MIN_PREVIEW_WIDTH)
  height = Math.max(height, MIN_PREVIEW_HEIGHT)

  return { width, height }
}

export default function PhotoCropModal({ imageSrc, gridCols, gridRows, onCancel, onConfirm }: PhotoCropModalProps) {
  const aspect = gridCols / gridRows
  const [previewSize, setPreviewSize] = useState(() => computePreviewSize(aspect))
  const { width: previewWidth, height: previewHeight } = previewSize

  useEffect(() => {
    function handleResize() {
      setPreviewSize(computePreviewSize(aspect))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [aspect])

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  // objectFit="cover" affiche l'image déjà "remplie" (recadrée) au zoom minimum
  // par défaut (1) — on calcule ici le zoom réel auquel l'image entière tient
  // dans le cadre, pour l'utiliser comme zoom minimum ET comme zoom de départ.
  // Ne touche pas à objectFit="cover" (nécessaire au fix portrait, cf. commit 04f59cf).
  //
  // IMPORTANT : mediaSize.width/height fournis par ce callback ne sont PAS
  // fiables au premier appel (bug de timing interne à react-easy-crop@6.2.3 —
  // son état this.state.mediaObjectFit vaut encore undefined à ce moment-là,
  // ce qui lui fait utiliser sa branche "contain" par défaut pour calculer
  // mediaSize, alors que le rendu CSS réel utilise déjà la bonne branche
  // "cover"). On ignore donc mediaSize.width/height et on recalcule nous-
  // mêmes la taille de couverture à partir de naturalWidth/naturalHeight
  // (fiables, ce sont des propriétés intrinsèques de l'image) — même formule
  // que la librairie utilise pour choisir sa classe CSS Cover_Horizontal/Vertical.
  const handleMediaLoaded = useCallback((mediaSize: MediaSize) => {
    const mediaAspect = mediaSize.naturalWidth / mediaSize.naturalHeight
    const containerAspect = previewWidth / previewHeight
    const coverSize = mediaAspect < containerAspect
      ? { width: previewWidth, height: previewWidth / mediaAspect }
      : { width: previewHeight * mediaAspect, height: previewHeight }

    const fitZoom = Math.min(previewWidth / coverSize.width, previewHeight / coverSize.height, 1)
    setMinZoom(fitZoom)
    setZoom(fitZoom)
  }, [previewWidth, previewHeight])

  async function handleValidate() {
    if (!croppedAreaPixels) return
    setExporting(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, rotation)
      onConfirm(blob)
    } catch (err) {
      console.error('Error cropping image:', err)
      toast.error('Erreur lors du recadrage de l\'image')
    } finally {
      setExporting(false)
    }
  }

  // Lignes de grille superposées, mêmes proportions que les tuiles du jeu —
  // ce que le DJ voit ici est exactement le découpage qu'il obtiendra en jeu.
  const verticalLines = Array.from({ length: gridCols - 1 }, (_, i) => ((i + 1) / gridCols) * 100)
  const horizontalLines = Array.from({ length: gridRows - 1 }, (_, i) => ((i + 1) / gridRows) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-5xl w-full overflow-hidden flex flex-col"
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
              onMediaLoaded={handleMediaLoaded}
              minZoom={minZoom}
              maxZoom={3}
              objectFit="cover"
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
              min={minZoom}
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
