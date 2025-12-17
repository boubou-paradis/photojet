'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Monitor,
  X,
  Plus,
  Trash2,
  Play,
  Pause,
  SkipForward,
  Trophy,
  Music,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, BlindTestSong, BlindTestParticipant } from '@/types/database'
import { toast } from 'sonner'

// Default songs
const DEFAULT_SONGS: BlindTestSong[] = [
  { id: '1', title: 'Thriller', artist: 'Michael Jackson', points: 10 },
  { id: '2', title: 'Bohemian Rhapsody', artist: 'Queen', points: 10 },
  { id: '3', title: 'Billie Jean', artist: 'Michael Jackson', points: 10 },
  { id: '4', title: 'I Will Always Love You', artist: 'Whitney Houston', points: 10 },
  { id: '5', title: 'Sweet Child O Mine', artist: "Guns N' Roses", points: 10 },
]

export default function BlindTestPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [songs, setSongs] = useState<BlindTestSong[]>(DEFAULT_SONGS)
  const [newTitle, setNewTitle] = useState('')
  const [newArtist, setNewArtist] = useState('')
  const [uploadingAudio, setUploadingAudio] = useState<string | null>(null)

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [participants, setParticipants] = useState<BlindTestParticipant[]>([])

  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
  const router = useRouter()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`blindtest-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Broadcast game state
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    songs: BlindTestSong[]
    currentSongIndex: number
    isPlaying: boolean
    showAnswer: boolean
    timeLeft: number | null
    participants: BlindTestParticipant[]
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'blindtest_state',
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

      // Charger les songs depuis la DB (même si le jeu n'est pas actif)
      if (data.blindtest_songs) {
        try {
          setSongs(JSON.parse(data.blindtest_songs))
        } catch {
          setSongs(DEFAULT_SONGS)
        }
      }

      // Initialize game state from session si le jeu est actif
      if (data.blindtest_active) {
        setGameActive(true)
        setCurrentSongIndex(data.blindtest_current_song ?? 0)
        setIsPlaying(data.blindtest_is_playing ?? false)
        setShowAnswer(data.blindtest_show_answer ?? false)
        setTimeLeft(data.blindtest_time_left ?? null)
        if (data.blindtest_participants) {
          try {
            setParticipants(JSON.parse(data.blindtest_participants))
          } catch {
            setParticipants([])
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

  // Timer effect
  useEffect(() => {
    if (!isPlaying || timeLeft === null || timeLeft <= 0 || !session) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) return 0
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isPlaying, timeLeft, session])

  // Subscribe to realtime participants
  useEffect(() => {
    if (!session || !gameActive) return

    const channel = supabase
      .channel(`blindtest-realtime-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new.blindtest_participants) {
            try {
              setParticipants(JSON.parse(payload.new.blindtest_participants))
            } catch {
              // Ignore
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, gameActive, supabase])

  // Sauvegarder les songs dans la DB
  async function saveSongsToDatabase(updatedSongs: BlindTestSong[]) {
    if (!session) return
    await supabase
      .from('sessions')
      .update({ blindtest_songs: JSON.stringify(updatedSongs) })
      .eq('id', session.id)
  }

  function addSong() {
    if (!newTitle.trim() || !newArtist.trim()) return

    const newSong: BlindTestSong = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      artist: newArtist.trim(),
      points: 10,
    }
    const updatedSongs = [...songs, newSong]
    setSongs(updatedSongs)
    saveSongsToDatabase(updatedSongs)
    setNewTitle('')
    setNewArtist('')
  }

  function removeSong(id: string) {
    const updatedSongs = songs.filter(s => s.id !== id)
    setSongs(updatedSongs)
    saveSongsToDatabase(updatedSongs)
  }

  async function handleAudioUpload(songId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    setUploadingAudio(songId)
    try {
      const fileName = `blindtest_${session.id}_${songId}_${Date.now()}.${file.name.split('.').pop()}`
      const filePath = `blindtest-audio/${fileName}`

      const { error } = await supabase.storage.from('photos').upload(filePath, file)
      if (error) throw error

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath)

      const updatedSongs = songs.map(s => s.id === songId ? { ...s, audioUrl: urlData.publicUrl } : s)
      setSongs(updatedSongs)
      saveSongsToDatabase(updatedSongs)
      toast.success('Audio ajouté!')
    } catch (err) {
      console.error('Error uploading audio:', err)
      toast.error("Erreur lors de l'upload")
    } finally {
      setUploadingAudio(null)
    }
  }

  async function launchGame() {
    if (!session || songs.length === 0) {
      toast.error('Ajoutez au moins une chanson')
      return
    }

    setLaunching(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          blindtest_active: true,
          blindtest_songs: JSON.stringify(songs),
          blindtest_current_song: 0,
          blindtest_is_playing: false,
          blindtest_show_answer: false,
          blindtest_time_left: null,
          blindtest_answers: JSON.stringify([]),
          blindtest_participants: JSON.stringify([]),
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setCurrentSongIndex(0)
      setIsPlaying(false)
      setShowAnswer(false)
      setTimeLeft(null)
      setParticipants([])

      broadcastGameState({
        gameActive: true,
        songs,
        currentSongIndex: 0,
        isPlaying: false,
        showAnswer: false,
        timeLeft: null,
        participants: [],
      })

      toast.success('Jeu configuré!')
      window.open(`/live/${session.code}`, '_blank')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function playSong() {
    if (!session) return

    const currentSong = songs[currentSongIndex]
    if (!currentSong) return

    setIsPlaying(true)
    setShowAnswer(false)
    setTimeLeft(30)

    // Play audio if available
    if (currentSong.audioUrl && audioRef.current) {
      audioRef.current.src = currentSong.audioUrl
      audioRef.current.play()
    }

    await supabase
      .from('sessions')
      .update({
        blindtest_is_playing: true,
        blindtest_show_answer: false,
        blindtest_time_left: 30,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      songs,
      currentSongIndex,
      isPlaying: true,
      showAnswer: false,
      timeLeft: 30,
      participants,
    })

    toast.success('Chanson lancée!')
  }

  async function stopSong() {
    if (!session) return

    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }

    await supabase
      .from('sessions')
      .update({
        blindtest_is_playing: false,
        blindtest_time_left: timeLeft,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      songs,
      currentSongIndex,
      isPlaying: false,
      showAnswer,
      timeLeft,
      participants,
    })
  }

  async function revealAnswer() {
    if (!session) return

    setIsPlaying(false)
    setShowAnswer(true)
    if (audioRef.current) {
      audioRef.current.pause()
    }

    await supabase
      .from('sessions')
      .update({
        blindtest_is_playing: false,
        blindtest_show_answer: true,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      songs,
      currentSongIndex,
      isPlaying: false,
      showAnswer: true,
      timeLeft,
      participants,
    })
  }

  async function nextSong() {
    if (!session) return

    const nextIndex = currentSongIndex + 1
    if (nextIndex >= songs.length) {
      toast.info('Blind Test terminé!')
      return
    }

    setCurrentSongIndex(nextIndex)
    setIsPlaying(false)
    setShowAnswer(false)
    setTimeLeft(null)
    if (audioRef.current) {
      audioRef.current.pause()
    }

    await supabase
      .from('sessions')
      .update({
        blindtest_current_song: nextIndex,
        blindtest_is_playing: false,
        blindtest_show_answer: false,
        blindtest_time_left: null,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      songs,
      currentSongIndex: nextIndex,
      isPlaying: false,
      showAnswer: false,
      timeLeft: null,
      participants,
    })
  }

  async function exitGame() {
    if (!session) return

    // On garde les songs dans la DB, on reset juste l'état du jeu
    setGameActive(false)
    setCurrentSongIndex(0)
    setIsPlaying(false)
    setShowAnswer(false)
    setTimeLeft(null)
    setParticipants([])
    // Ne pas reset à DEFAULT_SONGS - garder la liste actuelle
    if (audioRef.current) {
      audioRef.current.pause()
    }

    await supabase
      .from('sessions')
      .update({
        blindtest_active: false,
        // On garde blindtest_songs intact !
        blindtest_current_song: 0,
        blindtest_is_playing: false,
        blindtest_show_answer: false,
        blindtest_time_left: null,
        blindtest_answers: JSON.stringify([]),
        blindtest_participants: JSON.stringify([]),
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: false,
      songs: [],
      currentSongIndex: 0,
      isPlaying: false,
      showAnswer: false,
      timeLeft: null,
      participants: [],
    })

    toast.success('Jeu arrêté - Configuration conservée')
    router.push('/admin/jeux')
  }

  // Fonction pour supprimer toutes les données (songs, audio)
  async function clearAllData() {
    if (!session) return

    if (!window.confirm('Supprimer toutes les chansons et audio ? Cette action est irréversible.')) {
      return
    }

    // Delete audio files from storage
    const audioUrls = songs.filter(s => s.audioUrl).map(s => s.audioUrl!)
    if (audioUrls.length > 0) {
      // Extract file paths from URLs
      const filePaths = audioUrls.map(url => {
        const match = url.match(/blindtest-audio\/[^?]+/)
        return match ? match[0] : null
      }).filter(Boolean) as string[]

      if (filePaths.length > 0) {
        await supabase.storage.from('photos').remove(filePaths)
      }
    }

    // Reset tout
    await supabase
      .from('sessions')
      .update({
        blindtest_active: false,
        blindtest_songs: null,
        blindtest_current_song: 0,
        blindtest_is_playing: false,
        blindtest_show_answer: false,
        blindtest_time_left: null,
        blindtest_answers: null,
        blindtest_participants: null,
      })
      .eq('id', session.id)

    setGameActive(false)
    setSongs(DEFAULT_SONGS)
    setParticipants([])

    toast.success('Toutes les données ont été supprimées')
  }

  const currentSong = songs[currentSongIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5)

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
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Header */}
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)]">
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
                <span className="text-xl">🎵</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Blind Test</h1>
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
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {!gameActive ? (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-[#242428] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🎵</span>
                <div>
                  <h2 className="text-xl font-bold text-white">Blind Test</h2>
                  <p className="text-gray-400 text-sm">Ajoutez vos chansons</p>
                </div>
              </div>

              {/* Add song */}
              <div className="flex gap-2 mb-4">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Titre..."
                  className="flex-1 bg-[#2E2E33] text-white rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                />
                <input
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder="Artiste..."
                  className="flex-1 bg-[#2E2E33] text-white rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && addSong()}
                />
                <button
                  onClick={addSong}
                  className="px-4 py-3 bg-[#D4AF37] text-black rounded-xl font-bold hover:bg-[#F4D03F] flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Songs list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {songs.map((song, index) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 bg-[#1A1A1E] rounded-lg p-3"
                  >
                    <span className="text-gray-500 font-mono text-sm w-6">{index + 1}.</span>
                    <Music className={`h-5 w-5 flex-shrink-0 ${song.audioUrl ? 'text-green-500' : 'text-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{song.title}</p>
                      <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                    </div>
                    {uploadingAudio === song.id ? (
                      <Loader2 className="h-5 w-5 text-[#D4AF37] animate-spin" />
                    ) : (
                      <button
                        onClick={() => fileInputRefs.current[song.id]?.click()}
                        className={`p-2 rounded-lg transition-colors ${
                          song.audioUrl
                            ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                            : 'bg-[#2E2E33] text-gray-400 hover:bg-[#3E3E43] hover:text-white'
                        }`}
                        title={song.audioUrl ? 'Audio ajouté' : 'Ajouter audio'}
                      >
                        <Upload className="h-4 w-4" />
                      </button>
                    )}
                    <input
                      type="file"
                      accept="audio/*"
                      ref={(el) => { fileInputRefs.current[song.id] = el }}
                      onChange={(e) => handleAudioUpload(song.id, e)}
                      className="hidden"
                    />
                    <button
                      onClick={() => removeSong(song.id)}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-gray-500 text-xs mt-3">
                {songs.length} chansons • {songs.filter(s => s.audioUrl).length} avec audio
              </p>
            </div>

            {/* Launch button */}
            <button
              onClick={launchGame}
              disabled={launching || songs.length === 0}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Lancer le blind test ({songs.length} chansons)</>
              )}
            </button>

            {/* Clear data button */}
            {songs.length > 0 && songs !== DEFAULT_SONGS && (
              <button
                onClick={clearAllData}
                className="w-full py-3 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer toutes les chansons
              </button>
            )}
          </motion.div>
        ) : (
          /* Control Panel */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 bg-[#242428] rounded-xl p-4 border-2 border-[#D4AF37]"
            >
              {/* Song info */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[#D4AF37] font-bold">
                  Chanson {currentSongIndex + 1}/{songs.length}
                </span>
                {timeLeft !== null && (
                  <span className={`text-2xl font-bold font-mono ${
                    timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
                  }`}>
                    {timeLeft}s
                  </span>
                )}
              </div>

              {currentSong && (
                <div className="bg-[#1A1A1E] rounded-lg p-6 mb-4 text-center">
                  {isPlaying && !showAnswer && (
                    <div className="flex justify-center items-center gap-1 mb-4">
                      {[...Array(20)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-[#D4AF37] rounded-full"
                          animate={{
                            height: [10, Math.random() * 40 + 10, 10],
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            delay: i * 0.05,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {showAnswer ? (
                    <>
                      <p className="text-3xl font-bold text-white mb-2">{currentSong.title}</p>
                      <p className="text-xl text-[#D4AF37]">{currentSong.artist}</p>
                    </>
                  ) : (
                    <p className="text-xl text-gray-400">
                      {isPlaying ? '🎵 En écoute...' : 'Prêt à jouer'}
                    </p>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="space-y-2">
                {!isPlaying && !showAnswer && (
                  <button
                    onClick={playSong}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Play className="h-5 w-5" />
                    Jouer l&apos;extrait
                  </button>
                )}

                {isPlaying && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={stopSong}
                      className="py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                    >
                      <Pause className="h-5 w-5" />
                      Pause
                    </button>
                    <button
                      onClick={revealAnswer}
                      className="py-3 bg-[#D4AF37] hover:bg-[#F4D03F] text-black rounded-lg font-bold flex items-center justify-center gap-2"
                    >
                      <Eye className="h-5 w-5" />
                      Révéler
                    </button>
                  </div>
                )}

                {showAnswer && currentSongIndex < songs.length - 1 && (
                  <button
                    onClick={nextSong}
                    className="w-full py-3 bg-[#D4AF37] hover:bg-[#F4D03F] text-black rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <SkipForward className="h-5 w-5" />
                    Chanson suivante
                  </button>
                )}

                {showAnswer && currentSongIndex >= songs.length - 1 && (
                  <div className="text-center py-4 text-[#D4AF37] font-bold text-xl">
                    🎉 Blind Test terminé!
                  </div>
                )}
              </div>

              {/* Quitter */}
              <button
                onClick={exitGame}
                className="w-full mt-4 py-2 bg-red-500/30 hover:bg-red-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Quitter le jeu
              </button>
            </motion.div>

            {/* Leaderboard */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#242428] rounded-xl p-4"
            >
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#D4AF37]" />
                Classement
              </h3>

              {sortedParticipants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  En attente des joueurs...
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedParticipants.map((p, index) => (
                    <div key={p.odientId} className="flex items-center gap-2 bg-[#1A1A1E] rounded-lg p-2">
                      <span className={`font-bold w-6 text-center ${
                        index === 0 ? 'text-[#FFD700]' : index === 1 ? 'text-[#C0C0C0]' : index === 2 ? 'text-[#CD7F32]' : 'text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-white flex-1 truncate">{p.odientName}</span>
                      <span className="text-[#D4AF37] font-bold">{p.totalScore}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Playlist */}
              <div className="mt-4 bg-[#1A1A1E] rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-2">Playlist</p>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {songs.map((song, index) => (
                    <div
                      key={song.id}
                      className={`flex items-center gap-2 text-sm p-1 rounded ${
                        index === currentSongIndex ? 'bg-[#D4AF37]/20' : ''
                      }`}
                    >
                      <span className={`w-5 ${
                        index < currentSongIndex ? 'text-green-500' : index === currentSongIndex ? 'text-[#D4AF37]' : 'text-gray-500'
                      }`}>
                        {index < currentSongIndex ? '✓' : index === currentSongIndex ? '▶' : (index + 1)}
                      </span>
                      <span className={`truncate ${
                        index <= currentSongIndex && showAnswer ? 'text-white' : 'text-gray-400'
                      }`}>
                        {index <= currentSongIndex && showAnswer ? song.title : '???'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  )
}
