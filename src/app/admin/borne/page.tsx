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
                alt="AnimaJet"
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

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Enable/Disable Card */}
          <motion.div
            whileHover={{ scale: 1.005 }}
            className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
          >
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Activer la borne photo</h3>
                <p className="text-xs text-[#6B6B70] mt-0.5">
                  Transformez une tablette en borne photo
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="borne-toggle" className="text-xs text-[#B0B0B5]">
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
          </motion.div>

          {selectedSession.borne_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* QR Code Card */}
                <motion.div
                  whileHover={{ scale: 1.005 }}
                  className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                >
                  <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-sm font-semibold text-white">QR Code connexion</h3>
                    <p className="text-xs text-[#6B6B70] mt-0.5">
                      Scannez avec la tablette
                    </p>
                  </div>
                  <div className="p-4 flex flex-col items-center">
                    {selectedSession.borne_qr_code && (
                      <>
                        <div className="bg-white p-3 rounded-lg shadow-gold">
                          <QRCode
                            value={getBorneUrl(selectedSession.borne_qr_code)}
                            size={140}
                          />
                        </div>
                        <p className="text-[10px] text-[#6B6B70] mt-2 font-mono break-all text-center">
                          {selectedSession.borne_qr_code}
                        </p>
                        <div className="flex gap-2 mt-3 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyBorneLink}
                            className="flex-1 h-8 text-xs border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(`/borne/${selectedSession.borne_qr_code}`, '_blank')
                            }
                            className="flex-1 h-8 text-xs border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ouvrir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={regenerateBorneQr}
                            disabled={saving}
                            className="h-8 w-8 p-0 border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>

                {/* Connection Status Card */}
                <motion.div
                  whileHover={{ scale: 1.005 }}
                  className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                >
                  <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                    <h3 className="text-sm font-semibold text-white">Statut de connexion</h3>
                    <p className="text-xs text-[#6B6B70] mt-0.5">
                      État de la tablette
                    </p>
                  </div>
                  <div className="p-4">
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
                </motion.div>
              </div>

              {/* Installation Guide */}
              <motion.div
                whileHover={{ scale: 1.002 }}
                className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
              >
                <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="text-sm font-semibold text-white">Guide d&apos;installation</h3>
                  <p className="text-xs text-[#6B6B70] mt-0.5">
                    Configuration sur tablette
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                        <span className="w-5 h-5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center text-xs">1</span>
                        iPad / iOS
                      </h3>
                      <ol className="text-xs text-[#B0B0B5] space-y-1 ml-7">
                        <li>Ouvrez Safari sur votre iPad</li>
                        <li>Scannez le QR code ou entrez le lien</li>
                        <li>Appuyez sur Partager → &quot;Sur l&apos;écran d&apos;accueil&quot;</li>
                        <li>Activez l&apos;Accès guidé (Réglages &gt; Accessibilité)</li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                        <span className="w-5 h-5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center text-xs">2</span>
                        Android
                      </h3>
                      <ol className="text-xs text-[#B0B0B5] space-y-1 ml-7">
                        <li>Ouvrez Chrome sur votre tablette</li>
                        <li>Scannez le QR code ou entrez le lien</li>
                        <li>Menu (⋮) → &quot;Ajouter à l&apos;écran d&apos;accueil&quot;</li>
                        <li>Activez le mode kiosque si disponible</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Current Configuration */}
              <motion.div
                whileHover={{ scale: 1.002 }}
                className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
              >
                <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                  <h3 className="text-sm font-semibold text-white">Configuration actuelle</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2 bg-[#2E2E33]/50 rounded-lg">
                      <p className="text-[#6B6B70]">Compte à rebours</p>
                      <p className="font-semibold text-[#D4AF37] mt-0.5">
                        {selectedSession.borne_countdown
                          ? `${selectedSession.borne_countdown_duration}s`
                          : 'Désactivé'}
                      </p>
                    </div>
                    <div className="p-2 bg-[#2E2E33]/50 rounded-lg">
                      <p className="text-[#6B6B70]">Retour auto</p>
                      <p className="font-semibold text-[#D4AF37] mt-0.5">{selectedSession.borne_return_delay}s</p>
                    </div>
                    <div className="p-2 bg-[#2E2E33]/50 rounded-lg">
                      <p className="text-[#6B6B70]">Caméra par défaut</p>
                      <p className="font-semibold text-white mt-0.5">
                        {selectedSession.borne_default_camera === 'front' ? 'Frontale' : 'Arrière'}
                      </p>
                    </div>
                    <div className="p-2 bg-[#2E2E33]/50 rounded-lg">
                      <p className="text-[#6B6B70]">Nom événement</p>
                      <p className="font-semibold text-white mt-0.5">
                        {selectedSession.borne_show_event_name ? 'Affiché' : 'Masqué'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 text-xs border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
                    onClick={() => router.push('/admin/settings')}
                  >
                    <Settings className="h-3 w-3 mr-1.5" />
                    Modifier les paramètres
                  </Button>
                </div>
              </motion.div>

              {/* Lock Settings */}
              <motion.div
                whileHover={{ scale: 1.002 }}
                className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
              >
                <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#D4AF37]" />
                    <h3 className="text-sm font-semibold text-white">Verrouillage de la borne</h3>
                  </div>
                  <p className="text-xs text-[#6B6B70] mt-0.5">
                    Empêche de quitter l&apos;application borne
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="lock-toggle" className="text-white text-sm font-medium">
                        Activer le verrouillage
                      </Label>
                      <p className="text-xs text-[#6B6B70] mt-0.5">
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
                    <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                      <Label htmlFor="lock-code" className="text-white text-sm font-medium">
                        Code PIN (4 chiffres)
                      </Label>
                      <div className="flex gap-2">
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
                          className="w-28 h-9 text-center text-base tracking-widest bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white"
                        />
                        <Button
                          variant="outline"
                          size="sm"
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
                          className="h-9 text-xs border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
                        >
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  )
}
