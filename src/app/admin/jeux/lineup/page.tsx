'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import localFont from 'next/font/local'
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Users,
  Monitor,
  SkipForward,
  X,
  Music,
  Volume2,
  VolumeX,
  Upload,
  Trash2,
  FileText,
  Check,
  Sparkles,
  Timer,
  EyeOff,
  Rocket,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { fetchUserSession } from '@/lib/session-select'
import { sendDeactivateBeacon } from '@/lib/games/deactivate-beacon'
import { Session, WheelAudioSettings } from '@/types/database'
import { toast } from 'sonner'
import { compressAudio, needsAudioCompression } from '@/lib/audio-utils'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import type { RemoteLegendData } from '@/components/games/RemoteLegend'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import rg from './regie.module.css'

// Lettrage de la carte du jeu (Anton, licence OFL, hébergée dans le projet : aucun appel à Google)
// Réglages audio du Bon Ordre (colonne lineup_audio, JSON) : musique + bruitages de l'écran public.
// sfxEnabled absent = bruitages activés (aucune migration : simple clé ajoutée au JSON existant).
type LineupAudioSettings = WheelAudioSettings & { sfxEnabled?: boolean }

const cardFont = localFont({ src: './fonts/Anton-Regular.ttf', display: 'swap' })

// Égaliseur décoratif de la carte « Musique du jeu » (hauteurs fixes, aucun calcul au rendu)
const EQ_BARS = Array.from({ length: 26 }, (_, i) => ({ h: 18 + ((i * 37) % 32), d: -(i % 7) * 0.17 }))

export default function LineupPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [clockDuration, setClockDuration] = useState(60)
  const [team1Name, setTeam1Name] = useState('Équipe 1')
  const [team2Name, setTeam2Name] = useState('Équipe 2')

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [team1Score, setTeam1Score] = useState(0)
  const [team2Score, setTeam2Score] = useState(0)
  const [currentNumber, setCurrentNumber] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [currentPoints, setCurrentPoints] = useState(10)
  const [showWinner, setShowWinner] = useState(false)

  // Audio state
  const [audioSettings, setAudioSettings] = useState<LineupAudioSettings>({
    url: null,
    enabled: true,
    filename: null,
  })
  const [audioUploading, setAudioUploading] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Refs to store the latest values for the timer interval (avoid stale closures)
  const currentNumberRef = useRef(currentNumber)
  const team1ScoreRef = useRef(team1Score)
  const team2ScoreRef = useRef(team2Score)
  const team1NameRef = useRef(team1Name)
  const team2NameRef = useRef(team2Name)
  const audioSettingsRef = useRef(audioSettings)
  const currentPointsRef = useRef(currentPoints)
  const timeLeftRef = useRef(timeLeft)
  const awardPointsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync with state
  useEffect(() => { currentNumberRef.current = currentNumber }, [currentNumber])
  useEffect(() => { team1ScoreRef.current = team1Score }, [team1Score])
  useEffect(() => { team2ScoreRef.current = team2Score }, [team2Score])
  useEffect(() => { team1NameRef.current = team1Name }, [team1Name])
  useEffect(() => { team2NameRef.current = team2Name }, [team2Name])
  useEffect(() => { audioSettingsRef.current = audioSettings }, [audioSettings])
  useEffect(() => { currentPointsRef.current = currentPoints }, [currentPoints])
  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`lineup-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Cleanup: désactiver le jeu quand l'admin quitte la page
  useEffect(() => {
    if (!session?.id) return

    const cleanup = () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'lineup_state',
          payload: { gameActive: false, currentNumber: '', timeLeft: 0, isRunning: false, isPaused: false, isGameOver: false, currentPoints: 10, team1Score: 0, team2Score: 0, team1Name: 'Équipe 1', team2Name: 'Équipe 2', showWinner: false, clockDuration: 60 },
        })
      }
      // sendBeacon survit à la fermeture de l'onglet ; un fetch await ici est
      // souvent tué en vol → lineup_active resterait bloqué à true en base.
      if (!sendDeactivateBeacon(session.id, 'lineup')) {
        void supabase.from('sessions').update({ lineup_active: false }).eq('id', session.id).then(() => {})
      }
    }

    // pagehide (pas beforeunload) : ne part que si la page part vraiment,
    // après un éventuel « Annuler » sur la boîte de useLeaveGuard.
    window.addEventListener('pagehide', cleanup)

    return () => {
      if (awardPointsTimeoutRef.current) { clearTimeout(awardPointsTimeoutRef.current); awardPointsTimeoutRef.current = null }
      window.removeEventListener('pagehide', cleanup)
      cleanup()
    }
  }, [session?.id, supabase])

  // Broadcast game state to slideshow
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    currentNumber: string
    timeLeft: number
    isRunning: boolean
    isPaused: boolean
    isGameOver: boolean
    currentPoints: number
    team1Score: number
    team2Score: number
    team1Name: string
    team2Name: string
    showWinner: boolean
    clockDuration: number
    audioSettings?: WheelAudioSettings
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'lineup_state',
        payload: state,
      })
    }
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

      // Initialize state from session - use defaults if game not active
      if (data.lineup_active) {
        setGameActive(true)
        setClockDuration(data.lineup_clock_duration ?? 60)
        setTeam1Name(data.lineup_team1_name ?? 'Équipe 1')
        setTeam2Name(data.lineup_team2_name ?? 'Équipe 2')
        setTeam1Score(data.lineup_team1_score ?? 0)
        setTeam2Score(data.lineup_team2_score ?? 0)
        setCurrentNumber(data.lineup_current_number ?? '')
        setTimeLeft(data.lineup_time_left ?? 60)
        setIsRunning(data.lineup_is_running ?? false)
        setIsPaused(data.lineup_is_paused ?? false)
        setIsGameOver(data.lineup_is_game_over ?? false)
        setCurrentPoints(data.lineup_current_points ?? 10)
        setShowWinner(data.lineup_show_winner ?? false)
        // Charger les paramètres audio
        if (data.lineup_audio) {
          try {
            setAudioSettings(JSON.parse(data.lineup_audio))
          } catch {
            // Keep default
          }
        }
      } else {
        // Game not active - use defaults
        setGameActive(false)
        setClockDuration(60)
        setTeam1Name('Équipe 1')
        setTeam2Name('Équipe 2')
        setTeam1Score(0)
        setTeam2Score(0)
        setCurrentNumber('')
        setTimeLeft(60)
        setIsRunning(false)
        setIsPaused(false)
        setIsGameOver(false)
        setCurrentPoints(10)
        setShowWinner(false)
        // Charger les paramètres audio même si jeu non actif
        if (data.lineup_audio) {
          try {
            setAudioSettings(JSON.parse(data.lineup_audio))
          } catch {
            // Keep default
          }
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  // Historique des numéros récents pour éviter les répétitions
  const recentNumbersRef = useRef<string[]>([])

  // Generate random number with variable length (3-5 digits, weighted toward 5)
  const generateNumber = useCallback(() => {
    // Weighted distribution: 3 chiffres (10%), 4 chiffres (20%), 5 chiffres (70%)
    const rand = Math.random()
    let length: number
    if (rand < 0.1) {
      length = 3
    } else if (rand < 0.3) {
      length = 4
    } else {
      length = 5
    }

    // Fonction pour générer un numéro unique
    const generate = (): string => {
      // Pool de chiffres disponibles (1-5 uniquement pour 5 participants)
      const allDigits = [1, 2, 3, 4, 5]

      // Fisher-Yates shuffle sur tous les chiffres
      for (let i = allDigits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[allDigits[i], allDigits[j]] = [allDigits[j], allDigits[i]]
      }

      // Prendre les N premiers chiffres
      return allDigits.slice(0, length).join('')
    }

    // Essayer de générer un numéro qui n'est pas dans l'historique récent
    let newNumber = generate()
    let attempts = 0
    while (recentNumbersRef.current.includes(newNumber) && attempts < 10) {
      newNumber = generate()
      attempts++
    }

    // Ajouter à l'historique (garder les 20 derniers)
    recentNumbersRef.current.push(newNumber)
    if (recentNumbersRef.current.length > 20) {
      recentNumbersRef.current.shift()
    }

    return newNumber
  }, [])

  // Audio functions
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez MP3, WAV ou OGG.')
      return
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50MB)')
      return
    }

    setAudioUploading(true)
    try {
      // Delete old audio if exists
      if (audioSettings.url) {
        const oldPath = audioSettings.url.split('/').pop()
        if (oldPath) {
          await supabase.storage
            .from('lineup-audio')
            .remove([`${session.id}/${oldPath}`])
        }
      }

      // Upload new audio (compressé après validation, avant l'upload)
      const fileToUpload = needsAudioCompression(file) ? await compressAudio(file) : file
      const fileExt = fileToUpload.name.split('.').pop()
      const fileName = `lineup-audio-${Date.now()}.${fileExt}`
      const filePath = `${session.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('lineup-audio')
        .upload(filePath, fileToUpload)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('lineup-audio')
        .getPublicUrl(filePath)

      // Update settings
      const newSettings: LineupAudioSettings = {
        url: publicUrl,
        enabled: true,
        filename: file.name,
        sfxEnabled: audioSettings.sfxEnabled,
      }
      setAudioSettings(newSettings)

      // Save to database
      await supabase
        .from('sessions')
        .update({ lineup_audio: JSON.stringify(newSettings) })
        .eq('id', session.id)

      toast.success('Musique uploadée!')
    } catch (err) {
      console.error('Error uploading audio:', err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setAudioUploading(false)
      if (audioInputRef.current) {
        audioInputRef.current.value = ''
      }
    }
  }

  async function deleteAudio() {
    if (!session || !audioSettings.url) return

    try {
      // Extract path from URL
      const urlParts = audioSettings.url.split('/lineup-audio/')
      if (urlParts.length > 1) {
        await supabase.storage
          .from('lineup-audio')
          .remove([urlParts[1]])
      }

      // Update settings
      const newSettings: LineupAudioSettings = {
        url: null,
        enabled: false,
        filename: null,
        sfxEnabled: audioSettings.sfxEnabled,
      }
      setAudioSettings(newSettings)

      // Save to database
      await supabase
        .from('sessions')
        .update({ lineup_audio: JSON.stringify(newSettings) })
        .eq('id', session.id)

      // Stop preview if playing
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause()
        setIsPreviewPlaying(false)
      }

      toast.success('Musique supprimée')
    } catch (err) {
      console.error('Error deleting audio:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  async function toggleAudioEnabled() {
    if (!session) return

    const newSettings: LineupAudioSettings = {
      ...audioSettings,
      enabled: !audioSettings.enabled,
    }
    setAudioSettings(newSettings)

    await supabase
      .from('sessions')
      .update({ lineup_audio: JSON.stringify(newSettings) })
      .eq('id', session.id)
  }

  // Bruitages (sons FX) de l'écran public : enregistrés avec la musique et envoyés tout de suite à l'écran
  async function toggleSfxEnabled() {
    if (!session) return

    const newSettings: LineupAudioSettings = {
      ...audioSettings,
      sfxEnabled: audioSettings.sfxEnabled === false,
    }
    setAudioSettings(newSettings)
    audioSettingsRef.current = newSettings

    if (gameActive) {
      broadcastGameState({
        gameActive: true,
        currentNumber: currentNumberRef.current,
        timeLeft: timeLeftRef.current,
        isRunning,
        isPaused,
        isGameOver,
        currentPoints: currentPointsRef.current,
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current,
        team1Name: team1NameRef.current,
        team2Name: team2NameRef.current,
        showWinner,
        clockDuration,
        audioSettings: newSettings,
      })
    }

    await supabase
      .from('sessions')
      .update({ lineup_audio: JSON.stringify(newSettings) })
      .eq('id', session.id)
  }

  function toggleAudioPreview() {
    if (!audioPreviewRef.current || !audioSettings.url) return

    if (isPreviewPlaying) {
      audioPreviewRef.current.pause()
      setIsPreviewPlaying(false)
    } else {
      audioPreviewRef.current.play().catch(() => {})
      setIsPreviewPlaying(true)
    }
  }

  // CHRONO GLOBAL - Timer effect (side effects hors du state setter)
  useEffect(() => {
    if (!isRunning || isPaused || isGameOver || !session) return

    const timer = setInterval(() => {
      const prevTime = timeLeftRef.current
      if (prevTime <= 0) return

      const newTime = prevTime - 1

      const thirdOfTime = clockDuration / 3
      let newPoints = 10
      if (newTime > thirdOfTime * 2) newPoints = 10
      else if (newTime > thirdOfTime) newPoints = 20
      else newPoints = 30

      setTimeLeft(newTime)
      setCurrentPoints(newPoints)
      currentPointsRef.current = newPoints

      broadcastGameState({
        gameActive: true,
        currentNumber: currentNumberRef.current,
        timeLeft: newTime,
        isRunning: true,
        isPaused: false,
        isGameOver: newTime <= 0,
        currentPoints: newPoints,
        team1Score: team1ScoreRef.current,
        team2Score: team2ScoreRef.current,
        team1Name: team1NameRef.current,
        team2Name: team2NameRef.current,
        showWinner: newTime <= 0,
        clockDuration,
        audioSettings: audioSettingsRef.current,
      })

      if (newTime <= 0) {
        setIsRunning(false)
        setIsGameOver(true)
        setShowWinner(true)
        supabase.from('sessions').update({
          lineup_time_left: 0,
          lineup_is_running: false,
          lineup_is_game_over: true,
          lineup_show_winner: true,
          lineup_current_points: newPoints,
        }).eq('id', session.id)
      } else {
        supabase.from('sessions').update({
          lineup_time_left: newTime,
          lineup_current_points: newPoints,
        }).eq('id', session.id)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, isPaused, isGameOver, clockDuration, session, supabase, broadcastGameState])

  // Lancer le jeu (configurer et ouvrir le diaporama)
  async function launchGame() {
    if (!session) return

    setLaunching(true)
    try {
      // Désactiver tous les autres jeux avant d'activer Le Bon Ordre
      const { error } = await supabase
        .from('sessions')
        .update({
          // Désactiver les autres jeux
          mystery_photo_active: false,
          wheel_active: false,
          // Activer Le Bon Ordre
          lineup_active: true,
          lineup_clock_duration: clockDuration,
          lineup_team1_name: team1Name,
          lineup_team2_name: team2Name,
          lineup_team1_score: 0,
          lineup_team2_score: 0,
          lineup_current_number: '',
          lineup_time_left: clockDuration,
          lineup_is_running: false,
          lineup_is_paused: false,
          lineup_is_game_over: false,
          lineup_current_points: 10,
          lineup_show_winner: false,
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setTeam1Score(0)
      setTeam2Score(0)
      setCurrentNumber('')
      setTimeLeft(clockDuration)
      setIsRunning(false)
      setIsPaused(false)
      setIsGameOver(false)
      setCurrentPoints(10)
      setShowWinner(false)

      // Broadcast initial state
      broadcastGameState({
        gameActive: true,
        currentNumber: '',
        timeLeft: clockDuration,
        isRunning: false,
        isPaused: false,
        isGameOver: false,
        currentPoints: 10,
        team1Score: 0,
        team2Score: 0,
        team1Name,
        team2Name,
        showWinner: false,
        clockDuration,
        audioSettings,
      })

      toast.success('Jeu configuré!')

      // Open slideshow in new tab
      window.open(`/live/${session.code}`, 'photojet-live')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  // DÉMARRER LA PARTIE
  async function startGame() {
    if (!session) return

    const newNumber = generateNumber()

    setTeam1Score(0)
    setTeam2Score(0)
    setCurrentNumber(newNumber)
    setTimeLeft(clockDuration)
    setIsRunning(true)
    setIsPaused(false)
    setIsGameOver(false)
    setCurrentPoints(10)
    setShowWinner(false)

    // Mettre à jour les refs immédiatement pour le timer
    currentNumberRef.current = newNumber
    team1ScoreRef.current = 0
    team2ScoreRef.current = 0
    currentPointsRef.current = 10

    await supabase
      .from('sessions')
      .update({
        lineup_team1_score: 0,
        lineup_team2_score: 0,
        lineup_current_number: newNumber,
        lineup_time_left: clockDuration,
        lineup_is_running: true,
        lineup_is_paused: false,
        lineup_is_game_over: false,
        lineup_current_points: 10,
        lineup_show_winner: false,
      })
      .eq('id', session.id)

    // Broadcast
    broadcastGameState({
      gameActive: true,
      currentNumber: newNumber,
      timeLeft: clockDuration,
      isRunning: true,
      isPaused: false,
      isGameOver: false,
      currentPoints: 10,
      team1Score: 0,
      team2Score: 0,
      team1Name,
      team2Name,
      showWinner: false,
      clockDuration,
      audioSettings,
    })

    toast.success('Partie lancée!')
  }

  // PAUSE
  async function pauseGame() {
    if (!session) return

    setIsRunning(false)
    setIsPaused(true)

    await supabase
      .from('sessions')
      .update({
        lineup_is_running: false,
        lineup_is_paused: true,
        lineup_time_left: timeLeft,
        lineup_current_points: currentPoints,
      })
      .eq('id', session.id)

    // Broadcast
    broadcastGameState({
      gameActive: true,
      currentNumber,
      timeLeft,
      isRunning: false,
      isPaused: true,
      isGameOver: false,
      currentPoints,
      team1Score,
      team2Score,
      team1Name,
      team2Name,
      showWinner: false,
      clockDuration,
      audioSettings,
    })
  }

  // REPRENDRE
  async function resumeGame() {
    if (!session) return

    // Si pas de numéro affiché, en générer un nouveau
    let numberToShow = currentNumber
    if (!currentNumber) {
      numberToShow = generateNumber()
      setCurrentNumber(numberToShow)
      // Mettre à jour la ref immédiatement pour que le timer utilise la bonne valeur
      currentNumberRef.current = numberToShow
    }

    setIsRunning(true)
    setIsPaused(false)

    await supabase
      .from('sessions')
      .update({
        lineup_is_running: true,
        lineup_is_paused: false,
        lineup_current_number: numberToShow,
      })
      .eq('id', session.id)

    // Broadcast
    broadcastGameState({
      gameActive: true,
      currentNumber: numberToShow,
      timeLeft,
      isRunning: true,
      isPaused: false,
      isGameOver: false,
      currentPoints,
      team1Score,
      team2Score,
      team1Name,
      team2Name,
      showWinner: false,
      clockDuration,
      audioSettings,
    })
  }

  // Attribuer les points à une équipe
  async function awardPoints(team: 1 | 2) {
    if (!session || isGameOver) return

    const newTeam1Score = team === 1 ? team1Score + currentPoints : team1Score
    const newTeam2Score = team === 2 ? team2Score + currentPoints : team2Score

    if (team === 1) {
      setTeam1Score(newTeam1Score)
    } else {
      setTeam2Score(newTeam2Score)
    }

    setCurrentNumber('')
    currentNumberRef.current = ''
    // Mettre à jour les refs des scores pour le timer
    team1ScoreRef.current = newTeam1Score
    team2ScoreRef.current = newTeam2Score

    await supabase
      .from('sessions')
      .update({
        lineup_team1_score: newTeam1Score,
        lineup_team2_score: newTeam2Score,
        lineup_current_number: '',
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      currentNumber: '',
      timeLeft: timeLeftRef.current,
      isRunning,
      isPaused,
      isGameOver: false,
      currentPoints,
      team1Score: newTeam1Score,
      team2Score: newTeam2Score,
      team1Name: team1NameRef.current,
      team2Name: team2NameRef.current,
      showWinner: false,
      clockDuration,
      audioSettings: audioSettingsRef.current,
    })

    toast.success(`${team === 1 ? team1Name : team2Name} +${currentPoints} points!`)

    if (timeLeftRef.current > 0 && !isGameOver && isRunning && !isPaused) {
      if (awardPointsTimeoutRef.current) clearTimeout(awardPointsTimeoutRef.current)
      awardPointsTimeoutRef.current = setTimeout(async () => {
        const newNumber = generateNumber()
        setCurrentNumber(newNumber)
        currentNumberRef.current = newNumber
        await supabase.from('sessions').update({ lineup_current_number: newNumber }).eq('id', session.id)

        broadcastGameState({
          gameActive: true,
          currentNumber: newNumber,
          timeLeft: timeLeftRef.current,
          isRunning: true,
          isPaused: false,
          isGameOver: false,
          currentPoints: currentPointsRef.current,
          team1Score: team1ScoreRef.current,
          team2Score: team2ScoreRef.current,
          team1Name: team1NameRef.current,
          team2Name: team2NameRef.current,
          showWinner: false,
          clockDuration,
          audioSettings: audioSettingsRef.current,
        })
      }, 1500)
    }
  }

  // Passer au numéro suivant sans attribuer de points
  async function skipNumber() {
    if (!session || isGameOver) return

    const newNumber = generateNumber()
    setCurrentNumber(newNumber)
    currentNumberRef.current = newNumber

    await supabase
      .from('sessions')
      .update({ lineup_current_number: newNumber })
      .eq('id', session.id)

    // Broadcast
    broadcastGameState({
      gameActive: true,
      currentNumber: newNumber,
      timeLeft,
      isRunning,
      isPaused,
      isGameOver: false,
      currentPoints,
      team1Score,
      team2Score,
      team1Name,
      team2Name,
      showWinner: false,
      clockDuration,
      audioSettings,
    })
  }

  // Masquer l'écran de victoire
  async function hideWinnerScreen() {
    if (!session) return

    setShowWinner(false)

    await supabase
      .from('sessions')
      .update({ lineup_show_winner: false })
      .eq('id', session.id)

    // Broadcast
    broadcastGameState({
      gameActive: true,
      currentNumber,
      timeLeft,
      isRunning,
      isPaused,
      isGameOver: true,
      currentPoints,
      team1Score,
      team2Score,
      team1Name,
      team2Name,
      showWinner: false,
      clockDuration,
      audioSettings,
    })
  }

  // QUITTER LE JEU - Reset complet et retour à /admin/jeux
  async function exitGame() {
    if (!session) return

    // Reset local state
    setGameActive(false)
    setIsRunning(false)
    setIsPaused(false)
    setIsGameOver(false)
    setCurrentNumber('')
    setShowWinner(false)
    setTeam1Score(0)
    setTeam2Score(0)
    setTimeLeft(60)
    setCurrentPoints(10)
    setTeam1Name('Équipe 1')
    setTeam2Name('Équipe 2')
    setClockDuration(60)

    // Reset ALL game data in database
    await supabase
      .from('sessions')
      .update({
        lineup_active: false,
        lineup_is_running: false,
        lineup_is_paused: false,
        lineup_is_game_over: false,
        lineup_current_number: '',
        lineup_show_winner: false,
        lineup_team1_score: 0,
        lineup_team2_score: 0,
        lineup_time_left: 60,
        lineup_current_points: 10,
        lineup_team1_name: 'Équipe 1',
        lineup_team2_name: 'Équipe 2',
        lineup_clock_duration: 60,
      })
      .eq('id', session.id)

    // Broadcast reset to slideshow
    broadcastGameState({
      gameActive: false,
      currentNumber: '',
      timeLeft: 60,
      isRunning: false,
      isPaused: false,
      isGameOver: false,
      currentPoints: 10,
      team1Score: 0,
      team2Score: 0,
      team1Name: 'Équipe 1',
      team2Name: 'Équipe 2',
      showWinner: false,
      clockDuration: 60,
    })

    toast.success('Jeu arrêté - Données réinitialisées')

    // Retour à la liste des jeux
    router.push(`/admin/jeux?session=${session.id}`)
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!gameActive) return

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (isRunning) {
          pauseGame()
        } else if (isPaused) {
          resumeGame()
        } else if (!isGameOver) {
          startGame()
        }
      }
      if ((e.code === 'Digit1' || e.code === 'ArrowLeft') && currentNumber && !isGameOver) {
        awardPoints(1)
      }
      if ((e.code === 'Digit2' || e.code === 'ArrowRight') && currentNumber && !isGameOver) {
        awardPoints(2)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameActive, isRunning, isPaused, isGameOver, currentNumber])

  // Télécommande de présentation : PageUp = points à l'équipe 1, PageDown =
  // points à l'équipe 2 (comme flèche gauche / droite), B = démarrer / pause /
  // reprise (comme Espace). Numéro suivant et Nouvelle partie jamais mappés ;
  // coupée une fois la partie terminée. Mêmes handlers que les boutons.
  // Partie affichée : confirmation avant rechargement (F5) ou fermeture.
  useLeaveGuard(gameActive)

  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  // Une seule décision : exécutée par la touche ET affichée par la légende.
  const remoteActive = gameActive && remoteOn && !isGameOver
  const canAward = !!currentNumber && (isRunning || isPaused)
  const lineupB: 'pause' | 'resume' | 'start' | null =
    isRunning ? 'pause' : isPaused ? 'resume' : timeLeft === clockDuration ? 'start' : null
  const remoteAward = async (team: 1 | 2) => {
    if (!canAward) return
    await awardPoints(team)
    return 1500 // un double appui donnerait aussi les points du numéro suivant
  }
  useRemoteControl({
    active: remoteActive,
    phase: `${isRunning}|${isPaused}|${currentNumber}`,
    onPrev: () => remoteAward(1),
    onNext: () => remoteAward(2),
    onSecondary: async () => {
      if (lineupB === 'pause') await pauseGame()
      else if (lineupB === 'resume') await resumeGame()
      else if (lineupB === 'start') await startGame()
    },
  })
  const remoteLegend: RemoteLegendData = {
    active: remoteActive,
    inactiveReason: isGameOver ? 'Partie terminée : télécommande coupée.' : undefined,
    next: canAward ? `points à ${team2Name || 'l’équipe 2'}` : null,
    prev: canAward ? `points à ${team1Name || 'l’équipe 1'}` : null,
    secondary: lineupB === 'pause' ? 'mettre le chrono en pause' : lineupB === 'resume' ? 'reprendre le chrono' : lineupB === 'start' ? 'démarrer le chrono' : null,
  }

  if (loading) {
    return (
      <div className={`${rg.page} ${rg.center}`}>
        <Loader2 className={rg.spin} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className={`${rg.page} ${rg.center}`}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>Aucune session trouvée</p>
          <button className={`${rg.btn} ${rg.btnGold}`} onClick={() => router.push('/admin/dashboard')}>
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  // État du jeu pour l'affichage
  const gameNotStarted = !isRunning && !isPaused && !isGameOver && timeLeft === clockDuration
  const gameInProgress = isRunning && !isGameOver
  const gamePaused = isPaused && !isGameOver
  const gameEnded = isGameOver

  // Habillage « régie » AnimaJet 2.0 (maquette V1 validée le 25/11/2026) — handlers et états inchangés.
  const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
  const sfxOn = audioSettings.sfxEnabled !== false
  const digits = (currentNumber || '-----').split('')
  const teamButtons = currentNumber ? (
    <div className={rg.r2}>
      <button onClick={() => awardPoints(1)} className={cx(rg.big, rg.tm)} title="Touche 1 ou flèche gauche">
        <Check /><span>{team1Name}</span><em>+{currentPoints}</em>
      </button>
      <button onClick={() => awardPoints(2)} className={cx(rg.big, rg.tm)} title="Touche 2 ou flèche droite">
        <Check /><span>{team2Name}</span><em>+{currentPoints}</em>
      </button>
    </div>
  ) : null

  return (
    <div className={rg.page}>
      <div className={rg.wrap}>
        {/* En-tête */}
        <header className={rg.top}>
          <button className={rg.btn} onClick={() => router.push(`/admin/jeux?session=${session.id}`)}>
            <ArrowLeft />
            Retour
          </button>
          <div className={rg.vsep} />
          <div className={rg.ttl}>
            <div className={rg.thumb}><Image src="/images/games/le-bon-ordre-v2.png" alt="" fill sizes="100px" /></div>
            <div>
              <h1 className={`${rg.cardTitle} ${cardFont.className}`} data-t="LE BON ORDRE"><span>LE BON ORDRE</span></h1>
              <small>{session.name}</small>
            </div>
          </div>
          <div className={rg.grow} />
          <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={gameActive} finished={isGameOver} legend={remoteLegend} />
          <div className={rg.vsep} />
          <a href="/le-bon-ordre-regles-du-jeu.pdf" target="_blank" rel="noopener noreferrer" className={cx(rg.btn, rg.btnGold)}>
            <FileText />
            Notice
          </a>
          {gameActive && (
            <button onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className={cx(rg.btn, rg.btnViolet)}>
              <Monitor />
              Voir le diaporama
            </button>
          )}
        </header>

        {!gameActive ? (
          /* Configuration */
          <section className={cx(rg.panel, rg.cfgPanel)}>
            <div className={rg.head}>
              <div className={`${rg.thumb} ${rg.thumbBig}`}><Image src="/images/games/le-bon-ordre-v2.png" alt="Le Bon Ordre" fill sizes="200px" priority /></div>
              <div>
                <h2 className={`${rg.cardTitle} ${cardFont.className}`} data-t="LE BON ORDRE"><span>LE BON ORDRE</span></h2>
                <p>Les équipes se placent dans l&apos;ordre affiché</p>
              </div>
            </div>

            {/* Durée de la partie */}
            <div className={rg.box}>
              <div className={rg.lab}><Timer />Durée de la partie</div>
              <div className={rg.dur}>
                {[30, 60, 90, 120].map(sec => (
                  <button
                    key={sec}
                    onClick={() => {
                      setClockDuration(sec)
                      setTimeLeft(sec)
                    }}
                    className={clockDuration === sec ? rg.on : undefined}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              <div className={rg.hint}>Le chrono est global pour toute la partie</div>
            </div>

            {/* Noms des équipes */}
            <div className={rg.teams}>
              <div>
                <label className={rg.lab}><Users />Équipe 1</label>
                <input
                  value={team1Name}
                  onChange={(e) => setTeam1Name(e.target.value)}
                  placeholder="Nom équipe 1"
                  className={rg.txt}
                />
              </div>
              <div className={rg.vl} />
              <div>
                <label className={rg.lab}><Users />Équipe 2</label>
                <input
                  value={team2Name}
                  onChange={(e) => setTeam2Name(e.target.value)}
                  placeholder="Nom équipe 2"
                  className={rg.txt}
                />
              </div>
            </div>

            {/* Section Audio */}
            <div className={rg.music}>
              <div className={rg.eq} aria-hidden>
                {EQ_BARS.map((b, i) => <i key={i} style={{ height: b.h, animationDelay: `${b.d}s` }} />)}
              </div>
              <div className={rg.mRow}>
                <div className={rg.mi}><Music /></div>
                <div>
                  <h3>Musique du jeu</h3>
                  <small>Son pendant le chrono</small>
                </div>
              </div>

              {!audioSettings.url ? (
                <label className={rg.drop}>
                  {audioUploading ? (
                    <Loader2 className={rg.spin} />
                  ) : (
                    <>
                      <Upload />
                      Uploader (MP3, WAV, OGG)
                    </>
                  )}
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3"
                    onChange={handleAudioUpload}
                    className="hidden"
                    disabled={audioUploading}
                  />
                </label>
              ) : (
                <>
                  <div className={rg.aud}>
                    <p><Music />{audioSettings.filename || 'Fichier audio'}</p>
                    <button onClick={toggleAudioPreview} className={cx(rg.iconBtn, rg.iconPlay)} title={isPreviewPlaying ? 'Arrêter l’écoute' : 'Écouter'}>
                      {isPreviewPlaying ? <Pause /> : <Play />}
                    </button>
                    <button onClick={deleteAudio} className={cx(rg.iconBtn, rg.iconDel)} title="Supprimer la musique">
                      <Trash2 />
                    </button>
                  </div>
                  <div className={rg.aud}>
                    <p>{audioSettings.enabled ? <Volume2 /> : <VolumeX />}Son activé</p>
                    <button
                      onClick={toggleAudioEnabled}
                      className={cx(rg.toggle, audioSettings.enabled && rg.toggleOn)}
                      aria-label="Activer ou couper la musique"
                    />
                  </div>
                </>
              )}

              <div className={rg.aud}>
                <p>{sfxOn ? <Sparkles /> : <VolumeX />}Bruitages du jeu <small className={rg.sub}>tirage, chrono, alarme, points, victoire</small></p>
                <button
                  onClick={toggleSfxEnabled}
                  className={cx(rg.toggle, sfxOn && rg.toggleOn)}
                  aria-label="Activer ou couper les bruitages"
                />
              </div>

              {audioSettings.url && (
                <audio
                  ref={audioPreviewRef}
                  src={audioSettings.url}
                  onEnded={() => setIsPreviewPlaying(false)}
                />
              )}
            </div>

            {/* Bouton lancer */}
            <button onClick={launchGame} disabled={launching} className={rg.cta}>
              {launching ? <Loader2 className={rg.spin} /> : <><Rocket />Configurer et ouvrir le diaporama</>}
            </button>
          </section>
        ) : (
          /* Pilotage */
          <section className={rg.panel}>
            <div className={rg.status}>
              <div className={rg.st}>
                <span className={cx(rg.dot, isRunning && rg.dotRun, !isRunning && isPaused && rg.dotPause, isGameOver && rg.dotEnd)} />
                {isRunning ? 'En cours' : isPaused ? 'En pause' : isGameOver ? 'Terminé' : 'Prêt'}
              </div>
              <div className={rg.stRight}>
                <button onClick={toggleSfxEnabled} className={cx(rg.fxBtn, sfxOn && rg.fxOn)} title="Bruitages de l'écran public (la musique n'est pas concernée)">
                  {sfxOn ? <Volume2 /> : <VolumeX />}
                  Bruitages {sfxOn ? 'activés' : 'coupés'}
                </button>
                <div className={rg.kbd}><b>Espace</b>Start / Pause</div>
              </div>
            </div>

            {/* Scores + numéro + points + chrono */}
            <div className={rg.board}>
              <div className={rg.sc}>
                <p>{team1Name}</p>
                <b>{team1Score}</b>
              </div>
              <div className={rg.mid}>
                <div className={rg.digits}>
                  {digits.map((d, i) => <span key={i} className={currentNumber ? undefined : rg.e}>{d === '-' ? '–' : d}</span>)}
                </div>
                <div className={rg.meta}>
                  <span className={cx(rg.pts, currentPoints === 30 ? rg.p30 : currentPoints === 20 ? rg.p20 : rg.p10)}>{currentPoints} pts</span>
                  <span className={cx(rg.t, timeLeft <= 15 ? rg.tUrgent : timeLeft <= 30 && rg.tWarn)}>{timeLeft}s</span>
                  {currentNumber && <small>{currentNumber.length} chiffres</small>}
                </div>
              </div>
              <div className={rg.sc}>
                <p>{team2Name}</p>
                <b>{team2Score}</b>
              </div>
            </div>

            {/* Boutons selon l'état du jeu */}
            <div className={rg.acts}>
              {/* Jeu pas encore commencé */}
              {gameNotStarted && (
                <button onClick={startGame} className={cx(rg.big, rg.go)}>
                  <Play />
                  DÉMARRER LA PARTIE
                </button>
              )}

              {/* Jeu en cours */}
              {gameInProgress && (
                <>
                  <button onClick={pauseGame} className={cx(rg.big, rg.pa)}>
                    <Pause />
                    PAUSE
                  </button>
                  {teamButtons}
                  <button onClick={skipNumber} className={cx(rg.big, rg.sk)}>
                    <SkipForward />
                    Numéro suivant (sans points)
                  </button>
                </>
              )}

              {/* Jeu en pause */}
              {gamePaused && (
                <>
                  <button onClick={resumeGame} className={cx(rg.big, rg.go)}>
                    <Play />
                    REPRENDRE
                  </button>
                  {teamButtons}
                </>
              )}

              {/* Jeu terminé */}
              {gameEnded && (
                <>
                  <div className={rg.res}>
                    <div className={rg.cup}>🏆</div>
                    <h3>
                      {team1Score > team2Score ? team1Name : team2Score > team1Score ? team2Name : 'Égalité'}
                      {team1Score !== team2Score && ' gagne !'}
                    </h3>
                    <p>{team1Score} - {team2Score}</p>
                  </div>

                  {showWinner && (
                    <button onClick={hideWinnerScreen} className={rg.big}>
                      <EyeOff />
                      Masquer l&apos;écran de victoire
                    </button>
                  )}

                  <button onClick={startGame} className={cx(rg.big, rg.gd)}>
                    <RotateCcw />
                    NOUVELLE PARTIE
                  </button>
                </>
              )}
            </div>

            {/* Quitter - TOUJOURS visible */}
            <button onClick={exitGame} className={cx(rg.big, rg.q)}>
              <X />
              Quitter le jeu
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
