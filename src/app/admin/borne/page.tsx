'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import QRCode from 'react-qr-code'
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Settings,
  Loader2,
  Lock,
  FileText,
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
import { fetchUserSessions, pickSession } from '@/lib/session-select'
import { buzzerFontVars } from '@/components/buzzer/fonts'
import AnimaBoothLogo from '@/components/animabooth/AnimaBoothLogo'
import AnimaBoothTemplates from '@/components/animabooth/AnimaBoothTemplates'
import WelcomeSettings from '@/components/animabooth/WelcomeSettings'
import { TEMPLATES_NOTICE_URL } from '@/lib/borne-templates/constants'

export default function BornePage() {
  const [, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [borneConnection, setBorneConnection] = useState<BorneConnection | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (!selectedSession) return
    fetchBorneConnection(selectedSession.id)
    const unsub = subscribeToBorneConnection(selectedSession.id)
    return () => unsub()
  }, [selectedSession?.id])

  async function fetchSessions() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      const data = await fetchUserSessions(supabase, user.id)
      setSessions(data)
      setSelectedSession(pickSession(data, searchParams.get('session')))
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

      toast.success(newEnabled ? 'AnimaBooth activé' : 'AnimaBooth désactivé')
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
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
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

  // Hauteur = écran moins la barre de menu (64 px) et le pied de page (31 px) du layout admin : pas de défilement inutile
  return (
    <div className={`min-h-[calc(100vh-95px)] bg-[#0D0D0F] overflow-hidden ${buzzerFontVars}`}>
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
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
            <div className="h-4 w-px bg-white/10" />
            <div>
              <h1 className="sr-only">AnimaBooth</h1>
              <AnimaBoothLogo variant="small" subtitle={false} size="24px" />
              <p className="text-xs text-gray-500 mt-1">{selectedSession.name} · session {selectedSession.code}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={TEMPLATES_NOTICE_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-[#D4AF37] hover:text-[#F4D03F] border border-[#D4AF37]/30 hover:border-[#D4AF37]">
                <FileText className="h-4 w-4 mr-2" />
                Notice
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/settings?session=${selectedSession.id}`)}
              className="border-white/10 text-white hover:bg-white/5 hover:text-[#D4AF37]"
            >
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-8 py-6">
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] items-start">
          {/* Colonne tablette : activation, connexion, verrouillage, réglages */}
          <div className="space-y-4">
            <section className="card-gold rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">Activer AnimaBooth</h2>
                <p className="text-xs text-[#9a94b5] mt-0.5">Transformez une tablette en borne photo</p>
              </div>
              <div className="flex items-center gap-3">
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
            </section>

            {!selectedSession.borne_enabled && (
              <p className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-sm text-[#fde68a]">
                Activez AnimaBooth avec l&apos;interrupteur ci-dessus pour configurer la tablette, vos templates et l&apos;écran d&apos;accueil.
              </p>
            )}

            {/* Tant que la borne n'est pas activée : tout est visible mais grisé et inactif */}
            <div
              inert={!selectedSession.borne_enabled}
              aria-disabled={!selectedSession.borne_enabled}
              className={`space-y-4 transition-opacity ${selectedSession.borne_enabled ? '' : 'opacity-40 grayscale select-none'}`}
            >
                {/* QR code + statut de la tablette */}
                <section className="card-gold rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-white">Connexion de la tablette</h2>
                      <p className="text-xs text-[#9a94b5] mt-0.5">Scannez le QR code avec la tablette</p>
                    </div>
                    {borneConnection?.is_online ? (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
                        <Wifi className="h-4 w-4" /> En ligne
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-500">
                        <WifiOff className="h-4 w-4" /> Hors ligne
                      </span>
                    )}
                  </div>
                  {!selectedSession.borne_qr_code && (
                    <p className="mt-4 text-sm text-[#9a94b5]">Le QR code de connexion apparaîtra dès l&apos;activation.</p>
                  )}
                  {selectedSession.borne_qr_code && (
                    <div className="mt-4 flex gap-4 items-center">
                      <div className="bg-white p-2.5 rounded-lg shrink-0">
                        <QRCode value={getBorneUrl(selectedSession.borne_qr_code)} size={116} />
                      </div>
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyBorneLink}
                          className="h-9 justify-start text-xs border-white/10 text-white hover:bg-white/5 hover:text-[#b16cff]"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copier le lien
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/borne/${selectedSession.borne_qr_code}`, '_blank')}
                          className="h-9 justify-start text-xs border-white/10 text-white hover:bg-white/5 hover:text-[#b16cff]"
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Ouvrir la borne
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={regenerateBorneQr}
                          disabled={saving}
                          className="h-9 justify-start text-xs border-white/10 text-white hover:bg-white/5 hover:text-[#b16cff]"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${saving ? 'animate-spin' : ''}`} />
                          Nouveau QR code
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
                    {borneConnection ? (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge
                          className={
                            borneConnection.is_online
                              ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          }
                        >
                          {getDeviceTypeLabel(borneConnection.device_type)}
                        </Badge>
                        Dernière activité : {formatLastSeen(borneConnection.last_seen)}
                      </p>
                    ) : (
                      <p>Aucune tablette connectée pour l&apos;instant.</p>
                    )}
                  </div>
                </section>

                {/* Verrouillage */}
                <section className="card-gold rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="lock-toggle" className="text-white font-semibold flex items-center gap-2">
                        <Lock className="h-4 w-4 text-rose-400" />
                        Verrouillage de la borne
                      </Label>
                      <p className="text-xs text-[#9a94b5] mt-0.5">Code PIN requis pour quitter la borne</p>
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
                    <div className="flex gap-2 pt-3 border-t border-white/5">
                      <Input
                        id="lock-code"
                        aria-label="Code PIN (4 chiffres)"
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="1234"
                        value={selectedSession.borne_lock_code || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setSelectedSession({ ...selectedSession, borne_lock_code: value })
                        }}
                        className="w-28 h-10 text-center text-lg tracking-widest bg-[#0D0D0F] border-white/10 text-white rounded-xl"
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
                        className="h-10 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50"
                      >
                        Enregistrer le code
                      </Button>
                    </div>
                  )}
                </section>

                {/* Configuration actuelle */}
                <section className="card-gold rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-white">Configuration actuelle</h2>
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/settings?session=${selectedSession.id}`)}
                      className="text-xs font-semibold text-[#D4AF37] hover:text-[#F4D03F] flex items-center gap-1"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2.5 bg-[#0D0D0F] rounded-lg border border-white/5">
                      <dt className="text-xs text-gray-500">Compte à rebours</dt>
                      <dd className="font-bold text-[#D4AF37]">
                        {selectedSession.borne_countdown ? `${selectedSession.borne_countdown_duration}s` : 'Désactivé'}
                      </dd>
                    </div>
                    <div className="p-2.5 bg-[#0D0D0F] rounded-lg border border-white/5">
                      <dt className="text-xs text-gray-500">Retour auto</dt>
                      <dd className="font-bold text-[#D4AF37]">{selectedSession.borne_return_delay}s</dd>
                    </div>
                    <div className="p-2.5 bg-[#0D0D0F] rounded-lg border border-white/5">
                      <dt className="text-xs text-gray-500">Caméra par défaut</dt>
                      <dd className="font-bold text-white">{selectedSession.borne_default_camera === 'front' ? 'Frontale' : 'Arrière'}</dd>
                    </div>
                    <div className="p-2.5 bg-[#0D0D0F] rounded-lg border border-white/5">
                      <dt className="text-xs text-gray-500">Nom événement</dt>
                      <dd className="font-bold text-white">{selectedSession.borne_show_event_name ? 'Affiché' : 'Masqué'}</dd>
                    </div>
                  </dl>
                </section>

                {/* Guide d'installation (repliable) */}
                <details className="card-gold rounded-xl p-4 group">
                  <summary className="cursor-pointer list-none flex items-center justify-between text-base font-semibold text-white">
                    Guide d&apos;installation sur tablette
                    <span className="text-xs font-normal text-[#9a94b5] group-open:hidden">Afficher</span>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm text-gray-400">
                    <div>
                      <h3 className="text-sm font-semibold text-white">iPad / iOS</h3>
                      <ol className="list-decimal ml-5 mt-1 space-y-0.5">
                        <li>Ouvrez Safari sur votre iPad</li>
                        <li>Scannez le QR code ou entrez le lien</li>
                        <li>Appuyez sur Partager → &quot;Sur l&apos;écran d&apos;accueil&quot;</li>
                        <li>Activez l&apos;Accès guidé (Réglages &gt; Accessibilité)</li>
                      </ol>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Android</h3>
                      <ol className="list-decimal ml-5 mt-1 space-y-0.5">
                        <li>Ouvrez Chrome sur votre tablette</li>
                        <li>Scannez le QR code ou entrez le lien</li>
                        <li>Menu (⋮) → &quot;Ajouter à l&apos;écran d&apos;accueil&quot;</li>
                        <li>Activez le mode kiosque si disponible</li>
                      </ol>
                    </div>
                    <p>
                      Si vous aviez déjà installé la borne sur l&apos;écran d&apos;accueil, supprimez-la puis réinstallez-la pour pouvoir l&apos;utiliser à l&apos;horizontale.
                    </p>
                  </div>
                </details>
            </div>
          </div>

          {/* Colonne cadres et écran d'accueil (grisée tant que la borne n'est pas activée) */}
          <div
            inert={!selectedSession.borne_enabled}
            aria-disabled={!selectedSession.borne_enabled}
            className={`space-y-6 min-w-0 transition-opacity ${selectedSession.borne_enabled ? '' : 'opacity-40 grayscale select-none'}`}
          >
              {userId && (
                <AnimaBoothTemplates
                  session={selectedSession}
                  userId={userId}
                  onSessionChange={(patch) => setSelectedSession((s) => (s ? { ...s, ...patch } : s))}
                  aside={
                    <WelcomeSettings
                      session={selectedSession}
                      onSessionChange={(patch) => setSelectedSession((s) => (s ? { ...s, ...patch } : s))}
                    />
                  }
                />
              )}
          </div>
        </div>
      </main>
    </div>
  )
}
