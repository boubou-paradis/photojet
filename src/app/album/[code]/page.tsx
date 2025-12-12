'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
  Check,
  Package,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, Photo } from '@/types/database'

export default function AlbumPage() {
  const params = useParams()
  const code = params.code as string

  const [session, setSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])

  // Password protection
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', code)
          .single()

        if (sessionError) throw sessionError

        // Check if album is enabled
        if (sessionData.album_enabled === false) {
          setError('Album désactivé')
          return
        }

        setSession(sessionData)

        // If no password required, auto-unlock
        if (!sessionData.album_password) {
          setIsUnlocked(true)
          await fetchPhotos(sessionData.id)
        }
      } catch {
        setError('Album introuvable')
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchData()
    }
  }, [code, supabase])

  async function fetchPhotos(sessionId: string) {
    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'approved')
      .order('uploaded_at', { ascending: false })

    if (!photosError) {
      setPhotos(photosData || [])
    }
  }

  function checkPassword() {
    if (!session) return

    if (password === session.album_password) {
      setIsUnlocked(true)
      setPasswordError(false)
      fetchPhotos(session.id)
    } else {
      setPasswordError(true)
    }
  }

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  function toggleSelect(photoId: string) {
    setSelectedPhotos(prev =>
      prev.includes(photoId)
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    )
  }

  function selectAll() {
    if (selectedPhotos.length === photos.length) {
      setSelectedPhotos([])
    } else {
      setSelectedPhotos(photos.map(p => p.id))
    }
  }

  async function downloadSingle(photo: Photo) {
    try {
      const url = getPhotoUrl(photo.storage_path)
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `photo_${photo.id.substring(0, 8)}.jpg`
      a.click()
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('Error downloading:', err)
    }
  }

  async function downloadZip(photoIds: string[] | null = null) {
    setDownloading(true)
    try {
      const response = await fetch('/api/album/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode: code,
          photoIds: photoIds,
        }),
      })

      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${session?.name || 'album'}_${code}.zip`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading ZIP:', err)
      alert('Erreur lors du téléchargement')
    } finally {
      setDownloading(false)
    }
  }

  function openLightbox(index: number) {
    setCurrentPhotoIndex(index)
    setLightboxOpen(true)
  }

  function closeLightbox() {
    setLightboxOpen(false)
  }

  function nextPhoto() {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
  }

  function prevPhoto() {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!lightboxOpen) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') nextPhoto()
      if (e.key === 'ArrowLeft') prevPhoto()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen, photos.length])

  // Format date
  const eventDate = session?.created_at
    ? new Date(session.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1E]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1E] p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <div className="bg-[#242428] border border-[rgba(255,255,255,0.1)] rounded-xl w-full max-w-sm p-8 text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E53935]/10 flex items-center justify-center">
            <X className="h-8 w-8 text-[#E53935]" />
          </div>
          <h1 className="text-xl font-semibold mb-2 text-white">{error || 'Album introuvable'}</h1>
          <p className="text-[#6B6B70]">Vérifiez le code ou le lien fourni</p>
        </div>
      </div>
    )
  }

  // Password protection screen
  if (session.album_password && !isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1A1E] p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#242428] border border-[rgba(255,255,255,0.1)] rounded-xl w-full max-w-sm p-8 text-center relative z-10"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-xl font-semibold mb-2 text-white">Album protégé</h1>
          <p className="text-[#6B6B70] mb-6">Entrez le mot de passe pour accéder aux photos</p>

          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && checkPassword()}
            placeholder="Mot de passe"
            className={`w-full bg-[#2E2E33] text-white rounded-lg p-3 mb-4 text-center border ${
              passwordError ? 'border-red-500' : 'border-transparent'
            } focus:border-[#D4AF37] focus:outline-none transition-colors`}
          />

          {passwordError && (
            <p className="text-red-400 text-sm mb-4">Mot de passe incorrect</p>
          )}

          <Button
            onClick={checkPassword}
            className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#1A1A1E] font-bold hover:opacity-90"
          >
            Accéder à l'album
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E]">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5 pointer-events-none" />

      {/* Header */}
      <div className="bg-[#242428] py-6 px-4 text-center border-b border-[rgba(255,255,255,0.1)]">
        <div className="flex justify-center mb-4">
          <Image src="/logo.png" alt="PhotoJet" width={40} height={40} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{session.name}</h1>
        <p className="text-[#6B6B70]">
          {photos.length} photo{photos.length > 1 ? 's' : ''} • {eventDate}
        </p>
      </div>

      {/* Actions bar */}
      <div className="sticky top-0 bg-[#1A1A1E]/95 backdrop-blur-sm z-40 p-4 border-b border-[rgba(255,255,255,0.1)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            {photos.length > 0 && (
              <button
                onClick={selectAll}
                className="text-sm text-[#6B6B70] hover:text-[#D4AF37] transition-colors"
              >
                {selectedPhotos.length === photos.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}
            <p className="text-[#6B6B70] text-sm">
              {selectedPhotos.length > 0
                ? `${selectedPhotos.length} photo(s) sélectionnée(s)`
                : 'Cliquez pour sélectionner'}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedPhotos.length > 0 && (
              <Button
                onClick={() => downloadZip(selectedPhotos)}
                disabled={downloading}
                size="sm"
                className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger ({selectedPhotos.length})
              </Button>
            )}
            {photos.length > 0 && (
              <Button
                onClick={() => downloadZip(null)}
                disabled={downloading}
                size="sm"
                variant="outline"
                className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#1A1A1E]"
              >
                {downloading && selectedPhotos.length === 0 ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Tout (ZIP)
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 relative z-10">
        {photos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#2E2E33] flex items-center justify-center">
              <ImageIcon className="h-10 w-10 text-[#6B6B70]" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Aucune photo</h2>
            <p className="text-[#6B6B70]">Les photos approuvées apparaîtront ici</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group ${
                  selectedPhotos.includes(photo.id)
                    ? 'ring-4 ring-[#D4AF37]'
                    : ''
                }`}
                onClick={() => toggleSelect(photo.id)}
                onDoubleClick={() => openLightbox(index)}
              >
                <img
                  src={getPhotoUrl(photo.storage_path)}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Selection checkbox */}
                <div
                  className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedPhotos.includes(photo.id)
                      ? 'bg-[#D4AF37] border-[#D4AF37]'
                      : 'border-white/60 bg-black/40'
                  }`}
                >
                  {selectedPhotos.includes(photo.id) && (
                    <Check className="h-4 w-4 text-[#1A1A1E]" />
                  )}
                </div>

                {/* Download button on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadSingle(photo)
                    }}
                    className="bg-white text-[#1A1A1E] px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-[#D4AF37] transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && photos[currentPhotoIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-[#D4AF37] transition-colors"
            >
              <X className="h-8 w-8" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                prevPhoto()
              }}
              className="absolute left-4 p-2 text-white/70 hover:text-[#D4AF37] transition-colors"
            >
              <ChevronLeft className="h-10 w-10" />
            </button>

            <motion.img
              key={currentPhotoIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={getPhotoUrl(photos[currentPhotoIndex].storage_path)}
              alt={`Photo ${currentPhotoIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation()
                nextPhoto()
              }}
              className="absolute right-4 p-2 text-white/70 hover:text-[#D4AF37] transition-colors"
            >
              <ChevronRight className="h-10 w-10" />
            </button>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <span className="text-white/70 text-sm bg-black/50 px-3 py-1 rounded-full">
                {currentPhotoIndex + 1} / {photos.length}
              </span>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  downloadSingle(photos[currentPhotoIndex])
                }}
                className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-[rgba(255,255,255,0.1)] mt-8">
        <p className="text-[#6B6B70] text-sm">
          © 2025 PhotoJet • Créé avec 🚀
        </p>
      </footer>
    </div>
  )
}
