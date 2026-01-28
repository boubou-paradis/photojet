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
  SkipForward,
  Trophy,
  HelpCircle,
  Check,
  Timer,
  BarChart3,
  Music,
  Volume2,
  VolumeX,
  Award,
  Pause,
  Upload,
  Square,
  Download,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, QuizQuestion, QuizParticipant } from '@/types/database'
import { toast } from 'sonner'

// Default questions (Mariage)
const DEFAULT_QUESTIONS: QuizQuestion[] = [
  {
    id: '1',
    question: 'Où se sont rencontrés les mariés ?',
    answers: ['Au travail', 'En soirée', 'Sur une app', 'Par des amis'],
    correctAnswer: 0,
    timeLimit: 20,
    points: 10,
  },
  {
    id: '2',
    question: 'Quelle est la date de leur premier rendez-vous ?',
    answers: ['Janvier 2020', 'Mars 2020', 'Juin 2019', 'Décembre 2019'],
    correctAnswer: 1,
    timeLimit: 15,
    points: 10,
  },
  {
    id: '3',
    question: 'Quel est le plat préféré du marié ?',
    answers: ['Pizza', 'Sushi', 'Burger', 'Pasta'],
    correctAnswer: 2,
    timeLimit: 15,
    points: 10,
  },
]

export default function QuizPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [questions, setQuestions] = useState<QuizQuestion[]>(DEFAULT_QUESTIONS)
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null)

  // Game state
  const [lobbyVisible, setLobbyVisible] = useState(false) // Lobby affiché mais quiz pas encore lancé
  const [gameActive, setGameActive] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isAnswering, setIsAnswering] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [participants, setParticipants] = useState<QuizParticipant[]>([])
  const [answerStats, setAnswerStats] = useState<number[]>([0, 0, 0, 0])
  const [showPodium, setShowPodium] = useState(false)

  // Audio global (musique de fond)
  const [quizAudio, setQuizAudio] = useState<string | null>(null)
  const [quizAudioName, setQuizAudioName] = useState<string | null>(null)
  const [quizAudioVolume, setQuizAudioVolume] = useState(0.7)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Audio par question (preview) — utilise answerAudioVolume pour le jeu
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false)
  const [audioUploading, setAudioUploading] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const questionAudioInputRef = useRef<HTMLInputElement>(null)

  // Audio de la bonne réponse (lecture en jeu)
  const [isAnswerAudioPlaying, setIsAnswerAudioPlaying] = useState(false)
  const [answerAudioVolume, setAnswerAudioVolume] = useState(0.7)
  const answerAudioRef = useRef<HTMLAudioElement | null>(null)
  // Cache local des blobs audio pour éviter de re-télécharger depuis Supabase
  const audioLocalCacheRef = useRef<Map<string, string>>(new Map())

  // Import CSV
  const [showCsvImportModal, setShowCsvImportModal] = useState(false)
  const [csvPreviewQuestions, setCsvPreviewQuestions] = useState<QuizQuestion[]>([])
  const [csvImportErrors, setCsvImportErrors] = useState<string[]>([])
  const csvInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`quiz-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Broadcast game state
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    lobbyVisible?: boolean
    questions: QuizQuestion[]
    currentQuestionIndex: number
    isAnswering: boolean
    showResults: boolean
    timeLeft: number | null
    participants: QuizParticipant[]
    answerStats: number[]
    isFinished?: boolean
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'quiz_state',
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

      // Charger les questions depuis la DB (même si le jeu n'est pas actif)
      if (data.quiz_questions) {
        try {
          setQuestions(JSON.parse(data.quiz_questions))
        } catch {
          setQuestions(DEFAULT_QUESTIONS)
        }
      }

      // Initialize game state from session si le jeu est actif
      if (data.quiz_active) {
        setGameActive(true)
        setCurrentQuestionIndex(data.quiz_current_question ?? 0)
        setIsAnswering(data.quiz_is_answering ?? false)
        setShowResults(data.quiz_show_results ?? false)
        setTimeLeft(data.quiz_time_left ?? null)
        if (data.quiz_participants) {
          try {
            setParticipants(JSON.parse(data.quiz_participants))
          } catch {
            setParticipants([])
          }
        }
      } else {
        // Si le quiz n'est pas actif mais quiz_lobby_visible est true, on reset
        // Cela permet au diaporama de reprendre normalement
        if (data.quiz_lobby_visible === true) {
          console.log('Reset quiz_lobby_visible car quiz non actif')
          await supabase
            .from('sessions')
            .update({ quiz_lobby_visible: false })
            .eq('id', data.id)
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
    if (!isAnswering || timeLeft === null || timeLeft <= 0 || !session) return

    const timer = setInterval(async () => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 0) return 0
        const newTime = prev - 1

        if (newTime <= 0) {
          // Time's up - reveal answer
          setIsAnswering(false)
          setShowResults(true)
          pauseAudio()
          playAnswerAudio()
          supabase
            .from('sessions')
            .update({
              quiz_is_answering: false,
              quiz_show_results: true,
              quiz_time_left: 0,
            })
            .eq('id', session.id)

          broadcastGameState({
            gameActive: true,
            questions,
            currentQuestionIndex,
            isAnswering: false,
            showResults: true,
            timeLeft: 0,
            participants,
            answerStats,
          })
        } else {
          supabase
            .from('sessions')
            .update({ quiz_time_left: newTime })
            .eq('id', session.id)

          // Broadcast time update every second for phone sync
          broadcastGameState({
            gameActive: true,
            questions,
            currentQuestionIndex,
            isAnswering: true,
            showResults: false,
            timeLeft: newTime,
            participants,
            answerStats,
          })
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isAnswering, timeLeft, session, questions, currentQuestionIndex, participants, answerStats, broadcastGameState, supabase])

  // Subscribe to realtime answers (also works in lobby mode)
  useEffect(() => {
    if (!session || (!gameActive && !lobbyVisible)) return

    const channel = supabase
      .channel(`quiz-realtime-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if (payload.new.quiz_participants) {
            try {
              setParticipants(JSON.parse(payload.new.quiz_participants))
            } catch {
              // Ignore
            }
          }
          if (payload.new.quiz_answers) {
            try {
              const answers = JSON.parse(payload.new.quiz_answers)
              // Calculate stats for current question
              const currentQ = questions[currentQuestionIndex]
              if (currentQ) {
                const stats = [0, 0, 0, 0]
                answers.filter((a: { questionId: string }) => a.questionId === currentQ.id).forEach((a: { answerIndex: number }) => {
                  if (a.answerIndex >= 0 && a.answerIndex < 4) {
                    stats[a.answerIndex]++
                  }
                })
                setAnswerStats(stats)
              }
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
  }, [session, gameActive, lobbyVisible, questions, currentQuestionIndex, supabase])

  // Sauvegarder les questions dans la DB
  async function saveQuestionsToDatabase(updatedQuestions: QuizQuestion[]) {
    if (!session) return
    await supabase
      .from('sessions')
      .update({ quiz_questions: JSON.stringify(updatedQuestions) })
      .eq('id', session.id)
  }

  function addQuestion() {
    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      question: 'Nouvelle question ?',
      answers: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'],
      correctAnswer: 0,
      timeLimit: 20,
      points: 10,
    }
    const updatedQuestions = [...questions, newQuestion]
    setQuestions(updatedQuestions)
    saveQuestionsToDatabase(updatedQuestions)
    setEditingQuestion(newQuestion)
  }

  function updateQuestion(updated: QuizQuestion) {
    const updatedQuestions = questions.map(q => q.id === updated.id ? updated : q)
    setQuestions(updatedQuestions)
    saveQuestionsToDatabase(updatedQuestions)
  }

  function removeQuestion(id: string) {
    const updatedQuestions = questions.filter(q => q.id !== id)
    setQuestions(updatedQuestions)
    saveQuestionsToDatabase(updatedQuestions)
    if (editingQuestion?.id === id) setEditingQuestion(null)
  }

  // ========== Import/Export CSV ==========

  function handleCsvFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      parseCsvContent(text)
    }
    reader.readAsText(file, 'UTF-8')

    // Reset input
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  function parseCsvContent(text: string) {
    const errors: string[] = []
    const parsedQuestions: QuizQuestion[] = []

    // Split lignes et ignorer les vides
    const lines = text.split(/\r?\n/).filter(line => line.trim())

    if (lines.length < 2) {
      errors.push('Le fichier doit contenir au moins une ligne d\'en-tête et une question')
      setCsvImportErrors(errors)
      setCsvPreviewQuestions([])
      setShowCsvImportModal(true)
      return
    }

    // Ignorer la première ligne (en-tête)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Parser avec point-virgule, gérer les guillemets
      const cols = parseCsvLine(line)

      if (cols.length < 6) {
        errors.push(`Ligne ${i + 1}: Pas assez de colonnes (${cols.length}/6 minimum)`)
        continue
      }

      const [question, rep1, rep2, rep3, rep4, bonneRepStr, tempsStr, pointsStr, audioFile] = cols

      if (!question || !rep1 || !rep2 || !rep3 || !rep4) {
        errors.push(`Ligne ${i + 1}: Question ou réponses manquantes`)
        continue
      }

      const bonneRep = parseInt(bonneRepStr || '1', 10)
      if (bonneRep < 1 || bonneRep > 4 || isNaN(bonneRep)) {
        errors.push(`Ligne ${i + 1}: Bonne réponse doit être 1, 2, 3 ou 4 (reçu: "${bonneRepStr}")`)
        continue
      }

      const temps = parseInt(tempsStr || '20', 10) || 20
      const points = parseInt(pointsStr || '10', 10) || 10

      parsedQuestions.push({
        id: `csv_${Date.now()}_${i}`,
        question: question.trim(),
        answers: [rep1.trim(), rep2.trim(), rep3.trim(), rep4.trim()],
        correctAnswer: bonneRep - 1, // Index 0-based
        timeLimit: Math.max(5, Math.min(120, temps)),
        points: Math.max(1, points),
        audioUrl: undefined,
        // Stocker le nom du fichier audio pour référence
        ...(audioFile?.trim() ? { audioFileName: audioFile.trim().replace(/\.[^.]+$/, ''), pendingAudioFile: audioFile.trim() } : {}),
      } as QuizQuestion)
    }

    setCsvPreviewQuestions(parsedQuestions)
    setCsvImportErrors(errors)
    setShowCsvImportModal(true)
  }

  // Parser une ligne CSV avec gestion des guillemets
  function parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  function confirmCsvImport() {
    if (csvPreviewQuestions.length === 0) return

    const updatedQuestions = [...questions, ...csvPreviewQuestions]
    setQuestions(updatedQuestions)
    saveQuestionsToDatabase(updatedQuestions)

    const audioCount = csvPreviewQuestions.filter(q => (q as QuizQuestion & { pendingAudioFile?: string }).pendingAudioFile).length
    let message = `${csvPreviewQuestions.length} question(s) importée(s)`
    if (audioCount > 0) {
      message += ` — ${audioCount} fichier(s) audio à ajouter manuellement`
    }
    toast.success(message)

    setShowCsvImportModal(false)
    setCsvPreviewQuestions([])
    setCsvImportErrors([])
  }

  function exportToCsv() {
    if (questions.length === 0) {
      toast.error('Aucune question à exporter')
      return
    }

    const header = 'question;reponse1;reponse2;reponse3;reponse4;bonne_reponse;temps;points;fichier_audio'
    const lines = questions.map(q => {
      const audioFileName = (q as QuizQuestion & { audioFileName?: string }).audioFileName || ''
      return [
        escapeCsvField(q.question),
        escapeCsvField(q.answers[0] || ''),
        escapeCsvField(q.answers[1] || ''),
        escapeCsvField(q.answers[2] || ''),
        escapeCsvField(q.answers[3] || ''),
        q.correctAnswer + 1, // 1-based pour l'export
        q.timeLimit,
        q.points,
        escapeCsvField(audioFileName),
      ].join(';')
    })

    const csvContent = [header, ...lines].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' }) // BOM pour Excel
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quiz_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(`${questions.length} question(s) exportée(s)`)
  }

  function escapeCsvField(field: string): string {
    if (field.includes(';') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  // Upload audio pour une question spécifique
  async function handleQuestionAudioUpload(e: React.ChangeEvent<HTMLInputElement>, questionId: string) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    if (!file.type.startsWith('audio/')) {
      toast.error('Seuls les fichiers audio sont acceptés')
      return
    }

    // 1. Créer le blob local IMMÉDIATEMENT pour prévisualisation instantanée
    const localBlobUrl = URL.createObjectURL(file)
    const audioFileName = file.name.replace(/\.[^.]+$/, '')

    // 2. Mettre à jour l'UI immédiatement avec le blob local
    const tempUpdated = {
      ...editingQuestion!,
      audioUrl: localBlobUrl,
      audioFileName
    } as QuizQuestion
    setEditingQuestion(tempUpdated)

    // Mettre en cache pour lecture instantanée
    audioLocalCacheRef.current.set(localBlobUrl, localBlobUrl)

    toast.success('Audio prêt ! Upload en cours...')
    setAudioUploading(true)

    // 3. Uploader en arrière-plan vers Supabase
    try {
      const fileName = `quiz-audio/${session.id}_${questionId}_${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
      const supabaseUrl = urlData.publicUrl

      // 4. Mettre à jour avec l'URL Supabase pour persistance
      audioLocalCacheRef.current.set(supabaseUrl, localBlobUrl)

      const finalUpdated = {
        ...editingQuestion!,
        audioUrl: supabaseUrl,
        audioFileName
      } as QuizQuestion
      setEditingQuestion(finalUpdated)
      updateQuestion(finalUpdated)

      toast.success('Audio sauvegardé !')
    } catch (err) {
      console.error('Error uploading audio:', err)
      toast.error('Erreur upload - L\'audio fonctionne localement mais ne sera pas sauvegardé')
      // Garder le blob local quand même pour cette session
      updateQuestion(tempUpdated)
    } finally {
      setAudioUploading(false)
    }

    // Reset input
    if (questionAudioInputRef.current) questionAudioInputRef.current.value = ''
  }

  async function removeQuestionAudio(questionId: string) {
    if (!editingQuestion) return

    // Supprimer le fichier du storage si possible
    if (editingQuestion.audioUrl) {
      const path = editingQuestion.audioUrl.match(/photos\/(.+)/)
      if (path?.[1]) {
        await supabase.storage.from('photos').remove([decodeURIComponent(path[1])])
      }
    }

    const updated = { ...editingQuestion, audioUrl: null }
    setEditingQuestion(updated)
    updateQuestion(updated)
    stopPreviewAudio()
    toast.success('Audio supprimé')
  }

  function togglePreviewAudio(url: string) {
    // Si un audio est en cours, l'arrêter
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
      // Si on était en lecture, on arrête et c'est tout
      if (previewAudioPlaying) {
        setPreviewAudioPlaying(false)
        return
      }
    }

    // Lancer la lecture
    setPreviewAudioPlaying(false) // Reset état
    const cachedUrl = audioLocalCacheRef.current.get(url) || url
    const audio = new Audio(cachedUrl)
    audio.volume = answerAudioVolume
    audio.onended = () => {
      setPreviewAudioPlaying(false)
      previewAudioRef.current = null
    }
    audio.onerror = () => {
      setPreviewAudioPlaying(false)
      previewAudioRef.current = null
      toast.error('Impossible de lire l\'audio')
    }
    previewAudioRef.current = audio
    audio.play().then(() => {
      setPreviewAudioPlaying(true)
    }).catch(() => {
      setPreviewAudioPlaying(false)
      previewAudioRef.current = null
      toast.error('Impossible de lire l\'audio')
    })
  }

  function stopPreviewAudio() {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
      setPreviewAudioPlaying(false)
    }
  }

  // Afficher le lobby (sans lancer le quiz)
  async function showLobby() {
    if (!session || questions.length === 0) {
      toast.error('Ajoutez au moins une question')
      return
    }

    setLaunching(true)
    try {
      console.log('showLobby: updating session', session.id, 'code:', session.code)
      const { error, data } = await supabase
        .from('sessions')
        .update({
          quiz_active: false, // Quiz pas encore actif
          quiz_lobby_visible: true, // Lobby visible
          quiz_questions: JSON.stringify(questions),
          quiz_current_question: 0,
          quiz_is_answering: false,
          quiz_show_results: false,
          quiz_time_left: null,
          quiz_answers: JSON.stringify([]),
          quiz_participants: JSON.stringify([]),
        })
        .eq('id', session.id)
        .select()

      console.log('showLobby: Supabase response:', { error, data })

      if (error) throw error

      setLobbyVisible(true)
      setParticipants([])

      broadcastGameState({
        gameActive: false,
        lobbyVisible: true,
        questions,
        currentQuestionIndex: 0,
        isAnswering: false,
        showResults: false,
        timeLeft: null,
        participants: [],
        answerStats: [0, 0, 0, 0],
      })

      // Lancer la musique de fond automatiquement
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {})
      }

      toast.success(`Lobby affiché! Code: ${session.code}`)
      console.log('showLobby: opening /live/' + session.code)
      window.open(`/live/${session.code}`, 'photojet-live')
    } catch (err) {
      console.error('Error showing lobby:', err)
      toast.error('Erreur lors de l\'affichage du lobby')
    } finally {
      setLaunching(false)
    }
  }

  // Lancer le quiz (après le lobby)
  async function launchGame() {
    if (!session || questions.length === 0) {
      toast.error('Ajoutez au moins une question')
      return
    }

    setLaunching(true)
    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          quiz_active: true,
          quiz_lobby_visible: false,
          quiz_questions: JSON.stringify(questions),
          quiz_current_question: 0,
          quiz_is_answering: false,
          quiz_show_results: false,
          quiz_time_left: null,
        })
        .eq('id', session.id)

      if (error) throw error

      setLobbyVisible(false)
      setGameActive(true)
      setCurrentQuestionIndex(0)
      setIsAnswering(false)
      setShowResults(false)
      setTimeLeft(null)
      setAnswerStats([0, 0, 0, 0])

      broadcastGameState({
        gameActive: true,
        questions,
        currentQuestionIndex: 0,
        isAnswering: false,
        showResults: false,
        timeLeft: null,
        participants,
        answerStats: [0, 0, 0, 0],
      })

      toast.success('Quiz lancé!')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function startQuestion() {
    if (!session) return

    const currentQ = questions[currentQuestionIndex]
    if (!currentQ) return

    setIsAnswering(true)
    setShowResults(false)
    setTimeLeft(currentQ.timeLimit)
    setAnswerStats([0, 0, 0, 0])

    // Play background audio if available
    playAudio()

    // Précharger l'audio de la réponse pendant que les joueurs répondent
    preloadAnswerAudio()

    await supabase
      .from('sessions')
      .update({
        quiz_is_answering: true,
        quiz_show_results: false,
        quiz_time_left: currentQ.timeLimit,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      questions,
      currentQuestionIndex,
      isAnswering: true,
      showResults: false,
      timeLeft: currentQ.timeLimit,
      participants,
      answerStats: [0, 0, 0, 0],
    })

    toast.success('Question lancée!')
  }

  async function revealAnswer() {
    if (!session) return

    setIsAnswering(false)
    setShowResults(true)

    // Pause background audio & play answer audio
    pauseAudio()
    playAnswerAudio()

    await supabase
      .from('sessions')
      .update({
        quiz_is_answering: false,
        quiz_show_results: true,
        quiz_time_left: 0,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      questions,
      currentQuestionIndex,
      isAnswering: false,
      showResults: true,
      timeLeft: 0,
      participants,
      answerStats,
    })
  }

  async function nextQuestion() {
    if (!session) return

    // Stopper l'audio de la réponse précédente & relancer la musique de fond
    stopAnswerAudio()
    if (audioRef.current) {
      audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {})
    }

    const nextIndex = currentQuestionIndex + 1
    if (nextIndex >= questions.length) {
      toast.info('Quiz terminé!')
      return
    }

    setCurrentQuestionIndex(nextIndex)
    setIsAnswering(false)
    setShowResults(false)
    setTimeLeft(null)
    setAnswerStats([0, 0, 0, 0])

    await supabase
      .from('sessions')
      .update({
        quiz_current_question: nextIndex,
        quiz_is_answering: false,
        quiz_show_results: false,
        quiz_time_left: null,
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      questions,
      currentQuestionIndex: nextIndex,
      isAnswering: false,
      showResults: false,
      timeLeft: null,
      participants,
      answerStats: [0, 0, 0, 0],
    })
  }

  async function exitGame() {
    if (!session) return

    // Stopper tout audio
    stopAnswerAudio()
    pauseAudio()

    // On garde les questions dans la DB, on reset juste l'état du jeu
    setGameActive(false)
    setCurrentQuestionIndex(0)
    setIsAnswering(false)
    setShowResults(false)
    setTimeLeft(null)
    setParticipants([])
    setAnswerStats([0, 0, 0, 0])
    // Ne pas reset à DEFAULT_QUESTIONS - garder la liste actuelle

    await supabase
      .from('sessions')
      .update({
        quiz_active: false,
        quiz_lobby_visible: false, // IMPORTANT: reset pour que le diaporama reprenne
        // On garde quiz_questions intact !
        quiz_current_question: 0,
        quiz_is_answering: false,
        quiz_show_results: false,
        quiz_time_left: null,
        quiz_answers: JSON.stringify([]),
        quiz_participants: JSON.stringify([]),
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: false,
      questions: [],
      currentQuestionIndex: 0,
      isAnswering: false,
      showResults: false,
      timeLeft: null,
      participants: [],
      answerStats: [0, 0, 0, 0],
    })

    toast.success('Jeu arrêté - Configuration conservée')
    router.push('/admin/jeux')
  }

  // Fonction pour supprimer toutes les données (questions)
  async function clearAllData() {
    if (!session) return

    if (!window.confirm('Supprimer toutes les questions ? Cette action est irréversible.')) {
      return
    }

    await supabase
      .from('sessions')
      .update({
        quiz_active: false,
        quiz_questions: null,
        quiz_current_question: 0,
        quiz_is_answering: false,
        quiz_show_results: false,
        quiz_time_left: null,
        quiz_answers: null,
        quiz_participants: null,
      })
      .eq('id', session.id)

    setGameActive(false)
    setQuestions(DEFAULT_QUESTIONS)
    setParticipants([])
    setEditingQuestion(null)

    toast.success('Toutes les données ont été supprimées')
  }

  // Afficher le podium final
  function displayPodium() {
    setShowPodium(true)
    // Stopper audio de réponse + musique de fond
    stopAnswerAudio()
    if (audioRef.current) {
      audioRef.current.pause()
    }
    broadcastGameState({
      gameActive: true,
      questions,
      currentQuestionIndex,
      isAnswering: false,
      showResults: true,
      timeLeft: null,
      participants,
      answerStats,
      isFinished: true,
    })
    toast.success('Podium affiché!')
  }

  // Handle audio file upload
  function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setQuizAudio(url)
      setQuizAudioName(file.name.replace(/\.[^.]+$/, ''))

      // Create audio element
      const audio = new Audio(url)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = quizAudioVolume
      audio.onplay = () => setIsAudioPlaying(true)
      audio.onpause = () => setIsAudioPlaying(false)
      audio.onended = () => setIsAudioPlaying(false)
      audioRef.current = audio

      toast.success('Musique chargée!')
    }
  }

  // Changer le volume
  function changeVolume(newVolume: number) {
    const clamped = Math.max(0, Math.min(1, newVolume))
    setQuizAudioVolume(clamped)
    if (audioRef.current) {
      audioRef.current.volume = clamped
    }
  }

  // Play/pause audio
  function toggleAudio() {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => {
        setIsAudioPlaying(true)
      }).catch(err => {
        console.error('Audio play failed:', err)
        toast.error('Cliquez à nouveau pour lancer la musique')
      })
    } else {
      audioRef.current.pause()
      setIsAudioPlaying(false)
    }
  }

  // Play audio (for question start)
  function playAudio() {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0
    audioRef.current.play().then(() => {
      setIsAudioPlaying(true)
    }).catch(err => {
      console.error('Audio play failed:', err)
    })
  }

  // Pause audio
  function pauseAudio() {
    if (!audioRef.current) return
    audioRef.current.pause()
    setIsAudioPlaying(false)
  }

  // Précharger l'audio de la réponse en arrière-plan
  function preloadAnswerAudio() {
    const currentQ = questions[currentQuestionIndex]
    if (!currentQ?.audioUrl) return

    // Nettoyer un éventuel préchargement précédent
    if (answerAudioRef.current) {
      answerAudioRef.current.pause()
      answerAudioRef.current = null
    }

    const audioUrl = currentQ.audioUrl
    const cachedBlobUrl = audioLocalCacheRef.current.get(audioUrl)

    function createAudioElement(src: string) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.volume = answerAudioVolume
      audio.onplay = () => setIsAnswerAudioPlaying(true)
      audio.onpause = () => setIsAnswerAudioPlaying(false)
      audio.onended = () => {
        setIsAnswerAudioPlaying(false)
        answerAudioRef.current = null
      }
      audio.src = src
      answerAudioRef.current = audio
    }

    if (cachedBlobUrl) {
      // Blob local disponible → lecture instantanée
      createAudioElement(cachedBlobUrl)
    } else {
      // Pas de cache local → télécharger en blob pour lecture rapide
      fetch(audioUrl)
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob)
          audioLocalCacheRef.current.set(audioUrl, blobUrl)
          // Ne créer l'élément que si on est toujours sur la même question
          if (questions[currentQuestionIndex]?.audioUrl === audioUrl) {
            createAudioElement(blobUrl)
          }
        })
        .catch(() => {
          // Fallback : utiliser l'URL directe
          createAudioElement(audioUrl)
        })
    }
  }

  // Jouer l'audio de la bonne réponse (déjà préchargé)
  function playAnswerAudio() {
    if (!answerAudioRef.current) {
      // Fallback si pas préchargé
      const currentQ = questions[currentQuestionIndex]
      if (!currentQ?.audioUrl) return
      preloadAnswerAudio()
    }

    if (answerAudioRef.current) {
      answerAudioRef.current.currentTime = 0
      answerAudioRef.current.play().then(() => {
        setIsAnswerAudioPlaying(true)
      }).catch(err => {
        console.error('Answer audio play failed:', err)
      })
    }
  }

  // Arrêter l'audio de la bonne réponse
  function stopAnswerAudio() {
    if (answerAudioRef.current) {
      answerAudioRef.current.pause()
      answerAudioRef.current.currentTime = 0
      answerAudioRef.current = null
      setIsAnswerAudioPlaying(false)
    }
  }

  // Changer le volume de l'audio réponse (preview + jeu)
  function changeAnswerAudioVolume(newVolume: number) {
    const clamped = Math.max(0, Math.min(1, newVolume))
    setAnswerAudioVolume(clamped)
    if (answerAudioRef.current) {
      answerAudioRef.current.volume = clamped
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = clamped
    }
  }

  // Toggle play/pause de l'audio de la bonne réponse
  function toggleAnswerAudio() {
    if (!answerAudioRef.current) return
    if (answerAudioRef.current.paused) {
      answerAudioRef.current.play().then(() => setIsAnswerAudioPlaying(true))
    } else {
      answerAudioRef.current.pause()
      setIsAnswerAudioPlaying(false)
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.totalScore - a.totalScore).slice(0, 10)
  const totalAnswers = answerStats.reduce((a, b) => a + b, 0)

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
    <div className="min-h-screen bg-[#0D0D0F] relative">
      {/* Animated background effects - Red/Orange theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                // Reset lobby si visible avant de quitter
                if (lobbyVisible && !gameActive && session?.id) {
                  // Broadcast pour fermer le lobby immédiatement
                  broadcastGameState({
                    gameActive: false,
                    lobbyVisible: false,
                    questions: [],
                    currentQuestionIndex: 0,
                    isAnswering: false,
                    showResults: false,
                    timeLeft: null,
                    participants: [],
                    answerStats: [0, 0, 0, 0],
                  })
                  await supabase
                    .from('sessions')
                    .update({ quiz_lobby_visible: false })
                    .eq('id', session.id)
                }
                router.push('/admin/jeux')
              }}
              className="text-white hover:text-[#D4AF37]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                <span className="text-xl">❓</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Quiz</h1>
                <p className="text-sm text-[#6B6B70]">{session.name}</p>
              </div>
            </div>
          </div>
          {gameActive && (
            <Button
              size="sm"
              onClick={() => window.open(`/live/${session.code}`, 'photojet-live')}
              className="bg-[#D4AF37] text-[#1A1A1E] hover:bg-[#F4D03F]"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Voir le diaporama
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {!gameActive ? (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-[#242428] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">❓</span>
                  <div>
                    <h2 className="text-xl font-bold text-white">Quiz</h2>
                    <p className="text-gray-400 text-sm">Créez vos questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="px-3 py-2 bg-[#2E2E33] text-gray-300 rounded-xl hover:bg-[#3E3E43] flex items-center gap-2 text-sm"
                    title="Importer depuis CSV"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Importer
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={exportToCsv}
                    className="px-3 py-2 bg-[#2E2E33] text-gray-300 rounded-xl hover:bg-[#3E3E43] flex items-center gap-2 text-sm"
                    title="Exporter en CSV"
                  >
                    <Download className="h-4 w-4" />
                    Exporter
                  </button>
                  <button
                    onClick={addQuestion}
                    className="px-4 py-2 bg-[#D4AF37] text-black rounded-xl font-bold hover:bg-[#F4D03F] flex items-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    className={`flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-all ${
                      editingQuestion?.id === q.id ? 'bg-[#D4AF37]/20 border border-[#D4AF37]' : 'bg-[#1A1A1E] hover:bg-[#2E2E33]'
                    }`}
                    onClick={() => setEditingQuestion(q)}
                  >
                    <span className="text-gray-500 font-mono text-sm w-6">{index + 1}.</span>
                    <span className="flex-1 text-white truncate">{q.question}</span>
                    {q.audioUrl && (
                      <Music className="h-3.5 w-3.5 text-[#E91E63] flex-shrink-0" />
                    )}
                    <span className="px-2 py-1 bg-[#D4AF37]/20 text-[#D4AF37] rounded text-xs">
                      {q.timeLimit}s
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                      className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Question editor */}
            {editingQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#242428] rounded-xl p-6"
              >
                <h3 className="text-white font-bold mb-4">Modifier la question</h3>
                <div className="space-y-4">
                  <input
                    value={editingQuestion.question}
                    onChange={(e) => {
                      const updated = { ...editingQuestion, question: e.target.value }
                      setEditingQuestion(updated)
                      updateQuestion(updated)
                    }}
                    placeholder="Question..."
                    className="w-full bg-[#2E2E33] text-white rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {editingQuestion.answers.map((answer, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const updated = { ...editingQuestion, correctAnswer: i }
                            setEditingQuestion(updated)
                            updateQuestion(updated)
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            editingQuestion.correctAnswer === i
                              ? 'bg-green-500 text-white'
                              : 'bg-[#2E2E33] text-gray-500 hover:bg-[#3E3E43]'
                          }`}
                        >
                          {editingQuestion.correctAnswer === i && <Check className="h-4 w-4" />}
                        </button>
                        <input
                          value={answer}
                          onChange={(e) => {
                            const newAnswers = [...editingQuestion.answers]
                            newAnswers[i] = e.target.value
                            const updated = { ...editingQuestion, answers: newAnswers }
                            setEditingQuestion(updated)
                            updateQuestion(updated)
                          }}
                          placeholder={`Réponse ${i + 1}`}
                          className="flex-1 bg-[#2E2E33] text-white rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs">Temps (sec)</label>
                      <select
                        value={editingQuestion.timeLimit}
                        onChange={(e) => {
                          const updated = { ...editingQuestion, timeLimit: Number(e.target.value) }
                          setEditingQuestion(updated)
                          updateQuestion(updated)
                        }}
                        className="w-full bg-[#2E2E33] text-white rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none mt-1"
                      >
                        {[10, 15, 20, 30].map(s => (
                          <option key={s} value={s}>{s}s</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-gray-400 text-xs">Points</label>
                      <select
                        value={editingQuestion.points}
                        onChange={(e) => {
                          const updated = { ...editingQuestion, points: Number(e.target.value) }
                          setEditingQuestion(updated)
                          updateQuestion(updated)
                        }}
                        className="w-full bg-[#2E2E33] text-white rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none mt-1"
                      >
                        {[5, 10, 15, 20].map(p => (
                          <option key={p} value={p}>{p} pts</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Audio de la bonne réponse */}
                  <div className="mt-2 p-3 bg-[#1A1A1E] rounded-lg border border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="h-4 w-4 text-[#E91E63]" />
                      <label className="text-gray-400 text-xs font-medium">Piste audio (bonne réponse)</label>
                    </div>
                    <input
                      ref={questionAudioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleQuestionAudioUpload(e, editingQuestion.id)}
                      className="hidden"
                    />
                    {editingQuestion.audioUrl ? (
                      <div className="space-y-2">
                        {/* Titre du morceau + indicateur upload */}
                        <div className="flex items-center gap-2 text-[#E91E63]">
                          <Music className="h-3 w-3 shrink-0" />
                          <span className="text-xs font-medium truncate flex-1">
                            {(editingQuestion as QuizQuestion & { audioFileName?: string }).audioFileName || 'Piste audio'}
                          </span>
                          {audioUploading && (
                            <span className="text-xs text-yellow-400 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sauvegarde...
                            </span>
                          )}
                          {previewAudioPlaying && <span className="text-xs animate-pulse">&#9835; Lecture...</span>}
                        </div>

                        {/* Contrôles lecture */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePreviewAudio(editingQuestion.audioUrl!)}
                            className={`shrink-0 p-2 rounded-lg transition-colors ${
                              previewAudioPlaying
                                ? 'bg-green-500 text-white'
                                : 'bg-[#E91E63]/20 text-[#E91E63] hover:bg-[#E91E63]/30'
                            }`}
                          >
                            {previewAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={stopPreviewAudio}
                            className={`shrink-0 p-2 rounded-lg transition-colors ${
                              previewAudioPlaying
                                ? 'bg-red-500/30 text-red-400 hover:bg-red-500/50'
                                : 'bg-gray-600/20 text-gray-500'
                            }`}
                          >
                            <Square className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => questionAudioInputRef.current?.click()}
                            className="px-2 py-1.5 text-xs bg-[#2E2E33] text-gray-300 rounded hover:bg-[#3E3E43]"
                          >
                            Changer
                          </button>
                          <button
                            onClick={() => removeQuestionAudio(editingQuestion.id)}
                            className="shrink-0 p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Volume (partagé avec le jeu) */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => changeAnswerAudioVolume(0)}
                            className="shrink-0 p-1 text-gray-400 hover:text-[#E91E63] transition-colors"
                          >
                            <VolumeX className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={answerAudioVolume}
                            onChange={(e) => changeAnswerAudioVolume(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#E91E63]"
                          />
                          <button
                            onClick={() => changeAnswerAudioVolume(1)}
                            className="shrink-0 p-1 text-gray-400 hover:text-[#E91E63] transition-colors"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs text-gray-500 w-8 text-right shrink-0">{Math.round(answerAudioVolume * 100)}%</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => questionAudioInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-gray-300 rounded-lg text-sm transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Ajouter un fichier audio
                      </button>
                    )}
                    <p className="text-gray-600 text-[10px] mt-1.5">
                      Se joue automatiquement quand la bonne réponse est révélée
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Audio Controls */}
            <div className="bg-[#242428] rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <Music className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="text-white font-bold">Musique du Quiz</h3>
              </div>

              <div className="flex items-center gap-3">
                <label className="shrink-0">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-lg cursor-pointer transition-colors">
                    <Music className="h-4 w-4" />
                    <span className="text-sm">{quizAudio ? 'Changer' : 'Ajouter une musique'}</span>
                  </div>
                </label>

                {quizAudio && (
                  <>
                    <button
                      onClick={toggleAudio}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        isAudioPlaying
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-[#D4AF37] text-black hover:bg-[#F4D03F]'
                      }`}
                    >
                      {isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => {
                        pauseAudio()
                        audioRef.current = null
                        setQuizAudio(null)
                        setQuizAudioName(null)
                      }}
                      className="shrink-0 p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {quizAudio && (
                <>
                  {/* Titre du morceau */}
                  <div className={`flex items-center gap-2 mt-3 ${isAudioPlaying ? 'text-green-400' : 'text-gray-400'}`}>
                    <Music className="h-3 w-3 shrink-0" />
                    <span className="text-xs truncate">{quizAudioName || 'Sans titre'}</span>
                    {isAudioPlaying && (
                      <span className="text-xs shrink-0 animate-pulse">&#9835; En cours...</span>
                    )}
                  </div>

                  {/* Contrôle du volume */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => changeVolume(0)}
                      className="shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
                      title="Muet"
                    >
                      <VolumeX className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={quizAudioVolume}
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#D4AF37]"
                    />
                    <button
                      onClick={() => changeVolume(1)}
                      className="shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
                      title="Volume max"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-gray-500 w-8 text-right shrink-0">{Math.round(quizAudioVolume * 100)}%</span>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            {!lobbyVisible ? (
              /* Step 1: Show Lobby button */
              <button
                onClick={showLobby}
                disabled={launching || questions.length === 0}
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {launching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Monitor className="h-5 w-5" />
                    Afficher le Lobby ({questions.length} questions)
                  </>
                )}
              </button>
            ) : (
              /* Step 2: Lobby is visible, show player count and Launch button */
              <div className="space-y-4">
                {/* Player count */}
                <div className="bg-[#1A1A1E] rounded-xl p-4 border border-[#D4AF37]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                        <span className="text-xl">👥</span>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Joueurs connectés</p>
                        <p className="text-white text-2xl font-bold">{participants.length}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`/live/${session?.code}`, 'photojet-live')}
                      className="px-3 py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-lg text-sm flex items-center gap-2"
                    >
                      <Monitor className="h-4 w-4" />
                      Voir l'écran
                    </button>
                  </div>
                </div>

                {/* Launch Quiz button */}
                <button
                  onClick={launchGame}
                  disabled={launching}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {launching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Lancer le Quiz
                    </>
                  )}
                </button>

                {/* Cancel button */}
                <button
                  onClick={async () => {
                    setLobbyVisible(false)
                    setParticipants([])
                    // Broadcast pour fermer le lobby immédiatement
                    broadcastGameState({
                      gameActive: false,
                      lobbyVisible: false,
                      questions: [],
                      currentQuestionIndex: 0,
                      isAnswering: false,
                      showResults: false,
                      timeLeft: null,
                      participants: [],
                      answerStats: [0, 0, 0, 0],
                    })
                    // IMPORTANT: reset en DB pour que le diaporama reprenne
                    await supabase
                      .from('sessions')
                      .update({
                        quiz_lobby_visible: false,
                        quiz_participants: JSON.stringify([]),
                      })
                      .eq('id', session.id)
                  }}
                  className="w-full py-2 border border-gray-600 text-gray-400 rounded-xl hover:bg-gray-800 transition-colors text-sm"
                >
                  Annuler et revenir à la configuration
                </button>
              </div>
            )}

            {/* Clear data button - hidden when lobby is visible */}
            {!lobbyVisible && questions.length > 0 && questions !== DEFAULT_QUESTIONS && (
              <button
                onClick={clearAllData}
                className="w-full py-3 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer toutes les questions
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
              {/* Question display */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[#D4AF37] font-bold">
                  Question {currentQuestionIndex + 1}/{questions.length}
                </span>
                {timeLeft !== null && (
                  <span className={`text-2xl font-bold font-mono ${
                    timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
                  }`}>
                    {timeLeft}s
                  </span>
                )}
              </div>

              {currentQuestion && (
                <div className="bg-[#1A1A1E] rounded-lg p-4 mb-4">
                  <p className="text-xl text-white font-bold mb-4">{currentQuestion.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {currentQuestion.answers.map((answer, i) => {
                      const isCorrect = i === currentQuestion.correctAnswer
                      const percentage = totalAnswers > 0 ? (answerStats[i] / totalAnswers * 100) : 0
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded-lg relative overflow-hidden ${
                            showResults
                              ? isCorrect
                                ? 'bg-green-500/20 border-2 border-green-500'
                                : 'bg-[#2E2E33]'
                              : 'bg-[#2E2E33]'
                          }`}
                        >
                          {showResults && (
                            <div
                              className="absolute inset-0 bg-[#D4AF37]/10"
                              style={{ width: `${percentage}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between">
                            <span className="text-white">{answer}</span>
                            {showResults && (
                              <span className="text-[#D4AF37] font-bold">{answerStats[i]}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Mini-player audio bonne réponse */}
              {showResults && currentQuestion?.audioUrl && (
                <div className="p-3 bg-[#E91E63]/10 border border-[#E91E63]/30 rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-[#E91E63] flex-shrink-0" />
                    <span className="text-[#E91E63] text-sm font-medium flex-1 truncate">
                      {(currentQuestion as QuizQuestion & { audioFileName?: string }).audioFileName || 'Piste audio'}
                      {isAnswerAudioPlaying && <span className="animate-pulse ml-1">&#9835;</span>}
                    </span>
                    <button
                      onClick={toggleAnswerAudio}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        isAnswerAudioPlaying
                          ? 'bg-[#E91E63] text-white'
                          : 'bg-[#E91E63]/20 text-[#E91E63] hover:bg-[#E91E63]/30'
                      }`}
                    >
                      {isAnswerAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={stopAnswerAudio}
                      className="shrink-0 p-2 rounded-lg bg-gray-600/30 text-gray-400 hover:bg-gray-600/50 transition-colors"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Volume */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => changeAnswerAudioVolume(0)}
                      className="shrink-0 p-1 text-gray-400 hover:text-[#E91E63] transition-colors"
                    >
                      <VolumeX className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={answerAudioVolume}
                      onChange={(e) => changeAnswerAudioVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#E91E63]"
                    />
                    <button
                      onClick={() => changeAnswerAudioVolume(1)}
                      className="shrink-0 p-1 text-gray-400 hover:text-[#E91E63] transition-colors"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-500 w-8 text-right shrink-0">{Math.round(answerAudioVolume * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="space-y-2">
                {!isAnswering && !showResults && (
                  <button
                    onClick={startQuestion}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Play className="h-5 w-5" />
                    Lancer la question
                  </button>
                )}

                {isAnswering && (
                  <button
                    onClick={revealAnswer}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Check className="h-5 w-5" />
                    Révéler la réponse
                  </button>
                )}

                {showResults && currentQuestionIndex < questions.length - 1 && (
                  <button
                    onClick={nextQuestion}
                    className="w-full py-3 bg-[#D4AF37] hover:bg-[#F4D03F] text-black rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <SkipForward className="h-5 w-5" />
                    Question suivante
                  </button>
                )}

                {showResults && currentQuestionIndex >= questions.length - 1 && !showPodium && (
                  <button
                    onClick={displayPodium}
                    className="w-full py-3 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFC107] hover:to-[#FF8C00] text-black rounded-lg font-bold flex items-center justify-center gap-2"
                  >
                    <Award className="h-5 w-5" />
                    Afficher le Podium 🏆
                  </button>
                )}

                {showPodium && (
                  <div className="text-center py-4 text-[#D4AF37] font-bold text-xl">
                    🏆 Podium affiché!
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
            </motion.div>
          </div>
        )}
      </main>

      {/* Modal Import CSV */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#242428] rounded-2xl border border-white/10 shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="text-lg font-bold text-white">Import CSV</h3>
              </div>
              <button
                onClick={() => {
                  setShowCsvImportModal(false)
                  setCsvPreviewQuestions([])
                  setCsvImportErrors([])
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Erreurs */}
              {csvImportErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    {csvImportErrors.length} erreur(s) détectée(s)
                  </div>
                  <ul className="text-red-300 text-sm space-y-1 max-h-24 overflow-y-auto">
                    {csvImportErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Aperçu questions */}
              {csvPreviewQuestions.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 font-medium">
                      {csvPreviewQuestions.length} question(s) prête(s) à importer
                    </span>
                    <span className="text-gray-500 text-sm">
                      {csvPreviewQuestions.filter(q => (q as QuizQuestion & { pendingAudioFile?: string }).pendingAudioFile).length} avec audio référencé
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {csvPreviewQuestions.map((q, i) => (
                      <div key={q.id} className="bg-[#1A1A1E] rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <span className="text-gray-500 font-mono text-sm">{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-white text-sm">{q.question}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {q.answers.map((a, ai) => (
                                <span
                                  key={ai}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    ai === q.correctAnswer
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-gray-700 text-gray-400'
                                  }`}
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>{q.timeLimit}s</span>
                              <span>{q.points} pts</span>
                              {(q as QuizQuestion & { pendingAudioFile?: string }).pendingAudioFile && (
                                <span className="text-[#E91E63] flex items-center gap-1">
                                  <Music className="h-3 w-3" />
                                  {(q as QuizQuestion & { pendingAudioFile?: string }).pendingAudioFile}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Aucune question valide trouvée dans le fichier.</p>
                  <p className="text-sm mt-2">Format attendu (séparateur point-virgule) :</p>
                  <code className="text-xs text-gray-400 block mt-1 bg-[#1A1A1E] p-2 rounded">
                    question;rep1;rep2;rep3;rep4;bonne_reponse;temps;points;audio
                  </code>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => {
                  setShowCsvImportModal(false)
                  setCsvPreviewQuestions([])
                  setCsvImportErrors([])
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmCsvImport}
                disabled={csvPreviewQuestions.length === 0}
                className="px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-bold hover:bg-[#F4D03F] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Importer {csvPreviewQuestions.length} question(s)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
