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
import { Card, CardContent } from '@/components/ui/card'
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <X className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Album introuvable</h1>
            <p className="text-muted-foreground">
              Vérifiez le code ou le lien fourni
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-bold">{session.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {photos.length} photo{photos.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {photos.length > 0 && (
              <Button onClick={handleDownloadAll} disabled={downloading}>
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

      <main className="container mx-auto px-4 py-8">
        {photos.length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucune photo</h2>
            <p className="text-muted-foreground">
              Les photos approuvées apparaîtront ici
            </p>
          </div>
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
                transition={{ delay: index * 0.05 }}
                className="relative group cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-muted shadow-md">
                  <img
                    src={getPhotoUrl(photo.storage_path)}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownloadSingle(photo)
                  }}
                  className="absolute bottom-2 right-2 p-2 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/80"
                >
                  <Download className="h-4 w-4" />
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
              <span className="text-white/70">
                {currentPhotoIndex + 1} / {photos.length}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownloadSingle(photos[currentPhotoIndex])
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
