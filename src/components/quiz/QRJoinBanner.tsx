'use client'

import { useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import styles from './QRJoinBanner.module.css'

interface QRJoinBannerProps {
  joinUrl: string
  sessionCode: string
  playerCount: number
}

export default function QRJoinBanner({
  joinUrl,
  sessionCode,
  playerCount,
}: QRJoinBannerProps) {
  const [currentUrl, setCurrentUrl] = useState('')

  useEffect(() => {
    // Build URL client-side to ensure it works
    if (typeof window !== 'undefined') {
      // Use current origin - if accessing via IP, QR will use IP
      // If accessing via localhost, QR will use localhost
      const origin = window.location.origin
      setCurrentUrl(`${origin}/join/${sessionCode}`)
    }
  }, [sessionCode])

  // For network access, show the network URL hint
  const isLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')

  const displayUrl = currentUrl || joinUrl

  return (
    <div className={styles.container}>
      <div className={styles.qrSection}>
        <div className={styles.qrWrapper}>
          {displayUrl && (
            <QRCode
              value={displayUrl}
              size={80}
              level="M"
              bgColor="white"
              fgColor="#1a1a2e"
            />
          )}
        </div>
        <div className={styles.urlInfo}>
          <span className={styles.urlLabel}>Rejoindre :</span>
          <span className={styles.url}>{displayUrl.replace(/^https?:\/\//, '')}</span>
        </div>
      </div>

      <div className={styles.codeSection}>
        <span className={styles.codeLabel}>Code PIN</span>
        <span className={styles.codeValue}>{sessionCode}</span>
      </div>

      <div className={styles.playersSection}>
        <span className={styles.playersCount}>{playerCount}</span>
        <span className={styles.playersLabel}>joueur{playerCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
