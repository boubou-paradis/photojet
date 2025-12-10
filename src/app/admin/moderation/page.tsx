'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  CheckCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase'
import { Session, Photo } from '@/types/database'
import { toast } from 'sonner'

export default function ModerationPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchPhotos(selectedSession.id)
      subscribeToPhotos(selectedSession.id)
    }
  }, [selectedSession])

  async function fetchSessions() {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSessions(data || [])
      if (data && data.length > 0) {
        setSelectedSession(data[0])
      }
    } catch (err) {
      console.error('Error fetching sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPhotos(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: true })

      if (error) throw error
      setPhotos(data || [])
      setSelectedPhotos(new Set())
    } catch (err) {
      console.error('Error fetching photos:', err)
    }
  }

  function subscribeToPhotos(sessionId: string) {
    const channel = supabase
      .channel(`moderation-photos-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchPhotos(sessionId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotos((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) {
        next.delete(photoId)
      } else {
        next.add(photoId)
      }
      return next
    })
  }

  function selectAll() {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(photos.map((p) => p.id)))
    }
  }

  async function handleApprove(photoIds: string[]) {
    if (photoIds.length === 0) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .in('id', photoIds)

      if (error) throw error
      toast.success(`${photoIds.length} photo(s) approuvée(s)`)
      setSelectedPhotos(new Set())
    } catch (err) {
      toast.error('Erreur lors de l\'approbation')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(photoIds: string[]) {
    if (photoIds.length === 0) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: 'rejected' })
        .in('id', photoIds)

      if (error) throw error
      toast.success(`${photoIds.length} photo(s) rejetée(s)`)
      setSelectedPhotos(new Set())
    } catch (err) {
      toast.error('Erreur lors du rejet')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E]">
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)] sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/dashboard')}
              className="text-white hover:text-[#D4AF37] hover:bg-[#2E2E33]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="PhotoJet"
                width={32}
                height={32}
                className="drop-shadow-lg"
              />
              <h1 className="text-xl font-bold text-white">Modération</h1>
            </div>
            {photos.length > 0 && (
              <span className="text-[#D4AF37] font-semibold bg-[#D4AF37]/10 px-3 py-1 rounded-full">
                {photos.length} photo(s) en attente
              </span>
            )}
          </div>

          {photos.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                {selectedPhotos.size === photos.length ? 'Désélectionner' : 'Tout sélectionner'}
              </Button>

              {selectedPhotos.size > 0 && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(Array.from(selectedPhotos))}
                    disabled={actionLoading}
                    className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approuver ({selectedPhotos.size})
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReject(Array.from(selectedPhotos))}
                    disabled={actionLoading}
                    className="bg-[#E53935] hover:bg-[#D32F2F] text-white"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeter ({selectedPhotos.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {photos.length === 0 ? (
          <div className="card-gold rounded-xl max-w-md mx-auto">
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-[#4CAF50]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Tout est modéré !</h2>
              <p className="text-[#B0B0B5] mb-6">
                Aucune photo en attente de validation
              </p>
              <Button
                variant="outline"
                onClick={() => router.push('/admin/dashboard')}
                className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
              >
                Retour au dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <AnimatePresence>
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                  className="relative group"
                >
                  <div
                    className={`aspect-square rounded-lg overflow-hidden bg-[#2E2E33] cursor-pointer ring-2 transition-all ${
                      selectedPhotos.has(photo.id)
                        ? 'ring-[#D4AF37] ring-offset-2 ring-offset-[#1A1A1E]'
                        : 'ring-transparent'
                    }`}
                    onClick={() => togglePhotoSelection(photo.id)}
                  >
                    <img
                      src={getPhotoUrl(photo.storage_path)}
                      alt="Photo"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedPhotos.has(photo.id)}
                      onCheckedChange={() => togglePhotoSelection(photo.id)}
                      className="bg-white/90 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37]"
                    />
                  </div>

                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApprove([photo.id])
                      }}
                      disabled={actionLoading}
                      className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReject([photo.id])
                      }}
                      disabled={actionLoading}
                      className="bg-[#E53935] hover:bg-[#D32F2F] text-white"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  {photo.uploader_name && (
                    <p className="text-xs text-[#6B6B70] mt-1 truncate">
                      {photo.uploader_name}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}
