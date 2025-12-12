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
}

// Mystery Photo types
export interface MysteryPhotoRound {
  url: string
  revealedTiles: number[]
}

export interface MysteryGameState {
  currentRound: number
  totalRounds: number
  isPlaying: boolean
  revealedTiles: number[]
  photos: MysteryPhotoRound[]
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
