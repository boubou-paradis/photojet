// ===========================================
// ANTI-CHEAT SYSTEM
// Validation des réponses et détection de triche
// ===========================================

import {
  PlayerAnswer,
  QuestionWindow,
  SuspectReason,
  Player,
} from '../realtime/types'

// ===========================================
// CONFIGURATION
// ===========================================

export interface AntiCheatConfig {
  enabled: boolean
  minReactionTimeMs: number // Reject if faster than this (default 250ms)
  maxLateToleranceMs: number // Accept up to X ms after closesAt (network latency)
  flagTooFast: boolean // Flag as suspect instead of reject
  flagLate: boolean // Flag as suspect instead of reject
}

export const DEFAULT_ANTI_CHEAT_CONFIG: AntiCheatConfig = {
  enabled: true,
  minReactionTimeMs: 250,
  maxLateToleranceMs: 500,
  flagTooFast: true, // Flag instead of reject for better UX
  flagLate: true,
}

// ===========================================
// VALIDATION RESULT
// ===========================================

export interface ValidationResult {
  valid: boolean
  accepted: boolean // Can be valid but flagged
  suspect: boolean
  reason?: SuspectReason
}

// ===========================================
// MAIN VALIDATION FUNCTION
// MOVE TO SERVER: This is the core validation logic
// ===========================================

/**
 * Validate an answer submission
 * In production, this should run server-side
 *
 * @param answer - The player's answer submission
 * @param window - The current question window (opensAt, closesAt, nonce)
 * @param previousAnswers - Set of playerIds who already answered this question
 * @param config - Anti-cheat configuration
 * @param hostNow - Current host time (for time comparison)
 */
export function validateAnswerOnHost(
  answer: PlayerAnswer,
  window: QuestionWindow,
  previousAnswers: Set<string>,
  config: AntiCheatConfig,
  hostNow: number = Date.now()
): ValidationResult {
  // If anti-cheat disabled, accept everything
  if (!config.enabled) {
    return { valid: true, accepted: true, suspect: false }
  }

  // 1. Check nonce (prevents replay of old questions)
  if (answer.nonce !== window.nonce) {
    return {
      valid: false,
      accepted: false,
      suspect: true,
      reason: {
        type: 'bad_nonce',
        details: `Expected nonce ${window.nonce}, got ${answer.nonce}`,
        timestamp: hostNow,
      },
    }
  }

  // 2. Check for duplicate answer
  if (previousAnswers.has(answer.playerId)) {
    return {
      valid: false,
      accepted: false,
      suspect: true,
      reason: {
        type: 'duplicate',
        details: `Player ${answer.playerId} already answered question ${answer.questionIndex}`,
        timestamp: hostNow,
      },
    }
  }

  // 3. Check question state (must be within window)
  const receivedAt = answer.receivedAt || hostNow

  // Check if answer was sent before question opened
  if (answer.estimatedHostAt < window.opensAt) {
    return {
      valid: false,
      accepted: false,
      suspect: true,
      reason: {
        type: 'invalid_state',
        details: `Answer sent before question opened (${answer.estimatedHostAt} < ${window.opensAt})`,
        timestamp: hostNow,
      },
    }
  }

  // 4. Check reaction time (too fast = possibly bot/cheat)
  const reactionTime = answer.estimatedHostAt - window.opensAt
  if (reactionTime < config.minReactionTimeMs) {
    const reason: SuspectReason = {
      type: 'too_fast',
      details: `Reaction time ${reactionTime}ms < minimum ${config.minReactionTimeMs}ms`,
      timestamp: hostNow,
    }

    if (config.flagTooFast) {
      // Accept but flag as suspect
      return { valid: true, accepted: true, suspect: true, reason }
    } else {
      // Reject
      return { valid: false, accepted: false, suspect: true, reason }
    }
  }

  // 5. Check if answer is late
  const lateBy = receivedAt - window.closesAt
  if (lateBy > 0) {
    // Check tolerance
    if (lateBy > config.maxLateToleranceMs) {
      return {
        valid: false,
        accepted: false,
        suspect: true,
        reason: {
          type: 'late',
          details: `Answer received ${lateBy}ms after window closed (tolerance: ${config.maxLateToleranceMs}ms)`,
          timestamp: hostNow,
        },
      }
    }

    // Within tolerance but still late
    if (config.flagLate) {
      return {
        valid: true,
        accepted: true,
        suspect: true,
        reason: {
          type: 'late',
          details: `Answer received ${lateBy}ms after window closed (within tolerance)`,
          timestamp: hostNow,
        },
      }
    }
  }

  // All checks passed
  return { valid: true, accepted: true, suspect: false }
}

// ===========================================
// TIME SYNC UTILITIES
// ===========================================

export interface SyncData {
  hostSentAt: number
  playerReceivedAt: number
  playerSentAt: number
  hostReceivedAt: number
}

/**
 * Calculate time offset between host and player
 * offset = estimated difference (player clock - host clock)
 * To get hostNow from player: hostNow = Date.now() - offset
 *
 * Uses simple NTP-like calculation:
 * RTT = (hostReceivedAt - hostSentAt)
 * oneWayDelay = RTT / 2
 * playerTimeAtPong = playerSentAt
 * hostTimeAtPong = hostReceivedAt - oneWayDelay
 * offset = playerTimeAtPong - hostTimeAtPong
 */
export function calculateTimeOffset(sync: SyncData): number {
  const rtt = sync.hostReceivedAt - sync.hostSentAt
  const oneWayDelay = rtt / 2

  // Estimate what host time was when player sent pong
  const hostTimeAtPong = sync.hostReceivedAt - oneWayDelay

  // Offset = player's clock - host's clock at same moment
  const offset = sync.playerSentAt - hostTimeAtPong

  return Math.round(offset)
}

/**
 * Get estimated host time from player's perspective
 */
export function getEstimatedHostTime(playerNow: number, offsetMs: number): number {
  return playerNow - offsetMs
}

/**
 * Generate a random nonce for question authentication
 */
export function generateNonce(): string {
  const array = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback for older environments
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ===========================================
// SUSPECT TRACKING
// ===========================================

export interface SuspectEntry {
  playerId: string
  playerName: string
  reasons: SuspectReason[]
  totalFlags: number
}

export class SuspectTracker {
  private suspects: Map<string, SuspectEntry> = new Map()

  addSuspect(playerId: string, playerName: string, reason: SuspectReason): void {
    const existing = this.suspects.get(playerId)
    if (existing) {
      existing.reasons.push(reason)
      existing.totalFlags++
    } else {
      this.suspects.set(playerId, {
        playerId,
        playerName,
        reasons: [reason],
        totalFlags: 1,
      })
    }
  }

  getSuspects(): SuspectEntry[] {
    return Array.from(this.suspects.values())
  }

  getSuspectCount(): number {
    return this.suspects.size
  }

  getTotalFlags(): number {
    let total = 0
    this.suspects.forEach((s) => (total += s.totalFlags))
    return total
  }

  isPlayerSuspect(playerId: string): boolean {
    return this.suspects.has(playerId)
  }

  getPlayerFlags(playerId: string): SuspectReason[] {
    return this.suspects.get(playerId)?.reasons || []
  }

  clear(): void {
    this.suspects.clear()
  }
}

// ===========================================
// ANSWER TRACKING (per question)
// ===========================================

export class AnswerTracker {
  // Map: questionIndex -> Set of playerIds who answered
  private answered: Map<number, Set<string>> = new Map()

  hasAnswered(questionIndex: number, playerId: string): boolean {
    return this.answered.get(questionIndex)?.has(playerId) || false
  }

  markAnswered(questionIndex: number, playerId: string): void {
    if (!this.answered.has(questionIndex)) {
      this.answered.set(questionIndex, new Set())
    }
    this.answered.get(questionIndex)!.add(playerId)
  }

  getAnsweredSet(questionIndex: number): Set<string> {
    return this.answered.get(questionIndex) || new Set()
  }

  getAnswerCount(questionIndex: number): number {
    return this.answered.get(questionIndex)?.size || 0
  }

  clear(): void {
    this.answered.clear()
  }

  clearQuestion(questionIndex: number): void {
    this.answered.delete(questionIndex)
  }
}
