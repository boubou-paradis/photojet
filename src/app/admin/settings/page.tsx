'use client'

import { useState, useEffect } from 'react'
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
import { Session, TransitionType, CameraType } from '@/types/database'
import { generateSessionCode } from '@/lib/image-utils'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    moderation_enabled: true,
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
  })

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      setFormData({
        name: selectedSession.name,
        code: selectedSession.code,
        moderation_enabled: selectedSession.moderation_enabled,
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

  function handleRegenerateCode() {
    setFormData((prev) => ({ ...prev, code: generateSessionCode() }))
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
        <p className="text-[#B0B0B5]">Aucune session sélectionnée</p>
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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Informations générales */}
          <div className="card-gold rounded-xl">
            <div className="p-5 border-b border-[rgba(255,255,255,0.1)]">
              <h3 className="text-lg font-semibold text-white">Informations générales</h3>
              <p className="text-sm text-[#6B6B70] mt-1">
                Configurez les informations de base de votre événement
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#B0B0B5]">Nom de l&apos;événement</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Mariage de Jean et Marie"
                  className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-[#6B6B70]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-[#B0B0B5]">Code session</Label>
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
                <p className="text-sm text-[#6B6B70]">
                  Code à 4 chiffres que les invités utiliseront pour accéder
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires" className="text-[#B0B0B5]">Date d&apos;expiration</Label>
                <Input
                  id="expires"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Session active</Label>
                  <p className="text-sm text-[#6B6B70]">
                    Désactivez pour empêcher les nouveaux uploads
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
          </div>

          {/* Modération */}
          <div className="card-gold rounded-xl">
            <div className="p-5 border-b border-[rgba(255,255,255,0.1)]">
              <h3 className="text-lg font-semibold text-white">Modération</h3>
              <p className="text-sm text-[#6B6B70] mt-1">
                Contrôlez comment les photos sont validées
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Modération activée</Label>
                  <p className="text-sm text-[#6B6B70]">
                    Les photos doivent être approuvées avant d&apos;apparaître
                  </p>
                </div>
                <Switch
                  checked={formData.moderation_enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, moderation_enabled: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Diaporama */}
          <div className="card-gold rounded-xl">
            <div className="p-5 border-b border-[rgba(255,255,255,0.1)]">
              <h3 className="text-lg font-semibold text-white">Diaporama</h3>
              <p className="text-sm text-[#6B6B70] mt-1">
                Personnalisez l&apos;affichage du diaporama
              </p>
            </div>
            <div className="p-5 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Afficher le QR code</Label>
                  <p className="text-sm text-[#6B6B70]">
                    Affiche le QR code sur l&apos;écran du diaporama
                  </p>
                </div>
                <Switch
                  checked={formData.show_qr_on_screen}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, show_qr_on_screen: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#B0B0B5]">Type de transition</Label>
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

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-[#B0B0B5]">Durée entre les photos</Label>
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
                <p className="text-sm text-[#6B6B70]">
                  Entre 3 et 15 secondes
                </p>
              </div>
            </div>
          </div>

          {/* Borne Photo */}
          <div className="card-gold rounded-xl">
            <div className="p-5 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                  <Tablet className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Borne Photo</h3>
                  <p className="text-sm text-[#6B6B70]">
                    Paramètres de la borne photo (tablette)
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Compte à rebours</Label>
                  <p className="text-sm text-[#6B6B70]">
                    Affiche un compte à rebours avant la capture
                  </p>
                </div>
                <Switch
                  checked={formData.borne_countdown}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, borne_countdown: checked }))
                  }
                />
              </div>

              {formData.borne_countdown && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[#B0B0B5]">Durée du compte à rebours</Label>
                    <span className="text-sm text-[#D4AF37] font-semibold">
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

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-[#B0B0B5]">Délai retour caméra</Label>
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
                <p className="text-sm text-[#6B6B70]">
                  Temps avant retour automatique à la caméra après envoi
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[#B0B0B5]">Caméra par défaut</Label>
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
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Afficher le nom de l&apos;événement</Label>
                  <p className="text-sm text-[#6B6B70]">
                    Affiche le nom en haut de l&apos;écran de la borne
                  </p>
                </div>
                <Switch
                  checked={formData.borne_show_event_name}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, borne_show_event_name: checked }))
                  }
                />
              </div>

              <Button
                variant="outline"
                className="w-full border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#F4D03F]"
                onClick={() => router.push('/admin/borne')}
              >
                <Tablet className="h-4 w-4 mr-2" />
                Gérer la borne photo
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
