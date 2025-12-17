'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  SkipForward,
  Monitor,
  Music,
  Volume2,
  VolumeX,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface PhotoSlot {
  url: string
  preview: string
  audioUrl?: string
  audioPreview?: string
}

export default function MysteryPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const [launching, setLaunching] = useState(false)

  // Mystery Photo settings
  const [mysteryPhotoGrid, setMysteryPhotoGrid] = useState<MysteryPhotoGrid>('12x8')
  const [mysteryPhotoSpeed, setMysteryPhotoSpeed] = useState<MysteryPhotoSpeed>('medium')

  // Multi-photo support (20 photos max)
  const [photos, setPhotos] = useState<(PhotoSlot | null)[]>(Array(20).fill(null))

  // Game state (realtime)
  const [gameActive, setGameActive] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(1)
  const [revealedTiles, setRevealedTiles] = useState<number[]>([])

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const audioInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const audioPreviewRefs = useRef<(HTMLAudioElement | null)[]>([])
  const [uploadingAudio, setUploadingAudio] = useState<number | null>(null)
  const [playingAudio, setPlayingAudio] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Calculate total tiles
  const [cols, rows] = mysteryPhotoGrid.split('x').map(Number)
  const totalTiles = cols * rows

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
      setMysteryPhotoGrid(data.mystery_photo_grid ?? '12x8')
      setMysteryPhotoSpeed(data.mystery_photo_speed ?? 'medium')
      setGameActive(data.mystery_photo_active ?? false)
      setIsPlaying(data.mystery_is_playing ?? false)
      setCurrentRound(data.mystery_current_round ?? 1)
      setTotalRounds(data.mystery_total_rounds ?? 1)
      setRevealedTiles(data.mystery_revealed_tiles ?? [])

      // Load photos
      if (data.mystery_photos) {
        try {
          const parsedPhotos = JSON.parse(data.mystery_photos)
          const photoSlots: (PhotoSlot | null)[] = Array(20).fill(null)
          parsedPhotos.forEach((p: { url: string; audioUrl?: string }, index: number) => {
            if (index < 20 && p.url) {
              const { data: urlData } = supabase.storage.from('photos').getPublicUrl(p.url)
              const slot: PhotoSlot = { url: p.url, preview: urlData.publicUrl }
              if (p.audioUrl) {
                const { data: audioUrlData } = supabase.storage.from('photos').getPublicUrl(p.audioUrl)
                slot.audioUrl = p.audioUrl
                slot.audioPreview = audioUrlData.publicUrl
              }
              photoSlots[index] = slot
            }
          })
          setPhotos(photoSlots)
        } catch {
          console.error('Failed to parse mystery_photos')
        }
      }
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
      .channel(`mystery-admin-${session.id}`)
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
          setGameActive(updated.mystery_photo_active ?? false)
          setIsPlaying(updated.mystery_is_playing ?? false)
          setCurrentRound(updated.mystery_current_round ?? 1)
          setTotalRounds(updated.mystery_total_rounds ?? 1)
          setRevealedTiles(updated.mystery_revealed_tiles ?? [])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id, supabase])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    setUploading(index)
    try {
      // Compress image
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })

      const fileName = `mystery_${session.id}_${index}_${Date.now()}.${compressedFile.name.split('.').pop()}`
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

      // Update local state
      const newPhotos = [...photos]
      newPhotos[index] = { url: filePath, preview: urlData.publicUrl }
      setPhotos(newPhotos)

      // Save to database
      await savePhotosToDatabase(newPhotos)

      toast.success(`Photo ${index + 1} uploadée`)
    } catch (err) {
      console.error('Error uploading file:', err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(null)
      if (fileInputRefs.current[index]) {
        fileInputRefs.current[index]!.value = ''
      }
    }
  }

  async function removePhoto(index: number) {
    if (!session) return

    const photo = photos[index]
    if (!photo) return

    try {
      // Delete photo and audio from storage
      const filesToDelete = [photo.url]
      if (photo.audioUrl) {
        filesToDelete.push(photo.audioUrl)
      }
      await supabase.storage.from('photos').remove(filesToDelete)

      // Update local state
      const newPhotos = [...photos]
      newPhotos[index] = null
      setPhotos(newPhotos)

      // Save to database
      await savePhotosToDatabase(newPhotos)

      toast.success(`Photo ${index + 1} supprimée`)
    } catch (err) {
      console.error('Error removing photo:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    // Vérifier le type de fichier
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format audio non supporté (MP3, WAV, OGG)')
      return
    }

    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier audio trop volumineux (max 10MB)')
      return
    }

    setUploadingAudio(index)
    try {
      const fileName = `mystery_audio_${session.id}_${index}_${Date.now()}.${file.name.split('.').pop()}`
      const filePath = `mystery-audio/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath)

      // Update local state
      const newPhotos = [...photos]
      if (newPhotos[index]) {
        newPhotos[index] = {
          ...newPhotos[index]!,
          audioUrl: filePath,
          audioPreview: urlData.publicUrl
        }
        setPhotos(newPhotos)

        // Save to database
        await savePhotosToDatabase(newPhotos)

        toast.success(`Audio ajouté à la photo ${index + 1}`)
      }
    } catch (err) {
      console.error('Error uploading audio:', err)
      toast.error('Erreur lors de l\'upload audio')
    } finally {
      setUploadingAudio(null)
      if (audioInputRefs.current[index]) {
        audioInputRefs.current[index]!.value = ''
      }
    }
  }

  async function removeAudio(index: number) {
    if (!session) return

    const photo = photos[index]
    if (!photo?.audioUrl) return

    try {
      // Delete audio from storage
      await supabase.storage.from('photos').remove([photo.audioUrl])

      // Update local state
      const newPhotos = [...photos]
      newPhotos[index] = {
        ...newPhotos[index]!,
        audioUrl: undefined,
        audioPreview: undefined
      }
      setPhotos(newPhotos)

      // Save to database
      await savePhotosToDatabase(newPhotos)

      // Stop playing if this audio was playing
      if (playingAudio === index) {
        setPlayingAudio(null)
      }

      toast.success(`Audio supprimé de la photo ${index + 1}`)
    } catch (err) {
      console.error('Error removing audio:', err)
      toast.error('Erreur lors de la suppression audio')
    }
  }

  function toggleAudioPreview(index: number) {
    const audio = audioPreviewRefs.current[index]
    if (!audio) return

    if (playingAudio === index) {
      audio.pause()
      setPlayingAudio(null)
    } else {
      // Pause any other playing audio
      audioPreviewRefs.current.forEach((a, i) => {
        if (a && i !== index) a.pause()
      })
      audio.currentTime = 0
      audio.play()
      setPlayingAudio(index)
    }
  }

  async function savePhotosToDatabase(photoSlots: (PhotoSlot | null)[]) {
    if (!session) return

    const photosJson = photoSlots
      .filter(p => p !== null)
      .map(p => ({
        url: p!.url,
        audioUrl: p!.audioUrl || null
      }))

    await supabase
      .from('sessions')
      .update({
        mystery_photos: JSON.stringify(photosJson),
        mystery_total_rounds: photosJson.length || 1,
      })
      .eq('id', session.id)
  }

  async function saveSettings() {
    if (!session) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
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
    if (!session) return

    const validPhotos = photos.filter(p => p !== null)
    if (validPhotos.length === 0) {
      toast.error('Ajoutez au moins une photo')
      return
    }

    setLaunching(true)
    try {
      // Désactiver tous les autres jeux avant d'activer Photo Mystère
      const { error } = await supabase
        .from('sessions')
        .update({
          // Désactiver les autres jeux
          lineup_active: false,
          wheel_active: false,
          // Activer Photo Mystère
          mystery_photo_active: true,
          mystery_photo_enabled: true,
          mystery_is_playing: false,
          mystery_current_round: 1,
          mystery_total_rounds: validPhotos.length,
          mystery_revealed_tiles: [],
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      toast.success('Jeu lancé!')

      // Open slideshow in new tab
      window.open(`/live/${session.code}`, '_blank')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function togglePlayPause() {
    if (!session) return

    const newIsPlaying = !isPlaying
    await supabase
      .from('sessions')
      .update({ mystery_is_playing: newIsPlaying })
      .eq('id', session.id)

    setIsPlaying(newIsPlaying)
  }

  async function revealAll() {
    if (!session) return

    const allTiles = Array.from({ length: totalTiles }, (_, i) => i)
    await supabase
      .from('sessions')
      .update({
        mystery_revealed_tiles: allTiles,
        mystery_is_playing: false,
      })
      .eq('id', session.id)

    setRevealedTiles(allTiles)
    setIsPlaying(false)
  }

  async function resetCurrentRound() {
    if (!session) return

    await supabase
      .from('sessions')
      .update({
        mystery_revealed_tiles: [],
        mystery_is_playing: false,
      })
      .eq('id', session.id)

    setRevealedTiles([])
    setIsPlaying(false)
  }

  async function nextRound() {
    if (!session || currentRound >= totalRounds) return

    const newRound = currentRound + 1
    await supabase
      .from('sessions')
      .update({
        mystery_current_round: newRound,
        mystery_revealed_tiles: [],
        mystery_is_playing: false,
      })
      .eq('id', session.id)

    setCurrentRound(newRound)
    setRevealedTiles([])
    setIsPlaying(false)
  }

  // Trigger winner animation on slideshow
  async function triggerWinnerAnimation() {
    if (!session) return

    // Broadcast winner event to slideshow
    const channel = supabase.channel(`mystery-winner-${session.code}`)
    await channel.subscribe()

    await channel.send({
      type: 'broadcast',
      event: 'mystery_winner',
      payload: { startAnimation: true }
    })

    toast.success('Animation de victoire lancée !')

    // Cleanup channel after a short delay
    setTimeout(() => {
      supabase.removeChannel(channel)
    }, 1000)
  }

  async function exitGame() {
    if (!session) return

    // Ne PAS supprimer les photos/audio - on garde la configuration !
    // On désactive juste le jeu et reset l'état de la partie
    await supabase
      .from('sessions')
      .update({
        mystery_photo_active: false,
        mystery_is_playing: false,
        mystery_current_round: 1,
        mystery_revealed_tiles: [],
        // On garde mystery_photos et mystery_total_rounds intacts !
      })
      .eq('id', session.id)

    // Reset local state (mais photos reste intact car chargé depuis DB)
    setGameActive(false)
    setIsPlaying(false)
    setCurrentRound(1)
    setRevealedTiles([])

    toast.success('Jeu arrêté - Configuration conservée')

    // Retour à la liste des jeux
    router.push('/admin/jeux')
  }

  // Fonction pour supprimer toutes les données (photos, audio)
  async function clearAllData() {
    if (!session) return

    // Demander confirmation
    if (!window.confirm('Supprimer toutes les photos et audio ? Cette action est irréversible.')) {
      return
    }

    // Delete photos and audio from storage
    const filesToDelete: string[] = []
    photos.filter(p => p !== null).forEach(p => {
      filesToDelete.push(p!.url)
      if (p!.audioUrl) {
        filesToDelete.push(p!.audioUrl)
      }
    })
    if (filesToDelete.length > 0) {
      await supabase.storage.from('photos').remove(filesToDelete)
    }

    // Reset ALL game data
    await supabase
      .from('sessions')
      .update({
        mystery_photo_active: false,
        mystery_photo_enabled: false,
        mystery_is_playing: false,
        mystery_current_round: 1,
        mystery_total_rounds: 1,
        mystery_revealed_tiles: [],
        mystery_photo_state: null,
        mystery_photos: null,
      })
      .eq('id', session.id)

    // Reset local state
    setGameActive(false)
    setIsPlaying(false)
    setCurrentRound(1)
    setRevealedTiles([])
    setPhotos(Array(20).fill(null))

    toast.success('Toutes les données ont été supprimées')
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

  const validPhotosCount = photos.filter(p => p !== null).length

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#0D0D0F]">
      {/* Header */}
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)]">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/jeux')}
              className="text-white hover:text-[#D4AF37]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h1 className="text-lg font-bold text-white">Photo Mystère</h1>
                <p className="text-xs text-gray-400">{session.name}</p>
              </div>
            </div>
          </div>
          {gameActive && (
            <Button
              size="sm"
              onClick={() => window.open(`/live/${session.code}`, '_blank')}
              className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Diaporama
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="w-full px-4 py-4">
        {gameActive ? (
          /* Remote Control Panel */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl border-2 border-[#D4AF37] overflow-hidden"
          >
            {/* Header compact */}
            <div className="p-4 bg-gradient-to-br from-[#D4AF37]/10 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-white font-bold">
                    Jeu en cours - Manche {currentRound}/{totalRounds}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-black/40 backdrop-blur px-3 py-1 rounded-lg">
                  <span className="text-[#D4AF37] text-lg font-bold">{revealedTiles.length}/{totalTiles}</span>
                  <span className="text-white/60 text-xs">cases</span>
                </div>
              </div>

              {/* Preview miniature */}
              <div className="bg-[#1A1A1E] rounded-lg overflow-hidden relative mb-4 h-[200px]">
                {photos[currentRound - 1]?.preview && (
                  <img
                    src={photos[currentRound - 1]!.preview}
                    alt="Current photo"
                    className="w-full h-full object-cover opacity-40"
                  />
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(revealedTiles.length / totalTiles) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Control buttons */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <button
                  onClick={togglePlayPause}
                  className={`py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                    isPlaying
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPlaying ? 'PAUSE' : 'PLAY'}
                </button>

                <button
                  onClick={revealAll}
                  className="py-3 bg-[#D4AF37] hover:bg-[#F4D03F] text-[#1A1A1E] rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all"
                >
                  <Eye className="h-4 w-4" />
                  Révéler
                </button>

                <button
                  onClick={nextRound}
                  disabled={currentRound >= totalRounds}
                  className="py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SkipForward className="h-4 w-4" />
                  Suivante
                </button>

                <button
                  onClick={resetCurrentRound}
                  className="py-3 bg-[#3E3E43] hover:bg-[#4E4E53] text-white rounded-lg font-bold text-sm flex items-center justify-center gap-1.5 transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>

              {/* Winner & Quit buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={triggerWinnerAnimation}
                  className="py-3 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                >
                  🏆 GAGNANT !
                </button>

                <button
                  onClick={exitGame}
                  className="py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <StopCircle className="h-4 w-4" />
                  Quitter
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl p-4 space-y-4 w-full"
          >
            {/* Compact photo grid 5x4 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-white text-sm">
                  Photos à deviner (1 à 20 manches)
                </Label>
                <span className="text-xs text-[#6B6B70]">
                  {validPhotosCount}/20 photos
                  {photos.filter(p => p?.audioUrl).length > 0 && (
                    <span className="ml-1 text-[#D4AF37]">
                      • {photos.filter(p => p?.audioUrl).length} audio
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-4 w-full">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className={`
                      aspect-square rounded-xl border-2 relative overflow-hidden cursor-pointer
                      transition-all duration-200 group
                      ${photo
                        ? 'border-[#D4AF37]'
                        : 'border-dashed border-[#3E3E43] hover:border-[#D4AF37]/50 bg-[#1A1A1E]'
                      }
                    `}
                    onClick={() => {
                      if (!uploading && !photo) {
                        fileInputRefs.current[index]?.click()
                      }
                    }}
                  >
                    {uploading === index ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1E]">
                        <Loader2 className="h-4 w-4 text-[#D4AF37] animate-spin" />
                      </div>
                    ) : uploadingAudio === index ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1E]">
                        <Loader2 className="h-4 w-4 text-[#D4AF37] animate-spin" />
                      </div>
                    ) : photo ? (
                      <>
                        {/* Photo thumbnail */}
                        <img
                          src={photo.preview}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Number badge */}
                        <div className="absolute top-1 left-1 bg-[#D4AF37] text-[#1A1A1E] text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center shadow-lg">
                          {index + 1}
                        </div>

                        {/* Audio indicator */}
                        {photo.audioUrl && (
                          <div className="absolute top-1 right-1 bg-emerald-500 text-white w-6 h-6 rounded-lg flex items-center justify-center shadow-lg">
                            <Volume2 className="h-3.5 w-3.5" />
                          </div>
                        )}

                        {/* Hover overlay with actions */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                          {/* Audio button */}
                          {photo.audioUrl ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleAudioPreview(index)
                              }}
                              className={`p-2 rounded-lg ${playingAudio === index ? 'bg-[#D4AF37] text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}
                              title={playingAudio === index ? "Stop" : "Play audio"}
                            >
                              {playingAudio === index ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                audioInputRefs.current[index]?.click()
                              }}
                              className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30"
                              title="Ajouter audio"
                            >
                              <Music className="h-5 w-5" />
                            </button>
                          )}

                          {/* Delete buttons row */}
                          <div className="flex gap-2">
                            {photo.audioUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeAudio(index)
                                }}
                                className="p-1.5 rounded-lg bg-orange-500/80 text-white hover:bg-orange-500"
                                title="Supprimer audio"
                              >
                                <VolumeX className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removePhoto(index)
                              }}
                              className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500"
                              title="Supprimer photo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Hidden audio element */}
                        {photo.audioUrl && (
                          <audio
                            ref={(el) => { audioPreviewRefs.current[index] = el }}
                            src={photo.audioPreview}
                            onEnded={() => setPlayingAudio(null)}
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#6B6B70] group-hover:text-[#D4AF37]/70 transition-colors">
                        <span className="text-sm font-bold mb-1">{index + 1}</span>
                        <Upload className="h-6 w-6" />
                      </div>
                    )}

                    {/* Hidden file inputs */}
                    <input
                      ref={(el) => { fileInputRefs.current[index] = el }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, index)}
                      className="hidden"
                    />
                    <input
                      ref={(el) => { audioInputRefs.current[index] = el }}
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3,.mp3,.wav,.ogg"
                      onChange={(e) => handleAudioUpload(e, index)}
                      className="hidden"
                    />
                  </div>
                ))}
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
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sauvegarder les paramètres
            </Button>

            {/* Launch button */}
            <Button
              onClick={launchGame}
              disabled={validPhotosCount === 0 || launching}
              className="w-full py-6 text-lg font-bold bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#1A1A1E] hover:opacity-90 disabled:opacity-50"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Play className="h-5 w-5 mr-2" />
              )}
              Lancer le jeu ({validPhotosCount} manche{validPhotosCount > 1 ? 's' : ''})
            </Button>

            {/* Clear data button */}
            {validPhotosCount > 0 && (
              <Button
                onClick={clearAllData}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer toutes les photos ({validPhotosCount})
              </Button>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
