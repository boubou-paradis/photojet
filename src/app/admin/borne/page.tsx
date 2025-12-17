'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import QRCode from 'react-qr-code'
import {
  ArrowLeft,
  Tablet,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Settings,
  Loader2,
  Lock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { Session, BorneConnection } from '@/types/database'
import { toast } from 'sonner'
import { getBorneUrl } from '@/lib/utils'

export default function BornePage() {
  const [, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [borneConnection, setBorneConnection] = useState<BorneConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchBorneConnection(selectedSession.id)
      subscribeToBorneConnection(selectedSession.id)
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

  function subscribeToBorneConnection(sessionId: string) {
    const channel = supabase
      .channel(`borne-connection-${sessionId}`)
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

  async function toggleBorneEnabled() {
    if (!selectedSession) return

    setSaving(true)
    try {
      const newEnabled = !selectedSession.borne_enabled
      let borneQrCode = selectedSession.borne_qr_code

      if (newEnabled && !borneQrCode) {
        borneQrCode = `borne-${selectedSession.id.slice(0, 8)}-${Date.now().toString(36)}`
      }

      const { error } = await supabase
        .from('sessions')
        .update({
          borne_enabled: newEnabled,
          borne_qr_code: borneQrCode,
        })
        .eq('id', selectedSession.id)

      if (error) throw error

      setSelectedSession({
        ...selectedSession,
        borne_enabled: newEnabled,
        borne_qr_code: borneQrCode,
      })

      toast.success(newEnabled ? 'Borne activée' : 'Borne désactivée')
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function regenerateBorneQr() {
    if (!selectedSession) return

    setSaving(true)
    try {
      const borneQrCode = `borne-${selectedSession.id.slice(0, 8)}-${Date.now().toString(36)}`

      const { error } = await supabase
        .from('sessions')
        .update({ borne_qr_code: borneQrCode })
        .eq('id', selectedSession.id)

      if (error) throw error

      setSelectedSession({
        ...selectedSession,
        borne_qr_code: borneQrCode,
      })

      toast.success('QR code régénéré')
    } catch (err) {
      toast.error('Erreur lors de la régénération')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function copyBorneLink() {
    if (!selectedSession?.borne_qr_code) return
    const url = getBorneUrl(selectedSession.borne_qr_code)
    navigator.clipboard.writeText(url)
    toast.success('Lien copié')
  }

  function getDeviceTypeLabel(type: string) {
    switch (type) {
      case 'ipad':
        return 'iPad'
      case 'android_tablet':
        return 'Tablette Android'
      default:
        return 'Appareil'
    }
  }

  function formatLastSeen(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 60) return 'À l\'instant'
    if (diffSec < 3600) return `Il y a ${Math.floor(diffSec / 60)} min`
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" />
            <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-[#D4AF37]" />
          </div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </motion.div>
      </div>
    )
  }

  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Aucune session disponible</p>
          <Button onClick={() => router.push('/admin/dashboard')}>
            Retour au dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/dashboard')}
              className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-[#D4AF37]/20 blur-xl rounded-full" />
                <Image
                  src="/images/animajet_logo_principal.png"
                  alt="AnimaJet"
                  width={50}
                  height={50}
                  className="relative z-10 drop-shadow-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <Tablet className="h-5 w-5 text-[#D4AF37]" />
                <h1 className="text-xl font-bold text-white">Borne Photo</h1>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/settings')}
            className="border-white/10 text-white hover:bg-white/5 hover:text-[#D4AF37]"
          >
            <Settings className="h-4 w-4 mr-2" />
            Paramètres
          </Button>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '80px' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mb-6"
          />
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 mb-4">
            <Tablet className="h-8 w-8 text-cyan-400" />
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            Configuration Borne
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
          </h2>
          <p className="text-gray-500 text-sm mt-2">{selectedSession.name}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Enable/Disable Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#D4AF37]/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden hover:border-[#D4AF37]/30 transition-all">
              <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Activer la borne photo</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Transformez une tablette en borne photo
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Label htmlFor="borne-toggle" className="text-sm text-gray-400">
                    {selectedSession.borne_enabled ? 'Activée' : 'Désactivée'}
                  </Label>
                  <Switch
                    id="borne-toggle"
                    checked={selectedSession.borne_enabled}
                    onCheckedChange={toggleBorneEnabled}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </div>

          {selectedSession.borne_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* QR Code Card */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden hover:border-cyan-400/30 transition-all h-full">
                    <div className="h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                    <div className="p-4 border-b border-white/5">
                      <h3 className="text-base font-semibold text-white">QR Code connexion</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Scannez avec la tablette
                      </p>
                    </div>
                    <div className="p-6 flex flex-col items-center">
                      {selectedSession.borne_qr_code && (
                        <>
                          <div className="bg-white p-4 rounded-xl shadow-2xl shadow-black/50">
                            <QRCode
                              value={getBorneUrl(selectedSession.borne_qr_code)}
                              size={160}
                            />
                          </div>
                          <p className="text-[10px] text-gray-600 mt-3 font-mono break-all text-center">
                            {selectedSession.borne_qr_code}
                          </p>
                          <div className="flex gap-2 mt-4 w-full">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyBorneLink}
                              className="flex-1 h-10 text-xs border-white/10 text-white hover:bg-white/5 hover:text-cyan-400"
                            >
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              Copier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(`/borne/${selectedSession.borne_qr_code}`, '_blank')
                              }
                              className="flex-1 h-10 text-xs border-white/10 text-white hover:bg-white/5 hover:text-cyan-400"
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                              Ouvrir
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={regenerateBorneQr}
                              disabled={saving}
                              className="h-10 w-10 p-0 border-white/10 text-white hover:bg-white/5 hover:text-cyan-400"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Connection Status Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative group"
                >
                  <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                    borneConnection?.is_online ? 'bg-emerald-500/20' : 'bg-gray-500/20'
                  }`} />
                  <div className={`relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden transition-all h-full ${
                    borneConnection?.is_online ? 'hover:border-emerald-400/30' : 'hover:border-white/20'
                  }`}>
                    <div className={`h-1 bg-gradient-to-r from-transparent to-transparent ${
                      borneConnection?.is_online ? 'via-emerald-500/50' : 'via-gray-500/50'
                    }`} />
                    <div className="p-4 border-b border-white/5">
                      <h3 className="text-base font-semibold text-white">Statut de connexion</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        État de la tablette
                      </p>
                    </div>
                    <div className="p-6">
                      {borneConnection ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            {borneConnection.is_online ? (
                              <div className="flex items-center gap-2 text-emerald-500">
                                <div className="relative">
                                  <Wifi className="h-6 w-6" />
                                  <div className="absolute inset-0 animate-ping opacity-30">
                                    <Wifi className="h-6 w-6" />
                                  </div>
                                </div>
                                <span className="font-semibold">En ligne</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-gray-500">
                                <WifiOff className="h-6 w-6" />
                                <span className="font-semibold">Hors ligne</span>
                              </div>
                            )}
                            <Badge
                              className={
                                borneConnection.is_online
                                  ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'
                                  : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                              }
                            >
                              {getDeviceTypeLabel(borneConnection.device_type)}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-500">
                            <p>Dernière activité : {formatLastSeen(borneConnection.last_seen)}</p>
                            <p className="text-xs mt-1 font-mono text-gray-600">
                              ID: {borneConnection.device_id.slice(0, 12)}...
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-500/10 flex items-center justify-center border border-gray-500/20">
                            <WifiOff className="h-10 w-10 text-gray-600" />
                          </div>
                          <p className="text-gray-400 font-medium">
                            Aucune tablette connectée
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Scannez le QR code avec votre tablette
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Installation Guide */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden hover:border-violet-400/30 transition-all">
                  <div className="h-1 bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-base font-semibold text-white">Guide d&apos;installation</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configuration sur tablette
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-amber-600/10 text-[#D4AF37] flex items-center justify-center text-xs font-bold">1</span>
                          iPad / iOS
                        </h3>
                        <ol className="text-sm text-gray-400 space-y-1.5 ml-8">
                          <li>Ouvrez Safari sur votre iPad</li>
                          <li>Scannez le QR code ou entrez le lien</li>
                          <li>Appuyez sur Partager → &quot;Sur l&apos;écran d&apos;accueil&quot;</li>
                          <li>Activez l&apos;Accès guidé (Réglages &gt; Accessibilité)</li>
                        </ol>
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#D4AF37]/20 to-amber-600/10 text-[#D4AF37] flex items-center justify-center text-xs font-bold">2</span>
                          Android
                        </h3>
                        <ol className="text-sm text-gray-400 space-y-1.5 ml-8">
                          <li>Ouvrez Chrome sur votre tablette</li>
                          <li>Scannez le QR code ou entrez le lien</li>
                          <li>Menu (⋮) → &quot;Ajouter à l&apos;écran d&apos;accueil&quot;</li>
                          <li>Activez le mode kiosque si disponible</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Current Configuration */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-[#D4AF37]/20 to-amber-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden hover:border-[#D4AF37]/30 transition-all">
                  <div className="h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
                  <div className="p-4 border-b border-white/5">
                    <h3 className="text-base font-semibold text-white">Configuration actuelle</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-[#0D0D0F] rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500">Compte à rebours</p>
                        <p className="font-bold text-[#D4AF37] mt-1 text-lg">
                          {selectedSession.borne_countdown
                            ? `${selectedSession.borne_countdown_duration}s`
                            : 'Désactivé'}
                        </p>
                      </div>
                      <div className="p-4 bg-[#0D0D0F] rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500">Retour auto</p>
                        <p className="font-bold text-[#D4AF37] mt-1 text-lg">{selectedSession.borne_return_delay}s</p>
                      </div>
                      <div className="p-4 bg-[#0D0D0F] rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500">Caméra par défaut</p>
                        <p className="font-bold text-white mt-1 text-lg">
                          {selectedSession.borne_default_camera === 'front' ? 'Frontale' : 'Arrière'}
                        </p>
                      </div>
                      <div className="p-4 bg-[#0D0D0F] rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500">Nom événement</p>
                        <p className="font-bold text-white mt-1 text-lg">
                          {selectedSession.borne_show_event_name ? 'Affiché' : 'Masqué'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50"
                      onClick={() => router.push('/admin/settings')}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Modifier les paramètres
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Lock Settings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/20 to-red-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-gradient-to-br from-[#1A1A1E] to-[#242428] rounded-2xl border border-white/10 overflow-hidden hover:border-rose-400/30 transition-all">
                  <div className="h-1 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
                  <div className="p-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-rose-400" />
                      <h3 className="text-base font-semibold text-white">Verrouillage de la borne</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Empêche de quitter l&apos;application borne
                    </p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="lock-toggle" className="text-white font-medium">
                          Activer le verrouillage
                        </Label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Code PIN requis pour le dashboard
                        </p>
                      </div>
                      <Switch
                        id="lock-toggle"
                        checked={selectedSession.borne_lock_enabled || false}
                        onCheckedChange={async (checked) => {
                          setSaving(true)
                          try {
                            const { error } = await supabase
                              .from('sessions')
                              .update({ borne_lock_enabled: checked })
                              .eq('id', selectedSession.id)
                            if (error) throw error
                            setSelectedSession({ ...selectedSession, borne_lock_enabled: checked })
                            toast.success(checked ? 'Verrouillage activé' : 'Verrouillage désactivé')
                          } catch {
                            toast.error('Erreur lors de la mise à jour')
                          } finally {
                            setSaving(false)
                          }
                        }}
                        disabled={saving}
                      />
                    </div>

                    {selectedSession.borne_lock_enabled && (
                      <div className="space-y-3 pt-4 border-t border-white/5">
                        <Label htmlFor="lock-code" className="text-white font-medium">
                          Code PIN (4 chiffres)
                        </Label>
                        <div className="flex gap-3">
                          <Input
                            id="lock-code"
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="1234"
                            value={selectedSession.borne_lock_code || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                              setSelectedSession({ ...selectedSession, borne_lock_code: value })
                            }}
                            className="w-32 h-12 text-center text-xl tracking-widest bg-[#0D0D0F] border-white/10 text-white rounded-xl"
                          />
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (!selectedSession.borne_lock_code || selectedSession.borne_lock_code.length !== 4) {
                                toast.error('Le code doit contenir 4 chiffres')
                                return
                              }
                              setSaving(true)
                              try {
                                const { error } = await supabase
                                  .from('sessions')
                                  .update({ borne_lock_code: selectedSession.borne_lock_code })
                                  .eq('id', selectedSession.id)
                                if (error) throw error
                                toast.success('Code PIN enregistré')
                              } catch {
                                toast.error('Erreur lors de l\'enregistrement')
                              } finally {
                                setSaving(false)
                              }
                            }}
                            disabled={saving || !selectedSession.borne_lock_code || selectedSession.borne_lock_code.length !== 4}
                            className="h-12 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50"
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  )
}
