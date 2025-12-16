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
  const [gameActive, setGameActive] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isAnswering, setIsAnswering] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [participants, setParticipants] = useState<QuizParticipant[]>([])
  const [answerStats, setAnswerStats] = useState<number[]>([0, 0, 0, 0])

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
    questions: QuizQuestion[]
    currentQuestionIndex: number
    isAnswering: boolean
    showResults: boolean
    timeLeft: number | null
    participants: QuizParticipant[]
    answerStats: number[]
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
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
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
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isAnswering, timeLeft, session, questions, currentQuestionIndex, participants, answerStats, broadcastGameState, supabase])

  // Subscribe to realtime answers
  useEffect(() => {
    if (!session || !gameActive) return

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
  }, [session, gameActive, questions, currentQuestionIndex, supabase])

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
          quiz_questions: JSON.stringify(questions),
          quiz_current_question: 0,
          quiz_is_answering: false,
          quiz_show_results: false,
          quiz_time_left: null,
          quiz_answers: JSON.stringify([]),
          quiz_participants: JSON.stringify([]),
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setCurrentQuestionIndex(0)
      setIsAnswering(false)
      setShowResults(false)
      setTimeLeft(null)
      setParticipants([])
      setAnswerStats([0, 0, 0, 0])

      broadcastGameState({
        gameActive: true,
        questions,
        currentQuestionIndex: 0,
        isAnswering: false,
        showResults: false,
        timeLeft: null,
        participants: [],
        answerStats: [0, 0, 0, 0],
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

  async function startQuestion() {
    if (!session) return

    const currentQ = questions[currentQuestionIndex]
    if (!currentQ) return

    setIsAnswering(true)
    setShowResults(false)
    setTimeLeft(currentQ.timeLimit)
    setAnswerStats([0, 0, 0, 0])

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

  const currentQuestion = questions[currentQuestionIndex]
  const sortedParticipants = [...participants].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5)
  const totalAnswers = answerStats.reduce((a, b) => a + b, 0)

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
              onClick={() => router.push('/admin/jeux')}
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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">❓</span>
                  <div>
                    <h2 className="text-xl font-bold text-white">Quiz</h2>
                    <p className="text-gray-400 text-sm">Créez vos questions</p>
                  </div>
                </div>
                <button
                  onClick={addQuestion}
                  className="px-4 py-2 bg-[#D4AF37] text-black rounded-xl font-bold hover:bg-[#F4D03F] flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Ajouter
                </button>
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
                </div>
              </motion.div>
            )}

            {/* Launch button */}
            <button
              onClick={launchGame}
              disabled={launching || questions.length === 0}
              className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-bold rounded-xl text-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {launching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>🚀 Lancer le quiz ({questions.length} questions)</>
              )}
            </button>

            {/* Clear data button */}
            {questions.length > 0 && questions !== DEFAULT_QUESTIONS && (
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

                {showResults && currentQuestionIndex >= questions.length - 1 && (
                  <div className="text-center py-4 text-[#D4AF37] font-bold text-xl">
                    🎉 Quiz terminé!
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
    </div>
  )
}
