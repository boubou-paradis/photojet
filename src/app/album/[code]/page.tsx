'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import {
  Camera,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, Photo } from '@/types/database'
import Footer from '@/components/Footer'

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
        setSession(sessionData)

        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .eq('session_id', sessionData.id)
          .eq('status', 'approved')
          .order('uploaded_at', { ascending: false })

        if (photosError) throw photosError
        setPhotos(photosData || [])
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

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  async function handleDownloadAll() {
    if (photos.length === 0) return

    setDownloading(true)
    try {
      const zip = new JSZip()

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        const url = getPhotoUrl(photo.storage_path)
        const response = await fetch(url)
        const blob = await response.blob()
        zip.file(`photo-${i + 1}.jpg`, blob)
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${session?.name || 'album'}-photos.zip`)
    } catch (err) {
      console.error('Error downloading:', err)
    } finally {
      setDownloading(false)
    }
  }

  async function handleDownloadSingle(photo: Photo) {
    try {
      const url = getPhotoUrl(photo.storage_path)
      const response = await fetch(url)
      const blob = await response.blob()
      saveAs(blob, `photo-${photo.id}.jpg`)
    } catch (err) {
      console.error('Error downloading:', err)
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
        <div className="card-gold rounded-xl w-full max-w-sm p-8 text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#E53935]/10 flex items-center justify-center">
            <X className="h-8 w-8 text-[#E53935]" />
          </div>
          <h1 className="text-xl font-semibold mb-2 text-white">Album introuvable</h1>
          <p className="text-[#6B6B70]">
            Vérifiez le code ou le lien fourni
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E]">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#D4AF37]/5 via-transparent to-[#D4AF37]/5 pointer-events-none" />

      <header className="bg-[#242428]/80 backdrop-blur-sm border-b border-[rgba(255,255,255,0.1)] sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                <Camera className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h1 className="font-bold text-white">{session.name}</h1>
                <p className="text-xs text-[#6B6B70]">
                  {photos.length} photo{photos.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {photos.length > 0 && (
              <Button
                onClick={handleDownloadAll}
                disabled={downloading}
                size="sm"
                className="h-9 bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Tout télécharger
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 relative z-10">
        {photos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#2E2E33] flex items-center justify-center">
              <ImageIcon className="h-10 w-10 text-[#6B6B70]" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Aucune photo</h2>
            <p className="text-[#6B6B70]">
              Les photos approuvées apparaîtront ici
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          >
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ delay: index * 0.03 }}
                className="relative group cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-[#2E2E33] border border-[rgba(255,255,255,0.1)] transition-all duration-200 group-hover:border-[#D4AF37]/50 group-hover:shadow-[0_4px_20px_rgba(212,175,55,0.2)]">
                  <img
                    src={getPhotoUrl(photo.storage_path)}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadSingle(photo)
                  }}
                  className="absolute bottom-2 right-2 p-2 bg-[#D4AF37] rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[#1A1A1E] hover:bg-[#F4D03F]"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

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
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="h-8 w-8" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                prevPhoto()
              }}
              className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors"
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
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={(e) => {
                e.stopPropagation()
                nextPhoto()
              }}
              className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors"
            >
              <ChevronRight className="h-10 w-10" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <span className="text-white/70 text-sm">
                {currentPhotoIndex + 1} / {photos.length}
              </span>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownloadSingle(photos[currentPhotoIndex])
                }}
                className="h-9 bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <Footer fixed />
    </div>
  )
}
