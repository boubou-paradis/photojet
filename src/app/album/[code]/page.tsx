'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
  Check,
  Package,
  Lock,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, Photo } from '@/types/database'

// Composant image avec gestion du chargement et des erreurs
function GalleryImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  return (
    <>
      {/* Loading/Error state */}
      {status !== 'loaded' && (
        <div className="absolute inset-0 bg-[#1A1A1E] flex items-center justify-center z-10">
          {status === 'loading' ? (
            <div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
          ) : (
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
              <span className="text-xs text-gray-500">Erreur</span>
            </div>
          )}
        </div>
      )}

      {/* Image */}
      <img
        src={src}
        alt={alt}
        className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        style={{ transition: 'opacity 0.3s ease-in-out' }}
      />
    </>
  )
}

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
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0F]">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" />
          <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-[#D4AF37]" />
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0F] p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="absolute -inset-1 bg-red-500/10 rounded-3xl blur-xl" />
          <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-red-500/20 w-full max-w-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center border-2 border-red-500/20">
                <X className="h-10 w-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{error || 'Album introuvable'}</h1>
              <p className="text-gray-500">Vérifiez le code ou le lien fourni</p>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // Password protection screen
  if (session.album_password && !isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0F] p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="absolute -inset-1 bg-[#D4AF37]/10 rounded-3xl blur-xl" />
          <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-[#D4AF37]/20 w-full max-w-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-amber-600/10 flex items-center justify-center">
                <Lock className="h-10 w-10 text-[#D4AF37]" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Album protégé</h1>
              <p className="text-gray-500 mb-6">Entrez le mot de passe pour accéder aux photos</p>

              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError(false)
                }}
                onKeyDown={(e) => e.key === 'Enter' && checkPassword()}
                placeholder="Mot de passe"
                className={`w-full bg-[#0D0D0F] text-white rounded-xl p-4 mb-4 text-center border-2 ${
                  passwordError ? 'border-red-500' : 'border-white/10'
                } focus:border-[#D4AF37] focus:outline-none transition-colors`}
              />

              {passwordError && (
                <p className="text-red-400 text-sm mb-4">Mot de passe incorrect</p>
              )}

              <Button
                onClick={checkPassword}
                className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25"
              >
                Accéder à l'album
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl py-8 px-4 text-center border-b border-white/5">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-[#D4AF37]/20 blur-2xl rounded-full" />
            <Image
              src="/images/animajet_logo_principal.png"
              alt="AnimaJet"
              width={80}
              height={80}
              className="relative z-10 drop-shadow-2xl"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-[#D4AF37]" />
            {session.name}
            <Sparkles className="h-6 w-6 text-[#D4AF37]" />
          </h1>
          <p className="text-gray-500">
            {photos.length} photo{photos.length > 1 ? 's' : ''} • {eventDate}
          </p>
        </motion.div>
      </header>

      {/* Actions bar */}
      <div className="sticky top-0 bg-[#0D0D0F]/90 backdrop-blur-xl z-40 p-4 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            {photos.length > 0 && (
              <button
                onClick={selectAll}
                className="text-sm text-gray-500 hover:text-[#D4AF37] transition-colors"
              >
                {selectedPhotos.length === photos.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            )}
            <p className="text-gray-600 text-sm">
              {selectedPhotos.length > 0
                ? `${selectedPhotos.length} photo(s) sélectionnée(s)`
                : 'Cliquez pour sélectionner'}
            </p>
          </div>
          <div className="flex gap-3">
            {selectedPhotos.length > 0 && (
              <Button
                onClick={() => downloadZip(selectedPhotos)}
                disabled={downloading}
                className="bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#0D0D0F] font-semibold shadow-lg shadow-[#D4AF37]/20"
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
                variant="outline"
                className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
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

      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {photos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-gray-500/10 to-gray-600/5 flex items-center justify-center border border-white/5">
              <ImageIcon className="h-12 w-12 text-gray-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Aucune photo</h2>
            <p className="text-gray-500">Les photos approuvées apparaîtront ici</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 ${
                  selectedPhotos.includes(photo.id)
                    ? 'ring-4 ring-[#D4AF37] scale-[0.98]'
                    : 'hover:scale-[1.02]'
                }`}
                onClick={() => toggleSelect(photo.id)}
                onDoubleClick={() => openLightbox(index)}
              >
                {/* Image with loading/error handling */}
                <GalleryImage
                  src={getPhotoUrl(photo.storage_path)}
                  alt={`Photo ${index + 1}`}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />

                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20" />

                {/* Selection checkbox */}
                <div
                  className={`absolute top-3 left-3 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 z-30 ${
                    selectedPhotos.includes(photo.id)
                      ? 'bg-[#D4AF37] border-[#D4AF37] scale-110'
                      : 'border-white/70 bg-black/40 group-hover:border-[#D4AF37]'
                  }`}
                >
                  {selectedPhotos.includes(photo.id) && (
                    <Check className="h-4 w-4 text-[#0D0D0F]" />
                  )}
                </div>

                {/* Download button on hover */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadSingle(photo)
                    }}
                    className="bg-white/90 backdrop-blur-sm text-[#0D0D0F] px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-[#D4AF37] transition-colors shadow-lg"
                  >
                    <Download className="h-4 w-4" />
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
            className="fixed inset-0 z-50 bg-black/98 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 p-3 rounded-xl bg-white/10 text-white/70 hover:text-[#D4AF37] hover:bg-white/20 transition-all"
            >
              <X className="h-6 w-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                prevPhoto()
              }}
              className="absolute left-6 p-3 rounded-xl bg-white/10 text-white/70 hover:text-[#D4AF37] hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <motion.img
              key={currentPhotoIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={getPhotoUrl(photos[currentPhotoIndex].storage_path)}
              alt={`Photo ${currentPhotoIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation()
                nextPhoto()
              }}
              className="absolute right-6 p-3 rounded-xl bg-white/10 text-white/70 hover:text-[#D4AF37] hover:bg-white/20 transition-all"
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <span className="text-white/70 text-sm bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                {currentPhotoIndex + 1} / {photos.length}
              </span>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  downloadSingle(photos[currentPhotoIndex])
                }}
                className="bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#0D0D0F] font-semibold shadow-lg shadow-[#D4AF37]/25"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center border-t border-white/5 mt-8">
        <p className="text-gray-600 text-sm">
          © 2025 AnimaJet • Créé par MG Events Animation
        </p>
      </footer>
    </div>
  )
}
