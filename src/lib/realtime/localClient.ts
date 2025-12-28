// ===========================================
// LOCAL CLIENT - BroadcastChannel + localStorage fallback
// Mode démo sans backend
// ===========================================

import {
  RealtimeClient,
  HostEventType,
  PlayerEventType,
} from './types'

const CHANNEL_PREFIX = 'animajet-quiz-'
const STORAGE_KEY_PREFIX = 'animajet-quiz-events-'

type EventCallback<T> = (event: T) => void

export class LocalRealtimeClient implements RealtimeClient {
  private sessionId: string | null = null
  private role: 'host' | 'player' | null = null
  private channel: BroadcastChannel | null = null
  private connected = false

  private hostEventCallbacks: Set<EventCallback<HostEventType>> = new Set()
  private playerEventCallbacks: Set<EventCallback<PlayerEventType>> = new Set()

  // Fallback: localStorage polling
  private useStorageFallback = false
  private storageInterval: NodeJS.Timeout | null = null
  private lastEventIndex = 0

  async connect(sessionId: string, role: 'host' | 'player'): Promise<void> {
    this.sessionId = sessionId
    this.role = role

    // Try BroadcastChannel first
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`${CHANNEL_PREFIX}${sessionId}`)
        this.channel.onmessage = (event) => this.handleMessage(event.data)
        this.connected = true
        console.log(`[LocalClient] Connected via BroadcastChannel: ${sessionId} as ${role}`)
        return
      } catch (e) {
        console.warn('[LocalClient] BroadcastChannel failed, using storage fallback', e)
      }
    }

    // Fallback to localStorage events
    this.useStorageFallback = true
    this.connected = true
    this.startStoragePolling()
    console.log(`[LocalClient] Connected via localStorage fallback: ${sessionId} as ${role}`)
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.close()
      this.channel = null
    }
    if (this.storageInterval) {
      clearInterval(this.storageInterval)
      this.storageInterval = null
    }
    this.connected = false
    this.sessionId = null
    this.role = null
    console.log('[LocalClient] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  // Host broadcasts to all players
  broadcast(event: HostEventType): void {
    if (!this.connected || !this.sessionId) {
      console.warn('[LocalClient] Not connected, cannot broadcast')
      return
    }

    const message = { source: 'host', event }

    if (this.channel) {
      this.channel.postMessage(message)
    }

    if (this.useStorageFallback) {
      this.pushToStorage(message)
    }
  }

  // Player sends to host
  send(event: PlayerEventType): void {
    if (!this.connected || !this.sessionId) {
      console.warn('[LocalClient] Not connected, cannot send')
      return
    }

    const message = { source: 'player', event }

    if (this.channel) {
      this.channel.postMessage(message)
    }

    if (this.useStorageFallback) {
      this.pushToStorage(message)
    }
  }

  // Subscribe to player events (host calls this)
  onPlayerEvent(callback: EventCallback<PlayerEventType>): () => void {
    this.playerEventCallbacks.add(callback)
    return () => this.playerEventCallbacks.delete(callback)
  }

  // Subscribe to host events (player calls this)
  onHostEvent(callback: EventCallback<HostEventType>): () => void {
    this.hostEventCallbacks.add(callback)
    return () => this.hostEventCallbacks.delete(callback)
  }

  // Internal: handle incoming message
  private handleMessage(message: { source: 'host' | 'player'; event: HostEventType | PlayerEventType }): void {
    if (message.source === 'host' && this.role === 'player') {
      // Player receives host event
      this.hostEventCallbacks.forEach((cb) => cb(message.event as HostEventType))
    } else if (message.source === 'player' && this.role === 'host') {
      // Host receives player event
      this.playerEventCallbacks.forEach((cb) => cb(message.event as PlayerEventType))
    }
  }

  // Storage fallback methods
  private getStorageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.sessionId}`
  }

  private pushToStorage(message: { source: string; event: unknown }): void {
    try {
      const key = this.getStorageKey()
      const existing = localStorage.getItem(key)
      const events = existing ? JSON.parse(existing) : []
      events.push({ ...message, timestamp: Date.now() })
      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100)
      }
      localStorage.setItem(key, JSON.stringify(events))
    } catch (e) {
      console.error('[LocalClient] Storage push failed', e)
    }
  }

  private startStoragePolling(): void {
    this.storageInterval = setInterval(() => {
      try {
        const key = this.getStorageKey()
        const existing = localStorage.getItem(key)
        if (!existing) return

        const events = JSON.parse(existing) as Array<{
          source: 'host' | 'player'
          event: HostEventType | PlayerEventType
          timestamp: number
        }>

        // Process new events
        for (let i = this.lastEventIndex; i < events.length; i++) {
          this.handleMessage(events[i])
        }
        this.lastEventIndex = events.length
      } catch (e) {
        console.error('[LocalClient] Storage poll failed', e)
      }
    }, 100) // Poll every 100ms
  }
}

// Singleton for easy access
let clientInstance: LocalRealtimeClient | null = null

export function getLocalClient(): LocalRealtimeClient {
  if (!clientInstance) {
    clientInstance = new LocalRealtimeClient()
  }
  return clientInstance
}

export function resetLocalClient(): void {
  if (clientInstance) {
    clientInstance.disconnect()
    clientInstance = null
  }
}
