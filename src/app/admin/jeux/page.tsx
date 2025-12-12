'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Play,
  Pause,
  Eye,
  RotateCcw,
  StopCircle,
  Gamepad2,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { Session, MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'

export default function JeuxPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [launching, setLaunching] = useState(false)

  // Mystery Photo settings
  const [mysteryPhotoEnabled, setMysteryPhotoEnabled] = useState(false)
  const [mysteryPhotoUrl, setMysteryPhotoUrl] = useState<string | null>(null)
  const [mysteryPhotoGrid, setMysteryPhotoGrid] = useState<MysteryPhotoGrid>('8x6')
  const [mysteryPhotoSpeed, setMysteryPhotoSpeed] = useState<MysteryPhotoSpeed>('medium')
  const [mysteryPhotoActive, setMysteryPhotoActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      setSession(data)

      // Initialize state from session
      setMysteryPhotoEnabled(data.mystery_photo_enabled ?? false)
      setMysteryPhotoUrl(data.mystery_photo_url ?? null)
      setMysteryPhotoGrid(data.mystery_photo_grid ?? '8x6')
      setMysteryPhotoSpeed(data.mystery_photo_speed ?? 'medium')
      setMysteryPhotoActive(data.mystery_photo_active ?? false)
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  // Subscribe to session changes for real-time game state updates
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel(`jeux-session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as Session
          setMysteryPhotoActive(updated.mystery_photo_active ?? false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id, supabase])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    setUploading(true)
    try {
      // Compress image
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })

      const fileName = `mystery_${session.id}_${Date.now()}.${compressedFile.name.split('.').pop()}`
      const filePath = `mystery-photos/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, compressedFile)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath)

      setMysteryPhotoUrl(filePath)

      // Save to database
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ mystery_photo_url: filePath })
        .eq('id', session.id)

      if (updateError) throw updateError

      toast.success('Photo uploadée avec succès')
    } catch (err) {
      console.error('Error uploading file:', err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function removePhoto() {
    if (!session || !mysteryPhotoUrl) return

    try {
      // Delete from storage
      await supabase.storage.from('photos').remove([mysteryPhotoUrl])

      // Update database
      const { error } = await supabase
        .from('sessions')
        .update({ mystery_photo_url: null })
        .eq('id', session.id)

      if (error) throw error

      setMysteryPhotoUrl(null)
      toast.success('Photo supprimée')
    } catch (err) {
      console.error('Error removing photo:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  async function saveSettings() {
    if (!session) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          mystery_photo_enabled: mysteryPhotoEnabled,
          mystery_photo_grid: mysteryPhotoGrid,
          mystery_photo_speed: mysteryPhotoSpeed,
        })
        .eq('id', session.id)

      if (error) throw error
      toast.success('Paramètres sauvegardés')
    } catch (err) {
      console.error('Error saving settings:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function launchGame() {
    if (!session || !mysteryPhotoUrl) return

    setLaunching(true)
    try {
      // Initialize game state
      const [cols, rows] = mysteryPhotoGrid.split('x').map(Number)
      const totalTiles = cols * rows
      const initialState = {
        tiles: Array.from({ length: totalTiles }, (_, i) => ({
          id: i,
          revealed: false,
        })),
        isPlaying: false,
        revealedCount: 0,
      }

      const { error } = await supabase
        .from('sessions')
        .update({
          mystery_photo_active: true,
          mystery_photo_state: JSON.stringify(initialState),
        })
        .eq('id', session.id)

      if (error) throw error

      setMysteryPhotoActive(true)
      toast.success('Jeu lancé sur le diaporama!')

      // Open the slideshow in a new tab
      window.open(`/live/${session.code}`, '_blank')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function stopGame() {
    if (!session) return

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          mystery_photo_active: false,
          mystery_photo_state: null,
        })
        .eq('id', session.id)

      if (error) throw error

      setMysteryPhotoActive(false)
      toast.success('Jeu arrêté')
    } catch (err) {
      console.error('Error stopping game:', err)
      toast.error('Erreur lors de l\'arrêt')
    }
  }

  function getPhotoUrl(storagePath: string | null) {
    if (!storagePath) return null
    const { data } = supabase.storage.from('photos').getPublicUrl(storagePath)
    return data.publicUrl
  }

  const gridOptions = [
    { value: '6x4', label: '6x4 (24 cases) - Très facile' },
    { value: '8x6', label: '8x6 (48 cases) - Facile' },
    { value: '10x8', label: '10x8 (80 cases) - Moyen' },
    { value: '12x8', label: '12x8 (96 cases) - Difficile' },
    { value: '15x10', label: '15x10 (150 cases) - Très difficile' },
    { value: '20x12', label: '20x12 (240 cases) - Expert' },
  ]

  const speedOptions = [
    { value: 'slow', label: 'Lent (3s par case)' },
    { value: 'medium', label: 'Moyen (2s par case)' },
    { value: 'fast', label: 'Rapide (1s par case)' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Aucune session trouvée</p>
          <Button onClick={() => router.push('/admin/dashboard')}>
            Retour au dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1A1A1E]">
      {/* Header */}
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/dashboard')}
              className="text-white hover:text-[#D4AF37]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                <Gamepad2 className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Jeux</h1>
                <p className="text-sm text-[#6B6B70]">{session.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Photo Mystère Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl border border-[#D4AF37]/20 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center">
                  <Search className="h-7 w-7 text-[#D4AF37]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Photo Mystère</h2>
                  <p className="text-[#6B6B70] text-sm">Les invités devinent la photo cachée</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="mystery-enabled" className="text-white text-sm">
                  {mysteryPhotoEnabled ? 'Activé' : 'Désactivé'}
                </Label>
                <Switch
                  id="mystery-enabled"
                  checked={mysteryPhotoEnabled}
                  onCheckedChange={(checked) => {
                    setMysteryPhotoEnabled(checked)
                  }}
                  className="data-[state=checked]:bg-[#D4AF37]"
                />
              </div>
            </div>

            {/* Game Status Banner */}
            {mysteryPhotoActive && (
              <div className="bg-gradient-to-r from-[#D4AF37]/20 to-[#F4D03F]/10 px-6 py-3 flex items-center justify-between border-b border-[#D4AF37]/20">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-[#4CAF50] rounded-full animate-pulse" />
                  <span className="text-[#D4AF37] font-semibold">Jeu en cours sur le diaporama</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopGame}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Arrêter le jeu
                </Button>
              </div>
            )}

            {/* Configuration */}
            {mysteryPhotoEnabled && (
              <div className="p-6 space-y-6">
                {/* Upload zone */}
                <div>
                  <Label className="text-white text-sm mb-3 block">Photo à deviner</Label>
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                      transition-all duration-200
                      ${mysteryPhotoUrl
                        ? 'border-[#D4AF37]/40 bg-[#D4AF37]/5'
                        : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/5'
                      }
                    `}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-12 w-12 text-[#D4AF37] animate-spin mb-3" />
                        <p className="text-[#6B6B70]">Upload en cours...</p>
                      </div>
                    ) : mysteryPhotoUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={getPhotoUrl(mysteryPhotoUrl) || ''}
                          alt="Photo mystère"
                          className="max-h-48 rounded-lg shadow-lg"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removePhoto()
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-12 w-12 text-[#D4AF37] mx-auto mb-3" />
                        <p className="text-[#6B6B70]">Cliquez ou glissez une photo</p>
                        <p className="text-[#6B6B70]/60 text-sm mt-1">PNG, JPG jusqu'à 10MB</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Settings grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white text-sm mb-2 block">Nombre de cases</Label>
                    <Select
                      value={mysteryPhotoGrid}
                      onValueChange={(value) => setMysteryPhotoGrid(value as MysteryPhotoGrid)}
                    >
                      <SelectTrigger className="w-full bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)]">
                        {gridOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="text-white hover:bg-[#D4AF37]/10 focus:bg-[#D4AF37]/10"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-2 block">Vitesse de dévoilement</Label>
                    <Select
                      value={mysteryPhotoSpeed}
                      onValueChange={(value) => setMysteryPhotoSpeed(value as MysteryPhotoSpeed)}
                    >
                      <SelectTrigger className="w-full bg-[#2E2E33] border-[rgba(255,255,255,0.1)] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2E2E33] border-[rgba(255,255,255,0.1)]">
                        {speedOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className="text-white hover:bg-[#D4AF37]/10 focus:bg-[#D4AF37]/10"
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Save button */}
                <Button
                  onClick={saveSettings}
                  disabled={saving}
                  variant="outline"
                  className="w-full border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33] hover:text-[#D4AF37]"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Sauvegarder les paramètres
                </Button>

                {/* Launch button */}
                {!mysteryPhotoActive ? (
                  <Button
                    onClick={launchGame}
                    disabled={!mysteryPhotoUrl || launching}
                    className="w-full py-6 text-lg font-bold bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#1A1A1E] hover:opacity-90 disabled:opacity-50"
                  >
                    {launching ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Play className="h-5 w-5 mr-2" />
                    )}
                    Lancer le jeu sur le diaporama
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => window.open(`/live/${session.code}`, '_blank')}
                      className="py-6 text-lg font-bold bg-[#2E2E33] text-white hover:bg-[#3E3E43] border border-[rgba(255,255,255,0.1)]"
                    >
                      <Eye className="h-5 w-5 mr-2" />
                      Voir le diaporama
                    </Button>
                    <Button
                      onClick={stopGame}
                      className="py-6 text-lg font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                    >
                      <StopCircle className="h-5 w-5 mr-2" />
                      Arrêter le jeu
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Disabled state */}
            {!mysteryPhotoEnabled && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#2E2E33] flex items-center justify-center">
                  <Search className="h-8 w-8 text-[#6B6B70]" />
                </div>
                <p className="text-[#6B6B70]">
                  Activez Photo Mystère pour configurer le jeu
                </p>
              </div>
            )}
          </motion.div>

          {/* More games coming soon */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#242428]/50 rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] p-8 text-center"
          >
            <Gamepad2 className="h-12 w-12 text-[#6B6B70]/50 mx-auto mb-3" />
            <p className="text-[#6B6B70]">D'autres jeux arrivent bientôt...</p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
