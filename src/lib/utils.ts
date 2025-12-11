import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the app base URL for generating links (QR codes, sharing, etc.)
 * Uses NEXT_PUBLIC_APP_URL if defined, otherwise falls back to window.location.origin
 */
export function getAppBaseUrl(): string {
  // Use env variable if defined (for production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  // Fallback to current origin (for local dev)
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  // Server-side fallback
  return 'https://photojet.vercel.app'
}

/**
 * Generate invite URL for a session code
 */
export function getInviteUrl(code: string): string {
  return `${getAppBaseUrl()}/invite/${code}`
}

/**
 * Generate live slideshow URL for a session code
 */
export function getLiveUrl(code: string): string {
  return `${getAppBaseUrl()}/live/${code}`
}

/**
 * Generate borne URL for a borne QR code
 */
export function getBorneUrl(borneCode: string): string {
  return `${getAppBaseUrl()}/borne/${borneCode}`
}

/**
 * Generate album URL for a session code
 */
export function getAlbumUrl(code: string): string {
  return `${getAppBaseUrl()}/album/${code}`
}
