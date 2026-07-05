'use client'

// Handles both TEXT (string) and JSONB (already-parsed object) columns
function parseJsonArray<T = unknown>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as T[]
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
  return []
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Loader2,
  Monitor,
  FileText,
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
  Package,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session, QuizQuestion, QuizParticipant, SavedQuiz } from '@/types/database'
import { toast } from 'sonner'
import { prepackagedQuizzes, PrepackagedQuiz } from '@/data/prepackaged-quizzes'
import dynamic from 'next/dynamic'

// Outil de découpe audio (admin only) : chargé à la demande, jamais rendu côté serveur.
const AudioTrimmer = dynamic(() => import('./AudioTrimmer'), { ssr: false })

// Élément audio porteur de ses handlers de découpe (nettoyage propre entre lectures).
type ClipAudio = HTMLAudioElement & { _clipTimer?: number; _clipTU?: () => void }

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
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null)

  // Pénalité en cas de mauvaise réponse (0 = désactivé)
  const [penaltyPoints, setPenaltyPoints] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('quiz-penalty-points') || '0', 10) || 0
    }
    return 0
  })

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
  const [connectedPlayers, setConnectedPlayers] = useState<{ odientId: string; odientName: string }[]>([])

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

  // Audio de la QUESTION (joué PENDANT la question sur le PC animateur ; coupe l'ambiance)
  const [questionAudioUploading, setQuestionAudioUploading] = useState(false)
  const [questionAudioVolume, setQuestionAudioVolume] = useState(0.7)
  const [isQuestionAudioPlaying, setIsQuestionAudioPlaying] = useState(false)
  const questionAudioRef = useRef<HTMLAudioElement | null>(null) // lecture pendant le jeu
  const questionAudioFileInputRef = useRef<HTMLInputElement>(null) // input upload
  // Preview éditeur de l'audio de question (séparée de la preview de révélation)
  const [previewQuestionAudioPlaying, setPreviewQuestionAudioPlaying] = useState(false)
  const previewQuestionAudioRef = useRef<HTMLAudioElement | null>(null)

  // Photo de la bonne réponse (affichée sur l'écran public au reveal)
  const [photoUploading, setPhotoUploading] = useState(false)
  const questionPhotoInputRef = useRef<HTMLInputElement>(null)

  // Audio de la bonne réponse (lecture sur le PC animateur au reveal)
  const [isAnswerAudioPlaying, setIsAnswerAudioPlaying] = useState(false)
  const [answerAudioVolume, setAnswerAudioVolume] = useState(0.7)
  const answerAudioRef = useRef<HTMLAudioElement | null>(null)
  // Cache local des blobs audio pour éviter de re-télécharger depuis Supabase
  const audioLocalCacheRef = useRef<Map<string, string>>(new Map())
  // Préchargement de TOUS les audios au lancement (fiabilité connexion en soirée)
  const [audioPreload, setAudioPreload] = useState<{
    total: number
    done: number
    failed: number
    status: 'idle' | 'loading' | 'ready'
  }>({ total: 0, done: 0, failed: 0, status: 'idle' })

  // Import CSV
  const [showCsvImportModal, setShowCsvImportModal] = useState(false)
  const [csvPreviewQuestions, setCsvPreviewQuestions] = useState<QuizQuestion[]>([])
  const [csvImportErrors, setCsvImportErrors] = useState<string[]>([])
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Quiz pré-packagés
  const [showPrepackagedModal, setShowPrepackagedModal] = useState(false)
  const [addedQuizIds, setAddedQuizIds] = useState<Set<string>>(new Set())

  // Bibliothèque personnelle de quiz (saved_quizzes)
  const [showSaveQuizModal, setShowSaveQuizModal] = useState(false)
  const [showLoadQuizModal, setShowLoadQuizModal] = useState(false)
  const [saveQuizName, setSaveQuizName] = useState('')
  const [savingQuiz, setSavingQuiz] = useState(false)
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([])
  const [loadingSavedQuizzes, setLoadingSavedQuizzes] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const currentQuestionIndexRef = useRef(0)
  const questionsRef = useRef<QuizQuestion[]>([])
  const participantsRef = useRef<QuizParticipant[]>([])
  const answerStatsRef = useRef<number[]>([0, 0, 0, 0])
  const penaltyPointsRef = useRef(penaltyPoints)

  // Sync refs — valeurs toujours fraîches sans re-monter les useEffect qui les utilisent
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex }, [currentQuestionIndex])
  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { participantsRef.current = participants }, [participants])
  useEffect(() => { answerStatsRef.current = answerStats }, [answerStats])
  useEffect(() => { penaltyPointsRef.current = penaltyPoints }, [penaltyPoints])

  useEffect(() => {
    fetchSession()
  }, [])

  // Helper pour nettoyer complètement un élément audio
  const cleanupAudioElement = useCallback((audio: HTMLAudioElement | null, blobUrl?: string | null) => {
    if (audio) {
      audio.pause()
      audio.onplay = null
      audio.onpause = null
      audio.onended = null
      audio.onerror = null
      audio.src = ''
      audio.load() // Force le navigateur à libérer les ressources
    }
    if (blobUrl && blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl)
    }
  }, [])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      // Stop all audio when component unmounts
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.onplay = null
        audioRef.current.onpause = null
        audioRef.current.onended = null
        audioRef.current.src = ''
        audioRef.current.load()
        audioRef.current = null
      }
      if (answerAudioRef.current) {
        answerAudioRef.current.pause()
        answerAudioRef.current.onplay = null
        answerAudioRef.current.onpause = null
        answerAudioRef.current.onended = null
        answerAudioRef.current.src = ''
        answerAudioRef.current.load()
        answerAudioRef.current = null
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.onplay = null
        previewAudioRef.current.onpause = null
        previewAudioRef.current.onended = null
        previewAudioRef.current.src = ''
        previewAudioRef.current.load()
        previewAudioRef.current = null
      }
      if (questionAudioRef.current) {
        questionAudioRef.current.pause()
        questionAudioRef.current.onended = null
        questionAudioRef.current.onerror = null
        questionAudioRef.current.src = ''
        questionAudioRef.current = null
      }
      if (previewQuestionAudioRef.current) {
        previewQuestionAudioRef.current.pause()
        previewQuestionAudioRef.current.onended = null
        previewQuestionAudioRef.current.onerror = null
        previewQuestionAudioRef.current.src = ''
        previewQuestionAudioRef.current = null
      }
      // Libérer les blobs audio mis en cache (préchargement + preview)
      audioLocalCacheRef.current.forEach((blobUrl) => {
        if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl)
      })
      audioLocalCacheRef.current.clear()
    }
  }, [])

  // Setup broadcast channel with Presence tracking
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`quiz-game-${session.code}`)
    broadcastChannelRef.current = channel

    // Listen to presence events to track connected players
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const players: { odientId: string; odientName: string }[] = []
      Object.values(state).forEach((presences) => {
        (presences as unknown as Array<{ odientId: string; odientName: string }>).forEach((p) => {
          if (p.odientId && p.odientName) {
            players.push({ odientId: p.odientId, odientName: p.odientName })
          }
        })
      })
      setConnectedPlayers(players)
    })

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
    penaltyPoints?: number
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
        const qs = parseJsonArray<QuizQuestion>(data.quiz_questions)
        setQuestions(qs)
      }

      // Initialize game state from session si le jeu est actif
      if (data.quiz_active) {
        setGameActive(true)
        setCurrentQuestionIndex(data.quiz_current_question ?? 0)
        setIsAnswering(data.quiz_is_answering ?? false)
        setShowResults(data.quiz_show_results ?? false)
        setTimeLeft(data.quiz_time_left ?? null)
        const ps = parseJsonArray<QuizParticipant>(data.quiz_participants)
        if (ps.length > 0) setParticipants(ps)
      } else {
        // Si le quiz n'est pas actif mais quiz_lobby_visible est true, on reset
        // Cela permet au diaporama de reprendre normalement
        if (data.quiz_lobby_visible === true) {
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

  // Timer effect — side effects hors du state setter (pas de supabase/broadcast dans setTimeLeft)
  const timeLeftRef = useRef(timeLeft)
  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

  useEffect(() => {
    if (!isAnswering || timeLeft === null || timeLeft <= 0 || !session) return

    const timer = setInterval(() => {
      const prev = timeLeftRef.current
      if (prev === null || prev <= 0) return
      const newTime = prev - 1
      setTimeLeft(newTime)

      if (newTime <= 0) {
        setIsAnswering(false)
        setShowResults(true)
        // Stoppe l'audio de question puis joue le reveal / reprend l'ambiance
        handleRevealAudio()
        supabase.from('sessions').update({
          quiz_is_answering: false,
          quiz_show_results: true,
          quiz_time_left: 0,
        }).eq('id', session.id)
        broadcastGameState({
          gameActive: true,
          questions: questionsRef.current,
          currentQuestionIndex: currentQuestionIndexRef.current,
          isAnswering: false,
          showResults: true,
          timeLeft: 0,
          participants: participantsRef.current,
          answerStats: answerStatsRef.current,
          penaltyPoints: penaltyPointsRef.current,
        })
      } else {
        supabase.from('sessions').update({ quiz_time_left: newTime }).eq('id', session.id)
        broadcastGameState({
          gameActive: true,
          questions: questionsRef.current,
          currentQuestionIndex: currentQuestionIndexRef.current,
          isAnswering: true,
          showResults: false,
          timeLeft: newTime,
          participants: participantsRef.current,
          answerStats: answerStatsRef.current,
          penaltyPoints: penaltyPointsRef.current,
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isAnswering, timeLeft, session, broadcastGameState, supabase])

  // Polling DB toutes les 3s pour participants + answer stats (plus fiable que postgres_changes + RLS)
  useEffect(() => {
    if (!session?.id || (!gameActive && !lobbyVisible)) return

    const refresh = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('quiz_participants, quiz_answers')
        .eq('id', session.id)
        .single()
      if (!data) return

      const ps = parseJsonArray<QuizParticipant>(data.quiz_participants)
      setParticipants(ps)

      const answers = parseJsonArray<{ questionId: string; answerIndex: number }>(data.quiz_answers)
      if (answers.length > 0) {
        const currentQ = questionsRef.current[currentQuestionIndexRef.current]
        if (currentQ) {
          const stats = [0, 0, 0, 0]
          answers
            .filter(a => a.questionId === currentQ.id)
            .forEach(a => { if (a.answerIndex >= 0 && a.answerIndex < 4) stats[a.answerIndex]++ })
          setAnswerStats(stats)
        }
      }
    }

    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [session?.id, gameActive, lobbyVisible, supabase])

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

  function clearAllQuestions() {
    if (questions.length === 0) {
      toast.error('Aucune question à supprimer')
      return
    }
    if (!window.confirm(`Supprimer les ${questions.length} question(s) ? Cette action est irréversible.`)) {
      return
    }
    setQuestions([])
    saveQuestionsToDatabase([])
    setEditingQuestion(null)
    toast.success('Toutes les questions ont été supprimées')
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

  // === Bibliothèque personnelle de quiz (saved_quizzes) ===

  // Sauvegarder le quiz courant dans la bibliothèque de l'utilisateur
  async function handleSaveQuiz() {
    const name = saveQuizName.trim()
    if (!name) {
      toast.error('Donnez un nom à votre quiz')
      return
    }
    if (questions.length === 0) {
      toast.error('Ajoutez au moins une question avant de sauvegarder')
      return
    }
    // Garde-fou : refuser tant qu'un média n'est pas uploadé (URL blob locale non réutilisable)
    if (audioUploading || photoUploading || questionAudioUploading) {
      toast.error('Patientez la fin de l\'upload des médias avant de sauvegarder')
      return
    }
    const hasBlob = questions.some(q =>
      [q.audioUrl, q.questionAudioUrl, q.photoUrl].some(u => typeof u === 'string' && u.startsWith('blob:'))
    )
    if (hasBlob) {
      toast.error('Un média est encore en cours d\'upload. Réessayez dans un instant.')
      return
    }

    setSavingQuiz(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Session expirée, reconnectez-vous')
        return
      }
      const { error } = await supabase
        .from('saved_quizzes')
        .insert({ user_id: user.id, name, questions })

      if (error) throw error

      toast.success('Quiz sauvegardé dans votre bibliothèque ✅')
      setShowSaveQuizModal(false)
      setSaveQuizName('')
    } catch (err) {
      console.error('Error saving quiz:', err)
      toast.error('Erreur lors de la sauvegarde du quiz')
    } finally {
      setSavingQuiz(false)
    }
  }

  // Charger la liste des quiz sauvegardés de l'utilisateur (RLS = seulement les siens)
  async function loadSavedQuizzes() {
    setShowLoadQuizModal(true)
    setLoadingSavedQuizzes(true)
    try {
      const { data, error } = await supabase
        .from('saved_quizzes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSavedQuizzes((data as SavedQuiz[]) || [])
    } catch (err) {
      console.error('Error loading saved quizzes:', err)
      toast.error('Erreur lors du chargement de la bibliothèque')
      setSavedQuizzes([])
    } finally {
      setLoadingSavedQuizzes(false)
    }
  }

  // Charger un quiz sauvegardé dans l'éditeur (remplace les questions actuelles)
  function handleLoadQuiz(quiz: SavedQuiz) {
    if (!window.confirm('Charger ce quiz remplacera les questions actuelles. Continuer ?')) return

    // Régénérer les ids pour éviter toute collision sur la session courante
    const loaded: QuizQuestion[] = (quiz.questions || []).map((q, i) => ({
      ...q,
      id: `${Date.now()}_${i}`,
    }))

    setQuestions(loaded)
    saveQuestionsToDatabase(loaded)
    setShowLoadQuizModal(false)
    toast.success(`Quiz « ${quiz.name} » chargé (${loaded.length} question${loaded.length > 1 ? 's' : ''})`)
  }

  // Supprimer un quiz de la bibliothèque
  async function handleDeleteSavedQuiz(quizId: string) {
    if (!window.confirm('Supprimer définitivement ce quiz de votre bibliothèque ?')) return
    try {
      const { error } = await supabase.from('saved_quizzes').delete().eq('id', quizId)
      if (error) throw error
      setSavedQuizzes(prev => prev.filter(q => q.id !== quizId))
      toast.success('Quiz supprimé de la bibliothèque')
    } catch (err) {
      console.error('Error deleting saved quiz:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  // Ajouter un quiz pré-packagé
  function addPrepackagedQuiz(quiz: PrepackagedQuiz) {
    // Anti double-clic : vérifier si déjà ajouté
    if (addedQuizIds.has(quiz.id)) {
      toast.error(`${quiz.emoji} Le quiz "${quiz.name}" a déjà été ajouté !`)
      return
    }

    const newQuestions: QuizQuestion[] = quiz.questions.map((q, index) => ({
      id: `prepack-${quiz.id}-${Date.now()}-${index}`,
      question: q.question,
      answers: [...q.answers],
      correctAnswer: q.correctAnswer - 1, // Convert from 1-based to 0-based
      timeLimit: q.time,
      points: q.points,
      audioUrl: null,
    }))

    const updatedQuestions = [...questions, ...newQuestions]
    setQuestions(updatedQuestions)
    saveQuestionsToDatabase(updatedQuestions)

    // Tracker le quiz comme ajouté
    setAddedQuizIds(prev => new Set([...prev, quiz.id]))

    setShowPrepackagedModal(false)
    toast.success(`${quiz.emoji} ${newQuestions.length} questions "${quiz.name}" ajoutées !`)
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
      audioFileName,
      audioStart: null, // nouveau fichier ⇒ découpe réinitialisée
      audioEnd: null,
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
        audioFileName,
        audioStart: null,
        audioEnd: null,
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

  // Upload photo pour une question spécifique (affichée au reveal sur l'écran public)
  async function handleQuestionPhotoUpload(e: React.ChangeEvent<HTMLInputElement>, questionId: string) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    if (!file.type.startsWith('image/')) {
      toast.error('Seuls les fichiers image sont acceptés')
      return
    }

    // Limite de taille pour ne pas ralentir l'écran public
    const MAX_PHOTO_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Image trop lourde (max 5 Mo)')
      return
    }

    // 1. Preview locale instantanée
    const localBlobUrl = URL.createObjectURL(file)
    const tempUpdated = { ...editingQuestion!, photoUrl: localBlobUrl } as QuizQuestion
    setEditingQuestion(tempUpdated)

    toast.success('Photo prête ! Upload en cours...')
    setPhotoUploading(true)

    // 2. Upload en arrière-plan vers Supabase
    try {
      const fileName = `quiz-photos/${session.id}_${questionId}_${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
      const supabaseUrl = urlData.publicUrl

      const finalUpdated = { ...editingQuestion!, photoUrl: supabaseUrl } as QuizQuestion
      setEditingQuestion(finalUpdated)
      updateQuestion(finalUpdated)

      // Libérer le blob local de preview
      URL.revokeObjectURL(localBlobUrl)

      toast.success('Photo sauvegardée !')
    } catch (err) {
      console.error('Error uploading photo:', err)
      toast.error('Erreur upload - La photo s\'affiche localement mais ne sera pas sauvegardée')
      updateQuestion(tempUpdated)
    } finally {
      setPhotoUploading(false)
    }

    // Reset input
    if (questionPhotoInputRef.current) questionPhotoInputRef.current.value = ''
  }

  async function removeQuestionPhoto(questionId: string) {
    if (!editingQuestion) return

    // Supprimer le fichier du storage si possible
    if (editingQuestion.photoUrl) {
      const path = editingQuestion.photoUrl.match(/photos\/(.+)/)
      if (path?.[1]) {
        try {
          await supabase.storage.from('photos').remove([decodeURIComponent(path[1])])
        } catch { /* chemin photo invalide, ignoré */ }
      }
    }

    const updated = { ...editingQuestion, photoUrl: null }
    setEditingQuestion(updated)
    updateQuestion(updated)
    toast.success('Photo supprimée')
  }

  async function removeQuestionAudio(questionId: string) {
    if (!editingQuestion) return

    // Supprimer le fichier du storage si possible
    if (editingQuestion.audioUrl) {
      const path = editingQuestion.audioUrl.match(/photos\/(.+)/)
      if (path?.[1]) {
        try {
          await supabase.storage.from('photos').remove([decodeURIComponent(path[1])])
        } catch { /* chemin audio invalide, ignoré */ }
      }
    }

    const updated = { ...editingQuestion, audioUrl: null, audioStart: null, audioEnd: null }
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

  // === Audio de la QUESTION (≠ audio de révélation) ===

  // Upload de l'audio joué PENDANT la question
  async function handleQuestionPromptAudioUpload(e: React.ChangeEvent<HTMLInputElement>, questionId: string) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    if (!file.type.startsWith('audio/')) {
      toast.error('Seuls les fichiers audio sont acceptés')
      return
    }

    // 1. Blob local immédiat pour preview instantanée
    const localBlobUrl = URL.createObjectURL(file)
    const questionAudioName = file.name.replace(/\.[^.]+$/, '')

    const tempUpdated = {
      ...editingQuestion!,
      questionAudioUrl: localBlobUrl,
      questionAudioName,
      questionAudioStart: null, // nouveau fichier ⇒ découpe réinitialisée
      questionAudioEnd: null,
    } as QuizQuestion
    setEditingQuestion(tempUpdated)
    audioLocalCacheRef.current.set(localBlobUrl, localBlobUrl)

    toast.success('Audio de la question prêt ! Upload en cours...')
    setQuestionAudioUploading(true)

    // 2. Upload en arrière-plan vers Supabase (préfixe distinct du reveal)
    try {
      const fileName = `quiz-question-audio/${session.id}_${questionId}_${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, { contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
      const supabaseUrl = urlData.publicUrl

      audioLocalCacheRef.current.set(supabaseUrl, localBlobUrl)

      const finalUpdated = {
        ...editingQuestion!,
        questionAudioUrl: supabaseUrl,
        questionAudioName,
        questionAudioStart: null,
        questionAudioEnd: null,
      } as QuizQuestion
      setEditingQuestion(finalUpdated)
      updateQuestion(finalUpdated)

      toast.success('Audio de la question sauvegardé !')
    } catch (err) {
      console.error('Error uploading question audio:', err)
      toast.error('Erreur upload - L\'audio fonctionne localement mais ne sera pas sauvegardé')
      updateQuestion(tempUpdated)
    } finally {
      setQuestionAudioUploading(false)
    }

    if (questionAudioFileInputRef.current) questionAudioFileInputRef.current.value = ''
  }

  async function removeQuestionPromptAudio(_questionId: string) {
    if (!editingQuestion) return

    if (editingQuestion.questionAudioUrl) {
      const path = editingQuestion.questionAudioUrl.match(/photos\/(.+)/)
      if (path?.[1]) {
        try {
          await supabase.storage.from('photos').remove([decodeURIComponent(path[1])])
        } catch { /* chemin invalide, ignoré */ }
      }
    }

    const updated = { ...editingQuestion, questionAudioUrl: null, questionAudioName: null, questionAudioStart: null, questionAudioEnd: null }
    setEditingQuestion(updated)
    updateQuestion(updated)
    stopQuestionPreviewAudio()
    toast.success('Audio de la question supprimé')
  }

  function toggleQuestionPreviewAudio(url: string) {
    if (previewQuestionAudioRef.current) {
      previewQuestionAudioRef.current.pause()
      previewQuestionAudioRef.current = null
      if (previewQuestionAudioPlaying) {
        setPreviewQuestionAudioPlaying(false)
        return
      }
    }

    setPreviewQuestionAudioPlaying(false)
    const cachedUrl = audioLocalCacheRef.current.get(url) || url
    const audio = new Audio(cachedUrl)
    audio.volume = questionAudioVolume
    audio.onended = () => {
      setPreviewQuestionAudioPlaying(false)
      previewQuestionAudioRef.current = null
    }
    audio.onerror = () => {
      setPreviewQuestionAudioPlaying(false)
      previewQuestionAudioRef.current = null
      toast.error('Impossible de lire l\'audio')
    }
    previewQuestionAudioRef.current = audio
    audio.play().then(() => {
      setPreviewQuestionAudioPlaying(true)
    }).catch(() => {
      setPreviewQuestionAudioPlaying(false)
      previewQuestionAudioRef.current = null
      toast.error('Impossible de lire l\'audio')
    })
  }

  function stopQuestionPreviewAudio() {
    if (previewQuestionAudioRef.current) {
      previewQuestionAudioRef.current.pause()
      previewQuestionAudioRef.current = null
      setPreviewQuestionAudioPlaying(false)
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
          penaltyPoints: penaltyPointsRef.current,
      })

      // Lancer la musique de fond automatiquement
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {})
      }

      toast.success(`Lobby affiché! Code: ${session.code}`)
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

      // Précharger tous les audios en local dès le lancement (sans bloquer) pour
      // une lecture fiable au reveal même si le réseau devient instable.
      void preloadAllAnswerAudio()

      broadcastGameState({
        gameActive: true,
        questions,
        currentQuestionIndex: 0,
        isAnswering: false,
        showResults: false,
        timeLeft: null,
        participants,
        answerStats: [0, 0, 0, 0],
          penaltyPoints: penaltyPointsRef.current,
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

    // Audio de la question : si présent, il coupe l'ambiance et prend le relais.
    // Sinon, comportement actuel = musique d'ambiance pendant la question.
    if (currentQ.questionAudioUrl) {
      playQuestionAudio()
    } else {
      playAudio()
    }

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
          penaltyPoints: penaltyPointsRef.current,
    })

    toast.success('Question lancée!')
  }

  async function revealAnswer() {
    if (!session) return

    setIsAnswering(false)
    setShowResults(true)

    // Stoppe l'audio de question (si présent), puis joue le son de révélation
    // ou reprend l'ambiance — jamais 2 sources en même temps.
    handleRevealAudio()

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

    // Stopper les audios de la question précédente & relancer la musique de fond
    stopAnswerAudio()
    stopQuestionAudio()
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
          penaltyPoints: penaltyPointsRef.current,
    })
  }

  async function exitGame() {
    if (!session) return

    // Stopper et nettoyer tout audio avec cleanup complet
    stopAnswerAudio()

    // Cleanup complet des éléments audio (retirer listeners + libérer ressources)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onplay = null
      audioRef.current.onpause = null
      audioRef.current.onended = null
      audioRef.current.src = ''
      audioRef.current.load()
      audioRef.current = null
    }
    if (answerAudioRef.current) {
      answerAudioRef.current.pause()
      answerAudioRef.current.onplay = null
      answerAudioRef.current.onpause = null
      answerAudioRef.current.onended = null
      answerAudioRef.current.src = ''
      answerAudioRef.current.load()
      answerAudioRef.current = null
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.onplay = null
      previewAudioRef.current.onpause = null
      previewAudioRef.current.onended = null
      previewAudioRef.current.src = ''
      previewAudioRef.current.load()
      previewAudioRef.current = null
    }
    // Audios de la question (lecture en jeu + preview éditeur)
    if (questionAudioRef.current) {
      questionAudioRef.current.pause()
      questionAudioRef.current.onended = null
      questionAudioRef.current.onerror = null
      questionAudioRef.current.src = ''
      questionAudioRef.current = null
    }
    if (previewQuestionAudioRef.current) {
      previewQuestionAudioRef.current.pause()
      previewQuestionAudioRef.current.onended = null
      previewQuestionAudioRef.current.onerror = null
      previewQuestionAudioRef.current.src = ''
      previewQuestionAudioRef.current = null
    }
    setIsQuestionAudioPlaying(false)
    // Révoquer les URLs blob
    if (quizAudio && quizAudio.startsWith('blob:')) {
      URL.revokeObjectURL(quizAudio)
    }
    setQuizAudio(null)
    setQuizAudioName(null)
    setIsAudioPlaying(false)
    stopAnswerAudio()

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
          penaltyPoints: penaltyPointsRef.current,
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

    // Stopper et nettoyer tout audio avec cleanup complet
    stopAnswerAudio()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onplay = null
      audioRef.current.onpause = null
      audioRef.current.onended = null
      audioRef.current.src = ''
      audioRef.current.load()
      audioRef.current = null
    }
    if (answerAudioRef.current) {
      answerAudioRef.current.pause()
      answerAudioRef.current.onplay = null
      answerAudioRef.current.onpause = null
      answerAudioRef.current.onended = null
      answerAudioRef.current.src = ''
      answerAudioRef.current.load()
      answerAudioRef.current = null
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.onplay = null
      previewAudioRef.current.onpause = null
      previewAudioRef.current.onended = null
      previewAudioRef.current.src = ''
      previewAudioRef.current.load()
      previewAudioRef.current = null
    }
    // Audios de la question (lecture en jeu + preview éditeur)
    if (questionAudioRef.current) {
      questionAudioRef.current.pause()
      questionAudioRef.current.onended = null
      questionAudioRef.current.onerror = null
      questionAudioRef.current.src = ''
      questionAudioRef.current = null
    }
    if (previewQuestionAudioRef.current) {
      previewQuestionAudioRef.current.pause()
      previewQuestionAudioRef.current.onended = null
      previewQuestionAudioRef.current.onerror = null
      previewQuestionAudioRef.current.src = ''
      previewQuestionAudioRef.current = null
    }
    setIsQuestionAudioPlaying(false)
    // Révoquer les URLs blob
    if (quizAudio && quizAudio.startsWith('blob:')) {
      URL.revokeObjectURL(quizAudio)
    }
    setIsAudioPlaying(false)
    stopAnswerAudio()
    setQuizAudio(null)
    setQuizAudioName(null)

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
  async function displayPodium() {
    if (!session) return
    setShowPodium(true)
    // Stopper audio de réponse + musique de fond
    stopAnswerAudio()
    if (audioRef.current) {
      audioRef.current.pause()
    }
    // Lire les participants depuis la DB pour avoir les scores à jour
    const { data } = await supabase
      .from('sessions')
      .select('quiz_participants')
      .eq('id', session.id)
      .single()
    const freshParticipants: QuizParticipant[] =
      parseJsonArray<QuizParticipant>(data?.quiz_participants).length > 0
        ? parseJsonArray<QuizParticipant>(data?.quiz_participants)
        : participants
    if (freshParticipants.length > 0) {
      setParticipants(freshParticipants)
    }
    broadcastGameState({
      gameActive: true,
      questions,
      currentQuestionIndex,
      isAnswering: false,
      showResults: true,
      timeLeft: null,
      participants: freshParticipants,
      answerStats,
      isFinished: true,
    })
    toast.success('Podium affiché!')
  }

  // Handle audio file upload
  function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // Nettoyer l'ancien audio avant d'en créer un nouveau
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.onplay = null
        audioRef.current.onpause = null
        audioRef.current.onended = null
        audioRef.current.src = ''
        audioRef.current.load()
        audioRef.current = null
      }
      // Révoquer l'ancienne URL blob
      if (quizAudio && quizAudio.startsWith('blob:')) {
        URL.revokeObjectURL(quizAudio)
      }

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

  // Reprendre la musique d'ambiance (si une piste est chargée)
  function resumeAmbiance() {
    if (!audioRef.current) return
    audioRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {})
  }

  // === Lecture de l'audio de la QUESTION (PC animateur) ===

  function changeQuestionAudioVolume(newVolume: number) {
    const clamped = Math.max(0, Math.min(1, newVolume))
    setQuestionAudioVolume(clamped)
    if (questionAudioRef.current) questionAudioRef.current.volume = clamped
    if (previewQuestionAudioRef.current) previewQuestionAudioRef.current.volume = clamped
  }

  // Couper l'ambiance et lancer l'audio de la question (depuis le cache si préchargé)
  // Retire les handlers de découpe (timer + timeupdate) d'un élément audio.
  function clearClip(audio: HTMLAudioElement) {
    const a = audio as ClipAudio
    if (a._clipTimer !== undefined) { clearTimeout(a._clipTimer); a._clipTimer = undefined }
    if (a._clipTU) { a.removeEventListener('timeupdate', a._clipTU); a._clipTU = undefined }
  }

  // Lance la lecture d'un extrait [start, end] (secondes).
  // Coupe « au poil » : setTimeout précis + filet de sécurité timeupdate (~250 ms).
  // start/end absents ⇒ lecture intégrale (comportement historique inchangé).
  function startClippedPlayback(
    audio: HTMLAudioElement,
    start: number | null | undefined,
    end: number | null | undefined,
    onPlaying?: () => void,
    onStopped?: () => void,
  ) {
    const a = audio as ClipAudio
    clearClip(a)
    const s = typeof start === 'number' && start > 0 ? start : 0
    const hasEnd = typeof end === 'number' && end > s
    const stop = () => { clearClip(a); a.pause(); onStopped?.() }
    const begin = () => {
      try { a.currentTime = s } catch { /* seek pas encore possible */ }
      if (hasEnd) {
        const tu = () => { if (a.currentTime >= (end as number)) stop() }
        a._clipTU = tu
        a.addEventListener('timeupdate', tu)
        const ms = Math.max(0, ((end as number) - s) * 1000 / (a.playbackRate || 1))
        a._clipTimer = window.setTimeout(stop, ms)
      }
      a.play().then(() => onPlaying?.()).catch((err) => {
        console.error('Clip audio play failed:', err)
        onStopped?.()
      })
    }
    // On ne peut fixer currentTime qu'une fois les métadonnées connues.
    if (a.readyState >= 1) begin()
    else a.addEventListener('loadedmetadata', begin, { once: true })
  }

  function playQuestionAudio() {
    const currentQ = questions[currentQuestionIndex]
    if (!currentQ?.questionAudioUrl) return

    // Couper la musique d'ambiance (l'audio question prend le relais)
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause()
      setIsAudioPlaying(false)
    }

    // Nettoyer un éventuel élément précédent
    if (questionAudioRef.current) {
      questionAudioRef.current.pause()
      questionAudioRef.current.onended = null
      questionAudioRef.current.onerror = null
      questionAudioRef.current.src = ''
      questionAudioRef.current = null
    }

    const src = audioLocalCacheRef.current.get(currentQ.questionAudioUrl) || currentQ.questionAudioUrl
    const audio = new Audio(src)
    audio.volume = questionAudioVolume
    audio.onended = () => setIsQuestionAudioPlaying(false)
    audio.onerror = () => setIsQuestionAudioPlaying(false)
    questionAudioRef.current = audio
    // Démarre à questionAudioStart et coupe à questionAudioEnd (si définis).
    // Autoplay refusé (rare car déclenché par un clic) → le mini-player permet de relancer.
    startClippedPlayback(
      audio,
      currentQ.questionAudioStart,
      currentQ.questionAudioEnd,
      () => setIsQuestionAudioPlaying(true),
      () => setIsQuestionAudioPlaying(false),
    )
  }

  // Relancer/mettre en pause manuellement (mini-player + secours autoplay)
  function toggleQuestionAudio() {
    if (questionAudioRef.current) {
      if (questionAudioRef.current.paused) {
        questionAudioRef.current.play().then(() => setIsQuestionAudioPlaying(true)).catch(() => {})
      } else {
        questionAudioRef.current.pause()
        setIsQuestionAudioPlaying(false)
      }
    } else {
      // Pas encore d'élément (autoplay initial échoué) → (re)lancer
      playQuestionAudio()
    }
  }

  function stopQuestionAudio() {
    if (questionAudioRef.current) {
      clearClip(questionAudioRef.current)
      questionAudioRef.current.pause()
      questionAudioRef.current.onended = null
      questionAudioRef.current.onerror = null
      questionAudioRef.current.src = ''
      questionAudioRef.current = null
    }
    setIsQuestionAudioPlaying(false)
  }

  // Gère le son au moment de la révélation, sans jamais superposer 2 sources.
  // Utilise les refs (sûr depuis le timer auto-reveal ET le clic manuel).
  function handleRevealAudio() {
    const q = questionsRef.current[currentQuestionIndexRef.current]
    // Toujours stopper l'audio de la question d'abord
    stopQuestionAudio()

    if (q?.audioUrl) {
      // Audio de révélation présent → comportement existant inchangé
      pauseAudio()
      playAnswerAudio()
    } else if (q?.questionAudioUrl) {
      // La question avait un audio de question mais PAS d'audio de révélation
      // → on reprend la musique d'ambiance (si une piste est chargée)
      resumeAmbiance()
    } else {
      // Ni audio question ni audio révélation → comportement existant strict
      pauseAudio()
      playAnswerAudio()
    }
  }

  // Précharger TOUS les audios de réponse en local (cache mémoire) au lancement
  // du quiz. Objectif : la lecture au reveal ne dépend plus du réseau pendant la
  // soirée — un Wi-Fi instable ne coupe plus le son sur le PC animateur.
  async function preloadAllAnswerAudio() {
    // URLs distantes uniques restant à télécharger (reveal + audio de question),
    // on ignore les blobs locaux et ce qui est déjà en cache.
    const urls = Array.from(
      new Set(
        questions
          .flatMap((q) => [q.audioUrl, q.questionAudioUrl])
          .filter(
            (u): u is string =>
              !!u && !u.startsWith('blob:') && !audioLocalCacheRef.current.has(u)
          )
      )
    )

    if (urls.length === 0) {
      setAudioPreload({ total: 0, done: 0, failed: 0, status: 'ready' })
      return
    }

    setAudioPreload({ total: urls.length, done: 0, failed: 0, status: 'loading' })

    let done = 0
    let failed = 0
    // Téléchargements en parallèle, progression mise à jour au fil de l'eau
    await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url)
          const blob = await res.blob()
          const blobUrl = URL.createObjectURL(blob)
          audioLocalCacheRef.current.set(url, blobUrl)
          done++
        } catch {
          failed++
        }
        setAudioPreload({ total: urls.length, done, failed, status: 'loading' })
      })
    )

    setAudioPreload({ total: urls.length, done, failed, status: 'ready' })
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

  // Jouer l'audio de la bonne réponse (déjà préchargé) sur le PC animateur
  function playAnswerAudio() {
    if (!answerAudioRef.current) {
      // Fallback si pas préchargé
      const currentQ = questions[currentQuestionIndex]
      if (!currentQ?.audioUrl) return
      preloadAnswerAudio()
    }

    if (answerAudioRef.current) {
      const q = questionsRef.current[currentQuestionIndexRef.current] ?? questions[currentQuestionIndex]
      // Démarre à audioStart et coupe à audioEnd (si définis), sinon lecture intégrale.
      startClippedPlayback(
        answerAudioRef.current,
        q?.audioStart,
        q?.audioEnd,
        () => setIsAnswerAudioPlaying(true),
        () => setIsAnswerAudioPlaying(false),
      )
    }
  }

  // Arrêter l'audio de la bonne réponse (nettoyage entre questions)
  function stopAnswerAudio() {
    if (answerAudioRef.current) {
      clearClip(answerAudioRef.current)
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
      {/* Animated background effects - Premium gold/violet theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#D4AF37]/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/3 left-0 w-72 h-72 bg-violet-500/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        {/* Central radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
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
          penaltyPoints: penaltyPointsRef.current,
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
          <div className="flex items-center gap-2">
            <a href="/quiz-regles.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400">
                <FileText className="h-4 w-4 mr-2" />
                Notice
              </Button>
            </a>
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
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-8 py-6">
        {!gameActive ? (
          /* Configuration */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <motion.div
              whileHover={{ scale: 1.001 }}
              className="card-gold rounded-xl p-6 transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                    <HelpCircle className="h-6 w-6 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Quiz</h2>
                    <p className="text-[#6B6B70] text-sm">Créez vos questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
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
                    className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
                    title="Exporter en CSV"
                  >
                    <Download className="h-4 w-4" />
                    Exporter
                  </button>
                  <button
                    onClick={() => setShowSaveQuizModal(true)}
                    className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
                    title="Sauvegarder ce quiz dans votre bibliothèque"
                  >
                    <span aria-hidden>💾</span>
                    Sauvegarder
                  </button>
                  <button
                    onClick={loadSavedQuizzes}
                    className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
                    title="Charger un quiz de votre bibliothèque"
                  >
                    <span aria-hidden>📂</span>
                    Charger
                  </button>
                  <button
                    onClick={() => setShowPrepackagedModal(true)}
                    className="px-4 py-2.5 bg-[#2E2E33] text-[#B0B0B5] rounded-xl hover:bg-[#3E3E43] hover:text-white hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] flex items-center gap-2 text-sm transition-all duration-200 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30"
                    title="Quiz prêts à l'emploi"
                  >
                    <Package className="h-4 w-4" />
                    Quiz prêts
                  </button>
                  <button
                    onClick={addQuestion}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-xl font-bold hover:from-[#F4D03F] hover:to-[#D4AF37] flex items-center gap-2 transition-all duration-200 shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)]"
                  >
                    <Plus className="h-5 w-5" />
                    Ajouter
                  </button>
                  <button
                    onClick={clearAllQuestions}
                    className="px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 flex items-center gap-2 text-sm border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    title="Supprimer toutes les questions"
                  >
                    <Trash2 className="h-4 w-4" />
                    Tout vider
                  </button>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#D4AF37]/20 scrollbar-track-transparent">
                {questions.length === 0 ? (
                  <div className="text-center py-12 text-[#6B6B70]">
                    <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Aucune question pour le moment</p>
                    <p className="text-sm mt-1">Cliquez sur &quot;Ajouter&quot; pour créer votre première question</p>
                  </div>
                ) : (
                  questions.map((q, index) => (
                    <motion.div
                      key={q.id}
                      whileHover={{ scale: 1.005, x: 4 }}
                      className={`flex items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${
                        editingQuestion?.id === q.id
                          ? 'bg-gradient-to-r from-[#D4AF37]/20 to-[#D4AF37]/10 border border-[#D4AF37]/50 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                          : 'bg-[#1A1A1E]/80 hover:bg-[#2E2E33] border border-transparent hover:border-[#D4AF37]/20 hover:shadow-[0_0_15px_rgba(212,175,55,0.1)]'
                      }`}
                      onClick={() => setEditingQuestion(q)}
                    >
                      {/* Numéro stylé */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                        editingQuestion?.id === q.id
                          ? 'bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.5)]'
                          : 'bg-[#2E2E33] text-[#6B6B70] group-hover:bg-[#D4AF37]/20 group-hover:text-[#D4AF37]'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="flex-1 text-white truncate font-medium">{q.question}</span>
                      {q.audioUrl && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#E91E63]/10 rounded-lg border border-[#E91E63]/20">
                          <Music className="h-3.5 w-3.5 text-[#E91E63]" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/20">
                        <Timer className="h-3 w-3 text-[#D4AF37]" />
                        <span className="text-[#D4AF37] text-xs font-semibold">{q.timeLimit}s</span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-violet-500/10 rounded-lg border border-violet-500/20">
                        <Award className="h-3 w-3 text-violet-400" />
                        <span className="text-violet-400 text-xs font-semibold">{q.points}pts</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }}
                        className="p-2 text-[#6B6B70] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Question editor */}
            {editingQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.001 }}
                className="card-gold rounded-xl p-6 transition-all duration-300 hover:border-violet-500/30 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/30">
                    <HelpCircle className="h-5 w-5 text-violet-400" />
                  </div>
                  <h3 className="text-white font-bold text-lg">Modifier la question</h3>
                </div>
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

                  {/* Audio de la QUESTION (joué pendant la question) */}
                  <div className="mt-2 p-3 bg-[#1A1A1E] rounded-lg border border-[#14B8A6]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="h-4 w-4 text-[#14B8A6]" />
                      <label className="text-gray-300 text-xs font-medium">Audio de la question</label>
                    </div>
                    <input
                      ref={questionAudioFileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleQuestionPromptAudioUpload(e, editingQuestion.id)}
                      className="hidden"
                    />
                    {editingQuestion.questionAudioUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[#14B8A6]">
                          <Music className="h-3 w-3 shrink-0" />
                          <span className="text-xs font-medium truncate flex-1">
                            {editingQuestion.questionAudioName || 'Audio de la question'}
                          </span>
                          {questionAudioUploading && (
                            <span className="text-xs text-yellow-400 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sauvegarde...
                            </span>
                          )}
                          {previewQuestionAudioPlaying && <span className="text-xs animate-pulse">&#9835; Lecture...</span>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleQuestionPreviewAudio(editingQuestion.questionAudioUrl!)}
                            className={`shrink-0 p-2 rounded-lg transition-colors ${
                              previewQuestionAudioPlaying
                                ? 'bg-green-500 text-white'
                                : 'bg-[#14B8A6]/20 text-[#14B8A6] hover:bg-[#14B8A6]/30'
                            }`}
                          >
                            {previewQuestionAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={stopQuestionPreviewAudio}
                            className={`shrink-0 p-2 rounded-lg transition-colors ${
                              previewQuestionAudioPlaying
                                ? 'bg-red-500/30 text-red-400 hover:bg-red-500/50'
                                : 'bg-gray-600/20 text-gray-500'
                            }`}
                          >
                            <Square className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => questionAudioFileInputRef.current?.click()}
                            className="px-2 py-1.5 text-xs bg-[#2E2E33] text-gray-300 rounded hover:bg-[#3E3E43]"
                          >
                            Changer
                          </button>
                          <button
                            onClick={() => removeQuestionPromptAudio(editingQuestion.id)}
                            className="shrink-0 p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => changeQuestionAudioVolume(0)}
                            className="shrink-0 p-1 text-gray-400 hover:text-[#14B8A6] transition-colors"
                          >
                            <VolumeX className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={questionAudioVolume}
                            onChange={(e) => changeQuestionAudioVolume(parseFloat(e.target.value))}
                            className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#14B8A6]"
                          />
                          <button
                            onClick={() => changeQuestionAudioVolume(1)}
                            className="shrink-0 p-1 text-gray-400 hover:text-[#14B8A6] transition-colors"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs text-gray-500 w-8 text-right shrink-0">{Math.round(questionAudioVolume * 100)}%</span>
                        </div>

                        {/* Découpe de l'extrait (IN/OUT) — admin only */}
                        {!questionAudioUploading && (
                          <AudioTrimmer
                            key={editingQuestion.questionAudioUrl}
                            audioUrl={editingQuestion.questionAudioUrl!}
                            initialStart={editingQuestion.questionAudioStart}
                            initialEnd={editingQuestion.questionAudioEnd}
                            accent="#14B8A6"
                            onValidate={(start, end) => {
                              const u = { ...editingQuestion!, questionAudioStart: start, questionAudioEnd: end } as QuizQuestion
                              setEditingQuestion(u)
                              updateQuestion(u)
                              toast.success('Découpe enregistrée')
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => questionAudioFileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-gray-300 rounded-lg text-sm transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Ajouter un fichier audio
                      </button>
                    )}
                    <p className="text-gray-600 text-[10px] mt-1.5">
                      Se joue PENDANT la question (coupe la musique d&apos;ambiance, qui reprend ensuite). Distinct de l&apos;audio de la réponse.
                    </p>
                  </div>

                  {/* Audio de la réponse (révélation) */}
                  <div className="mt-2 p-3 bg-[#1A1A1E] rounded-lg border border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Music className="h-4 w-4 text-[#E91E63]" />
                      <label className="text-gray-400 text-xs font-medium">Audio de la réponse (révélation)</label>
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

                        {/* Découpe de l'extrait (IN/OUT) — admin only */}
                        {!audioUploading && (
                          <AudioTrimmer
                            key={editingQuestion.audioUrl}
                            audioUrl={editingQuestion.audioUrl!}
                            initialStart={editingQuestion.audioStart}
                            initialEnd={editingQuestion.audioEnd}
                            accent="#E91E63"
                            onValidate={(start, end) => {
                              const u = { ...editingQuestion!, audioStart: start, audioEnd: end } as QuizQuestion
                              setEditingQuestion(u)
                              updateQuestion(u)
                              toast.success('Découpe enregistrée')
                            }}
                          />
                        )}
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

                  {/* Photo de la bonne réponse */}
                  <div className="mt-2 p-3 bg-[#1A1A1E] rounded-lg border border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center gap-2 mb-2">
                      <ImageIcon className="h-4 w-4 text-[#3B82F6]" />
                      <label className="text-gray-400 text-xs font-medium">Photo (bonne réponse)</label>
                    </div>
                    <input
                      ref={questionPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleQuestionPhotoUpload(e, editingQuestion.id)}
                      className="hidden"
                    />
                    {editingQuestion.photoUrl ? (
                      <div className="space-y-2">
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={editingQuestion.photoUrl}
                            alt="Photo de la bonne réponse"
                            className="w-full max-h-40 object-contain rounded-lg bg-black/30"
                          />
                          {photoUploading && (
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/70 px-2 py-1 rounded text-xs text-yellow-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sauvegarde...
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => questionPhotoInputRef.current?.click()}
                            className="px-2 py-1.5 text-xs bg-[#2E2E33] text-gray-300 rounded hover:bg-[#3E3E43]"
                          >
                            Changer
                          </button>
                          <button
                            onClick={() => removeQuestionPhoto(editingQuestion.id)}
                            className="shrink-0 p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => questionPhotoInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-[#2E2E33] hover:bg-[#3E3E43] text-gray-300 rounded-lg text-sm transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Ajouter une photo
                      </button>
                    )}
                    <p className="text-gray-600 text-[10px] mt-1.5">
                      S&apos;affiche sur l&apos;écran public quand la bonne réponse est révélée
                    </p>
                  </div>

                  {/* Durée d'affichage du reveal (photo + audio) */}
                  {(editingQuestion.photoUrl || editingQuestion.audioUrl) && (
                    <div className="mt-2 p-3 bg-[#1A1A1E] rounded-lg border border-[rgba(255,255,255,0.1)]">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="h-4 w-4 text-[#D4AF37]" />
                        <label className="text-gray-400 text-xs font-medium">Durée d&apos;affichage de la réponse</label>
                      </div>
                      <div className="flex gap-2">
                        {[5, 10, 15, 20].map((s) => {
                          const current = editingQuestion.revealDuration ?? 10
                          const active = current === s
                          return (
                            <button
                              key={s}
                              onClick={() => {
                                const updated = { ...editingQuestion, revealDuration: s }
                                setEditingQuestion(updated)
                                updateQuestion(updated)
                              }}
                              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                                active
                                  ? 'bg-[#D4AF37] text-black'
                                  : 'bg-[#2E2E33] text-gray-300 hover:bg-[#3E3E43]'
                              }`}
                            >
                              {s}s
                            </button>
                          )
                        })}
                        {/* Option ∞ : révélation figée jusqu'à ce que le DJ avance manuellement (revealDuration = -1) */}
                        {(() => {
                          const infiniteActive = (editingQuestion.revealDuration ?? 10) < 0
                          return (
                            <button
                              onClick={() => {
                                const updated = { ...editingQuestion, revealDuration: -1 }
                                setEditingQuestion(updated)
                                updateQuestion(updated)
                              }}
                              title="Affichage illimité — le DJ passe manuellement à la question suivante"
                              className={`flex-1 py-2 rounded-lg text-lg font-bold leading-none transition-colors ${
                                infiniteActive
                                  ? 'bg-[#D4AF37] text-black'
                                  : 'bg-[#2E2E33] text-gray-300 hover:bg-[#3E3E43]'
                              }`}
                            >
                              &#8734;
                            </button>
                          )
                        })()}
                      </div>
                      <p className="text-gray-600 text-[10px] mt-1.5">
                        Temps pendant lequel la photo reste affichée et l&apos;audio joue (par défaut 10s). &#8734; = illimité, vous avancez manuellement.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Audio Controls */}
            <motion.div
              whileHover={{ scale: 1.001 }}
              className="card-gold rounded-xl p-5 mb-4 transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-[0_0_25px_rgba(212,175,55,0.15)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                  <Music className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <h3 className="text-white font-bold text-lg">Musique du Quiz</h3>
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
                        if (audioRef.current) {
                          audioRef.current.pause()
                          audioRef.current.onplay = null
                          audioRef.current.onpause = null
                          audioRef.current.onended = null
                          audioRef.current.src = ''
                          audioRef.current.load()
                          audioRef.current = null
                        }
                        // Révoquer l'URL blob
                        if (quizAudio && quizAudio.startsWith('blob:')) {
                          URL.revokeObjectURL(quizAudio)
                        }
                        setIsAudioPlaying(false)
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
            </motion.div>

            {/* Pénalité mauvaise réponse */}
            <div className="flex items-center justify-between bg-[#1A1A1E] rounded-xl p-3">
              <div>
                <p className="text-white text-sm font-medium">Pénalité mauvaise réponse</p>
                <p className="text-gray-500 text-xs mt-0.5">Points retirés si le joueur se trompe</p>
              </div>
              <select
                value={penaltyPoints}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setPenaltyPoints(v)
                  localStorage.setItem('quiz-penalty-points', String(v))
                }}
                className="bg-[#2E2E33] text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="0">Aucune</option>
                <option value="1">-1 pt</option>
                <option value="2">-2 pts</option>
                <option value="5">-5 pts</option>
                <option value="10">-10 pts</option>
              </select>
            </div>

            {/* Action buttons */}
            {!lobbyVisible ? (
              /* Step 1: Show Lobby button */
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={showLobby}
                disabled={launching || questions.length === 0}
                className="w-full py-4 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-black font-bold rounded-xl text-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:shadow-[0_0_40px_rgba(212,175,55,0.6)] border border-[#D4AF37]/50"
              >
                {launching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Monitor className="h-5 w-5" />
                    Afficher le Lobby ({questions.length} questions)
                  </>
                )}
              </motion.button>
            ) : (
              /* Step 2: Lobby is visible, show player count and Launch button */
              <div className="space-y-4">
                {/* Player count - show connected players in lobby */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-gold rounded-xl p-5 border-[#D4AF37]/40 shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/30 to-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/40 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                        <span className="text-2xl">👥</span>
                      </div>
                      <div>
                        <p className="text-[#6B6B70] text-sm">Joueurs inscrits</p>
                        <p className="text-[#D4AF37] text-3xl font-bold">{Math.max(participants.length, connectedPlayers.length)}</p>
                        {participants.length > 0 && (
                          <p className="text-[#6B6B70] text-xs mt-1 truncate max-w-[200px]">
                            {participants.slice(0, 3).map(p => p.odientName).join(', ')}
                            {participants.length > 3 && ` +${participants.length - 3}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`/live/${session?.code}`, 'photojet-live')}
                      className="px-4 py-2.5 bg-[#2E2E33] hover:bg-[#3E3E43] text-white rounded-xl text-sm flex items-center gap-2 border border-[rgba(255,255,255,0.05)] hover:border-[#D4AF37]/30 transition-all duration-200"
                    >
                      <Monitor className="h-4 w-4" />
                      Voir l&apos;écran
                    </button>
                  </div>
                </motion.div>

                {/* Launch Quiz button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={launchGame}
                  disabled={launching}
                  className="w-full py-4 bg-gradient-to-r from-green-500 via-green-400 to-green-500 text-white font-bold rounded-xl text-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] border border-green-400/50"
                >
                  {launching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      Lancer le Quiz
                    </>
                  )}
                </motion.button>

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
          penaltyPoints: penaltyPointsRef.current,
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

          </motion.div>
        ) : (
          /* Control Panel */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 card-gold rounded-xl p-5 border-[#D4AF37]/50 shadow-[0_0_30px_rgba(212,175,55,0.2)]"
            >
              {/* Question display */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 shadow-[0_0_10px_rgba(212,175,55,0.3)]">
                  <span className="text-[#B0B0B5] text-xs font-medium uppercase tracking-wider">Question</span>
                  <span className="text-3xl font-black font-mono leading-none text-[#D4AF37]">
                    {currentQuestionIndex + 1}
                    <span className="text-white/50 text-xl font-bold"> / {questions.length}</span>
                  </span>
                </div>
                {timeLeft !== null && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                    timeLeft <= 5 ? 'bg-red-500/20 border border-red-500/50' : 'bg-[#2E2E33] border border-[rgba(255,255,255,0.1)]'
                  }`}>
                    <Timer className={`h-5 w-5 ${timeLeft <= 5 ? 'text-red-500' : 'text-[#D4AF37]'}`} />
                    <span className={`text-2xl font-bold font-mono ${
                      timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'
                    }`}>
                      {timeLeft}s
                    </span>
                  </div>
                )}
              </div>

              {currentQuestion && (
                <div className="bg-[#1A1A1E]/80 rounded-xl p-5 mb-5 border border-[rgba(255,255,255,0.05)]">
                  <p className="text-xl text-white font-bold mb-5">{currentQuestion.question}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {currentQuestion.answers.map((answer, i) => {
                      const isCorrect = i === currentQuestion.correctAnswer
                      const percentage = totalAnswers > 0 ? (answerStats[i] / totalAnswers * 100) : 0
                      return (
                        <div
                          key={i}
                          className={`p-4 rounded-xl relative overflow-hidden transition-all duration-300 ${
                            showResults
                              ? isCorrect
                                ? 'bg-green-500/20 border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                : 'bg-[#2E2E33] border border-[rgba(255,255,255,0.05)]'
                              : 'bg-[#2E2E33] border border-[rgba(255,255,255,0.05)]'
                          }`}
                        >
                          {showResults && (
                            <div
                              className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/20 to-transparent"
                              style={{ width: `${percentage}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between">
                            <span className="text-white font-medium">{answer}</span>
                            {showResults && (
                              <span className="text-[#D4AF37] font-bold text-lg">{answerStats[i]}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Mini-player audio de la QUESTION (pendant la question, sur le PC animateur) */}
              {isAnswering && currentQuestion?.questionAudioUrl && (
                <div className="p-3 bg-[#14B8A6]/10 border border-[#14B8A6]/30 rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-[#14B8A6] flex-shrink-0" />
                    <span className="text-[#14B8A6] text-sm font-medium flex-1 truncate">
                      {currentQuestion.questionAudioName || 'Audio de la question'}
                      {isQuestionAudioPlaying && <span className="animate-pulse ml-1">&#9835;</span>}
                    </span>
                    <button
                      onClick={toggleQuestionAudio}
                      className={`shrink-0 p-2 rounded-lg transition-colors ${
                        isQuestionAudioPlaying
                          ? 'bg-[#14B8A6] text-white'
                          : 'bg-[#14B8A6]/20 text-[#14B8A6] hover:bg-[#14B8A6]/30'
                      }`}
                    >
                      {isQuestionAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={stopQuestionAudio}
                      className="shrink-0 p-2 rounded-lg bg-gray-600/30 text-gray-400 hover:bg-gray-600/50 transition-colors"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </div>
                  {/* Secours autoplay : si le son n'est pas parti tout seul */}
                  {!isQuestionAudioPlaying && (
                    <button
                      onClick={toggleQuestionAudio}
                      className="mt-2 w-full py-2 rounded-lg bg-[#14B8A6]/20 text-[#14B8A6] text-sm font-medium hover:bg-[#14B8A6]/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Volume2 className="h-4 w-4" />
                      🔊 Activer le son
                    </button>
                  )}
                  {/* Volume */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => changeQuestionAudioVolume(0)}
                      className="shrink-0 p-1 text-gray-400 hover:text-[#14B8A6] transition-colors"
                    >
                      <VolumeX className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={questionAudioVolume}
                      onChange={(e) => changeQuestionAudioVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#14B8A6]"
                    />
                    <button
                      onClick={() => changeQuestionAudioVolume(1)}
                      className="shrink-0 p-1 text-gray-400 hover:text-[#14B8A6] transition-colors"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-500 w-8 text-right shrink-0">{Math.round(questionAudioVolume * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Mini-player audio bonne réponse (lecture sur le PC animateur) */}
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

              {/* Indicateur : la photo est affichée sur l'écran public /live */}
              {showResults && currentQuestion?.photoUrl && (
                <div className="p-2.5 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg mb-4 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#3B82F6] flex-shrink-0" />
                  <span className="text-[#3B82F6] text-sm font-medium">Photo affichée sur l&apos;écran public</span>
                </div>
              )}

              {/* Indicateur de préchargement audio (fiabilité connexion en soirée) */}
              {audioPreload.total > 0 && (
                audioPreload.status === 'loading' ? (
                  <div className="p-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg mb-4 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-[#D4AF37] flex-shrink-0 animate-spin" />
                    <span className="text-[#D4AF37] text-sm font-medium">
                      Préchargement audio… {audioPreload.done}/{audioPreload.total}
                    </span>
                  </div>
                ) : audioPreload.failed > 0 ? (
                  <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0" />
                    <span className="text-orange-300 text-sm font-medium">
                      {audioPreload.done}/{audioPreload.total} audios préchargés ({audioPreload.failed} échec{audioPreload.failed > 1 ? 's' : ''} — relecture réseau au besoin)
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg mb-4 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                    <span className="text-green-300 text-sm font-medium">
                      ✓ Audios prêts ({audioPreload.done}/{audioPreload.total}) — lecture garantie sans réseau
                    </span>
                  </div>
                )
              )}

              {/* Controls */}
              <div className="space-y-3">
                {!isAnswering && !showResults && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={startQuestion}
                    className="w-full py-4 bg-gradient-to-r from-green-500 via-green-400 to-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(34,197,94,0.4)] hover:shadow-[0_0_35px_rgba(34,197,94,0.6)] border border-green-400/50"
                  >
                    <Play className="h-5 w-5" />
                    Lancer la question
                  </motion.button>
                )}

                {isAnswering && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={revealAnswer}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(249,115,22,0.4)] hover:shadow-[0_0_35px_rgba(249,115,22,0.6)] border border-orange-400/50"
                  >
                    <Check className="h-5 w-5" />
                    Révéler la réponse
                  </motion.button>
                )}

                {showResults && currentQuestionIndex < questions.length - 1 && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={nextQuestion}
                    className="w-full py-4 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] text-black rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:shadow-[0_0_35px_rgba(212,175,55,0.6)] border border-[#D4AF37]/50"
                  >
                    <SkipForward className="h-5 w-5" />
                    Question suivante ({currentQuestionIndex + 2}/{questions.length})
                  </motion.button>
                )}

                {showResults && currentQuestionIndex >= questions.length - 1 && !showPodium && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={displayPodium}
                    className="w-full py-4 bg-gradient-to-r from-[#FFD700] via-[#FFC107] to-[#FFD700] text-black rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_30px_rgba(255,215,0,0.5)] hover:shadow-[0_0_40px_rgba(255,215,0,0.7)] border border-[#FFD700]/50"
                  >
                    <Award className="h-5 w-5" />
                    Afficher le Podium 🏆
                  </motion.button>
                )}

                {showPodium && (
                  <div className="text-center py-5 bg-gradient-to-r from-[#FFD700]/20 via-[#FFD700]/10 to-[#FFD700]/20 rounded-xl border border-[#FFD700]/30">
                    <span className="text-[#FFD700] font-bold text-xl">🏆 Podium affiché!</span>
                  </div>
                )}
              </div>

              {/* Quitter */}
              <button
                onClick={exitGame}
                className="w-full mt-5 py-3 bg-red-500/10 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 border border-red-500/20 hover:border-red-500/40"
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
              className="card-gold rounded-xl p-5 transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-[0_0_25px_rgba(212,175,55,0.15)]"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                  <Trophy className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <h3 className="text-white font-bold text-lg">Classement</h3>
              </div>

              {sortedParticipants.length === 0 ? (
                <div className="text-center py-10 text-[#6B6B70]">
                  <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>En attente des joueurs...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedParticipants.map((p, index) => (
                    <motion.div
                      key={p.odientId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-3 rounded-xl p-3 transition-all duration-200 ${
                        index === 0
                          ? 'bg-gradient-to-r from-[#FFD700]/20 to-transparent border border-[#FFD700]/30'
                          : index === 1
                          ? 'bg-gradient-to-r from-[#C0C0C0]/15 to-transparent border border-[#C0C0C0]/20'
                          : index === 2
                          ? 'bg-gradient-to-r from-[#CD7F32]/15 to-transparent border border-[#CD7F32]/20'
                          : 'bg-[#1A1A1E]/80 border border-transparent hover:border-[rgba(255,255,255,0.05)]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-[#FFD700]/30 text-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.3)]'
                          : index === 1
                          ? 'bg-[#C0C0C0]/20 text-[#C0C0C0]'
                          : index === 2
                          ? 'bg-[#CD7F32]/20 text-[#CD7F32]'
                          : 'bg-[#2E2E33] text-[#6B6B70]'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="text-white flex-1 truncate font-medium">{p.odientName}</span>
                      <span className="text-[#D4AF37] font-bold">{p.totalScore} pts</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </main>

      {/* Modal Import CSV */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30">
                  <FileSpreadsheet className="h-5 w-5 text-[#D4AF37]" />
                </div>
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

      {/* Modal Quiz pré-packagés */}
      {showPrepackagedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30">
                  <Package className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Quiz prêts à l&apos;emploi</h3>
                  <p className="text-sm text-gray-400">75 questions réparties en 5 thèmes</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrepackagedModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {prepackagedQuizzes.map((quiz) => {
                  const isAdded = addedQuizIds.has(quiz.id)
                  return (
                    <motion.div
                      key={quiz.id}
                      whileHover={!isAdded ? { scale: 1.02 } : {}}
                      className={`card-gold rounded-xl p-5 transition-all duration-300 group relative ${
                        isAdded
                          ? 'opacity-60 cursor-default border-green-500/30'
                          : 'cursor-pointer hover:border-[#D4AF37]/50 hover:shadow-[0_0_25px_rgba(212,175,55,0.2)]'
                      }`}
                      onClick={() => !isAdded && addPrepackagedQuiz(quiz)}
                    >
                      {isAdded && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div className="text-4xl mb-3">{quiz.emoji}</div>
                      <h4 className="text-lg font-bold text-white mb-1">{quiz.name}</h4>
                      <p className="text-sm text-gray-400 mb-3">{quiz.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#D4AF37] font-medium">
                          {quiz.questions.length} questions
                        </span>
                        <span className={`text-xs transition-colors ${
                          isAdded
                            ? 'text-green-400'
                            : 'text-gray-500 group-hover:text-[#D4AF37]'
                        }`}>
                          {isAdded ? 'Ajouté !' : 'Cliquer pour ajouter'}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <div className="mt-6 p-4 bg-[#1A1A1E] rounded-xl border border-[rgba(255,255,255,0.05)]">
                <p className="text-sm text-gray-400">
                  <span className="text-[#D4AF37] font-medium">Note :</span> Les questions seront ajoutées à votre quiz actuel sans supprimer les questions existantes.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowPrepackagedModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modale : Sauvegarder le quiz dans la bibliothèque */}
      {showSaveQuizModal && (
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
                  <h3 className="text-lg font-bold text-white">Sauvegarder ce quiz</h3>
                  <p className="text-sm text-gray-400">{questions.length} question{questions.length > 1 ? 's' : ''} dans votre bibliothèque</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveQuizModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <label className="text-gray-400 text-xs">Nom du quiz</label>
              <input
                type="text"
                value={saveQuizName}
                onChange={(e) => setSaveQuizName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !savingQuiz) handleSaveQuiz() }}
                autoFocus
                placeholder="Ex : Blind Test Années 80, Quiz Mariage 2025"
                className="w-full bg-[#2E2E33] text-white rounded-lg px-3 py-2.5 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none mt-1"
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowSaveQuizModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveQuiz}
                disabled={savingQuiz}
                className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-xl font-bold hover:from-[#F4D03F] hover:to-[#D4AF37] flex items-center gap-2 transition-all duration-200 disabled:opacity-60"
              >
                {savingQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden>💾</span>}
                Sauvegarder
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modale : Charger un quiz sauvegardé */}
      {showLoadQuizModal && (
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
                  <h3 className="text-lg font-bold text-white">Votre bibliothèque de quiz</h3>
                  <p className="text-sm text-gray-400">Charger remplace les questions actuelles</p>
                </div>
              </div>
              <button
                onClick={() => setShowLoadQuizModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSavedQuizzes ? (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
                </div>
              ) : savedQuizzes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">📂</div>
                  <p>Aucun quiz sauvegardé pour l&apos;instant.</p>
                  <p className="text-sm text-gray-500 mt-1">Créez un quiz puis cliquez sur « 💾 Sauvegarder ».</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="card-gold rounded-xl p-4 flex items-center justify-between gap-3 hover:border-[#D4AF37]/50 transition-all duration-200"
                    >
                      <button
                        onClick={() => handleLoadQuiz(quiz)}
                        className="flex-1 text-left group"
                      >
                        <h4 className="text-white font-bold group-hover:text-[#D4AF37] transition-colors">{quiz.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(quiz.questions?.length ?? 0)} question{(quiz.questions?.length ?? 0) > 1 ? 's' : ''}
                          {' · '}
                          {new Date(quiz.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </button>
                      <button
                        onClick={() => handleLoadQuiz(quiz)}
                        className="shrink-0 px-3 py-2 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-lg font-bold text-sm hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all duration-200"
                      >
                        Charger
                      </button>
                      <button
                        onClick={() => handleDeleteSavedQuiz(quiz.id)}
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
                onClick={() => setShowLoadQuizModal(false)}
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
