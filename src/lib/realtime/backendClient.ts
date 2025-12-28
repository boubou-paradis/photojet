// ===========================================
// BACKEND CLIENT - Stub for WebSocket/Supabase integration
// TODO: Implement real backend connection
// ===========================================

import {
  RealtimeClient,
  HostEventType,
  PlayerEventType,
} from './types'

type EventCallback<T> = (event: T) => void

/**
 * Backend client stub - replace with real WebSocket or Supabase Realtime
 *
 * ADAPTATION BACKEND:
 * 1. Replace connect() with WebSocket connection to your server
 * 2. Map broadcast() to ws.send() with proper event format
 * 3. Map onPlayerEvent/onHostEvent to ws.onmessage handlers
 * 4. Implement reconnection logic
 * 5. Move anti-cheat validation to server-side
 *
 * Example WebSocket implementation:
 * ```
 * const ws = new WebSocket(`wss://api.animajet.fr/quiz/${sessionId}`)
 * ws.onmessage = (msg) => {
 *   const data = JSON.parse(msg.data)
 *   if (data.type === 'host_event') hostCallbacks.forEach(cb => cb(data.event))
 *   if (data.type === 'player_event') playerCallbacks.forEach(cb => cb(data.event))
 * }
 * ```
 *
 * Example Supabase Realtime:
 * ```
 * const channel = supabase.channel(`quiz-${sessionId}`)
 * channel.on('broadcast', { event: 'quiz_event' }, (payload) => { ... })
 * channel.subscribe()
 * ```
 */
export class BackendRealtimeClient implements RealtimeClient {
  private sessionId: string | null = null
  private role: 'host' | 'player' | null = null
  private connected = false

  private hostEventCallbacks: Set<EventCallback<HostEventType>> = new Set()
  private playerEventCallbacks: Set<EventCallback<PlayerEventType>> = new Set()

  // TODO: Add WebSocket instance
  // private ws: WebSocket | null = null

  async connect(sessionId: string, role: 'host' | 'player'): Promise<void> {
    this.sessionId = sessionId
    this.role = role

    // TODO: Implement real connection
    // this.ws = new WebSocket(`wss://api.animajet.fr/quiz/${sessionId}?role=${role}`)
    // await new Promise((resolve, reject) => {
    //   this.ws.onopen = resolve
    //   this.ws.onerror = reject
    // })

    // For now, just mark as connected (stub)
    this.connected = true
    console.log(`[BackendClient] STUB: Connected to ${sessionId} as ${role}`)
    console.warn('[BackendClient] Backend not implemented, use LocalClient for demo')
  }

  disconnect(): void {
    // TODO: Close WebSocket
    // if (this.ws) {
    //   this.ws.close()
    //   this.ws = null
    // }

    this.connected = false
    this.sessionId = null
    this.role = null
    console.log('[BackendClient] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  broadcast(event: HostEventType): void {
    if (!this.connected) {
      console.warn('[BackendClient] Not connected')
      return
    }

    // TODO: Send via WebSocket
    // this.ws?.send(JSON.stringify({ type: 'host_broadcast', event }))

    console.log('[BackendClient] STUB broadcast:', event.type)
  }

  send(event: PlayerEventType): void {
    if (!this.connected) {
      console.warn('[BackendClient] Not connected')
      return
    }

    // TODO: Send via WebSocket
    // this.ws?.send(JSON.stringify({ type: 'player_send', event }))

    console.log('[BackendClient] STUB send:', event.type)
  }

  onPlayerEvent(callback: EventCallback<PlayerEventType>): () => void {
    this.playerEventCallbacks.add(callback)
    return () => this.playerEventCallbacks.delete(callback)
  }

  onHostEvent(callback: EventCallback<HostEventType>): () => void {
    this.hostEventCallbacks.add(callback)
    return () => this.hostEventCallbacks.delete(callback)
  }

  // TODO: Handle incoming WebSocket messages
  // private handleMessage(data: unknown): void {
  //   const msg = data as { type: string; event: unknown }
  //   if (msg.type === 'host_event') {
  //     this.hostEventCallbacks.forEach(cb => cb(msg.event as HostEventType))
  //   } else if (msg.type === 'player_event') {
  //     this.playerEventCallbacks.forEach(cb => cb(msg.event as PlayerEventType))
  //   }
  // }
}

// ===========================================
// SERVER-SIDE VALIDATION INTERFACE
// Move these functions to your backend
// ===========================================

/**
 * Server-side answer validation
 * MOVE TO SERVER: This should run on your backend for secure anti-cheat
 */
export interface ServerValidateAnswerParams {
  playerId: string
  questionIndex: number
  answerKey: 'A' | 'B' | 'C' | 'D'
  clientSentAt: number
  estimatedHostAt: number
  nonce: string
  // Server has access to:
  // - questionWindow (opensAt, closesAt, nonce)
  // - player's time offset
  // - previous answers for this question
}

export interface ServerValidateAnswerResult {
  valid: boolean
  reason?: 'too_fast' | 'late' | 'duplicate' | 'bad_nonce' | 'invalid_state'
  details?: string
}

/**
 * Stub for server validation
 * In production, this would be an API call:
 * POST /api/quiz/validate-answer
 */
export async function serverValidateAnswer(
  params: ServerValidateAnswerParams
): Promise<ServerValidateAnswerResult> {
  // TODO: Implement real server validation
  console.log('[BackendClient] STUB serverValidateAnswer:', params)
  return { valid: true }
}
