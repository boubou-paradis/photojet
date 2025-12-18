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
  Gamepad2,
  FolderOpen,
  CalendarClock,
  AlertTriangle,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { Session, Photo, Message, BorneConnection, Subscription } from '@/types/database'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SpeedMeter from '@/components/SpeedMeter'
import { toast } from 'sonner'
import { getInviteUrl } from '@/lib/utils'

// Subscription Status Card Component
function SubscriptionStatusCard({ subscription }: { subscription: Subscription }) {
  const now = new Date()
  const end = new Date(subscription.current_period_end!)
  const diff = end.getTime() - now.getTime()

  // Calculate days and hours remaining
  const totalHours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  // Calculate progress (assuming 30-day subscription)
  const start = subscription.current_period_start
    ? new Date(subscription.current_period_start)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  const totalDuration = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()
  const progressPercent = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))

  // Determine status color
  const isExpired = diff <= 0
  const isCritical = days < 1 && !isExpired
  const isWarning = days < 7 && days >= 1

  const statusColor = isExpired
    ? 'text-red-500'
    : isCritical
    ? 'text-red-500'
    : isWarning
    ? 'text-orange-500'
    : 'text-[#4CAF50]'

  const borderColor = isExpired || isCritical
    ? 'border-red-500/50'
    : isWarning
    ? 'border-orange-500/50'
    : 'border-[#D4AF37]/30'

  const progressColor = isExpired || isCritical
    ? 'bg-red-500'
    : isWarning
    ? 'bg-orange-500'
    : 'bg-[#D4AF37]'

  return (
    <div className={`card-gold rounded-xl flex-shrink-0 border ${borderColor}`}>
      <div className="px-2.5 py-1.5 border-b border-[rgba(255,255,255,0.1)]">
        <div className="flex items-center gap-1.5">
          <CalendarClock className={`h-3.5 w-3.5 ${statusColor}`} />
          <h3 className="font-semibold text-white text-xs">Abonnement</h3>
          <Badge className={`ml-auto text-[9px] px-1 py-0 ${
            isExpired
              ? 'bg-red-500/20 text-red-500 border-red-500/30'
              : subscription.cancel_at_period_end
              ? 'bg-orange-500/20 text-orange-500 border-orange-500/30'
              : 'bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30'
          }`}>
            {isExpired ? 'Expiré' : subscription.cancel_at_period_end ? 'Annulé' : 'Actif'}
          </Badge>
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        {/* Time remaining */}
        <div className="flex items-center justify-between">
          {isExpired ? (
            <p className="text-red-500 font-bold text-sm">Expiré</p>
          ) : (
            <>
              <span className={`font-bold text-lg ${statusColor}`}>
                {days > 0 ? `${days}j ${hours}h` : `${hours}h`}
              </span>
              <span className="text-[10px] text-[#6B6B70]">
                jusqu&apos;au {end.toLocaleDateString('fr-FR')}
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#1A1A1E] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full ${progressColor} rounded-full`}
          />
        </div>

        {/* Warning message */}
        {(isCritical || isWarning) && !isExpired && (
          <p className={`text-[10px] ${isCritical ? 'text-red-400' : 'text-orange-400'}`}>
            {isCritical ? '⚠️ Expire bientôt !' : '⏰ Renouveler bientôt'}
          </p>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [borneConnection, setBorneConnection] = useState<BorneConnection | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [togglingModeration, setTogglingModeration] = useState(false)
  const [activeTab, setActiveTab] = useState<'photos' | 'messages'>('photos')
  const [downloading, setDownloading] = useState(false)
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

  // Fetch subscription on mount
  useEffect(() => {
    fetchSubscription()
  }, [])

  async function fetchSessions() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
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

  async function fetchSubscription() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Récupérer l'abonnement le plus récent de l'utilisateur (actif ou non)
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        setSubscription(null)
        return
      }
      setSubscription(data)
    } catch (err) {
      console.error('Error fetching subscription:', err)
      setSubscription(null)
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

  async function handleApprove(photo: Photo) {
    setActionLoading(photo.id)
    try {
      const { error } = await supabase
        .from('photos')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', photo.id)

      if (error) throw error

      // Mise à jour immédiate de l'état local
      setPhotos((prev) => prev.map((p) =>
        p.id === photo.id ? { ...p, status: 'approved', approved_at: new Date().toISOString() } : p
      ))
      toast.success('Photo approuvée')
    } catch (err) {
      toast.error('Erreur lors de l\'approbation')
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

  async function generateUniqueCode(): Promise<string> {
    const maxAttempts = 10
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = Math.floor(1000 + Math.random() * 9000).toString()
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('code', code)
        .single()
      if (!existing) return code
    }
    // Fallback: use timestamp-based code
    return Date.now().toString().slice(-6)
  }

  async function createNewSession() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Vous devez être connecté')
        router.push('/login')
        return
      }

      const code = await generateUniqueCode()
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
          user_id: user.id,
          album_qr_code: null,
          // Borne defaults
          borne_enabled: false,
          borne_qr_code: null,
          borne_countdown: true,
          borne_countdown_duration: 3,
          borne_return_delay: 5,
          borne_default_camera: 'front',
          borne_show_event_name: true,
          borne_lock_enabled: false,
          borne_lock_code: '0000',
          // Messages defaults
          messages_enabled: true,
          messages_frequency: 4,
          messages_duration: 8,
          // Mystery Photo Game defaults
          mystery_photo_enabled: false,
          mystery_photo_url: null,
          mystery_photo_grid: '12x8',
          mystery_photo_speed: 'medium',
          mystery_photo_active: false,
          mystery_photo_state: null,
          mystery_photos: '[]',
          mystery_current_round: 1,
          mystery_total_rounds: 1,
          mystery_is_playing: false,
          mystery_revealed_tiles: [],
          // Album defaults
          album_enabled: true,
          album_password: null,
          // Lineup Game defaults
          lineup_active: false,
          lineup_team_size: 5,
          lineup_clock_duration: 60,
          lineup_team1_name: 'Équipe 1',
          lineup_team2_name: 'Équipe 2',
          lineup_team1_score: 0,
          lineup_team2_score: 0,
          lineup_current_number: '',
          lineup_time_left: 60,
          lineup_is_running: false,
          lineup_is_paused: false,
          lineup_is_game_over: false,
          lineup_current_points: 10,
          lineup_show_winner: false,
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
    const url = getInviteUrl(selectedSession.code)
    navigator.clipboard.writeText(url)
    toast.success('Lien copié')
  }

  function printQRCode() {
    if (!selectedSession) return

    const inviteUrl = getInviteUrl(selectedSession.code)
    const logoUrl = selectedSession.custom_logo || '/images/animajet_logo_principal.png'
    const eventName = selectedSession.name || 'Événement'

    // Récupérer le SVG du QR code existant dans la page
    const qrContainer = document.querySelector('#qr-invite svg')
    const qrSvg = qrContainer ? qrContainer.outerHTML.replace(/width="130"/, 'width="250"').replace(/height="130"/, 'height="250"') : ''

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Impossible d\'ouvrir la fenêtre d\'impression')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${eventName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4 portrait; margin: 15mm; }
            html, body {
              width: 210mm;
              min-height: 297mm;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: white;
              padding: 20mm;
            }
            .card {
              width: 100%;
              max-width: 180mm;
              padding: 15mm;
              text-align: center;
              border: 5px solid #D4AF37;
              border-radius: 20px;
              background: linear-gradient(135deg, #fefefe 0%, #f8f6f0 100%);
              box-shadow: 0 10px 40px rgba(212, 175, 55, 0.2);
            }
            .logo {
              width: 280px;
              height: auto;
              margin-bottom: 20px;
            }
            .title {
              font-size: 36px;
              font-weight: 800;
              color: #1A1A1E;
              margin-bottom: 8px;
            }
            .subtitle {
              font-size: 20px;
              color: #6B6B70;
              margin-bottom: 25px;
            }
            .qr-container {
              display: inline-block;
              padding: 25px;
              background: white;
              border-radius: 20px;
              box-shadow: 0 8px 40px rgba(212, 175, 55, 0.35);
              border: 4px solid #D4AF37;
            }
            .qr-container svg {
              display: block;
              width: 280px;
              height: 280px;
            }
            .code {
              font-size: 56px;
              font-weight: 900;
              color: #D4AF37;
              margin-top: 25px;
              font-family: 'Courier New', monospace;
              letter-spacing: 8px;
              text-shadow: 2px 2px 4px rgba(212, 175, 55, 0.3);
            }
            .instruction {
              font-size: 24px;
              color: #1A1A1E;
              margin-top: 20px;
              font-weight: 600;
            }
            .footer {
              font-size: 16px;
              color: #6B6B70;
              margin-top: 25px;
              font-style: italic;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                padding: 0;
              }
              .card {
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${logoUrl}" alt="Logo" class="logo" />
            <div class="title">${eventName}</div>
            <div class="subtitle">Partagez vos plus beaux moments !</div>
            <div class="qr-container">
              ${qrSvg}
            </div>
            <div class="code">#${selectedSession.code}</div>
            <div class="instruction">📱 Scannez pour envoyer vos photos</div>
            <div class="footer">Propulsé par AnimaJet</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            };
          <\/script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  function getAlbumUrl(code: string) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/album/${code}`
    }
    return `/album/${code}`
  }

  function copyAlbumLink() {
    if (!selectedSession) return
    const url = getAlbumUrl(selectedSession.code)
    navigator.clipboard.writeText(url)
    toast.success('Lien album copié')
  }

  async function downloadAllPhotos() {
    if (!selectedSession || downloading) return

    const approvedPhotos = photos.filter(p => p.status === 'approved')
    if (approvedPhotos.length === 0) {
      toast.error('Aucune photo approuvée à télécharger')
      return
    }

    setDownloading(true)
    try {
      const response = await fetch('/api/album/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: selectedSession.code })
      })

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedSession.name.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedSession.code}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`${approvedPhotos.length} photos téléchargées`)
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors du téléchargement')
    } finally {
      setDownloading(false)
    }
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
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
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

  return (
    <div className="h-screen bg-[#0D0D0F] flex flex-col overflow-hidden relative">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5 flex-shrink-0">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
                  onClick={() => router.push(`/admin/jeux`)}
                  className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                >
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  Jeux
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

      <main className="relative z-10 flex-1 overflow-hidden">
        {!selectedSession ? (
          <div className="h-full w-full flex items-center justify-center px-6">
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
          <div className="h-full w-full flex flex-col lg:flex-row gap-4 px-6 py-4 overflow-hidden">
            {/* Colonne gauche : Stats + Photos */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {/* Stats Cards - Premium Gaming Style */}
              <div className="grid grid-cols-5 gap-4 flex-shrink-0">
                {/* Photos Total */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="relative group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-[#D4AF37]/30 to-amber-500/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl p-3 border border-[#D4AF37]/20 group-hover:border-[#D4AF37]/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-amber-600/10 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Photos</p>
                        <span className="text-2xl font-black text-[#D4AF37]">{photos.length}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Invités */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="relative group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/30 to-green-500/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl p-3 border border-emerald-500/20 group-hover:border-emerald-500/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-600/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Invités</p>
                        <span className="text-2xl font-black text-emerald-500">{invitePhotosCount}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Borne */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="relative group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl p-3 border border-cyan-500/20 group-hover:border-cyan-500/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 flex items-center justify-center">
                        <Tablet className="h-5 w-5 text-cyan-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Borne</p>
                        <span className="text-2xl font-black text-cyan-500">{bornePhotosCount}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Messages */}
                <motion.div
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="relative group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/30 to-purple-500/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl p-3 border border-violet-500/20 group-hover:border-violet-500/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Messages</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-violet-500">{totalMessagesCount}</span>
                          {pendingMessagesCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full animate-pulse">
                              {pendingMessagesCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Moderation Toggle */}
                <motion.div
                  onClick={toggleModeration}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative group cursor-pointer"
                >
                  <div className={`absolute -inset-0.5 rounded-xl blur transition-opacity duration-300 ${
                    moderationEnabled
                      ? 'bg-gradient-to-r from-[#D4AF37]/50 to-amber-500/50 opacity-100'
                      : 'bg-gradient-to-r from-gray-500/30 to-gray-600/30 opacity-0 group-hover:opacity-100'
                  }`} />
                  <div className={`relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl p-3 border-2 transition-all ${
                    moderationEnabled
                      ? 'border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                      : 'border-gray-600/30 group-hover:border-gray-500/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: togglingModeration ? 360 : 0 }}
                        transition={{ duration: 0.5 }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          moderationEnabled ? 'bg-gradient-to-br from-[#D4AF37]/30 to-amber-600/20' : 'bg-gray-600/10'
                        }`}
                      >
                        {togglingModeration ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
                        ) : moderationEnabled ? (
                          <Shield className="h-5 w-5 text-[#D4AF37]" />
                        ) : (
                          <ShieldOff className="h-5 w-5 text-gray-500" />
                        )}
                      </motion.div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">Modération</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-black ${moderationEnabled ? 'text-[#D4AF37]' : 'text-gray-500'}`}>
                            {moderationEnabled ? 'ON' : 'OFF'}
                          </span>
                          {moderationEnabled && (pendingCount + pendingMessagesCount) > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white rounded-full animate-pulse">
                              {pendingCount + pendingMessagesCount}
                            </span>
                          )}
                        </div>
                      </div>
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

                  <TabsContent value="photos" className="flex-1 overflow-auto m-0 p-3">
                    {photos.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {photos.map((photo) => (
                          <motion.div
                            key={photo.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            className="relative group"
                          >
                            <div className="aspect-square rounded-xl overflow-hidden bg-[#2E2E33] border border-[rgba(255,255,255,0.1)] transition-all duration-200 group-hover:border-[#D4AF37]/50 group-hover:shadow-[0_4px_20px_rgba(212,175,55,0.2)]">
                              <img
                                src={getPhotoUrl(photo.storage_path)}
                                alt="Photo"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {/* Badges en haut */}
                            <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-start">
                              {photo.source === 'borne' ? (
                                <Badge className="text-[9px] px-1 py-0 bg-[#D4AF37]/30 text-[#D4AF37] border-[#D4AF37]/40 backdrop-blur-sm">
                                  <Tablet className="h-2 w-2 mr-0.5" />
                                  Borne
                                </Badge>
                              ) : <div />}
                              {photo.status === 'pending' && (
                                <Badge className="text-[9px] px-1 py-0 bg-[#FF9800]/30 text-[#FF9800] border-[#FF9800]/40 backdrop-blur-sm">
                                  <Clock className="h-2 w-2 mr-0.5" />
                                  Attente
                                </Badge>
                              )}
                            </div>
                            {/* Nom en bas */}
                            {photo.uploader_name && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4 rounded-b-xl">
                                <p className="text-[10px] text-white/90 truncate font-medium">{photo.uploader_name}</p>
                              </div>
                            )}
                            {/* Overlay hover avec actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-xl flex items-center justify-center gap-2">
                              {photo.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleApprove(photo)}
                                  disabled={actionLoading === photo.id}
                                  className="bg-[#4CAF50] hover:bg-[#43A047] text-white h-8 w-8 p-0"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
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
                      <div className="text-center py-12 text-[#6B6B70]">
                        <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
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

            {/* Colonne droite : QR Code + Infos - largeur fixe */}
            <div className="lg:w-[320px] flex flex-col gap-2 lg:overflow-y-auto lg:overflow-x-hidden flex-shrink-0">
              {/* Actions rapides Card - Premium Style - EN HAUT */}
              <div className="relative group flex-shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500/20 to-orange-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl border border-rose-500/20 group-hover:border-rose-500/30 overflow-hidden transition-all">
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
                  <div className="px-2.5 py-1.5 border-b border-white/5">
                    <h3 className="font-bold text-white text-xs">⚡ Actions rapides</h3>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 justify-start border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 text-[11px] font-medium"
                      onClick={() => router.push('/admin/borne')}
                    >
                      <Tablet className="h-3.5 w-3.5 mr-1.5" />
                      Borne photo
                      {selectedSession.borne_enabled && borneConnection?.is_online && (
                        <span className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 justify-start border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 text-[11px] font-medium"
                      onClick={() => window.open(`/album/${selectedSession.code}`, '_blank')}
                    >
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                      Voir l&apos;album
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 justify-start border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 text-[11px] font-medium"
                      onClick={downloadAllPhotos}
                      disabled={downloading || approvedCount === 0}
                    >
                      {downloading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {downloading ? 'Téléchargement...' : `Télécharger (${approvedCount})`}
                    </Button>
                  </div>
                </div>
              </div>

              {/* QR Code Card - Premium Gaming Style */}
              <div className="relative group flex-shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#D4AF37]/30 to-amber-500/30 rounded-xl blur opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl border border-[#D4AF37]/30 overflow-hidden">
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
                  <div className="px-2.5 py-1.5 border-b border-white/5">
                    <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span className="text-sm">📱</span>
                      QR Code invités
                    </h3>
                  </div>
                  <div className="p-2.5 flex flex-col items-center">
                    <div className="relative" id="qr-invite">
                      <div className="absolute -inset-1 bg-[#D4AF37]/10 rounded-lg blur-md" />
                      <div className="relative bg-white p-2 rounded-lg shadow-xl shadow-black/50">
                        <QRCode
                          value={getInviteUrl(selectedSession.code)}
                          size={100}
                        />
                      </div>
                    </div>
                    <p className="text-lg font-mono font-black mt-2 text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]">
                      #{selectedSession.code}
                    </p>
                    <div className="flex gap-1.5 mt-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyInviteLink}
                        className="flex-1 h-7 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 text-[11px] font-semibold"
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
                        className="flex-1 h-7 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 text-[11px] font-semibold"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ouvrir
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={printQRCode}
                      className="w-full mt-1.5 h-7 bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[11px] font-semibold"
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Imprimer
                    </Button>
                  </div>
                </div>
              </div>

              {/* QR Code Album - Premium Style */}
              <div className="relative group flex-shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/30 to-purple-500/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl border border-violet-500/20 group-hover:border-violet-500/40 overflow-hidden transition-all">
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
                  <div className="px-2.5 py-1.5 border-b border-white/5">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-violet-500" />
                      <h3 className="font-bold text-white text-xs">Album post-event</h3>
                    </div>
                  </div>
                  <div className="p-2.5 flex flex-col items-center">
                    <div className="relative">
                      <div className="absolute -inset-1 bg-violet-500/10 rounded-lg blur-md" />
                      <div className="relative bg-white p-1.5 rounded-lg shadow-lg shadow-black/30">
                        <QRCode
                          value={getAlbumUrl(selectedSession.code)}
                          size={70}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      <span className="text-violet-400 font-bold">{approvedCount}</span> photos
                    </p>
                    <div className="flex gap-1.5 mt-1.5 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyAlbumLink}
                        className="flex-1 h-6 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 text-[10px] font-medium"
                      >
                        <Copy className="h-2.5 w-2.5 mr-1" />
                        Copier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/album/${selectedSession.code}`, '_blank')}
                        className="flex-1 h-6 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50 text-[10px] font-medium"
                      >
                        <ExternalLink className="h-2.5 w-2.5 mr-1" />
                        Voir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations Card - Premium Style */}
              <div className="relative group flex-shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-xl border border-emerald-500/20 group-hover:border-emerald-500/30 overflow-hidden transition-all">
                  <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                  <div className="px-2.5 py-1.5 border-b border-white/5">
                    <h3 className="font-bold text-white text-xs">📋 Infos</h3>
                  </div>
                  <div className="p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">Événement</span>
                      <span className="font-semibold text-white text-xs truncate ml-2">{selectedSession.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">Créé le</span>
                      <span className="font-semibold text-white text-xs">
                        {new Date(selectedSession.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {selectedSession.borne_enabled && (
                      <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                        <span className="text-[10px] text-gray-500">Borne</span>
                        {borneConnection?.is_online ? (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 rounded-full">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] text-emerald-400 font-medium">En ligne</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-500/10 rounded-full">
                            <WifiOff className="h-2.5 w-2.5 text-gray-500" />
                            <span className="text-[10px] text-gray-500">Hors ligne</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Subscription Status Card */}
              {subscription && subscription.current_period_end && (
                <SubscriptionStatusCard subscription={subscription} />
              )}

              {/* Speed Meter */}
              <SpeedMeter className="flex-shrink-0" />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
