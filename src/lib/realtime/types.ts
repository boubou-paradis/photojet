// ===========================================
// REALTIME TYPES FOR QUIZ SYSTEM
// ===========================================

export type QuizState = 'LOBBY' | 'RUNNING' | 'ANSWER_REVEAL' | 'LEADERBOARD' | 'FINISHED'

export interface Player {
  id: string
  name: string
  joinedAt: number
  score: number
  streak: number
  lastAnswerCorrect: boolean
  isSuspect: boolean
  suspectReasons: SuspectReason[]
  // Time sync
  offsetMs: number
  lastPingAt: number
}

export interface QuizQuestion {
  id: string
  question: string
  answers: {
    A: string
    B: string
    C: string
    D: string
  }
  correctKey: 'A' | 'B' | 'C' | 'D'
  durationMs: number // typically 20000 (20s)
  points: number
}

export interface QuestionWindow {
  questionIndex: number
  opensAt: number // epoch ms
  closesAt: number // epoch ms
  nonce: string // random token to prevent replay
}

export interface PlayerAnswer {
  playerId: string
  playerName: string
  questionIndex: number
  answerKey: 'A' | 'B' | 'C' | 'D'
  clientSentAt: number // player's Date.now()
  estimatedHostAt: number // player's estimate of host time
  nonce: string
  receivedAt?: number // when host received it
}

export interface AnswerStats {
  A: number
  B: number
  C: number
  D: number
  total: number
}

export interface SuspectReason {
  type: 'too_fast' | 'late' | 'duplicate' | 'bad_nonce' | 'invalid_state'
  details: string
  timestamp: number
}

export interface LeaderboardEntry {
  playerId: string
  playerName: string
  score: number
  rank: number
  streak: number
  correctAnswers: number
  totalAnswers: number
}

// ===========================================
// EVENTS (Host -> Players)
// ===========================================

export interface HostEvent {
  type: string
  sessionId: string
  timestamp: number
}

export interface QuizStartedEvent extends HostEvent {
  type: 'quiz_started'
  totalQuestions: number
  antiCheatEnabled: boolean
  hideQuestionOnMobile: boolean
}

export interface NextQuestionEvent extends HostEvent {
  type: 'next_question'
  questionIndex: number
  question: string
  answers: { A: string; B: string; C: string; D: string }
  durationMs: number
  points: number
  opensAt: number
  closesAt: number
  nonce: string
  hideQuestionOnMobile: boolean
}

export interface QuestionClosedEvent extends HostEvent {
  type: 'question_closed'
  questionIndex: number
  correctKey: 'A' | 'B' | 'C' | 'D'
  stats: AnswerStats
}

export interface LeaderboardUpdateEvent extends HostEvent {
  type: 'leaderboard_update'
  leaderboard: LeaderboardEntry[]
}

export interface QuizFinishedEvent extends HostEvent {
  type: 'quiz_finished'
  finalLeaderboard: LeaderboardEntry[]
}

export interface SyncPingEvent extends HostEvent {
  type: 'sync_ping'
  hostSentAt: number
}

export interface SyncOffsetEvent extends HostEvent {
  type: 'sync_offset'
  playerId: string
  offsetMs: number
}

export interface PlayerJoinedEvent extends HostEvent {
  type: 'player_joined'
  playerId: string
  playerName: string
  totalPlayers: number
}

export interface PlayerLeftEvent extends HostEvent {
  type: 'player_left'
  playerId: string
  totalPlayers: number
}

export type HostEventType =
  | QuizStartedEvent
  | NextQuestionEvent
  | QuestionClosedEvent
  | LeaderboardUpdateEvent
  | QuizFinishedEvent
  | SyncPingEvent
  | SyncOffsetEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent

// ===========================================
// EVENTS (Players -> Host)
// ===========================================

export interface PlayerEvent {
  type: string
  playerId: string
  timestamp: number
}

export interface JoinRequestEvent extends PlayerEvent {
  type: 'join_request'
  playerName: string
  sessionCode: string
}

export interface AnswerSubmittedEvent extends PlayerEvent {
  type: 'answer_submitted'
  questionIndex: number
  answerKey: 'A' | 'B' | 'C' | 'D'
  clientSentAt: number
  estimatedHostAt: number
  nonce: string
}

export interface SyncPongEvent extends PlayerEvent {
  type: 'sync_pong'
  hostSentAt: number
  playerReceivedAt: number
  playerSentAt: number
}

export interface LeaveRequestEvent extends PlayerEvent {
  type: 'leave_request'
}

export type PlayerEventType =
  | JoinRequestEvent
  | AnswerSubmittedEvent
  | SyncPongEvent
  | LeaveRequestEvent

// ===========================================
// CLIENT INTERFACE
// ===========================================

export interface RealtimeClient {
  // Connection
  connect(sessionId: string, role: 'host' | 'player'): Promise<void>
  disconnect(): void
  isConnected(): boolean

  // Host methods
  broadcast(event: HostEventType): void
  onPlayerEvent(callback: (event: PlayerEventType) => void): () => void

  // Player methods
  send(event: PlayerEventType): void
  onHostEvent(callback: (event: HostEventType) => void): () => void

  // Session info
  getSessionId(): string | null
}

// ===========================================
// QUIZ SESSION CONFIG
// ===========================================

export interface QuizSessionConfig {
  sessionId: string
  sessionCode: string
  antiCheatEnabled: boolean
  hideQuestionOnMobile: boolean
  questionDurationMs: number
  syncIntervalMs: number
  minReactionTimeMs: number // anti-cheat: reject if faster than this (default 250ms)
}

export const DEFAULT_QUIZ_CONFIG: Omit<QuizSessionConfig, 'sessionId' | 'sessionCode'> = {
  antiCheatEnabled: true,
  hideQuestionOnMobile: false,
  questionDurationMs: 20000,
  syncIntervalMs: 5000,
  minReactionTimeMs: 250,
}
