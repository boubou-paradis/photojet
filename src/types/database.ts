export type TransitionType = 'fade' | 'slide' | 'zoom'
export type PhotoStatus = 'pending' | 'approved' | 'rejected'
export type MessageStatus = 'pending' | 'approved' | 'rejected'
export type PhotoSource = 'invite' | 'borne'
export type MessageSource = 'invite' | 'borne'
export type CameraType = 'front' | 'back'
export type DeviceType = 'ipad' | 'android_tablet' | 'other'
export type BackgroundType = 'color' | 'image'
export type LogoSize = 'small' | 'medium' | 'large'
export type LogoPosition = 'bottom-left' | 'top-center'
export type MysteryPhotoGrid = '6x4' | '8x6' | '10x8' | '12x8' | '15x10' | '20x12'
export type MysteryPhotoSpeed = 'slow' | 'medium' | 'fast'

export interface Session {
  id: string
  code: string
  name: string
  created_at: string
  expires_at: string
  moderation_enabled: boolean
  show_qr_on_screen: boolean
  transition_type: TransitionType
  transition_duration: number
  album_qr_code: string | null
  is_active: boolean
  user_id: string | null
  // Borne photo settings
  borne_enabled: boolean
  borne_qr_code: string | null
  borne_countdown: boolean
  borne_countdown_duration: number
  borne_return_delay: number
  borne_default_camera: CameraType
  borne_show_event_name: boolean
  borne_lock_enabled: boolean
  borne_lock_code: string
  // Customization settings
  background_type: BackgroundType
  background_color: string
  background_image: string | null
  background_opacity: number
  custom_logo: string | null
  logo_size: LogoSize
  logo_position: LogoPosition
  // Messages settings
  messages_enabled: boolean
  messages_frequency: number // Show message every X photos
  messages_duration: number // Duration in seconds
  // Mystery Photo Game settings
  mystery_photo_enabled: boolean
  mystery_photo_url: string | null // Legacy single photo (kept for backwards compatibility)
  mystery_photo_grid: MysteryPhotoGrid
  mystery_photo_speed: MysteryPhotoSpeed
  mystery_photo_active: boolean
  mystery_photo_state: string | null // JSON string for game state (tiles, isPlaying, etc.)
  // Multi-photo support
  mystery_photos: string | null // JSON array of photo URLs
  mystery_current_round: number
  mystery_total_rounds: number
  mystery_is_playing: boolean
  mystery_revealed_tiles: number[] | null // Array of revealed tile indices for current round
  // Album settings
  album_enabled: boolean
  album_password: string | null
  // Lineup Game (Le Bon Ordre) settings
  lineup_active: boolean
  lineup_team_size: number
  lineup_clock_duration: number
  lineup_team1_name: string
  lineup_team2_name: string
  lineup_team1_score: number
  lineup_team2_score: number
  lineup_current_number: string
  lineup_time_left: number
  lineup_is_running: boolean
  lineup_is_paused: boolean
  lineup_is_game_over: boolean
  lineup_current_points: number
  lineup_show_winner: boolean
  // Vote Photo settings
  vote_active: boolean
  vote_photos: string | null // JSON array of VotePhotoCandidate
  vote_votes: string | null // JSON array of VoteRecord
  vote_is_open: boolean
  vote_show_results: boolean
  vote_show_podium: boolean
  vote_timer: number | null // Optional timer in seconds
  vote_timer_left: number | null
  // Wheel (Roue de la Fortune) settings
  wheel_active: boolean
  wheel_segments: string | null // JSON array of WheelSegment
  wheel_is_spinning: boolean
  wheel_result: string | null // Current result text
  wheel_history: string | null // JSON array of WheelResult
  // Challenges (Défis Photo) settings
  challenges_active: boolean
  challenges_list: string | null // JSON array of PhotoChallenge
  challenges_submissions: string | null // JSON array of ChallengeSubmission
  challenges_current: string | null // Current challenge ID being displayed
  // Quiz settings
  quiz_active: boolean
  quiz_questions: string | null // JSON array of QuizQuestion
  quiz_current_question: number
  quiz_is_answering: boolean
  quiz_show_results: boolean
  quiz_time_left: number | null
  quiz_answers: string | null // JSON array of QuizAnswer
  quiz_participants: string | null // JSON array of QuizParticipant
  // Blind Test settings
  blindtest_active: boolean
  blindtest_songs: string | null // JSON array of BlindTestSong
  blindtest_current_song: number
  blindtest_is_playing: boolean
  blindtest_show_answer: boolean
  blindtest_time_left: number | null
  blindtest_answers: string | null // JSON array of BlindTestAnswer
  blindtest_participants: string | null // JSON array of BlindTestParticipant
}

// Mystery Photo types
export interface MysteryPhotoRound {
  url: string
  audioUrl?: string // URL audio optionnel pour chaque photo
  revealedTiles: number[]
}

export interface MysteryGameState {
  currentRound: number
  totalRounds: number
  isPlaying: boolean
  revealedTiles: number[]
  photos: MysteryPhotoRound[]
}

// Lineup Game (Le Bon Ordre) types
export interface LineupGameState {
  teamSize: number
  clockDuration: number
  team1Name: string
  team2Name: string
  team1Score: number
  team2Score: number
  currentNumber: string
  timeLeft: number
  isRunning: boolean
  isPaused: boolean
  isGameOver: boolean
  currentPoints: number
  showWinner: boolean
}

// Vote Photo types
export interface VotePhotoCandidate {
  photoId: string
  photoUrl: string
  votes: number
}

export interface VoteRecord {
  odientId: string
  photoId: string
  timestamp: string
}

// Wheel (Roue de la Fortune) types
export interface WheelSegment {
  id: string
  text: string
  color: string
  probability?: number
}

export interface WheelResult {
  segmentId: string
  text: string
  timestamp: string
}

// Challenges (Défis Photo) types
export interface PhotoChallenge {
  id: string
  title: string
  description?: string
  points: number
  enabled: boolean
}

export interface ChallengeSubmission {
  id: string
visitorId: string
  visitorName: string
  challengeId: string
  photoUrl: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
}

// Quiz types
export interface QuizQuestion {
  id: string
  question: string
  answers: string[]
  correctAnswer: number // Index of correct answer
  timeLimit: number // Seconds
  points: number
}

export interface QuizAnswer {
  odientId: string
  odientName: string
  questionId: string
  answerIndex: number
  timeToAnswer: number // Milliseconds
  correct: boolean
  pointsEarned: number
}

export interface QuizParticipant {
  odientId: string
  odientName: string
  totalScore: number
  correctAnswers: number
}

// Blind Test types
export interface BlindTestSong {
  id: string
  title: string
  artist: string
  audioUrl?: string // URL to audio file or YouTube/Spotify link
  coverUrl?: string
  startTime?: number // Start position in seconds
  duration?: number // Clip duration in seconds
  points: number
}

export interface BlindTestAnswer {
  odientId: string
  odientName: string
  songId: string
  answer: string
  correct: boolean
  timeToAnswer: number
  pointsEarned: number
}

export interface BlindTestParticipant {
  odientId: string
  odientName: string
  totalScore: number
  correctAnswers: number
}

export interface Photo {
  id: string
  session_id: string
  storage_path: string
  status: PhotoStatus
  uploaded_at: string
  approved_at: string | null
  uploader_name: string | null
  source: PhotoSource
}

export interface Message {
  id: string
  session_id: string
  content: string
  author_name: string | null
  status: MessageStatus
  created_at: string
  approved_at: string | null
  source: MessageSource
}

export interface BorneConnection {
  id: string
  session_id: string
  device_id: string
  device_type: DeviceType
  last_seen: string
  is_online: boolean
}

export type SessionInsert = Omit<Session, 'id' | 'created_at'>
export type SessionUpdate = Partial<Omit<Session, 'id' | 'created_at'>>
export type PhotoInsert = Omit<Photo, 'id' | 'uploaded_at'>
export type PhotoUpdate = Partial<Omit<Photo, 'id' | 'uploaded_at'>>
export type MessageInsert = Omit<Message, 'id' | 'created_at'>
export type MessageUpdate = Partial<Omit<Message, 'id' | 'created_at'>>
export type BorneConnectionInsert = Omit<BorneConnection, 'id'>
export type BorneConnectionUpdate = Partial<Omit<BorneConnection, 'id'>>

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session
        Insert: SessionInsert
        Update: SessionUpdate
      }
      photos: {
        Row: Photo
        Insert: PhotoInsert
        Update: PhotoUpdate
      }
      messages: {
        Row: Message
        Insert: MessageInsert
        Update: MessageUpdate
      }
      borne_connections: {
        Row: BorneConnection
        Insert: BorneConnectionInsert
        Update: BorneConnectionUpdate
      }
    }
  }
}
