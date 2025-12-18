'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, WheelAudioSettings } from '@/types/database'
import { toast } from 'sonner'

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
  const [audioSettings, setAudioSettings] = useState<WheelAudioSettings>({
    url: null,
    enabled: true,
    filename: null,
  })
  const [audioUploading, setAudioUploading] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  const router = useRouter()
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

  // Keep refs in sync with state
  useEffect(() => { currentNumberRef.current = currentNumber }, [currentNumber])
  useEffect(() => { team1ScoreRef.current = team1Score }, [team1Score])
  useEffect(() => { team2ScoreRef.current = team2Score }, [team2Score])
  useEffect(() => { team1NameRef.current = team1Name }, [team1Name])
  useEffect(() => { team2NameRef.current = team2Name }, [team2Name])
  useEffect(() => { audioSettingsRef.current = audioSettings }, [audioSettings])
  useEffect(() => { currentPointsRef.current = currentPoints }, [currentPoints])

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

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
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
    // Weighted distribution: 3 chiffres (20%), 4 chiffres (30%), 5 chiffres (50%)
    const rand = Math.random()
    let length: number
    if (rand < 0.2) {
      length = 3
    } else if (rand < 0.5) {
      length = 4
    } else {
      length = 5
    }

    // Fonction pour générer un numéro unique
    const generate = (): string => {
      // Pool de chiffres disponibles (1-9)
      const allDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9]

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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10MB)')
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

      // Upload new audio
      const fileExt = file.name.split('.').pop()
      const fileName = `lineup-audio-${Date.now()}.${fileExt}`
      const filePath = `${session.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('lineup-audio')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('lineup-audio')
        .getPublicUrl(filePath)

      // Update settings
      const newSettings: WheelAudioSettings = {
        url: publicUrl,
        enabled: true,
        filename: file.name,
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
      const newSettings: WheelAudioSettings = {
        url: null,
        enabled: false,
        filename: null,
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

    const newSettings: WheelAudioSettings = {
      ...audioSettings,
      enabled: !audioSettings.enabled,
    }
    setAudioSettings(newSettings)

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

  // CHRONO GLOBAL - Timer effect
  useEffect(() => {
    if (!isRunning || isPaused || isGameOver || !session) return

    const timer = setInterval(async () => {
      setTimeLeft(prevTime => {
        if (prevTime <= 0) return 0

        const newTime = prevTime - 1

        // Calculate points based on time remaining
        const thirdOfTime = clockDuration / 3
        let newPoints = 10
        if (newTime > thirdOfTime * 2) {
          newPoints = 10
        } else if (newTime > thirdOfTime) {
          newPoints = 20
        } else {
          newPoints = 30
        }

        setCurrentPoints(newPoints)

        // Broadcast state update (use refs to get latest values, avoid stale closures)
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

        // Fin du jeu !
        if (newTime <= 0) {
          setIsRunning(false)
          setIsGameOver(true)
          setShowWinner(true)

          supabase
            .from('sessions')
            .update({
              lineup_time_left: 0,
              lineup_is_running: false,
              lineup_is_game_over: true,
              lineup_show_winner: true,
              lineup_current_points: newPoints,
            })
            .eq('id', session.id)
        } else {
          supabase
            .from('sessions')
            .update({
              lineup_time_left: newTime,
              lineup_current_points: newPoints,
            })
            .eq('id', session.id)
        }

        return newTime
      })
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
      window.open(`/live/${session.code}`, '_blank')
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

    // Broadcast empty number
    broadcastGameState({
      gameActive: true,
      currentNumber: '',
      timeLeft,
      isRunning,
      isPaused,
      isGameOver: false,
      currentPoints,
      team1Score: newTeam1Score,
      team2Score: newTeam2Score,
      team1Name,
      team2Name,
      showWinner: false,
      clockDuration,
      audioSettings,
    })

    toast.success(`${team === 1 ? team1Name : team2Name} +${currentPoints} points!`)

    // Générer automatiquement le prochain numéro SEULEMENT si le chrono tourne
    if (timeLeft > 0 && !isGameOver && isRunning && !isPaused) {
      setTimeout(async () => {
        const newNumber = generateNumber()
        setCurrentNumber(newNumber)
        currentNumberRef.current = newNumber
        await supabase
          .from('sessions')
          .update({ lineup_current_number: newNumber })
          .eq('id', session.id)

        // Broadcast new number
        broadcastGameState({
          gameActive: true,
          currentNumber: newNumber,
          timeLeft,
          isRunning: true,
          isPaused: false,
          isGameOver: false,
          currentPoints,
          team1Score: newTeam1Score,
          team2Score: newTeam2Score,
          team1Name,
          team2Name,
          showWinner: false,
          clockDuration,
          audioSettings,
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
    router.push('/admin/jeux')
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

  // État du jeu pour l'affichage
  const gameNotStarted = !isRunning && !isPaused && !isGameOver && timeLeft === clockDuration
  const gameInProgress = isRunning && !isGameOver
  const gamePaused = isPaused && !isGameOver
  const gameEnded = isGameOver

  return (
    <div className="min-h-screen bg-[#0D0D0F] relative">
      {/* Animated background effects - Violet/Purple theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-[#D4AF37]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Le Bon Ordre</h1>
                <p className="text-sm text-[#6B6B70]">{session.name}</p>
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
              Voir le diaporama
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-2xl">
        {!gameActive ? (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl p-6 space-y-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🏃</span>
              <div>
                <h2 className="text-xl font-bold text-white">Le Bon Ordre</h2>
                <p className="text-gray-400 text-sm">Les équipes se placent dans l&apos;ordre affiché</p>
              </div>
            </div>

            {/* Durée de la partie */}
            <div>
              <label className="text-white mb-2 block font-medium">Durée de la partie</label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map(sec => (
                  <button
                    key={sec}
                    onClick={() => {
                      setClockDuration(sec)
                      setTimeLeft(sec)
                    }}
                    className={`py-3 rounded-xl font-bold transition-all ${
                      clockDuration === sec
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#2E2E33] text-white hover:bg-[#3E3E43]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-2">Le chrono est global pour toute la partie</p>
            </div>

            {/* Noms des équipes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white mb-2 block font-medium">Équipe 1</label>
                <input
                  value={team1Name}
                  onChange={(e) => setTeam1Name(e.target.value)}
                  placeholder="Nom équipe 1"
                  className="w-full bg-[#2E2E33] text-white rounded-xl p-3 text-center font-bold border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-white mb-2 block font-medium">Équipe 2</label>
                <input
                  value={team2Name}
                  onChange={(e) => setTeam2Name(e.target.value)}
                  placeholder="Nom équipe 2"
                  className="w-full bg-[#2E2E33] text-white rounded-xl p-3 text-center font-bold border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            {/* Section Audio */}
            <div className="bg-[#1A1A1E] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Music className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Musique du jeu</h3>
                  <p className="text-gray-400 text-xs">Son pendant le chrono</p>
                </div>
              </div>

              {/* Upload zone */}
              {!audioSettings.url ? (
                <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:border-violet-500/50 transition-colors bg-[#242428]">
                  {audioUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">Uploader (MP3, WAV, OGG)</span>
                    </div>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#242428] rounded-lg p-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <Music className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">
                        {audioSettings.filename || 'Fichier audio'}
                      </p>
                    </div>
                    <button
                      onClick={toggleAudioPreview}
                      className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
                    >
                      {isPreviewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={deleteAudio}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-[#242428] rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      {audioSettings.enabled ? (
                        <Volume2 className="h-3.5 w-3.5 text-violet-400" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5 text-gray-500" />
                      )}
                      <span className="text-white text-xs">Son activé</span>
                    </div>
                    <button
                      onClick={toggleAudioEnabled}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        audioSettings.enabled ? 'bg-violet-500' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          audioSettings.enabled ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {audioSettings.url && (
                <audio
                  ref={audioPreviewRef}
                  src={audioSettings.url}
                  onEnded={() => setIsPreviewPlaying(false)}
                />
              )}
            </div>

            {/* Bouton lancer */}
            <button
              onClick={launchGame}
              disabled={launching}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Configurer et ouvrir le diaporama</>
              )}
            </button>
          </motion.div>
        ) : (
          /* Control Panel */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#242428] rounded-xl p-4 border-2 border-[#D4AF37]"
          >
            {/* Header avec status */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  isRunning ? 'bg-green-500' : isPaused ? 'bg-orange-500' : isGameOver ? 'bg-red-500' : 'bg-gray-500'
                }`}></span>
                <span className="text-white font-bold text-sm">
                  {isRunning ? 'En cours' : isPaused ? 'En pause' : isGameOver ? 'Terminé' : 'Prêt'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Espace = Start/Pause
              </div>
            </div>

            {/* Scores côte à côte */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-[#1A1A1E] rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs truncate">{team1Name}</p>
                <p className="text-3xl font-bold text-white">{team1Score}</p>
              </div>
              <div className="bg-[#1A1A1E] rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs truncate">{team2Name}</p>
                <p className="text-3xl font-bold text-white">{team2Score}</p>
              </div>
            </div>

            {/* Numéro + Points + Timer */}
            <div className="bg-[#1A1A1E] rounded-lg p-3 mb-3 text-center">
              <p className="text-4xl font-bold text-[#D4AF37] tracking-widest font-mono mb-1">
                {currentNumber || '-----'}
              </p>
              {currentNumber && (
                <p className="text-xs text-gray-500 mb-1">{currentNumber.length} chiffres</p>
              )}
              <div className="flex justify-center items-center gap-4">
                <span className={`font-bold ${
                  currentPoints === 30 ? 'text-green-400' :
                  currentPoints === 20 ? 'text-yellow-400' :
                  'text-orange-400'
                }`}>
                  {currentPoints} pts
                </span>
                <span className={`text-3xl font-bold font-mono ${
                  timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'
                }`}>
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Boutons selon l'état du jeu */}
            <div className="space-y-2">
              {/* Jeu pas encore commencé */}
              {gameNotStarted && (
                <button
                  onClick={startGame}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2"
                >
                  <Play className="h-5 w-5" />
                  🚀 DÉMARRER LA PARTIE
                </button>
              )}

              {/* Jeu en cours */}
              {gameInProgress && (
                <>
                  <button
                    onClick={pauseGame}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    PAUSE
                  </button>

                  {/* Attribution des points */}
                  {currentNumber && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => awardPoints(1)}
                        className="py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-sm truncate px-2"
                      >
                        ✓ {team1Name}
                      </button>
                      <button
                        onClick={() => awardPoints(2)}
                        className="py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold text-sm truncate px-2"
                      >
                        ✓ {team2Name}
                      </button>
                    </div>
                  )}

                  {/* Passer au numéro suivant */}
                  <button
                    onClick={skipNumber}
                    className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <SkipForward className="h-4 w-4" />
                    Numéro suivant (sans points)
                  </button>
                </>
              )}

              {/* Jeu en pause */}
              {gamePaused && (
                <>
                  <button
                    onClick={resumeGame}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2"
                  >
                    <Play className="h-5 w-5" />
                    ▶️ REPRENDRE
                  </button>

                  {/* Attribution des points même en pause */}
                  {currentNumber && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => awardPoints(1)}
                        className="py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-sm truncate px-2"
                      >
                        ✓ {team1Name}
                      </button>
                      <button
                        onClick={() => awardPoints(2)}
                        className="py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-bold text-sm truncate px-2"
                      >
                        ✓ {team2Name}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Jeu terminé */}
              {gameEnded && (
                <>
                  <div className="bg-[#1A1A1E] rounded-lg p-4 text-center mb-2">
                    <p className="text-2xl mb-2">🏆</p>
                    <p className="text-[#D4AF37] font-bold text-lg">
                      {team1Score > team2Score ? team1Name : team2Score > team1Score ? team2Name : 'Égalité'}
                      {team1Score !== team2Score && ' gagne !'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {team1Score} - {team2Score}
                    </p>
                  </div>

                  {showWinner && (
                    <button
                      onClick={hideWinnerScreen}
                      className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
                    >
                      Masquer l&apos;écran de victoire
                    </button>
                  )}

                  <button
                    onClick={startGame}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-5 w-5" />
                    🔄 NOUVELLE PARTIE
                  </button>
                </>
              )}
            </div>

            {/* Quitter - TOUJOURS visible */}
            <button
              onClick={exitGame}
              className="w-full mt-3 py-2 bg-red-500/30 hover:bg-red-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Quitter le jeu
            </button>
          </motion.div>
        )}
      </main>
    </div>
  )
}
