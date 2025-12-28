// ===========================================
// REALTIME CLIENT FACTORY
// Choose between local (demo) and backend (production)
// ===========================================

import { RealtimeClient } from './types'
import { LocalRealtimeClient, getLocalClient, resetLocalClient } from './localClient'
import { BackendRealtimeClient } from './backendClient'

export * from './types'
export { getLocalClient, resetLocalClient } from './localClient'
export { serverValidateAnswer } from './backendClient'

export type RealtimeMode = 'local' | 'backend'

// Configuration
let currentMode: RealtimeMode = 'local'
let backendClientInstance: BackendRealtimeClient | null = null

/**
 * Set the realtime mode
 * - 'local': Use BroadcastChannel for same-browser demo
 * - 'backend': Use WebSocket/Supabase for production
 */
export function setRealtimeMode(mode: RealtimeMode): void {
  currentMode = mode
  console.log(`[Realtime] Mode set to: ${mode}`)
}

/**
 * Get the current realtime mode
 */
export function getRealtimeMode(): RealtimeMode {
  return currentMode
}

/**
 * Get the appropriate client based on current mode
 */
export function getRealtimeClient(): RealtimeClient {
  if (currentMode === 'local') {
    return getLocalClient()
  }

  // Backend mode
  if (!backendClientInstance) {
    backendClientInstance = new BackendRealtimeClient()
  }
  return backendClientInstance
}

/**
 * Reset all clients (useful for cleanup)
 */
export function resetRealtimeClients(): void {
  resetLocalClient()
  if (backendClientInstance) {
    backendClientInstance.disconnect()
    backendClientInstance = null
  }
}

/**
 * Check if backend is available
 * In production, this would check if the WebSocket server is reachable
 */
export async function isBackendAvailable(): Promise<boolean> {
  // TODO: Implement real check
  // try {
  //   const response = await fetch('/api/quiz/health')
  //   return response.ok
  // } catch {
  //   return false
  // }

  // For now, always return false (use local mode)
  return false
}

/**
 * Auto-detect and set the best mode
 */
export async function autoDetectMode(): Promise<RealtimeMode> {
  const backendOk = await isBackendAvailable()
  const mode = backendOk ? 'backend' : 'local'
  setRealtimeMode(mode)
  return mode
}
