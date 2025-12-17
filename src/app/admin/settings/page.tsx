'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw,
  Trash2,
  Tablet,
  Upload,
  ImageIcon,
  Palette,
  X,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase'
import { Session, TransitionType, CameraType, BackgroundType, LogoSize, LogoPosition } from '@/types/database'
import { generateSessionCode } from '@/lib/image-utils'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    moderation_enabled: false,
    show_qr_on_screen: true,
    transition_type: 'fade' as TransitionType,
    transition_duration: 5,
    expires_at: '',
    is_active: true,
    // Borne settings
    borne_countdown: true,
    borne_countdown_duration: 3,
    borne_return_delay: 5,
    borne_default_camera: 'front' as CameraType,
    borne_show_event_name: true,
    // Customization settings
    background_type: 'color' as BackgroundType,
    background_color: '#1A1A1E',
    background_image: null as string | null,
    background_opacity: 50,
    custom_logo: null as string | null,
    logo_size: 'medium' as LogoSize,
    logo_position: 'bottom-left' as LogoPosition,
    // Messages settings
    messages_enabled: true,
    messages_frequency: 4,
    messages_duration: 8,
  })

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      setFormData({
        name: selectedSession.name,
        code: selectedSession.code,
        moderation_enabled: false,
        show_qr_on_screen: selectedSession.show_qr_on_screen,
        transition_type: selectedSession.transition_type,
        transition_duration: selectedSession.transition_duration,
        expires_at: selectedSession.expires_at.split('T')[0],
        is_active: selectedSession.is_active,
        // Borne settings
        borne_countdown: selectedSession.borne_countdown ?? true,
        borne_countdown_duration: selectedSession.borne_countdown_duration ?? 3,
        borne_return_delay: selectedSession.borne_return_delay ?? 5,
        borne_default_camera: selectedSession.borne_default_camera ?? 'front',
        borne_show_event_name: selectedSession.borne_show_event_name ?? true,
        // Customization settings
        background_type: selectedSession.background_type ?? 'color',
        background_color: selectedSession.background_color ?? '#1A1A1E',
        background_image: selectedSession.background_image ?? null,
        background_opacity: selectedSession.background_opacity ?? 50,
        custom_logo: selectedSession.custom_logo ?? null,
        logo_size: selectedSession.logo_size ?? 'medium',
        logo_position: selectedSession.logo_position ?? 'bottom-left',
        // Messages settings
        messages_enabled: selectedSession.messages_enabled ?? true,
        messages_frequency: selectedSession.messages_frequency ?? 4,
        messages_duration: selectedSession.messages_duration ?? 8,
      })
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

  async function handleSave() {
    if (!selectedSession) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          name: formData.name,
          code: formData.code,
          moderation_enabled: formData.moderation_enabled,
          show_qr_on_screen: formData.show_qr_on_screen,
          transition_type: formData.transition_type,
          transition_duration: formData.transition_duration,
          expires_at: new Date(formData.expires_at).toISOString(),
          is_active: formData.is_active,
          // Borne settings
          borne_countdown: formData.borne_countdown,
          borne_countdown_duration: formData.borne_countdown_duration,
          borne_return_delay: formData.borne_return_delay,
          borne_default_camera: formData.borne_default_camera,
          borne_show_event_name: formData.borne_show_event_name,
          // Customization settings
          background_type: formData.background_type,
          background_color: formData.background_color,
          background_image: formData.background_image,
          background_opacity: formData.background_opacity,
          custom_logo: formData.custom_logo,
          logo_size: formData.logo_size,
          logo_position: formData.logo_position,
          // Messages settings
          messages_enabled: formData.messages_enabled,
          messages_frequency: formData.messages_frequency,
          messages_duration: formData.messages_duration,
        })
        .eq('id', selectedSession.id)

      if (error) throw error

      toast.success('Paramètres enregistrés')
      fetchSessions()
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedSession) return

    setUploadingBg(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `backgrounds/${selectedSession.id}.${fileExt}`

      // Delete old background if exists
      if (formData.background_image) {
        await supabase.storage.from('photos').remove([formData.background_image])
      }

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      setFormData((prev) => ({ ...prev, background_image: filePath, background_type: 'image' }))
      toast.success('Image de fond uploadée')
    } catch (err) {
      toast.error('Erreur lors de l\'upload')
      console.error(err)
    } finally {
      setUploadingBg(false)
      if (bgInputRef.current) bgInputRef.current.value = ''
    }
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedSession) return

    setUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `logos/${selectedSession.id}.${fileExt}`

      // Delete old logo if exists
      if (formData.custom_logo) {
        await supabase.storage.from('photos').remove([formData.custom_logo])
      }

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      setFormData((prev) => ({ ...prev, custom_logo: filePath }))
      toast.success('Logo uploadé')
    } catch (err) {
      toast.error('Erreur lors de l\'upload')
      console.error(err)
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  function getStorageUrl(path: string | null) {
    if (!path) return null
    const { data } = supabase.storage.from('photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleRemoveBackground() {
    if (formData.background_image) {
      await supabase.storage.from('photos').remove([formData.background_image])
    }
    setFormData((prev) => ({ ...prev, background_image: null, background_type: 'color' }))
  }

  async function handleRemoveLogo() {
    if (formData.custom_logo) {
      await supabase.storage.from('photos').remove([formData.custom_logo])
    }
    setFormData((prev) => ({ ...prev, custom_logo: null }))
  }

  async function handleDelete() {
    if (!selectedSession) return

    try {
      const { data: photos } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('session_id', selectedSession.id)

      if (photos && photos.length > 0) {
        await supabase.storage
          .from('photos')
          .remove(photos.map((p) => p.storage_path))
      }

      await supabase.from('photos').delete().eq('session_id', selectedSession.id)
      await supabase.from('borne_connections').delete().eq('session_id', selectedSession.id)

      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', selectedSession.id)

      if (error) throw error

      toast.success('Session supprimée')
      setDeleteDialogOpen(false)
      router.push('/admin/dashboard')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error(err)
    }
  }

  async function handleRegenerateCode() {
    // Generate unique code by checking database
    const maxAttempts = 10
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const newCode = generateSessionCode()
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('code', newCode)
        .neq('id', selectedSession?.id || '') // Exclude current session
        .single()
      if (!existing) {
        setFormData((prev) => ({ ...prev, code: newCode }))
        return
      }
    }
    // Fallback
    setFormData((prev) => ({ ...prev, code: Date.now().toString().slice(-4) }))
  }

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

  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <p className="text-[#B0B0B5]">Aucune session sélectionnée</p>
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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
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
              <h1 className="text-xl font-bold text-white">Paramètres</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#E53935] hover:bg-[#D32F2F] text-white"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#242428] border-[rgba(255,255,255,0.1)]">
                <DialogHeader>
                  <DialogTitle className="text-white">Supprimer la session ?</DialogTitle>
                </DialogHeader>
                <p className="text-[#B0B0B5]">
                  Cette action est irréversible. Toutes les photos seront également supprimées.
                </p>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleDelete}
                    className="bg-[#E53935] hover:bg-[#D32F2F] text-white"
                  >
                    Supprimer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gold-gradient text-[#1A1A1E] font-semibold hover:opacity-90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-3 flex-1 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full"
        >
          {/* Colonne gauche : Informations générales */}
          <motion.div
            whileHover={{ scale: 1.002 }}
            className="card-gold rounded-xl flex flex-col transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
          >
            <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
              <h3 className="text-sm font-semibold text-white">Informations générales</h3>
              <p className="text-xs text-[#6B6B70]">
                Informations de base de votre événement
              </p>
            </div>
            <div className="p-3 space-y-3 flex-1">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[#B0B0B5] text-sm">Nom de l&apos;événement</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Mariage de Jean et Marie"
                  className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-[#6B6B70]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-[#B0B0B5] text-sm">Code session</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setFormData((prev) => ({ ...prev, code: value }))
                    }}
                    className="font-mono text-center text-lg bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] text-[#D4AF37]"
                    maxLength={4}
                  />
                  <Button
                    variant="outline"
                    onClick={handleRegenerateCode}
                    className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expires" className="text-[#B0B0B5] text-sm">Date d&apos;expiration</Label>
                <Input
                  id="expires"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label className="text-white text-sm">Session active</Label>
                  <p className="text-xs text-[#6B6B70]">
                    Désactivez pour empêcher les uploads
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            </div>
          </motion.div>

          {/* Colonne droite : Diaporama */}
          <div className="flex flex-col gap-3">
            {/* Diaporama */}
            <motion.div
              whileHover={{ scale: 1.002 }}
              className="card-gold rounded-xl transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
            >
              <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
                <h3 className="text-sm font-semibold text-white">Diaporama</h3>
              </div>
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white text-sm">Afficher le QR code</Label>
                    <p className="text-xs text-[#6B6B70]">
                      QR code en bas à droite
                    </p>
                  </div>
                  <Switch
                    checked={formData.show_qr_on_screen}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, show_qr_on_screen: checked }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[#B0B0B5] text-sm">Transition</Label>
                    <Select
                      value={formData.transition_type}
                      onValueChange={(value: TransitionType) =>
                        setFormData((prev) => ({ ...prev, transition_type: value }))
                      }
                    >
                      <SelectTrigger className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)]">
                        <SelectItem value="fade">Fondu</SelectItem>
                        <SelectItem value="slide">Glissement</SelectItem>
                        <SelectItem value="zoom">Zoom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label className="text-[#B0B0B5] text-sm">Durée</Label>
                      <span className="text-sm text-[#D4AF37] font-semibold">
                        {formData.transition_duration}s
                      </span>
                    </div>
                    <Slider
                      value={[formData.transition_duration]}
                      onValueChange={([value]) =>
                        setFormData((prev) => ({ ...prev, transition_duration: value }))
                      }
                      min={3}
                      max={15}
                      step={1}
                      className="[&_[role=slider]]:bg-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Personnalisation Diaporama - pleine largeur */}
          <motion.div
            whileHover={{ scale: 1.001 }}
            className="card-gold rounded-xl lg:col-span-2 transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
          >
            <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                  <Palette className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Personnalisation Diaporama</h3>
                  <p className="text-sm text-[#6B6B70]">Fond d&apos;écran et logo personnalisé</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section Fond d'écran */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
                    Fond d&apos;écran
                  </h4>

                  <div className="flex gap-2">
                    <Button
                      variant={formData.background_type === 'color' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData((prev) => ({ ...prev, background_type: 'color' }))}
                      className={formData.background_type === 'color'
                        ? 'bg-[#D4AF37] text-[#1A1A1E]'
                        : 'border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]'}
                    >
                      Couleur unie
                    </Button>
                    <Button
                      variant={formData.background_type === 'image' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => formData.background_image && setFormData((prev) => ({ ...prev, background_type: 'image' }))}
                      disabled={!formData.background_image}
                      className={formData.background_type === 'image'
                        ? 'bg-[#D4AF37] text-[#1A1A1E]'
                        : 'border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]'}
                    >
                      Image
                    </Button>
                  </div>

                  {formData.background_type === 'color' ? (
                    <div className="space-y-2">
                      <Label className="text-[#B0B0B5] text-sm">Couleur de fond</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.background_color}
                          onChange={(e) => setFormData((prev) => ({ ...prev, background_color: e.target.value }))}
                          className="w-12 h-10 rounded border border-[rgba(255,255,255,0.1)] cursor-pointer bg-transparent"
                        />
                        <Input
                          value={formData.background_color}
                          onChange={(e) => setFormData((prev) => ({ ...prev, background_color: e.target.value }))}
                          className="flex-1 bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white font-mono"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.background_image ? (
                        <div className="relative">
                          <img
                            src={getStorageUrl(formData.background_image) || ''}
                            alt="Background"
                            className="w-full h-24 object-cover rounded-lg border border-[rgba(255,255,255,0.1)]"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2 h-7 w-7 p-0"
                            onClick={handleRemoveBackground}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}

                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <Label className="text-[#B0B0B5] text-sm">Opacité overlay</Label>
                          <span className="text-sm text-[#D4AF37] font-semibold">
                            {formData.background_opacity}%
                          </span>
                        </div>
                        <Slider
                          value={[formData.background_opacity]}
                          onValueChange={([value]) =>
                            setFormData((prev) => ({ ...prev, background_opacity: value }))
                          }
                          min={0}
                          max={100}
                          step={5}
                          className="[&_[role=slider]]:bg-[#D4AF37]"
                        />
                      </div>
                    </div>
                  )}

                  <input
                    ref={bgInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadBackground}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bgInputRef.current?.click()}
                    disabled={uploadingBg}
                    className="w-full border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]"
                  >
                    {uploadingBg ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {formData.background_image ? 'Changer l\'image' : 'Uploader une image'}
                  </Button>
                </div>

                {/* Section Logo */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#D4AF37]" />
                    Logo personnalisé
                  </h4>

                  <div className="flex items-center gap-4">
                    {formData.custom_logo ? (
                      <div className="relative">
                        <img
                          src={getStorageUrl(formData.custom_logo) || ''}
                          alt="Logo"
                          className="h-16 w-auto object-contain bg-[#2E2E33] rounded-lg p-2"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0"
                          onClick={handleRemoveLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-20 w-20 bg-[#2E2E33] rounded-lg flex items-center justify-center border border-dashed border-[rgba(255,255,255,0.2)]">
                        <Image src="/images/animajet_logo_principal.png" alt="AnimaJet" width={50} height={50} />
                      </div>
                    )}
                    <p className="text-xs text-[#6B6B70]">
                      {formData.custom_logo ? 'Logo personnalisé actif' : 'Logo AnimaJet par défaut'}
                    </p>
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadLogo}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="w-full border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {formData.custom_logo ? 'Changer le logo' : 'Uploader un logo'}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[#B0B0B5] text-sm">Taille</Label>
                      <Select
                        value={formData.logo_size}
                        onValueChange={(value: LogoSize) =>
                          setFormData((prev) => ({ ...prev, logo_size: value }))
                        }
                      >
                        <SelectTrigger className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)]">
                          <SelectItem value="small">Petit</SelectItem>
                          <SelectItem value="medium">Moyen</SelectItem>
                          <SelectItem value="large">Grand</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[#B0B0B5] text-sm">Position</Label>
                      <Select
                        value={formData.logo_position}
                        onValueChange={(value: LogoPosition) =>
                          setFormData((prev) => ({ ...prev, logo_position: value }))
                        }
                      >
                        <SelectTrigger className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)]">
                          <SelectItem value="bottom-left">Bas gauche</SelectItem>
                          <SelectItem value="top-center">Haut centre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Messages - pleine largeur */}
          <motion.div
            whileHover={{ scale: 1.001 }}
            className="card-gold rounded-xl lg:col-span-2 transition-all duration-200 hover:border-[#9C27B0]/50 hover:shadow-[0_0_20px_rgba(156,39,176,0.15)]"
          >
            <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#9C27B0]/10 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-[#9C27B0]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Messages</h3>
                  <p className="text-xs text-[#6B6B70]">Messages texte dans le diaporama</p>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white text-sm">Activer les messages</Label>
                    <p className="text-xs text-[#6B6B70]">
                      Permettre aux invités d&apos;envoyer des messages
                    </p>
                  </div>
                  <Switch
                    checked={formData.messages_enabled}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, messages_enabled: checked }))
                    }
                  />
                </div>

                {formData.messages_enabled && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[#B0B0B5] text-sm">Fréquence d&apos;affichage</Label>
                        <span className="text-sm text-[#D4AF37] font-semibold">
                          Toutes les {formData.messages_frequency} photos
                        </span>
                      </div>
                      <Slider
                        value={[formData.messages_frequency]}
                        onValueChange={([value]) =>
                          setFormData((prev) => ({ ...prev, messages_frequency: value }))
                        }
                        min={2}
                        max={10}
                        step={1}
                        className="[&_[role=slider]]:bg-[#D4AF37]"
                      />
                      <p className="text-xs text-[#6B6B70]">
                        Un message sera affiché toutes les X photos
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[#B0B0B5] text-sm">Durée d&apos;affichage</Label>
                        <span className="text-sm text-[#D4AF37] font-semibold">
                          {formData.messages_duration}s
                        </span>
                      </div>
                      <Slider
                        value={[formData.messages_duration]}
                        onValueChange={([value]) =>
                          setFormData((prev) => ({ ...prev, messages_duration: value }))
                        }
                        min={5}
                        max={15}
                        step={1}
                        className="[&_[role=slider]]:bg-[#D4AF37]"
                      />
                      <p className="text-xs text-[#6B6B70]">
                        Temps d&apos;affichage de chaque message
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Borne Photo - pleine largeur */}
          <motion.div
            whileHover={{ scale: 1.001 }}
            className="card-gold rounded-xl lg:col-span-2 transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
          >
            <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                  <Tablet className="h-4 w-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Borne Photo</h3>
                  <p className="text-xs text-[#6B6B70]">Paramètres de la tablette</p>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-white text-sm">Compte à rebours</Label>
                      <p className="text-xs text-[#6B6B70]">Avant la capture</p>
                    </div>
                    <Switch
                      checked={formData.borne_countdown}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, borne_countdown: checked }))
                      }
                    />
                  </div>
                  {formData.borne_countdown && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-[#B0B0B5] text-xs">Durée</Label>
                        <span className="text-xs text-[#D4AF37] font-semibold">
                          {formData.borne_countdown_duration}s
                        </span>
                      </div>
                      <Slider
                        value={[formData.borne_countdown_duration]}
                        onValueChange={([value]) =>
                          setFormData((prev) => ({ ...prev, borne_countdown_duration: value }))
                        }
                        min={1}
                        max={10}
                        step={1}
                        className="[&_[role=slider]]:bg-[#D4AF37]"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-[#B0B0B5] text-sm">Délai retour caméra</Label>
                    <span className="text-sm text-[#D4AF37] font-semibold">
                      {formData.borne_return_delay}s
                    </span>
                  </div>
                  <Slider
                    value={[formData.borne_return_delay]}
                    onValueChange={([value]) =>
                      setFormData((prev) => ({ ...prev, borne_return_delay: value }))
                    }
                    min={3}
                    max={10}
                    step={1}
                    className="[&_[role=slider]]:bg-[#D4AF37]"
                  />
                  <p className="text-xs text-[#6B6B70]">
                    Retour auto après envoi
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[#B0B0B5] text-sm">Caméra par défaut</Label>
                  <Select
                    value={formData.borne_default_camera}
                    onValueChange={(value: CameraType) =>
                      setFormData((prev) => ({ ...prev, borne_default_camera: value }))
                    }
                  >
                    <SelectTrigger className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)]">
                      <SelectItem value="front">Frontale (selfie)</SelectItem>
                      <SelectItem value="back">Arrière</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between pt-2">
                    <Label className="text-white text-xs">Nom événement</Label>
                    <Switch
                      checked={formData.borne_show_event_name}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, borne_show_event_name: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 text-xs border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
                    onClick={() => router.push('/admin/borne')}
                  >
                    <Tablet className="h-3.5 w-3.5 mr-1.5" />
                    Gérer la borne
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
