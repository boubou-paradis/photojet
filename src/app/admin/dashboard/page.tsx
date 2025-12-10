'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import {
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Monitor,
  Download,
  Trash2,
  Image as ImageIcon,
  Plus,
  Copy,
  ExternalLink,
  Loader2,
  Tablet,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase'
import { Session, Photo, BorneConnection } from '@/types/database'
import { toast } from 'sonner'

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [borneConnection, setBorneConnection] = useState<BorneConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchPhotos(selectedSession.id)
      subscribeToPhotos(selectedSession.id)
      if (selectedSession.borne_enabled) {
        fetchBorneConnection(selectedSession.id)
        subscribeToBorneConnection(selectedSession.id)
      }
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
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (err) {
      console.error('Error fetching photos:', err)
    }
  }

  async function fetchBorneConnection(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('borne_connections')
        .select('*')
        .eq('session_id', sessionId)
        .order('last_seen', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setBorneConnection(data || null)
    } catch (err) {
      console.error('Error fetching borne connection:', err)
      setBorneConnection(null)
    }
  }

  function subscribeToPhotos(sessionId: string) {
    const channel = supabase
      .channel(`dashboard-photos-${sessionId}`)
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

  function subscribeToBorneConnection(sessionId: string) {
    const channel = supabase
      .channel(`dashboard-borne-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'borne_connections',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchBorneConnection(sessionId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function handleApprove(photoId: string) {
    setActionLoading(photoId)
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', photoId)

      if (error) throw error
      toast.success('Photo approuvée')
    } catch (err) {
      toast.error('Erreur lors de l\'approbation')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(photoId: string) {
    setActionLoading(photoId)
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: 'rejected' })
        .eq('id', photoId)

      if (error) throw error
      toast.success('Photo rejetée')
    } catch (err) {
      toast.error('Erreur lors du rejet')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(photo: Photo) {
    setActionLoading(photo.id)
    try {
      await supabase.storage.from('photos').remove([photo.storage_path])

      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id)

      if (error) throw error
      toast.success('Photo supprimée')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  async function createNewSession() {
    try {
      const code = Math.floor(1000 + Math.random() * 9000).toString()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          code,
          name: 'Nouvel événement',
          expires_at: expiresAt.toISOString(),
          moderation_enabled: true,
          show_qr_on_screen: true,
          transition_type: 'fade',
          transition_duration: 5,
          is_active: true,
          user_id: null,
          album_qr_code: null,
          // Borne defaults
          borne_enabled: false,
          borne_qr_code: null,
          borne_countdown: true,
          borne_countdown_duration: 3,
          borne_return_delay: 5,
          borne_default_camera: 'front',
          borne_show_event_name: true,
        })
        .select()
        .single()

      if (error) throw error
      setSessions((prev) => [data, ...prev])
      setSelectedSession(data)
      toast.success('Session créée')
    } catch (err) {
      toast.error('Erreur lors de la création')
      console.error(err)
    }
  }

  function copyInviteLink() {
    if (!selectedSession) return
    const url = `${window.location.origin}/invite/${selectedSession.code}`
    navigator.clipboard.writeText(url)
    toast.success('Lien copié')
  }

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const pendingCount = photos.filter((p) => p.status === 'pending').length
  const approvedCount = photos.filter((p) => p.status === 'approved').length
  const rejectedCount = photos.filter((p) => p.status === 'rejected').length
  const bornePhotosCount = photos.filter((p) => p.source === 'borne').length

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
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="PhotoJet"
                width={40}
                height={40}
                className="drop-shadow-lg"
              />
              <h1 className="text-xl font-bold text-white">PhotoJet</h1>
            </div>
            {selectedSession && (
              <Badge className="font-mono bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30">
                #{selectedSession.code}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={createNewSession}
              className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle session
            </Button>
            {selectedSession && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/borne`)}
                  className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                >
                  <Tablet className="h-4 w-4 mr-2" />
                  Borne
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/settings`)}
                  className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.open(`/live/${selectedSession.code}`, '_blank')}
                  className="bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Diaporama
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!selectedSession ? (
          <div className="card-gold rounded-xl max-w-md mx-auto">
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
                <ImageIcon className="h-10 w-10 text-[#D4AF37]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Aucune session</h2>
              <p className="text-[#B0B0B5] mb-6">
                Créez votre première session pour commencer
              </p>
              <Button
                onClick={createNewSession}
                className="bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer une session
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card-gold rounded-xl p-5">
                <p className="text-sm font-medium text-[#B0B0B5] mb-2">Total photos</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-[#D4AF37]" />
                  </div>
                  <span className="text-3xl font-bold text-[#D4AF37]">{photos.length}</span>
                </div>
                {bornePhotosCount > 0 && (
                  <p className="text-xs text-[#6B6B70] mt-2">
                    dont {bornePhotosCount} via borne
                  </p>
                )}
              </div>

              <div className="card-gold rounded-xl p-5">
                <p className="text-sm font-medium text-[#B0B0B5] mb-2">En attente</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FF9800]/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-[#FF9800]" />
                  </div>
                  <span className="text-3xl font-bold text-[#D4AF37]">{pendingCount}</span>
                </div>
              </div>

              <div className="card-gold rounded-xl p-5">
                <p className="text-sm font-medium text-[#B0B0B5] mb-2">Approuvées</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-[#4CAF50]" />
                  </div>
                  <span className="text-3xl font-bold text-[#D4AF37]">{approvedCount}</span>
                </div>
              </div>

              <div className="card-gold rounded-xl p-5">
                <p className="text-sm font-medium text-[#B0B0B5] mb-2">Rejetées</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E53935]/10 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-[#E53935]" />
                  </div>
                  <span className="text-3xl font-bold text-[#D4AF37]">{rejectedCount}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="card-gold rounded-xl">
                  <div className="p-6 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-lg font-semibold text-white">Photos</h3>
                  </div>
                  <div className="p-6">
                    <Tabs defaultValue="pending">
                      <TabsList className="mb-4 bg-[#2E2E33] border border-[rgba(255,255,255,0.1)]">
                        <TabsTrigger
                          value="pending"
                          className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1E]"
                        >
                          En attente ({pendingCount})
                        </TabsTrigger>
                        <TabsTrigger
                          value="approved"
                          className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1E]"
                        >
                          Approuvées ({approvedCount})
                        </TabsTrigger>
                        <TabsTrigger
                          value="rejected"
                          className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1E]"
                        >
                          Rejetées ({rejectedCount})
                        </TabsTrigger>
                      </TabsList>

                      {['pending', 'approved', 'rejected'].map((status) => (
                        <TabsContent key={status} value={status}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {photos
                              .filter((p) => p.status === status)
                              .map((photo) => (
                                <motion.div
                                  key={photo.id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="relative group"
                                >
                                  <div className="aspect-square rounded-lg overflow-hidden bg-[#2E2E33] border border-[rgba(255,255,255,0.1)]">
                                    <img
                                      src={getPhotoUrl(photo.storage_path)}
                                      alt="Photo"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  {photo.source === 'borne' && (
                                    <div className="absolute top-2 left-2">
                                      <Badge className="text-xs bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30">
                                        <Tablet className="h-3 w-3 mr-1" />
                                        Borne
                                      </Badge>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                    {status === 'pending' && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => handleApprove(photo.id)}
                                          disabled={actionLoading === photo.id}
                                          className="bg-[#4CAF50] hover:bg-[#43A047] text-white"
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleReject(photo.id)}
                                          disabled={actionLoading === photo.id}
                                          className="bg-[#E53935] hover:bg-[#D32F2F] text-white"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleDelete(photo)}
                                      disabled={actionLoading === photo.id}
                                      className="bg-[#2E2E33] hover:bg-[#3E3E43] text-white border border-[rgba(255,255,255,0.1)]"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {photo.uploader_name && (
                                    <p className="text-xs text-[#6B6B70] mt-1 truncate">
                                      {photo.uploader_name}
                                    </p>
                                  )}
                                </motion.div>
                              ))}
                          </div>
                          {photos.filter((p) => p.status === status).length === 0 && (
                            <div className="text-center py-12 text-[#6B6B70]">
                              Aucune photo
                            </div>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* QR Code Card */}
                <div className="card-gold rounded-xl">
                  <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-lg font-semibold text-white">QR Code invités</h3>
                  </div>
                  <div className="p-6 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-lg shadow-gold">
                      <QRCode
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${selectedSession.code}`}
                        size={180}
                      />
                    </div>
                    <p className="text-3xl font-mono font-bold mt-4 text-gold-gradient">
                      {selectedSession.code}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyInviteLink}
                        className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(`/invite/${selectedSession.code}`, '_blank')
                        }
                        className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ouvrir
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Informations Card */}
                <div className="card-gold rounded-xl">
                  <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-lg font-semibold text-white">Informations</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-sm text-[#6B6B70]">Événement</p>
                      <p className="font-medium text-white">{selectedSession.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B6B70] mb-1">Modération</p>
                      <Badge
                        className={
                          selectedSession.moderation_enabled
                            ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                            : 'bg-[#2E2E33] text-[#B0B0B5] border-[rgba(255,255,255,0.1)]'
                        }
                      >
                        {selectedSession.moderation_enabled ? 'Activée' : 'Désactivée'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B6B70]">Expire le</p>
                      <p className="font-medium text-white">
                        {new Date(selectedSession.expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    {selectedSession.borne_enabled && (
                      <div>
                        <p className="text-sm text-[#6B6B70] mb-1">Borne photo</p>
                        <div className="flex items-center gap-2">
                          {borneConnection?.is_online ? (
                            <>
                              <Wifi className="h-4 w-4 text-[#4CAF50]" />
                              <span className="text-sm text-[#4CAF50]">En ligne</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="h-4 w-4 text-[#6B6B70]" />
                              <span className="text-sm text-[#6B6B70]">Hors ligne</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions rapides Card */}
                <div className="card-gold rounded-xl">
                  <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-lg font-semibold text-white">Actions rapides</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                      onClick={() => router.push('/admin/moderation')}
                    >
                      <Clock className="h-4 w-4 mr-2 text-[#FF9800]" />
                      Modération
                      {pendingCount > 0 && (
                        <span className="ml-auto bg-[#FF9800] text-white text-xs px-2 py-0.5 rounded-full">
                          {pendingCount}
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                      onClick={() => router.push('/admin/borne')}
                    >
                      <Tablet className="h-4 w-4 mr-2 text-[#D4AF37]" />
                      Borne photo
                      {selectedSession.borne_enabled && borneConnection?.is_online && (
                        <span className="ml-auto w-2 h-2 bg-[#4CAF50] rounded-full" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                      onClick={() => window.open(`/album/${selectedSession.code}`, '_blank')}
                    >
                      <ImageIcon className="h-4 w-4 mr-2 text-[#D4AF37]" />
                      Voir l&apos;album
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                        >
                          <Download className="h-4 w-4 mr-2 text-[#D4AF37]" />
                          Télécharger tout
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#242428] border-[rgba(255,255,255,0.1)]">
                        <DialogHeader>
                          <DialogTitle className="text-white">Télécharger l&apos;album</DialogTitle>
                        </DialogHeader>
                        <p className="text-[#B0B0B5]">
                          Cette fonctionnalité sera disponible prochainement.
                        </p>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
