'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import QRCode from 'react-qr-code'
import {
  CheckCircle,
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
  Shield,
  ShieldOff,
  Clock,
  MessageCircle,
  XCircle,
  Aperture,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase'
import { Session, Photo, Message, BorneConnection } from '@/types/database'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SpeedMeter from '@/components/SpeedMeter'
import { toast } from 'sonner'

export default function DashboardPage() {
  const [, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [borneConnection, setBorneConnection] = useState<BorneConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [togglingModeration, setTogglingModeration] = useState(false)
  const [activeTab, setActiveTab] = useState<'photos' | 'messages'>('photos')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchPhotos(selectedSession.id)
      fetchMessages(selectedSession.id)
      subscribeToPhotos(selectedSession.id)
      subscribeToMessages(selectedSession.id)
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

  async function fetchMessages(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
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

      if (error) throw error
      setBorneConnection(data && data.length > 0 ? data[0] : null)
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

  function subscribeToMessages(sessionId: string) {
    const channel = supabase
      .channel(`dashboard-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchMessages(sessionId)
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

  async function handleDelete(photo: Photo) {
    setActionLoading(photo.id)
    try {
      await supabase.storage.from('photos').remove([photo.storage_path])

      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id)

      if (error) throw error

      // Mise à jour immédiate de l'état local
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      toast.success('Photo supprimée')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMessageAction(messageId: string, action: 'approve' | 'reject' | 'delete') {
    setActionLoading(messageId)
    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId)
        if (error) throw error

        // Mise à jour immédiate de l'état local
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        toast.success('Message supprimé')
      } else {
        const newStatus = action === 'approve' ? 'approved' : 'rejected'
        const { error } = await supabase
          .from('messages')
          .update({
            status: newStatus,
            approved_at: action === 'approve' ? new Date().toISOString() : null,
          })
          .eq('id', messageId)
        if (error) throw error

        // Mise à jour immédiate de l'état local
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, status: newStatus as 'approved' | 'rejected', approved_at: action === 'approve' ? new Date().toISOString() : null }
              : m
          )
        )
        toast.success(action === 'approve' ? 'Message approuvé' : 'Message rejeté')
      }
    } catch (err) {
      toast.error('Erreur lors de l\'action')
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
          moderation_enabled: false,
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
          // Messages defaults
          messages_enabled: true,
          messages_frequency: 4,
          messages_duration: 8,
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

  async function toggleModeration() {
    if (!selectedSession || togglingModeration) return

    setTogglingModeration(true)
    const newValue = !selectedSession.moderation_enabled

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ moderation_enabled: newValue })
        .eq('id', selectedSession.id)

      if (error) throw error

      // Update local state
      setSelectedSession({ ...selectedSession, moderation_enabled: newValue })
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedSession.id ? { ...s, moderation_enabled: newValue } : s
        )
      )

      toast.success(newValue ? 'Modération activée' : 'Modération désactivée')
    } catch (err) {
      toast.error('Erreur lors de la modification')
      console.error(err)
    } finally {
      setTogglingModeration(false)
    }
  }

  function getPhotoUrl(storagePath: string) {
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const approvedCount = photos.filter((p) => p.status === 'approved').length
  const pendingCount = photos.filter((p) => p.status === 'pending').length
  const bornePhotosCount = photos.filter((p) => p.source === 'borne').length
  const invitePhotosCount = photos.filter((p) => p.source === 'invite').length
  const moderationEnabled = selectedSession?.moderation_enabled ?? false

  const totalMessagesCount = messages.length
  const approvedMessagesCount = messages.filter((m) => m.status === 'approved').length
  const pendingMessagesCount = messages.filter((m) => m.status === 'pending').length

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#1A1A1E] flex flex-col overflow-hidden">
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)] flex-shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo PhotoJet */}
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="PhotoJet"
                width={32}
                height={32}
                className="drop-shadow-lg"
                priority
              />
              <span className="text-sm font-medium text-[#6B6B70]">PhotoJet</span>
            </div>

            {/* Session Info Card */}
            {selectedSession && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#1A1A1E] rounded-xl border border-[#D4AF37]/20">
                {/* Event Icon */}
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                  <Aperture className="h-4 w-4 text-[#D4AF37]" />
                </div>

                {/* Event Name & Code */}
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-base leading-tight">
                    {selectedSession.name || 'Événement'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono text-xs px-1.5 py-0 h-5 bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30 hover:bg-[#D4AF37]/25">
                      #{selectedSession.code}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-emerald-400 font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>
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

      <main className="flex-1 overflow-hidden">
        {!selectedSession ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="card-gold rounded-xl max-w-md">
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
          </div>
        ) : (
          <div className="h-full flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
            {/* Colonne gauche (70%) : Stats + Photos */}
            <div className="flex-1 lg:w-[70%] flex flex-col gap-4 min-h-0">
              {/* Stats Cards */}
              <div className="grid grid-cols-5 gap-3 flex-shrink-0">
                <div className="card-gold rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6B70]">Photos</p>
                      <span className="text-xl font-bold text-[#D4AF37]">{photos.length}</span>
                    </div>
                  </div>
                </div>

                <div className="card-gold rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#4CAF50]/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-[#4CAF50]" />
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6B70]">Invités</p>
                      <span className="text-xl font-bold text-[#D4AF37]">{invitePhotosCount}</span>
                    </div>
                  </div>
                </div>

                <div className="card-gold rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                      <Tablet className="h-4 w-4 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6B70]">Borne</p>
                      <span className="text-xl font-bold text-[#D4AF37]">{bornePhotosCount}</span>
                    </div>
                  </div>
                </div>

                {/* Messages Counter Card */}
                <div className="card-gold rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#9C27B0]/10 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-4 w-4 text-[#9C27B0]" />
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6B70]">Messages</p>
                      <span className="text-xl font-bold text-[#D4AF37]">{totalMessagesCount}</span>
                      {pendingMessagesCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-[#FF9800] text-white rounded-full">
                          {pendingMessagesCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Moderation Toggle Card */}
                <motion.div
                  onClick={toggleModeration}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`rounded-xl p-3 cursor-pointer transition-all duration-300 ${
                    moderationEnabled
                      ? 'bg-[#242428] border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                      : 'card-gold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: togglingModeration ? 360 : 0 }}
                      transition={{ duration: 0.5 }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        moderationEnabled ? 'bg-[#D4AF37]/20' : 'bg-[#6B6B70]/10'
                      }`}
                    >
                      {togglingModeration ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                      ) : moderationEnabled ? (
                        <Shield className="h-4 w-4 text-[#D4AF37]" />
                      ) : (
                        <ShieldOff className="h-4 w-4 text-[#6B6B70]" />
                      )}
                    </motion.div>
                    <div>
                      <p className="text-xs text-[#6B6B70]">Modération</p>
                      <span className={`text-sm font-semibold ${
                        moderationEnabled ? 'text-[#D4AF37]' : 'text-[#6B6B70]'
                      }`}>
                        {moderationEnabled ? 'ON' : 'OFF'}
                      </span>
                      {moderationEnabled && (pendingCount + pendingMessagesCount) > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-[#FF9800] text-white rounded-full">
                          {pendingCount + pendingMessagesCount}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Content Section with Tabs - fills remaining space */}
              <div className="card-gold rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'photos' | 'messages')} className="flex flex-col flex-1 min-h-0">
                  <div className="p-3 border-b border-[rgba(255,255,255,0.1)] flex-shrink-0">
                    <TabsList className="bg-[#2E2E33] border border-[rgba(255,255,255,0.1)]">
                      <TabsTrigger value="photos" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1E]">
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Photos ({photos.length})
                      </TabsTrigger>
                      <TabsTrigger value="messages" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1E]">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Messages ({messages.length})
                        {pendingMessagesCount > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-[#FF9800] text-white rounded-full">
                            {pendingMessagesCount}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="photos" className="flex-1 overflow-auto m-0 p-4">
                    {photos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {photos.map((photo) => (
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
                            {photo.status === 'pending' && (
                              <div className="absolute top-1.5 right-1.5">
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30">
                                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                                  En attente
                                </Badge>
                              </div>
                            )}
                            {photo.source === 'borne' && (
                              <div className="absolute top-1.5 left-1.5">
                                <Badge className="text-[10px] px-1.5 py-0.5 bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30">
                                  <Tablet className="h-2.5 w-2.5 mr-0.5" />
                                  Borne
                                </Badge>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleDelete(photo)}
                                disabled={actionLoading === photo.id}
                                className="bg-[#E53935] hover:bg-[#D32F2F] text-white h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[#6B6B70]">
                        Aucune photo pour le moment
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="messages" className="flex-1 overflow-auto m-0 p-4">
                    {messages.length > 0 ? (
                      <div className="space-y-3">
                        {messages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-lg border ${
                              msg.status === 'pending'
                                ? 'bg-[#FF9800]/5 border-[#FF9800]/30'
                                : msg.status === 'rejected'
                                ? 'bg-[#E53935]/5 border-[#E53935]/30'
                                : 'bg-[#2E2E33] border-[rgba(255,255,255,0.1)]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-white text-sm leading-relaxed">&ldquo;{msg.content}&rdquo;</p>
                                <div className="flex items-center gap-2 mt-2">
                                  {msg.author_name && (
                                    <span className="text-[#D4AF37] text-xs italic">— {msg.author_name}</span>
                                  )}
                                  <span className="text-[#6B6B70] text-xs">
                                    {new Date(msg.created_at).toLocaleString('fr-FR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  {msg.status === 'pending' && (
                                    <Badge className="text-[10px] px-1.5 py-0.5 bg-[#FF9800]/20 text-[#FF9800] border-[#FF9800]/30">
                                      En attente
                                    </Badge>
                                  )}
                                  {msg.status === 'rejected' && (
                                    <Badge className="text-[10px] px-1.5 py-0.5 bg-[#E53935]/20 text-[#E53935] border-[#E53935]/30">
                                      Rejeté
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {msg.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMessageAction(msg.id, 'approve')}
                                      disabled={actionLoading === msg.id}
                                      className="h-8 w-8 p-0 text-[#4CAF50] hover:bg-[#4CAF50]/10"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMessageAction(msg.id, 'reject')}
                                      disabled={actionLoading === msg.id}
                                      className="h-8 w-8 p-0 text-[#E53935] hover:bg-[#E53935]/10"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleMessageAction(msg.id, 'delete')}
                                  disabled={actionLoading === msg.id}
                                  className="h-8 w-8 p-0 text-[#6B6B70] hover:text-[#E53935] hover:bg-[#E53935]/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-[#6B6B70]">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        Aucun message pour le moment
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Colonne droite (30%) : QR Code + Infos */}
            <div className="lg:w-[30%] flex flex-col gap-4 lg:overflow-auto">
              {/* QR Code Card */}
              <div className="card-gold rounded-xl flex-shrink-0">
                <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="font-semibold text-white">QR Code invités</h3>
                </div>
                <div className="p-4 flex flex-col items-center">
                  <div className="bg-white p-3 rounded-lg shadow-gold">
                    <QRCode
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${selectedSession.code}`}
                      size={140}
                    />
                  </div>
                  <p className="text-2xl font-mono font-bold mt-3 text-gold-gradient">
                    {selectedSession.code}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyInviteLink}
                      className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37] text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`/invite/${selectedSession.code}`, '_blank')
                      }
                      className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37] text-xs"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ouvrir
                    </Button>
                  </div>
                </div>
              </div>

              {/* Informations Card */}
              <div className="card-gold rounded-xl flex-shrink-0">
                <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="font-semibold text-white">Informations</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-[#6B6B70]">Événement</p>
                    <p className="font-medium text-white text-sm">{selectedSession.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B70]">Expire le</p>
                    <p className="font-medium text-white text-sm">
                      {new Date(selectedSession.expires_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {selectedSession.borne_enabled && (
                    <div className="flex items-center gap-2 pt-1">
                      {borneConnection?.is_online ? (
                        <>
                          <Wifi className="h-4 w-4 text-[#4CAF50]" />
                          <span className="text-sm text-[#4CAF50]">Borne en ligne</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-4 w-4 text-[#6B6B70]" />
                          <span className="text-sm text-[#6B6B70]">Borne hors ligne</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Speed Meter */}
              <SpeedMeter className="flex-shrink-0" />

              {/* Actions rapides Card */}
              <div className="card-gold rounded-xl flex-shrink-0">
                <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="font-semibold text-white">Actions rapides</h3>
                </div>
                <div className="p-3 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    size="sm"
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
                        size="sm"
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
        )}
      </main>
    </div>
  )
}
