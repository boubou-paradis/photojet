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
  Download,
  FileUp,
} from 'lucide-react'
import Image from 'next/image'
import localFont from 'next/font/local'
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
import { compressAudio, needsAudioCompression } from '@/lib/audio-utils'
import { TransferError } from '@/lib/games/mystery-transfer/format'
import {
  applyImport,
  checkExportAccess,
  exportGame,
  isValidGrid,
  isValidSpeed,
  readGameSnapshot,
  type GameSnapshot,
  type PreparedImport,
  type TransferProgress,
} from '@/lib/games/mystery-transfer/transfer'
import { SUBSCRIBE_HREF } from '@/lib/watermark/constants'
import PhotoCropModal from './PhotoCropModal'
import { MysteryExportModal, MysteryImportModal } from './MysteryTransferModals'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import type { RemoteLegendData } from '@/components/games/RemoteLegend'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import rg from './regie.module.css'

// Titre façon carte du jeu (même police que les régies du Bon Ordre et de la Roue)
const cardFont = localFont({ src: './fonts/Anton-Regular.ttf', display: 'swap' })

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
  const [croppingGrid, setCroppingGrid] = useState<{ cols: number; rows: number } | null>(null)

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

  // Export / import d'une partie complète dans un fichier .zip
  const [exportSnapshot, setExportSnapshot] = useState<GameSnapshot | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)

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

    // pagehide (pas beforeunload) : ne part que si la page part vraiment,
    // après un éventuel « Annuler » sur la boîte de useLeaveGuard.
    window.addEventListener('pagehide', cleanup)

    return () => {
      window.removeEventListener('pagehide', cleanup)
      cleanup()
    }
  }, [session?.id, supabase])

  // Étape 1 : sélection du fichier → ouvre la modale de recadrage (pas d'upload direct)
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    // Relit la grille RÉELLEMENT en base (pas mysteryPhotoGrid, state local
    // d'édition pouvant diverger tant que "Enregistrer les paramètres" n'a
    // pas été cliqué) — même principe que revealAll(). Sans ça, une photo
    // recadrée juste après un changement de grille non sauvegardé exporte
    // un ratio différent de celui que le jeu utilisera réellement.
    const { data: currentSession } = await supabase
      .from('sessions')
      .select('mystery_photo_grid')
      .eq('id', session.id)
      .single()
    const [dbCols, dbRows] = (currentSession?.mystery_photo_grid || mysteryPhotoGrid).split('x').map(Number)

    setCroppingGrid({ cols: dbCols, rows: dbRows })
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
    setCroppingGrid(null)
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

      // Compress image — les tuiles de la grille (12x8 par défaut) sont petites
      // à l'affichage, 1920px/2 Mo (sans initialQuality, donc qualité 1.0 par
      // défaut) était largement surdimensionné pour ce qui sera réellement rendu.
      const compressedFile = await imageCompression(croppedFile, {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1280,
        initialQuality: 0.85,
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
      // Delete photo and audio from storage (sauf si encore utilisés dans la bibliothèque)
      const filesToDelete = [photo.url]
      if (photo.audioUrl) {
        filesToDelete.push(photo.audioUrl)
      }
      const safeToDelete = await filterPathsSafeToDelete(filesToDelete)
      if (safeToDelete.length > 0) {
        await supabase.storage.from('photos').remove(safeToDelete)
      }

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
      const fileToUpload = needsAudioCompression(file) ? await compressAudio(file) : file
      const fileName = `mystery_audio_${session.id}_${index}_${Date.now()}.${fileToUpload.name.split('.').pop()}`
      const filePath = `mystery-audio/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, fileToUpload)

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
      // Delete audio from storage (sauf si encore utilisé dans la bibliothèque)
      const safeToDelete = await filterPathsSafeToDelete([photo.audioUrl])
      if (safeToDelete.length > 0) {
        await supabase.storage.from('photos').remove(safeToDelete)
      }

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
      const fileToUpload = needsAudioCompression(file) ? await compressAudio(file) : file
      const fileName = `mystery_reveal_${session.id}_${Date.now()}.${fileToUpload.name.split('.').pop()}`
      const filePath = `mystery-audio/${fileName}`

      // Delete old file if exists (sauf si encore utilisé dans la bibliothèque)
      if (revealAudio?.url) {
        const safeToDelete = await filterPathsSafeToDelete([revealAudio.url])
        if (safeToDelete.length > 0) {
          await supabase.storage.from('photos').remove(safeToDelete)
        }
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, fileToUpload)

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
      // Delete from storage (sauf si encore utilisé dans la bibliothèque)
      const safeToDelete = await filterPathsSafeToDelete([revealAudio.url])
      if (safeToDelete.length > 0) {
        await supabase.storage.from('photos').remove(safeToDelete)
      }

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

  // Empêche de supprimer physiquement du Storage un fichier encore référencé
  // par un jeu de la bibliothèque (saved_mysteries.photos / reveal_audio_url
  // pointent vers les MÊMES fichiers que la session, pas des copies) : sans ce
  // filtre, éditer/supprimer une photo dans la session courante casse
  // silencieusement et définitivement tout jeu sauvegardé qui l'utilise
  // encore. RLS restreint déjà la requête aux jeux de l'utilisateur courant.
  async function filterPathsSafeToDelete(paths: string[]): Promise<string[]> {
    const candidates = paths.filter(Boolean)
    if (candidates.length === 0) return []
    const { data, error } = await supabase
      .from('saved_mysteries')
      .select('photos, reveal_audio_url')
    if (error) {
      console.error('Error checking library references before delete:', error)
      return [] // prudence : en cas de doute, ne rien supprimer
    }
    const used = new Set<string>()
    for (const row of (data || []) as { photos: SavedMysteryPhoto[] | null; reveal_audio_url: string | null }[]) {
      if (row.reveal_audio_url) used.add(row.reveal_audio_url)
      for (const p of row.photos || []) {
        if (p.url) used.add(p.url)
        if (p.audioUrl) used.add(p.audioUrl)
      }
    }
    const skipped = candidates.filter((p) => used.has(p))
    if (skipped.length > 0) {
      toast.info(
        `${skipped.length} fichier${skipped.length > 1 ? 's' : ''} conservé${skipped.length > 1 ? 's' : ''} en Storage (encore utilisé${skipped.length > 1 ? 's' : ''} dans votre bibliothèque)`
      )
    }
    return candidates.filter((p) => !used.has(p))
  }

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
    if (uploading !== null || uploadingAudio !== null || uploadingRevealAudio) {
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
      if (!session) return
      // Grille et vitesse relues en base : le menu déroulant peut ne pas être
      // enregistré, et c'est la valeur en base que le jeu utilise.
      const { grid, speed } = await readGameSnapshot(supabase, session.id)
      const photosToSave: SavedMysteryPhoto[] = validPhotos.map((p) => ({
        url: p.url,
        audioUrl: p.audioUrl || null,
      }))
      const { error } = await supabase
        .from('saved_mysteries')
        .insert({
          user_id: user.id,
          name,
          photos: photosToSave,
          reveal_audio_url: revealAudio?.url || null,
          grid,
          speed,
        })

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
  async function handleLoadMystery(saved: SavedMystery) {
    if (!session) return
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
    await savePhotosToDatabase(photoSlots)

    // Restaure l'audio de fond (musique de révélation) sauvegardé avec le jeu,
    // sur le même modèle que les audios par photo ci-dessus.
    if (saved.reveal_audio_url) {
      const { data: revealUrlData } = supabase.storage.from('photos').getPublicUrl(saved.reveal_audio_url)
      setRevealAudio({ url: saved.reveal_audio_url, preview: revealUrlData.publicUrl })
    } else {
      setRevealAudio(null)
    }

    // Un jeu sauvegardé avant l'ajout de ces colonnes n'a ni grille ni vitesse :
    // la session garde alors les siennes, comme auparavant.
    const savedGrid = isValidGrid(saved.grid) ? saved.grid : null
    const savedSpeed = isValidSpeed(saved.speed) ? saved.speed : null
    await supabase
      .from('sessions')
      .update({
        mystery_reveal_audio: saved.reveal_audio_url || null,
        ...(savedGrid && { mystery_photo_grid: savedGrid }),
        ...(savedSpeed && { mystery_photo_speed: savedSpeed }),
      })
      .eq('id', session.id)
    if (savedGrid) setMysteryPhotoGrid(savedGrid)
    if (savedSpeed) setMysteryPhotoSpeed(savedSpeed)

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

  // === Export / import d'une partie complète (.zip) ===

  function transfersBusy(): boolean {
    if (uploading !== null || uploadingAudio !== null || uploadingRevealAudio) {
      toast.error('Patientez la fin de l\'upload')
      return true
    }
    return false
  }

  async function openExportModal() {
    if (!session || transfersBusy()) return
    try {
      const access = await checkExportAccess()
      if (access.blocked) {
        toast.error(access.message, {
          action: { label: 'Voir les offres', onClick: () => router.push(SUBSCRIBE_HREF) },
        })
        return
      }
      const snapshot = await readGameSnapshot(supabase, session.id)
      if (snapshot.photos.length === 0) {
        toast.error('Ajoutez au moins une photo avant d\'exporter')
        return
      }
      setExportSnapshot(snapshot)
    } catch (err) {
      console.error('Error opening mystery export:', err)
      toast.error(err instanceof TransferError ? err.message : 'Erreur lors de la préparation de l\'export')
    }
  }

  async function handleExport(name: string, onProgress: TransferProgress) {
    if (!session) return
    const { blob, fileName } = await exportGame({ supabase, sessionId: session.id, name, onProgress })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    setExportSnapshot(null)
    toast.success('Partie exportée')
  }

  async function openImportModal() {
    if (!session || transfersBusy()) return
    try {
      const { active } = await readGameSnapshot(supabase, session.id)
      if (active) {
        toast.error('Une partie est en cours. Quittez-la avant d\'importer')
        return
      }
      setShowImportModal(true)
    } catch (err) {
      console.error('Error opening mystery import:', err)
      toast.error(err instanceof TransferError ? err.message : 'Erreur lors de la préparation de l\'import')
    }
  }

  // Renvoie false si l'animateur renonce à remplacer sa partie.
  async function handleImport(prepared: PreparedImport, onProgress: TransferProgress): Promise<boolean> {
    if (!session) return false
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new TransferError('Session expirée, reconnectez-vous')

    const current = await readGameSnapshot(supabase, session.id)
    const hasGame = current.photos.length > 0 || current.revealAudio !== null
    if (hasGame && !window.confirm('Importer cette partie remplacera les photos et les audios actuels. Continuer ?')) {
      return false
    }

    setImporting(true)
    try {
      const result = await applyImport({
        supabase,
        sessionId: session.id,
        userId: user.id,
        prepared,
        filterPathsSafeToDelete,
        onProgress,
      })

      const photoSlots: (PhotoSlot | null)[] = Array(20).fill(null)
      result.photos.forEach((photo, index) => {
        const slot: PhotoSlot = {
          url: photo.url,
          preview: supabase.storage.from('photos').getPublicUrl(photo.url).data.publicUrl,
        }
        if (photo.audioUrl) {
          slot.audioUrl = photo.audioUrl
          slot.audioPreview = supabase.storage.from('photos').getPublicUrl(photo.audioUrl).data.publicUrl
        }
        photoSlots[index] = slot
      })
      setPhotos(photoSlots)
      setRevealAudio(
        result.revealAudio
          ? {
              url: result.revealAudio,
              preview: supabase.storage.from('photos').getPublicUrl(result.revealAudio).data.publicUrl,
            }
          : null
      )
      setMysteryPhotoGrid(result.grid)
      setMysteryPhotoSpeed(result.speed)
      setCurrentRound(1)
      setTotalRounds(result.photos.length)
      setRevealedTiles([])
      setShowImportModal(false)
      toast.success(`Partie « ${prepared.manifest.name} » importée`)
      return true
    } finally {
      setImporting(false)
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
    await setPlaying(!isPlaying)
  }

  async function setPlaying(newIsPlaying: boolean) {
    if (!session) return

    await supabase
      .from('sessions')
      .update({ mystery_is_playing: newIsPlaying })
      .eq('id', session.id)

    setIsPlaying(newIsPlaying)
  }

  async function revealAll() {
    if (!session) return

    // Recalcule totalTiles depuis la grille RÉELLEMENT en base (pas depuis
    // mysteryPhotoGrid, qui est un state local d'édition pouvant diverger de
    // la valeur persistée tant que "Enregistrer les paramètres" n'a pas été
    // cliqué). MysteryPhotoGame.tsx (l'affichage en jeu) lit toujours la
    // valeur en base : un décalage ici laissait des tuiles non révélées en
    // bas de grille et empêchait l'audio de la photo de se déclencher
    // (les deux dépendent de revealedTiles.length === totalTiles).
    const { data: currentSession } = await supabase
      .from('sessions')
      .select('mystery_photo_grid')
      .eq('id', session.id)
      .single()
    const [dbCols, dbRows] = (currentSession?.mystery_photo_grid || mysteryPhotoGrid).split('x').map(Number)
    const dbTotalTiles = dbCols * dbRows

    const allTiles = Array.from({ length: dbTotalTiles }, (_, i) => i)
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
    if (!window.confirm('Supprimer toutes les photos et audio ? Cette action est irréversible (les fichiers encore utilisés par un jeu de votre bibliothèque seront conservés).')) {
      return
    }

    // Delete photos and audio from storage (sauf si encore utilisés dans la bibliothèque)
    const filesToDelete: string[] = []
    photos.filter(p => p !== null).forEach(p => {
      filesToDelete.push(p!.url)
      if (p!.audioUrl) {
        filesToDelete.push(p!.audioUrl)
      }
    })
    const safeToDelete = await filterPathsSafeToDelete(filesToDelete)
    if (safeToDelete.length > 0) {
      await supabase.storage.from('photos').remove(safeToDelete)
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

  // Télécommande de présentation. L'état de la manche est relu en base à chaque
  // appui (les cases sont révélées par l'écran /live, le state local peut être
  // en retard) : PageDown = PLAY → Révéler → Manche suivante, PageUp = pause /
  // reprise, B = animation GAGNANT. Reset n'est jamais mappé. Mêmes handlers
  // que les boutons.
  async function readRoundState() {
    if (!session) return null
    const { data } = await supabase
      .from('sessions')
      .select('mystery_is_playing, mystery_revealed_tiles, mystery_photo_grid, mystery_current_round, mystery_total_rounds')
      .eq('id', session.id)
      .single()
    if (!data) return null
    const [dbCols, dbRows] = (data.mystery_photo_grid || mysteryPhotoGrid).split('x').map(Number)
    const revealed = data.mystery_revealed_tiles?.length ?? 0
    return {
      isPlaying: data.mystery_is_playing ?? false,
      revealed,
      allRevealed: revealed >= dbCols * dbRows,
      round: data.mystery_current_round ?? 1,
      total: data.mystery_total_rounds ?? 1,
    }
  }

  // Partie affichée : confirmation avant rechargement (F5) ou fermeture.
  useLeaveGuard(gameActive || importing)

  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  // Une seule décision : exécutée par la touche (sur l'état relu en base au
  // moment de l'appui) ET affichée par la légende (sur l'état de la régie).
  type RoundState = { isPlaying: boolean; revealed: number; allRevealed: boolean; round: number; total: number }
  const mysteryNext = (state: RoundState): 'next_round' | 'play' | 'reveal' | null => {
    // Dernière manche, ou state local pas encore à jour : on ne fait rien.
    if (state.allRevealed) return state.round < state.total && state.round === currentRound ? 'next_round' : null
    if (!state.isPlaying && state.revealed === 0) return 'play'
    return 'reveal'
  }
  const mysteryPrev = (state: RoundState): 'pause' | 'resume' | null => {
    if (state.allRevealed) return null
    if (state.isPlaying) return 'pause'
    if (state.revealed > 0) return 'resume'
    return null
  }
  const remoteActive = gameActive && remoteOn
  const remoteBlocked = () =>
    croppingIndex !== null ||
    showSaveMysteryModal ||
    showLoadMysteryModal ||
    exportSnapshot !== null ||
    showImportModal
  useRemoteControl({
    active: remoteActive,
    phase: `${currentRound}|${isPlaying}`,
    isBlocked: remoteBlocked,
    onNext: async () => {
      const state = await readRoundState()
      if (!state) return
      const action = mysteryNext(state)
      if (action === 'next_round') { await nextRound(); return 1000 }
      if (action === 'play') { await setPlaying(true); return }
      if (action === 'reveal') { await revealAll(); return 1500 }
    },
    onPrev: async () => {
      const state = await readRoundState()
      if (!state) return
      const action = mysteryPrev(state)
      if (action === 'pause') await setPlaying(false)
      else if (action === 'resume') await setPlaying(true)
    },
    onSecondary: async () => {
      await triggerWinnerAnimation()
      return 1500
    },
  })
  const localRound: RoundState = {
    isPlaying,
    revealed: revealedTiles.length,
    allRevealed: revealedTiles.length >= cols * rows,
    round: currentRound,
    total: totalRounds,
  }
  const legendNext = mysteryNext(localRound)
  const legendPrev = mysteryPrev(localRound)
  const remoteLegend: RemoteLegendData = {
    active: remoteActive,
    blocked: remoteBlocked(),
    next: legendNext === 'next_round' ? 'manche suivante' : legendNext === 'play' ? 'lancer le dévoilement (PLAY)' : legendNext === 'reveal' ? 'révéler toute la photo' : null,
    prev: legendPrev === 'pause' ? 'mettre le dévoilement en pause' : legendPrev === 'resume' ? 'reprendre le dévoilement' : null,
    secondary: 'animation du gagnant',
  }

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

  // Habillage « régie » AnimaJet 2.0 (maquette V2 validée le 25/11/2026) — handlers et états inchangés.
  const toolCls = (...extra: string[]) => [rg.tool, ...extra].join(' ')
  const bigCls = (...extra: string[]) => [rg.big, ...extra].join(' ')

  return (
    <div className={rg.page}>
      <div className={rg.wrap}>
        {/* En-tête */}
        <header className={rg.top}>
          <button className={rg.ghost} onClick={() => router.push(`/admin/jeux?session=${session.id}`)}>
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <div className={rg.brand}>
            <div className={rg.thumb}><Image src="/images/games/photo-mystere-v2.png" alt="" fill sizes="100px" /></div>
            <div>
              <h1 className={`${rg.cardTitle} ${cardFont.className}`} data-t="PHOTO MYSTÈRE"><span>PHOTO MYSTÈRE</span></h1>
              <small>{session.name}</small>
            </div>
          </div>
        </header>

        <div className={rg.tools}>
          <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={gameActive} legend={remoteLegend} />
          <a href="/photo-mystere-regles.pdf" target="_blank" rel="noopener noreferrer" className={toolCls(rg.sep)}>
            <FileText />
            Notice
          </a>
          <button onClick={() => setShowSaveMysteryModal(true)} className={toolCls()} title="Sauvegarder ce jeu dans votre bibliothèque">
            <span aria-hidden>💾</span>
            Sauvegarder
          </button>
          <button onClick={loadSavedMysteries} className={toolCls()} title="Charger un jeu de votre bibliothèque">
            <span aria-hidden>📂</span>
            Charger
          </button>
          <button onClick={openExportModal} className={toolCls()} title="Exporter cette partie dans un fichier à partager">
            <Download />
            Exporter
          </button>
          <button
            onClick={openImportModal}
            disabled={gameActive}
            className={toolCls()}
            title={gameActive ? 'Quittez la partie en cours pour importer' : 'Importer une partie depuis un fichier'}
          >
            <FileUp />
            Importer
          </button>
          <button onClick={clearAllData} className={toolCls(rg.danger, rg.sep)} title="Supprimer toutes les photos et audio">
            <Trash2 />
            Tout vider
          </button>
          {gameActive && (
            <button onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className={toolCls(rg.violetTool)} title="Ouvrir l'écran public">
              <Monitor />
              Diaporama
            </button>
          )}
        </div>

        {gameActive ? (
          /* Partie en cours */
          <section className={rg.panel}>
            <div className={rg.status}>
              <div className={rg.st}>
                <span className={`${rg.dot} ${isPlaying ? '' : rg.dotPause}`} />
                <span>Jeu en cours - Manche {currentRound}/{totalRounds}</span>
              </div>
              <div className={rg.cases}>
                <span className={rg.g}>{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>
                <span><b>{revealedTiles.length}</b> <b>/</b> <b>{totalTiles}</b> cases</span>
              </div>
            </div>

            {/* Aperçu en pleine luminosité */}
            <div className={rg.preview}>
              {photos[currentRound - 1]?.preview && (
                <img src={photos[currentRound - 1]!.preview} alt="Photo de la manche" style={{ aspectRatio: `${cols} / ${rows}` }} />
              )}
              <div className={rg.bar}>
                <i style={{ width: `${totalTiles ? (revealedTiles.length / totalTiles) * 100 : 0}%` }} />
              </div>
            </div>

            <div className={`${rg.ctrl} ${rg.r4}`}>
              <button onClick={togglePlayPause} className={bigCls(isPlaying ? rg.pause : rg.play)}>
                {isPlaying ? <Pause /> : <Play />}
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
              <button onClick={revealAll} className={bigCls(rg.gold)}>
                <Eye />
                Révéler
              </button>
              <button onClick={nextRound} disabled={currentRound >= totalRounds} className={bigCls(rg.violet)}>
                <SkipForward />
                Suivante
              </button>
              <button onClick={resetCurrentRound} className={bigCls(rg.slate)}>
                <RotateCcw />
                Reset
              </button>
            </div>

            <div className={`${rg.ctrl} ${rg.r2}`}>
              <button onClick={triggerWinnerAnimation} className={bigCls(rg.gold)}>
                🏆 GAGNANT !
              </button>
              <button onClick={exitGame} className={bigCls(rg.red)}>
                <StopCircle />
                Quitter
              </button>
            </div>
          </section>
        ) : (
          /* Configuration */
          <section className={`${rg.panel} ${rg.cfg}`}>
            <div className={rg.box}>
              <h3 className={rg.h3}>
                <Music />
                Musique de dévoilement <em>(pendant que les cases s&apos;enlèvent)</em>
              </h3>
              {revealAudio ? (
                <div className={rg.aud}>
                  <button onClick={toggleRevealAudioPreview} className={`${rg.iconBtn} ${rg.iconGold}`} title={playingRevealAudio ? 'Stop' : 'Écouter'}>
                    {playingRevealAudio ? <Pause /> : <Play />}
                  </button>
                  <p>Audio configuré<small>Joue pendant le dévoilement</small></p>
                  <button onClick={removeRevealAudio} className={`${rg.iconBtn} ${rg.iconDel}`} title="Supprimer">
                    <Trash2 />
                  </button>
                  <audio ref={revealAudioPreviewRef} src={revealAudio.preview} onEnded={() => setPlayingRevealAudio(false)} />
                </div>
              ) : (
                <button onClick={() => revealAudioInputRef.current?.click()} disabled={uploadingRevealAudio} className={rg.addAudio}>
                  {uploadingRevealAudio ? <Loader2 className={rg.spin} /> : <Upload />}
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

            <div className={rg.slotsHead}>
              <h3 className={rg.h3}>Photos à deviner (1 à 20 manches)</h3>
              <span>
                {validPhotosCount}/20 photos
                {photos.filter(p => p?.audioUrl).length > 0 && (
                  <b> • {photos.filter(p => p?.audioUrl).length} audio</b>
                )}
              </span>
            </div>
            <div className={rg.slots}>
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className={`${rg.slot} ${photo ? rg.full : rg.empty}`}
                  style={{ aspectRatio: `${cols} / ${rows}` }}
                  onClick={() => {
                    if (!uploading && !photo) {
                      fileInputRefs.current[index]?.click()
                    }
                  }}
                >
                  {uploading === index || uploadingAudio === index ? (
                    <div className={rg.loading}>
                      <Loader2 className={rg.spin} />
                    </div>
                  ) : photo ? (
                    <>
                      <img src={photo.preview} alt={`Photo ${index + 1}`} />
                      <div className={`${rg.badge} ${rg.badgeN}`}>{index + 1}</div>
                      {photo.audioUrl && (
                        <div className={`${rg.badge} ${rg.badgeA}`}>
                          <Volume2 />
                        </div>
                      )}
                      <div className={rg.hov}>
                        {photo.audioUrl ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleAudioPreview(index) }}
                            className={`${rg.mini} ${playingAudio === index ? rg.miniOn : ''}`}
                            title={playingAudio === index ? 'Stop' : 'Play audio'}
                          >
                            {playingAudio === index ? <Pause /> : <Play />}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); audioInputRefs.current[index]?.click() }}
                            className={rg.mini}
                            title="Ajouter audio"
                          >
                            <Music />
                          </button>
                        )}
                        <div className={rg.row}>
                          {photo.audioUrl && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeAudio(index) }}
                              className={`${rg.mini} ${rg.miniO}`}
                              title="Supprimer audio"
                            >
                              <VolumeX />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removePhoto(index) }}
                            className={`${rg.mini} ${rg.miniR}`}
                            title="Supprimer photo"
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                      {photo.audioUrl && (
                        <audio
                          ref={(el) => { audioPreviewRefs.current[index] = el }}
                          src={photo.audioPreview}
                          onEnded={() => setPlayingAudio(null)}
                        />
                      )}
                    </>
                  ) : (
                    <div>
                      {index + 1}
                      <Upload />
                    </div>
                  )}

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

            <div className={rg.settings}>
              <div>
                <label>Nombre de cases</label>
                <Select value={mysteryPhotoGrid} onValueChange={(value) => setMysteryPhotoGrid(value as MysteryPhotoGrid)}>
                  <SelectTrigger className={`w-full ${rg.selTrigger}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={rg.selContent}>
                    {gridOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-[#D4AF37]/10 focus:bg-[#D4AF37]/10">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label>Vitesse de dévoilement</label>
                <Select value={mysteryPhotoSpeed} onValueChange={(value) => setMysteryPhotoSpeed(value as MysteryPhotoSpeed)}>
                  <SelectTrigger className={`w-full ${rg.selTrigger}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={rg.selContent}>
                    {speedOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-white hover:bg-[#D4AF37]/10 focus:bg-[#D4AF37]/10">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <button onClick={saveSettings} disabled={saving} className={rg.line}>
              {saving && <Loader2 className={`h-4 w-4 ${rg.spin}`} />}
              Sauvegarder les paramètres
            </button>

            <button onClick={launchGame} disabled={validPhotosCount === 0 || launching} className={bigCls(rg.gold, rg.launch)}>
              {launching ? <Loader2 className={rg.spin} /> : <Play />}
              Lancer le jeu ({validPhotosCount} manche{validPhotosCount > 1 ? 's' : ''})
            </button>
          </section>
        )}
      </div>

      {/* Modale de recadrage : ratio verrouillé sur le quadrillage RÉELLEMENT
          enregistré en base (croppingGrid, relu à l'ouverture) — pas sur
          cols/rows qui reflètent le state local d'édition, potentiellement
          non sauvegardé. */}
      {croppingImageSrc && croppingGrid && (
        <PhotoCropModal
          imageSrc={croppingImageSrc}
          gridCols={croppingGrid.cols}
          gridRows={croppingGrid.rows}
          onCancel={closeCropModal}
          onConfirm={handleCropConfirm}
        />
      )}

      {exportSnapshot && (
        <MysteryExportModal
          snapshot={exportSnapshot}
          onClose={() => setExportSnapshot(null)}
          onExport={handleExport}
        />
      )}

      {showImportModal && (
        <MysteryImportModal onClose={() => setShowImportModal(false)} onImport={handleImport} />
      )}

      {/* Modale : Sauvegarder le jeu dans la bibliothèque */}
      {showSaveMysteryModal && (
        <div className={rg.modalBg}>
          <div className={`${rg.modal} ${rg.modalSm}`}>
            <div className={rg.mHead}>
              <div>
                <div className={rg.mIco}>💾</div>
                <div>
                  <h3>Sauvegarder ce jeu</h3>
                  <p>{validPhotosCount} photo{validPhotosCount > 1 ? 's' : ''} dans votre bibliothèque</p>
                </div>
              </div>
              <button onClick={() => setShowSaveMysteryModal(false)} className={rg.mClose}>
                <X />
              </button>
            </div>
            <div className={rg.mBody}>
              <label>Nom du jeu</label>
              <input
                type="text"
                value={saveMysteryName}
                onChange={(e) => setSaveMysteryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !savingMystery) handleSaveMystery() }}
                autoFocus
                placeholder="Ex : Les plus grandes villes du monde"
              />
              <p className={rg.hint}>Supprimer une photo depuis une session la retirera aussi de ce jeu sauvegardé.</p>
            </div>
            <div className={rg.mFoot}>
              <button onClick={() => setShowSaveMysteryModal(false)}>Annuler</button>
              <button onClick={handleSaveMystery} disabled={savingMystery} className={rg.btnGoldS}>
                {savingMystery ? <Loader2 className={`h-4 w-4 ${rg.spin}`} /> : <span aria-hidden>💾</span>}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : Charger un jeu sauvegardé */}
      {showLoadMysteryModal && (
        <div className={rg.modalBg}>
          <div className={rg.modal}>
            <div className={rg.mHead}>
              <div>
                <div className={rg.mIco}>📂</div>
                <div>
                  <h3>Votre bibliothèque de jeux Photo Mystère</h3>
                  <p>Charger remplace les photos actuelles</p>
                </div>
              </div>
              <button onClick={() => setShowLoadMysteryModal(false)} className={rg.mClose}>
                <X />
              </button>
            </div>
            <div className={rg.mBody}>
              {loadingSavedMysteries ? (
                <div className={rg.emptyLib}>
                  <Loader2 className={`inline h-5 w-5 mr-2 ${rg.spin}`} /> Chargement…
                </div>
              ) : savedMysteries.length === 0 ? (
                <div className={rg.emptyLib}>
                  <div className="text-4xl mb-3">📂</div>
                  <p>Aucun jeu sauvegardé pour l&apos;instant.</p>
                  <p className="text-sm mt-1">Préparez un jeu puis cliquez sur « 💾 Sauvegarder ».</p>
                </div>
              ) : (
                savedMysteries.map((mystery) => (
                  <div key={mystery.id} className={rg.lib}>
                    <button onClick={() => handleLoadMystery(mystery)} className={rg.libMain}>
                      <h4>{mystery.name}</h4>
                      <small>
                        {(mystery.photos?.length ?? 0)} photo{(mystery.photos?.length ?? 0) > 1 ? 's' : ''}
                        {' · '}
                        {new Date(mystery.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </small>
                    </button>
                    <button onClick={() => handleLoadMystery(mystery)} className={rg.btnGoldS}>
                      Charger
                    </button>
                    <button
                      onClick={() => handleDeleteSavedMystery(mystery.id)}
                      className={`${rg.iconBtn} ${rg.iconDel}`}
                      title="Supprimer de la bibliothèque"
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className={rg.mFoot}>
              <button onClick={() => setShowLoadMysteryModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
