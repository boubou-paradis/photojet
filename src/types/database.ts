export type TransitionType = 'fade' | 'slide' | 'zoom'
export type PhotoStatus = 'pending' | 'approved' | 'rejected'
export type PhotoSource = 'invite' | 'borne'
export type CameraType = 'front' | 'back'
export type DeviceType = 'ipad' | 'android_tablet' | 'other'

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
      borne_connections: {
        Row: BorneConnection
        Insert: BorneConnectionInsert
        Update: BorneConnectionUpdate
      }
    }
  }
}
