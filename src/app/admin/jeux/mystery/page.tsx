'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  FileText,
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
import { fetchUserSession } from '@/lib/session-select'
import { sendDeactivateBeacon } from '@/lib/games/deactivate-beacon'
import { Session, MysteryPhotoGrid, MysteryPhotoSpeed, SavedMystery, SavedMysteryPhoto } from '@/types/database'
import { toast } from 'sonner'
import imageCompression from 'browser-image-compression'
import PhotoCropModal from './PhotoCropModal'

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

  // Recadrage : fichier sélectionné en attente de validation du cadrage
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null)
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null)

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

  // Global reveal audio (plays during tile removal)
  const [revealAudio, setRevealAudio] = useState<{ url: string; preview: string } | null>(null)
  const [uploadingRevealAudio, setUploadingRevealAudio] = useState(false)
  const [playingRevealAudio, setPlayingRevealAudio] = useState(false)
  const revealAudioInputRef = useRef<HTMLInputElement | null>(null)
  const revealAudioPreviewRef = useRef<HTMLAudioElement | null>(null)

  // Bibliothèque personnelle de jeux Photo Mystère (saved_mysteries)
  const [showSaveMysteryModal, setShowSaveMysteryModal] = useState(false)
  const [showLoadMysteryModal, setShowLoadMysteryModal] = useState(false)
  const [saveMysteryName, setSaveMysteryName] = useState('')
  const [savingMystery, setSavingMystery] = useState(false)
  const [savedMysteries, setSavedMysteries] = useState<SavedMystery[]>([])
  const [loadingSavedMysteries, setLoadingSavedMysteries] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const winnerChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Calculate total tiles
  const [cols, rows] = mysteryPhotoGrid.split('x').map(Number)
  const totalTiles = cols * rows

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const data = await fetchUserSession(supabase, user.id, searchParams.get('session'))
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

      // Load global reveal audio
      if (data.mystery_reveal_audio) {
        const { data: audioUrlData } = supabase.storage.from('photos').getPublicUrl(data.mystery_reveal_audio)
        setRevealAudio({ url: data.mystery_reveal_audio, preview: audioUrlData.publicUrl })
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

  // Canal dédié à l'animation gagnant (stable, pas recréé à chaque appel)
  useEffect(() => {
    if (!session?.code) return
    const channel = supabase.channel(`mystery-winner-${session.code}`)
    winnerChannelRef.current = channel
    channel.subscribe()
    return () => {
      channel.unsubscribe()
      winnerChannelRef.current = null
    }
  }, [session?.code, supabase])

  // Cleanup : désactiver le jeu quand l'admin quitte la page (navigation SPA
  // ET fermeture d'onglet). ATTENTION : un builder supabase non awaité/then
  // n'exécute JAMAIS sa requête (thenable paresseux) — d'où le .then() explicite.
  useEffect(() => {
    if (!session?.id) return

    const cleanup = () => {
      // sendBeacon survit à la fermeture de l'onglet ; un fetch await ici est
      // souvent tué en vol → mystery_photo_active resterait bloqué à true en base.
      if (!sendDeactivateBeacon(session.id, 'mystery')) {
        void supabase
          .from('sessions')
          .update({ mystery_photo_active: false, mystery_is_playing: false })
          .eq('id', session.id)
          .then(() => {})
      }
    }

    window.addEventListener('beforeunload', cleanup)

    return () => {
      window.removeEventListener('beforeunload', cleanup)
      cleanup()
    }
  }, [session?.id, supabase])

  // Étape 1 : sélection du fichier → ouvre la modale de recadrage (pas d'upload direct)
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file || !session) return
    setCroppingImageSrc(URL.createObjectURL(file))
    setCroppingIndex(index)
  }

  // Ferme la modale de recadrage et réinitialise l'input file (pour pouvoir
  // resélectionner le même fichier ensuite) sans upload — utilisé par
  // l'annulation ET après une validation réussie.
  function closeCropModal() {
    if (croppingImageSrc) URL.revokeObjectURL(croppingImageSrc)
    const indexToReset = croppingIndex
    setCroppingImageSrc(null)
    setCroppingIndex(null)
    if (indexToReset !== null && fileInputRefs.current[indexToReset]) {
      fileInputRefs.current[indexToReset]!.value = ''
    }
  }

  // Étape 2 : validation du recadrage → pipeline d'upload existant, inchangé
  // à partir d'ici (compression, Storage, sauvegarde session).
  async function handleCropConfirm(blob: Blob) {
    const index = croppingIndex
    if (index === null || !session) return
    closeCropModal()

    setUploading(index)
    try {
      const croppedFile = new File([blob], `mystery-crop-${Date.now()}.jpg`, { type: 'image/jpeg' })

      // Compress image
      const compressedFile = await imageCompression(croppedFile, {
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

    // Vérifier la taille (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier audio trop volumineux (max 50MB)')
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
      // Also pause reveal audio preview
      if (revealAudioPreviewRef.current) {
        revealAudioPreviewRef.current.pause()
        setPlayingRevealAudio(false)
      }
      audio.currentTime = 0
      audio.play()
      setPlayingAudio(index)
    }
  }

  // ---- GLOBAL REVEAL AUDIO FUNCTIONS ----
  async function handleRevealAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    // Check file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format audio non supporté (MP3, WAV, OGG)')
      return
    }

    // Check size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier audio trop volumineux (max 50MB)')
      return
    }

    setUploadingRevealAudio(true)
    try {
      const fileName = `mystery_reveal_${session.id}_${Date.now()}.${file.name.split('.').pop()}`
      const filePath = `mystery-audio/${fileName}`

      // Delete old file if exists
      if (revealAudio?.url) {
        await supabase.storage.from('photos').remove([revealAudio.url])
      }

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
      setRevealAudio({ url: filePath, preview: urlData.publicUrl })

      // Save to database
      await supabase
        .from('sessions')
        .update({ mystery_reveal_audio: filePath })
        .eq('id', session.id)

      toast.success('Audio de dévoilement ajouté')
    } catch (err) {
      console.error('Error uploading reveal audio:', err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploadingRevealAudio(false)
      if (revealAudioInputRef.current) {
        revealAudioInputRef.current.value = ''
      }
    }
  }

  async function removeRevealAudio() {
    if (!session || !revealAudio) return

    try {
      // Delete from storage
      await supabase.storage.from('photos').remove([revealAudio.url])

      // Update database
      await supabase
        .from('sessions')
        .update({ mystery_reveal_audio: null })
        .eq('id', session.id)

      // Update local state
      setRevealAudio(null)
      setPlayingRevealAudio(false)

      toast.success('Audio de dévoilement supprimé')
    } catch (err) {
      console.error('Error removing reveal audio:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  function toggleRevealAudioPreview() {
    const audio = revealAudioPreviewRef.current
    if (!audio) return

    if (playingRevealAudio) {
      audio.pause()
      setPlayingRevealAudio(false)
    } else {
      // Pause any photo audio
      audioPreviewRefs.current.forEach(a => a?.pause())
      setPlayingAudio(null)
      audio.currentTime = 0
      audio.play()
      setPlayingRevealAudio(true)
    }
  }

  // === Bibliothèque personnelle de jeux Photo Mystère (saved_mysteries) ===

  // Sauvegarder le jeu courant (toutes les photos valides, dans l'ordre) dans la bibliothèque de l'utilisateur
  async function handleSaveMystery() {
    const name = saveMysteryName.trim()
    if (!name) {
      toast.error('Donnez un nom à votre jeu')
      return
    }
    const validPhotos = photos.filter((p): p is PhotoSlot => p !== null)
    if (validPhotos.length === 0) {
      toast.error('Ajoutez au moins une photo avant de sauvegarder')
      return
    }
    if (uploading !== null) {
      toast.error('Patientez la fin de l\'upload avant de sauvegarder')
      return
    }

    setSavingMystery(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Session expirée, reconnectez-vous')
        return
      }
      const photosToSave: SavedMysteryPhoto[] = validPhotos.map((p) => ({
        url: p.url,
        audioUrl: p.audioUrl || null,
      }))
      const { error } = await supabase
        .from('saved_mysteries')
        .insert({ user_id: user.id, name, photos: photosToSave })

      if (error) throw error

      toast.success('Jeu sauvegardé dans votre bibliothèque ✅')
      setShowSaveMysteryModal(false)
      setSaveMysteryName('')
    } catch (err) {
      console.error('Error saving mystery:', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingMystery(false)
    }
  }

  // Charger la liste des jeux sauvegardés de l'utilisateur (RLS = seulement les siens)
  async function loadSavedMysteries() {
    setShowLoadMysteryModal(true)
    setLoadingSavedMysteries(true)
    try {
      const { data, error } = await supabase
        .from('saved_mysteries')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSavedMysteries((data as SavedMystery[]) || [])
    } catch (err) {
      console.error('Error loading saved mysteries:', err)
      toast.error('Erreur lors du chargement de la bibliothèque')
      setSavedMysteries([])
    } finally {
      setLoadingSavedMysteries(false)
    }
  }

  // Charger un jeu sauvegardé dans l'éditeur (remplace les photos actuelles de la session courante)
  function handleLoadMystery(saved: SavedMystery) {
    if (!window.confirm('Charger ce jeu remplacera les photos actuelles. Continuer ?')) return

    const photoSlots: (PhotoSlot | null)[] = Array(20).fill(null)
    ;(saved.photos || []).forEach((p, index) => {
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
    savePhotosToDatabase(photoSlots)
    setShowLoadMysteryModal(false)
    const count = saved.photos?.length ?? 0
    toast.success(`Jeu « ${saved.name} » chargé (${count} photo${count > 1 ? 's' : ''})`)
  }

  // Supprimer un jeu de la bibliothèque (ligne DB uniquement — les fichiers Storage
  // peuvent encore être utilisés par une session active, donc jamais supprimés ici)
  async function handleDeleteSavedMystery(id: string) {
    if (!window.confirm('Supprimer définitivement ce jeu de votre bibliothèque ?')) return
    try {
      const { error } = await supabase.from('saved_mysteries').delete().eq('id', id)
      if (error) throw error
      setSavedMysteries((prev) => prev.filter((m) => m.id !== id))
      toast.success('Jeu supprimé de la bibliothèque')
    } catch (err) {
      console.error('Error deleting saved mystery:', err)
      toast.error('Erreur lors de la suppression')
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
      window.open(`/live/${session.code}`, 'photojet-live')
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
    if (!session || !winnerChannelRef.current) return

    await winnerChannelRef.current.send({
      type: 'broadcast',
      event: 'mystery_winner',
      payload: { startAnimation: true },
    })

    toast.success('Animation de victoire lancée !')
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
    router.push(`/admin/jeux?session=${session.id}`)
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
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
            <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-cyan-400" />
          </div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </motion.div>
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
    <div className="min-h-screen bg-[#0D0D0F] overflow-hidden">
      {/* Animated background effects - Gold/Violet premium theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/jeux?session=${session.id}`)}
              className="text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 flex items-center justify-center">
                <span className="text-xl">🔍</span>
                <div className="absolute inset-0 rounded-xl bg-cyan-400/20 blur-xl opacity-50" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Photo Mystère</h1>
                <p className="text-xs text-gray-500">{session.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/photo-mystere-regles.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 border border-cyan-400/30 hover:border-cyan-400">
                <FileText className="h-4 w-4 mr-2" />
                Notice
              </Button>
            </a>
            <button
              onClick={() => setShowSaveMysteryModal(true)}
              className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
              title="Sauvegarder ce jeu dans votre bibliothèque"
            >
              <span aria-hidden>💾</span>
              Sauvegarder
            </button>
            <button
              onClick={loadSavedMysteries}
              className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
              title="Charger un jeu de votre bibliothèque"
            >
              <span aria-hidden>📂</span>
              Charger
            </button>
            {gameActive && (
              <Button
                size="sm"
                onClick={() => window.open(`/live/${session.code}`, 'photojet-live')}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                <Monitor className="h-4 w-4 mr-2" />
                Diaporama
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-8 py-6">
        {gameActive ? (
          /* Remote Control Panel */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-gold rounded-xl border-2 border-[#D4AF37] overflow-hidden hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] transition-all duration-300"
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
              <div className="bg-black rounded-lg overflow-hidden relative mb-4 flex items-center justify-center" style={{ minHeight: '250px', maxHeight: '350px' }}>
                {photos[currentRound - 1]?.preview && (
                  <img
                    src={photos[currentRound - 1]!.preview}
                    alt="Current photo"
                    className="max-w-full max-h-[350px] object-contain opacity-40"
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
            className="card-gold rounded-xl p-4 space-y-4 w-full hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] transition-all duration-300"
          >
            {/* Global Reveal Audio Section */}
            <div className="bg-[#1A1A1E] rounded-xl p-4 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Music className="h-5 w-5 text-cyan-400" />
                <Label className="text-white text-sm font-semibold">
                  Musique de dévoilement
                </Label>
                <span className="text-xs text-cyan-400/70">(pendant que les cases s'enlèvent)</span>
              </div>

              {revealAudio ? (
                <div className="flex items-center gap-3 bg-[#242428] rounded-lg p-3">
                  <button
                    onClick={toggleRevealAudioPreview}
                    className={`p-3 rounded-lg transition-all ${
                      playingRevealAudio
                        ? 'bg-cyan-500 text-white'
                        : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                    }`}
                  >
                    {playingRevealAudio ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">Audio configuré</p>
                    <p className="text-cyan-400/70 text-xs">Joue pendant le dévoilement</p>
                  </div>
                  <button
                    onClick={removeRevealAudio}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <audio
                    ref={revealAudioPreviewRef}
                    src={revealAudio.preview}
                    onEnded={() => setPlayingRevealAudio(false)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => revealAudioInputRef.current?.click()}
                  disabled={uploadingRevealAudio}
                  className="w-full py-4 border-2 border-dashed border-cyan-500/30 rounded-lg text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex items-center justify-center gap-2"
                >
                  {uploadingRevealAudio ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                  Ajouter une musique de fond
                </button>
              )}
              <input
                ref={revealAudioInputRef}
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3,.mp3,.wav,.ogg"
                onChange={handleRevealAudioUpload}
                className="hidden"
              />
            </div>

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
                      onChange={(e) => handleFileSelect(e, index)}
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

      {/* Modale de recadrage : ratio verrouillé sur le quadrillage de tuiles actuel */}
      {croppingImageSrc && (
        <PhotoCropModal
          imageSrc={croppingImageSrc}
          gridCols={cols}
          gridRows={rows}
          onCancel={closeCropModal}
          onConfirm={handleCropConfirm}
        />
      )}

      {/* Modale : Sauvegarder le jeu dans la bibliothèque */}
      {showSaveMysteryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-md w-full overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 text-lg">💾</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Sauvegarder ce jeu</h3>
                  <p className="text-sm text-gray-400">{validPhotosCount} photo{validPhotosCount > 1 ? 's' : ''} dans votre bibliothèque</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveMysteryModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <label className="text-gray-400 text-xs">Nom du jeu</label>
              <input
                type="text"
                value={saveMysteryName}
                onChange={(e) => setSaveMysteryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !savingMystery) handleSaveMystery() }}
                autoFocus
                placeholder="Ex : Les plus grandes villes du monde"
                className="w-full bg-[#2E2E33] text-white rounded-lg px-3 py-2.5 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none mt-1"
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowSaveMysteryModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveMystery}
                disabled={savingMystery}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-xl font-bold hover:from-[#F4D03F] hover:to-[#D4AF37] flex items-center gap-2 transition-all duration-200 disabled:opacity-60"
              >
                {savingMystery ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden>💾</span>}
                Sauvegarder
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modale : Charger un jeu sauvegardé */}
      {showLoadMysteryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 text-lg">📂</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Votre bibliothèque de jeux Photo Mystère</h3>
                  <p className="text-sm text-gray-400">Charger remplace les photos actuelles</p>
                </div>
              </div>
              <button
                onClick={() => setShowLoadMysteryModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSavedMysteries ? (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
                </div>
              ) : savedMysteries.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">📂</div>
                  <p>Aucun jeu sauvegardé pour l&apos;instant.</p>
                  <p className="text-sm text-gray-500 mt-1">Préparez un jeu puis cliquez sur « 💾 Sauvegarder ».</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedMysteries.map((mystery) => (
                    <div
                      key={mystery.id}
                      className="card-gold rounded-xl p-4 flex items-center justify-between gap-3 hover:border-[#D4AF37]/50 transition-all duration-200"
                    >
                      <button
                        onClick={() => handleLoadMystery(mystery)}
                        className="flex-1 text-left group"
                      >
                        <h4 className="text-white font-bold group-hover:text-[#D4AF37] transition-colors">{mystery.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(mystery.photos?.length ?? 0)} photo{(mystery.photos?.length ?? 0) > 1 ? 's' : ''}
                          {' · '}
                          {new Date(mystery.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </button>
                      <button
                        onClick={() => handleLoadMystery(mystery)}
                        className="shrink-0 px-3 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-lg font-bold text-sm hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all duration-200"
                      >
                        Charger
                      </button>
                      <button
                        onClick={() => handleDeleteSavedMystery(mystery.id)}
                        className="shrink-0 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Supprimer de la bibliothèque"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowLoadMysteryModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
