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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <p className="text-[#B0B0B5]">Aucune session disponible</p>
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
            className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
          >
            <Settings className="h-4 w-4 mr-2" />
            Paramètres borne
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Enable/Disable Card */}
          <div className="card-gold rounded-xl">
            <div className="p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Activer la borne photo</h3>
                <p className="text-sm text-[#6B6B70] mt-1">
                  Transformez une tablette en borne photo pour votre événement
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="borne-toggle" className="text-sm text-[#B0B0B5]">
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

          {selectedSession.borne_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* QR Code Card */}
                <div className="card-gold rounded-xl">
                  <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-lg font-semibold text-white">QR Code connexion</h3>
                    <p className="text-sm text-[#6B6B70] mt-1">
                      Scannez ce QR code avec la tablette pour la connecter
                    </p>
                  </div>
                  <div className="p-6 flex flex-col items-center">
                    {selectedSession.borne_qr_code && (
                      <>
                        <div className="bg-white p-4 rounded-lg shadow-gold">
                          <QRCode
                            value={getBorneUrl(selectedSession.borne_qr_code)}
                            size={180}
                          />
                        </div>
                        <p className="text-xs text-[#6B6B70] mt-3 font-mono break-all text-center">
                          {selectedSession.borne_qr_code}
                        </p>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyBorneLink}
                            className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(`/borne/${selectedSession.borne_qr_code}`, '_blank')
                            }
                            className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ouvrir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={regenerateBorneQr}
                            disabled={saving}
                            className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Connection Status Card */}
                <div className="card-gold rounded-xl">
                  <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-lg font-semibold text-white">Statut de connexion</h3>
                    <p className="text-sm text-[#6B6B70] mt-1">
                      État de la tablette connectée à cette session
                    </p>
                  </div>
                  <div className="p-6">
                    {borneConnection ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          {borneConnection.is_online ? (
                            <div className="flex items-center gap-2 text-[#4CAF50]">
                              <Wifi className="h-5 w-5" />
                              <span className="font-medium">En ligne</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[#6B6B70]">
                              <WifiOff className="h-5 w-5" />
                              <span className="font-medium">Hors ligne</span>
                            </div>
                          )}
                          <Badge
                            className={
                              borneConnection.is_online
                                ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                                : 'bg-[#2E2E33] text-[#B0B0B5] border-[rgba(255,255,255,0.1)]'
                            }
                          >
                            {getDeviceTypeLabel(borneConnection.device_type)}
                          </Badge>
                        </div>
                        <div className="text-sm text-[#6B6B70]">
                          <p>Dernière activité : {formatLastSeen(borneConnection.last_seen)}</p>
                          <p className="text-xs mt-1 font-mono">
                            ID: {borneConnection.device_id.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#2E2E33] flex items-center justify-center">
                          <WifiOff className="h-8 w-8 text-[#6B6B70]" />
                        </div>
                        <p className="text-[#B0B0B5]">
                          Aucune tablette connectée
                        </p>
                        <p className="text-sm text-[#6B6B70] mt-1">
                          Scannez le QR code avec votre tablette
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Installation Guide */}
              <div className="card-gold rounded-xl">
                <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="text-lg font-semibold text-white">Guide d&apos;installation</h3>
                  <p className="text-sm text-[#6B6B70] mt-1">
                    Instructions pour configurer la borne photo sur votre tablette
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-white">
                        <span className="w-6 h-6 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center text-sm">1</span>
                        iPad / iOS
                      </h3>
                      <ol className="text-sm text-[#B0B0B5] space-y-2 ml-8">
                        <li>Ouvrez Safari sur votre iPad</li>
                        <li>Scannez le QR code ou entrez le lien</li>
                        <li>Appuyez sur le bouton Partager</li>
                        <li>Sélectionnez &quot;Sur l&apos;écran d&apos;accueil&quot;</li>
                        <li>Activez l&apos;Accès guidé dans Réglages &gt; Accessibilité</li>
                      </ol>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-white">
                        <span className="w-6 h-6 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center text-sm">2</span>
                        Android
                      </h3>
                      <ol className="text-sm text-[#B0B0B5] space-y-2 ml-8">
                        <li>Ouvrez Chrome sur votre tablette</li>
                        <li>Scannez le QR code ou entrez le lien</li>
                        <li>Appuyez sur le menu (3 points)</li>
                        <li>Sélectionnez &quot;Ajouter à l&apos;écran d&apos;accueil&quot;</li>
                        <li>Activez le mode kiosque si disponible</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Configuration */}
              <div className="card-gold rounded-xl">
                <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="text-lg font-semibold text-white">Configuration actuelle</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-[#6B6B70]">Compte à rebours</p>
                      <p className="font-medium text-[#D4AF37]">
                        {selectedSession.borne_countdown
                          ? `${selectedSession.borne_countdown_duration}s`
                          : 'Désactivé'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#6B6B70]">Retour auto</p>
                      <p className="font-medium text-[#D4AF37]">{selectedSession.borne_return_delay}s</p>
                    </div>
                    <div>
                      <p className="text-[#6B6B70]">Caméra par défaut</p>
                      <p className="font-medium text-white">
                        {selectedSession.borne_default_camera === 'front' ? 'Frontale' : 'Arrière'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#6B6B70]">Nom événement</p>
                      <p className="font-medium text-white">
                        {selectedSession.borne_show_event_name ? 'Affiché' : 'Masqué'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
                    onClick={() => router.push('/admin/settings')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Modifier les paramètres
                  </Button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  )
}
