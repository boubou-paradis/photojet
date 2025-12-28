// ===========================================
// QUIZ ENGINE - State Machine for Quiz Game
// ===========================================

import {
  QuizState,
  QuizQuestion,
  Player,
  PlayerAnswer,
  AnswerStats,
  LeaderboardEntry,
  QuestionWindow,
  QuizSessionConfig,
  DEFAULT_QUIZ_CONFIG,
  HostEventType,
  PlayerEventType,
  NextQuestionEvent,
  QuestionClosedEvent,
  LeaderboardUpdateEvent,
  QuizFinishedEvent,
  QuizStartedEvent,
  SyncPingEvent,
  PlayerJoinedEvent,
} from '../realtime/types'

import {
  validateAnswerOnHost,
  AntiCheatConfig,
  DEFAULT_ANTI_CHEAT_CONFIG,
  generateNonce,
  calculateTimeOffset,
  SuspectTracker,
  AnswerTracker,
  SyncData,
} from './antiCheat'

// ===========================================
// QUIZ ENGINE STATE
// ===========================================

export interface QuizEngineState {
  // Session
  sessionId: string
  sessionCode: string
  state: QuizState

  // Questions
  questions: QuizQuestion[]
  currentQuestionIndex: number
  currentWindow: QuestionWindow | null

  // Players
  players: Map<string, Player>

  // Answers for current question
  currentAnswers: PlayerAnswer[]
  currentStats: AnswerStats

  // Leaderboard
  leaderboard: LeaderboardEntry[]

  // Config
  config: QuizSessionConfig
  antiCheatConfig: AntiCheatConfig
  hideQuestionOnMobile: boolean

  // Trackers
  suspectTracker: SuspectTracker
  answerTracker: AnswerTracker

  // Timing
  questionStartedAt: number | null
  timerInterval: NodeJS.Timeout | null
}

// ===========================================
// CALLBACKS
// ===========================================

export interface QuizEngineCallbacks {
  onBroadcast: (event: HostEventType) => void
  onStateChange: (state: QuizState) => void
  onTimerTick: (timeLeftMs: number) => void
  onQuestionEnd: (stats: AnswerStats, correctKey: string) => void
  onPlayerJoin: (player: Player) => void
  onPlayerLeave: (playerId: string) => void
  onAnswerReceived: (answer: PlayerAnswer, accepted: boolean) => void
  onSuspectDetected: (playerId: string, reason: string) => void
}

// ===========================================
// QUIZ ENGINE CLASS
// ===========================================

export class QuizEngine {
  private state: QuizEngineState
  private callbacks: QuizEngineCallbacks

  constructor(
    sessionId: string,
    sessionCode: string,
    questions: QuizQuestion[],
    callbacks: QuizEngineCallbacks,
    config?: Partial<QuizSessionConfig>,
    antiCheatConfig?: Partial<AntiCheatConfig>
  ) {
    this.callbacks = callbacks

    this.state = {
      sessionId,
      sessionCode,
      state: 'LOBBY',
      questions,
      currentQuestionIndex: -1,
      currentWindow: null,
      players: new Map(),
      currentAnswers: [],
      currentStats: { A: 0, B: 0, C: 0, D: 0, total: 0 },
      leaderboard: [],
      config: {
        ...DEFAULT_QUIZ_CONFIG,
        sessionId,
        sessionCode,
        ...config,
      },
      antiCheatConfig: {
        ...DEFAULT_ANTI_CHEAT_CONFIG,
        ...antiCheatConfig,
      },
      hideQuestionOnMobile: config?.hideQuestionOnMobile || false,
      suspectTracker: new SuspectTracker(),
      answerTracker: new AnswerTracker(),
      questionStartedAt: null,
      timerInterval: null,
    }
  }

  // ===========================================
  // GETTERS
  // ===========================================

  getState(): QuizState {
    return this.state.state
  }

  getPlayers(): Player[] {
    return Array.from(this.state.players.values())
  }

  getPlayerCount(): number {
    return this.state.players.size
  }

  getCurrentQuestion(): QuizQuestion | null {
    if (this.state.currentQuestionIndex < 0) return null
    return this.state.questions[this.state.currentQuestionIndex] || null
  }

  getCurrentQuestionIndex(): number {
    return this.state.currentQuestionIndex
  }

  getTotalQuestions(): number {
    return this.state.questions.length
  }

  getCurrentStats(): AnswerStats {
    return { ...this.state.currentStats }
  }

  getLeaderboard(): LeaderboardEntry[] {
    return [...this.state.leaderboard]
  }

  getSuspectCount(): number {
    return this.state.suspectTracker.getSuspectCount()
  }

  getSuspects() {
    return this.state.suspectTracker.getSuspects()
  }

  getCurrentWindow(): QuestionWindow | null {
    return this.state.currentWindow
  }

  isAntiCheatEnabled(): boolean {
    return this.state.antiCheatConfig.enabled
  }

  isHideQuestionOnMobile(): boolean {
    return this.state.hideQuestionOnMobile
  }

  // ===========================================
  // SETTERS
  // ===========================================

  setAntiCheatEnabled(enabled: boolean): void {
    this.state.antiCheatConfig.enabled = enabled
  }

  setHideQuestionOnMobile(hide: boolean): void {
    this.state.hideQuestionOnMobile = hide
  }

  // ===========================================
  // PLAYER MANAGEMENT
  // ===========================================

  addPlayer(playerId: string, playerName: string): Player {
    const player: Player = {
      id: playerId,
      name: playerName,
      joinedAt: Date.now(),
      score: 0,
      streak: 0,
      lastAnswerCorrect: false,
      isSuspect: false,
      suspectReasons: [],
      offsetMs: 0,
      lastPingAt: 0,
    }

    this.state.players.set(playerId, player)
    this.callbacks.onPlayerJoin(player)

    // Broadcast player joined
    const event: PlayerJoinedEvent = {
      type: 'player_joined',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      playerId,
      playerName,
      totalPlayers: this.state.players.size,
    }
    this.callbacks.onBroadcast(event)

    return player
  }

  removePlayer(playerId: string): void {
    this.state.players.delete(playerId)
    this.callbacks.onPlayerLeave(playerId)
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.get(playerId)
  }

  // ===========================================
  // TIME SYNC
  // ===========================================

  handleSyncPong(playerId: string, hostSentAt: number, playerReceivedAt: number, playerSentAt: number): void {
    const player = this.state.players.get(playerId)
    if (!player) return

    const syncData: SyncData = {
      hostSentAt,
      playerReceivedAt,
      playerSentAt,
      hostReceivedAt: Date.now(),
    }

    const offset = calculateTimeOffset(syncData)
    player.offsetMs = offset
    player.lastPingAt = Date.now()

    // Send offset back to player
    this.callbacks.onBroadcast({
      type: 'sync_offset',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      playerId,
      offsetMs: offset,
    })
  }

  broadcastSyncPing(): void {
    const event: SyncPingEvent = {
      type: 'sync_ping',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      hostSentAt: Date.now(),
    }
    this.callbacks.onBroadcast(event)
  }

  // ===========================================
  // QUIZ FLOW
  // ===========================================

  startQuiz(): void {
    if (this.state.state !== 'LOBBY') {
      console.warn('[QuizEngine] Cannot start quiz, not in LOBBY state')
      return
    }

    this.state.state = 'RUNNING'
    this.state.currentQuestionIndex = -1
    this.callbacks.onStateChange('RUNNING')

    // Broadcast quiz started
    const event: QuizStartedEvent = {
      type: 'quiz_started',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      totalQuestions: this.state.questions.length,
      antiCheatEnabled: this.state.antiCheatConfig.enabled,
      hideQuestionOnMobile: this.state.hideQuestionOnMobile,
    }
    this.callbacks.onBroadcast(event)

    // Start first question after a short delay
    setTimeout(() => this.nextQuestion(), 1000)
  }

  nextQuestion(): void {
    // Clear timer
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval)
      this.state.timerInterval = null
    }

    // Move to next question
    this.state.currentQuestionIndex++

    // Check if quiz is finished
    if (this.state.currentQuestionIndex >= this.state.questions.length) {
      this.finishQuiz()
      return
    }

    const question = this.state.questions[this.state.currentQuestionIndex]
    const now = Date.now()

    // Reset current question state
    this.state.currentAnswers = []
    this.state.currentStats = { A: 0, B: 0, C: 0, D: 0, total: 0 }

    // Create question window
    const opensAt = now + 800 // 800ms delay for sync
    const closesAt = opensAt + question.durationMs
    const nonce = generateNonce()

    this.state.currentWindow = {
      questionIndex: this.state.currentQuestionIndex,
      opensAt,
      closesAt,
      nonce,
    }

    this.state.questionStartedAt = opensAt
    this.state.state = 'RUNNING'

    // Broadcast next question
    const event: NextQuestionEvent = {
      type: 'next_question',
      sessionId: this.state.sessionId,
      timestamp: now,
      questionIndex: this.state.currentQuestionIndex,
      question: question.question,
      answers: question.answers,
      durationMs: question.durationMs,
      points: question.points,
      opensAt,
      closesAt,
      nonce,
      hideQuestionOnMobile: this.state.hideQuestionOnMobile,
    }
    this.callbacks.onBroadcast(event)

    // Start timer
    this.startTimer(closesAt)
  }

  private startTimer(closesAt: number): void {
    this.state.timerInterval = setInterval(() => {
      const now = Date.now()
      const timeLeft = closesAt - now

      if (timeLeft <= 0) {
        this.endQuestion()
      } else {
        this.callbacks.onTimerTick(timeLeft)
      }
    }, 100) // Update every 100ms for smooth display
  }

  private endQuestion(): void {
    // Clear timer
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval)
      this.state.timerInterval = null
    }

    const question = this.getCurrentQuestion()
    if (!question) return

    this.state.state = 'ANSWER_REVEAL'
    this.callbacks.onStateChange('ANSWER_REVEAL')

    // Calculate scores
    this.calculateScores()

    // Broadcast question closed
    const event: QuestionClosedEvent = {
      type: 'question_closed',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      questionIndex: this.state.currentQuestionIndex,
      correctKey: question.correctKey,
      stats: this.state.currentStats,
    }
    this.callbacks.onBroadcast(event)

    this.callbacks.onQuestionEnd(this.state.currentStats, question.correctKey)

    // Update and broadcast leaderboard
    this.updateLeaderboard()
  }

  private calculateScores(): void {
    const question = this.getCurrentQuestion()
    if (!question || !this.state.currentWindow) return

    const { opensAt, closesAt } = this.state.currentWindow
    const totalTime = closesAt - opensAt

    for (const answer of this.state.currentAnswers) {
      const player = this.state.players.get(answer.playerId)
      if (!player) continue

      const isCorrect = answer.answerKey === question.correctKey

      if (isCorrect) {
        // Calculate time-based points
        const answerTime = answer.estimatedHostAt - opensAt
        const timeRatio = Math.max(0, 1 - answerTime / totalTime)
        const points = Math.round(question.points * (0.5 + 0.5 * timeRatio)) // 50-100% of points based on speed

        player.score += points
        player.streak++
        player.lastAnswerCorrect = true

        // Streak bonus
        if (player.streak >= 3) {
          player.score += Math.round(points * 0.1 * player.streak) // 10% bonus per streak
        }
      } else {
        player.streak = 0
        player.lastAnswerCorrect = false
      }
    }
  }

  private updateLeaderboard(): void {
    const entries: LeaderboardEntry[] = []
    let correctAnswers = new Map<string, number>()
    let totalAnswers = new Map<string, number>()

    // Count correct/total answers per player
    for (const answer of this.state.currentAnswers) {
      const question = this.state.questions[answer.questionIndex]
      if (!question) continue

      const current = totalAnswers.get(answer.playerId) || 0
      totalAnswers.set(answer.playerId, current + 1)

      if (answer.answerKey === question.correctKey) {
        const correct = correctAnswers.get(answer.playerId) || 0
        correctAnswers.set(answer.playerId, correct + 1)
      }
    }

    // Build leaderboard
    this.state.players.forEach((player) => {
      entries.push({
        playerId: player.id,
        playerName: player.name,
        score: player.score,
        rank: 0,
        streak: player.streak,
        correctAnswers: correctAnswers.get(player.id) || 0,
        totalAnswers: totalAnswers.get(player.id) || 0,
      })
    })

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score)

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    this.state.leaderboard = entries

    // Broadcast leaderboard
    const event: LeaderboardUpdateEvent = {
      type: 'leaderboard_update',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      leaderboard: entries,
    }
    this.callbacks.onBroadcast(event)
  }

  showLeaderboard(): void {
    this.state.state = 'LEADERBOARD'
    this.callbacks.onStateChange('LEADERBOARD')
    this.updateLeaderboard()
  }

  private finishQuiz(): void {
    // Clear timer
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval)
      this.state.timerInterval = null
    }

    this.state.state = 'FINISHED'
    this.callbacks.onStateChange('FINISHED')

    // Final leaderboard
    this.updateLeaderboard()

    // Broadcast quiz finished
    const event: QuizFinishedEvent = {
      type: 'quiz_finished',
      sessionId: this.state.sessionId,
      timestamp: Date.now(),
      finalLeaderboard: this.state.leaderboard,
    }
    this.callbacks.onBroadcast(event)
  }

  // ===========================================
  // ANSWER HANDLING
  // ===========================================

  handleAnswer(answer: PlayerAnswer): void {
    const player = this.state.players.get(answer.playerId)
    if (!player) {
      console.warn('[QuizEngine] Answer from unknown player:', answer.playerId)
      return
    }

    // Add received timestamp
    answer.receivedAt = Date.now()

    // Validate answer
    if (!this.state.currentWindow) {
      console.warn('[QuizEngine] No current window, rejecting answer')
      this.callbacks.onAnswerReceived(answer, false)
      return
    }

    const previousAnswers = this.state.answerTracker.getAnsweredSet(answer.questionIndex)
    const result = validateAnswerOnHost(
      answer,
      this.state.currentWindow,
      previousAnswers,
      this.state.antiCheatConfig,
      Date.now()
    )

    if (result.suspect && result.reason) {
      // Track suspect
      this.state.suspectTracker.addSuspect(answer.playerId, player.name, result.reason)
      player.isSuspect = true
      player.suspectReasons.push(result.reason)
      this.callbacks.onSuspectDetected(answer.playerId, result.reason.type)
    }

    if (result.accepted) {
      // Accept answer
      this.state.currentAnswers.push(answer)
      this.state.answerTracker.markAnswered(answer.questionIndex, answer.playerId)

      // Update stats
      this.state.currentStats[answer.answerKey]++
      this.state.currentStats.total++

      this.callbacks.onAnswerReceived(answer, true)
    } else {
      this.callbacks.onAnswerReceived(answer, false)
    }
  }

  // ===========================================
  // PLAYER EVENT HANDLING
  // ===========================================

  handlePlayerEvent(event: PlayerEventType): void {
    switch (event.type) {
      case 'join_request':
        this.addPlayer(event.playerId, event.playerName)
        break

      case 'answer_submitted':
        this.handleAnswer({
          playerId: event.playerId,
          playerName: this.state.players.get(event.playerId)?.name || 'Unknown',
          questionIndex: event.questionIndex,
          answerKey: event.answerKey,
          clientSentAt: event.clientSentAt,
          estimatedHostAt: event.estimatedHostAt,
          nonce: event.nonce,
        })
        break

      case 'sync_pong':
        this.handleSyncPong(
          event.playerId,
          event.hostSentAt,
          event.playerReceivedAt,
          event.playerSentAt
        )
        break

      case 'leave_request':
        this.removePlayer(event.playerId)
        break
    }
  }

  // ===========================================
  // CLEANUP
  // ===========================================

  destroy(): void {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval)
    }
    this.state.players.clear()
    this.state.suspectTracker.clear()
    this.state.answerTracker.clear()
  }

  // ===========================================
  // RESET
  // ===========================================

  reset(): void {
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval)
      this.state.timerInterval = null
    }

    this.state.state = 'LOBBY'
    this.state.currentQuestionIndex = -1
    this.state.currentWindow = null
    this.state.currentAnswers = []
    this.state.currentStats = { A: 0, B: 0, C: 0, D: 0, total: 0 }
    this.state.leaderboard = []
    this.state.questionStartedAt = null

    // Reset player scores but keep players
    this.state.players.forEach((player) => {
      player.score = 0
      player.streak = 0
      player.lastAnswerCorrect = false
      player.isSuspect = false
      player.suspectReasons = []
    })

    this.state.suspectTracker.clear()
    this.state.answerTracker.clear()

    this.callbacks.onStateChange('LOBBY')
  }
}
