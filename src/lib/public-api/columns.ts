// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Colonnes envoyées aux écrans publics. Les types des pages dérivent de ces
// listes : une colonne oubliée fait échouer la compilation, pas un jeu en
// pleine soirée. N'y mettre ni user_id, ni album_password, ni les codes de borne.

import type { Message, Photo, Session } from '@/types/database'

export const INVITE_SESSION_COLUMNS = [
  'id', 'name', 'moderation_enabled', 'messages_enabled', 'print_enabled', 'print_mode',
  'print_limit', 'print_count', 'print_paid', 'print_price',
] as const
export type InviteSession = Pick<Session, (typeof INVITE_SESSION_COLUMNS)[number]>

export const BORNE_SESSION_COLUMNS = [
  'id', 'name', 'moderation_enabled', 'print_enabled', 'print_limit', 'print_count',
  'borne_countdown', 'borne_countdown_duration', 'borne_return_delay', 'borne_default_camera',
  'borne_show_event_name', 'borne_lock_enabled', 'borne_welcome_enabled', 'borne_welcome_message',
] as const
export type BorneSession = Pick<Session, (typeof BORNE_SESSION_COLUMNS)[number]>

export const LIVE_SESSION_COLUMNS = [
  'id', 'code', 'name', 'created_at', 'show_qr_on_screen', 'transition_type', 'transition_duration',
  'background_color', 'background_image', 'background_opacity', 'background_type', 'custom_logo',
  'logo_size', 'logo_position', 'show_logo', 'qr_size', 'slideshow_mode', 'promo_enabled',
  'promo_frequency', 'promo_affiches', 'messages_enabled', 'messages_frequency', 'messages_duration',
  'mystery_photo_url', 'mystery_photo_grid', 'mystery_photo_speed', 'mystery_photo_active',
  'mystery_photos', 'mystery_current_round', 'mystery_total_rounds', 'mystery_is_playing',
  'mystery_revealed_tiles', 'mystery_reveal_audio',
  'lineup_active', 'lineup_clock_duration', 'lineup_team1_name', 'lineup_team2_name',
  'lineup_team1_score', 'lineup_team2_score', 'lineup_current_number', 'lineup_time_left',
  'lineup_is_running', 'lineup_current_points', 'lineup_show_winner', 'lineup_is_paused',
  'lineup_is_game_over',
  'wheel_active', 'wheel_segments', 'wheel_is_spinning', 'wheel_result', 'wheel_audio',
  'quiz_active', 'quiz_lobby_visible', 'quiz_questions', 'quiz_current_question', 'quiz_is_answering',
  'quiz_show_results', 'quiz_show_podium', 'quiz_time_left', 'quiz_participants',
  'affinity_active', 'affinity_phase', 'affinity_questions', 'affinity_current_question',
  'affinity_deadline', 'affinity_reveal', 'affinity_final_stats',
  'buzzer_active', 'vote_active',
] as const
export type LiveSession = Pick<Session, (typeof LIVE_SESSION_COLUMNS)[number]>

export const LIVE_PHOTO_COLUMNS = ['id', 'storage_path', 'uploader_name', 'approved_at'] as const
export type LivePhoto = Pick<Photo, (typeof LIVE_PHOTO_COLUMNS)[number]>

export const LIVE_MESSAGE_COLUMNS = ['id', 'content', 'author_name', 'created_at'] as const
export type LiveMessage = Pick<Message, (typeof LIVE_MESSAGE_COLUMNS)[number]>
