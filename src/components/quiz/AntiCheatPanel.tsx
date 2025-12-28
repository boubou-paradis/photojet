'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react'
import { SuspectEntry } from '@/lib/quiz/antiCheat'
import styles from './AntiCheatPanel.module.css'

interface AntiCheatPanelProps {
  enabled: boolean
  suspectCount: number
  suspects: SuspectEntry[]
  debug?: boolean
}

const REASON_LABELS: Record<string, string> = {
  too_fast: 'Réponse trop rapide',
  late: 'Réponse tardive',
  duplicate: 'Double réponse',
  bad_nonce: 'Nonce invalide',
  invalid_state: 'État invalide',
}

export default function AntiCheatPanel({
  enabled,
  suspectCount,
  suspects,
  debug = false,
}: AntiCheatPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!enabled) return null

  // In non-debug mode, only show if there are suspects
  if (!debug && suspectCount === 0) return null

  return (
    <div className={styles.container}>
      <motion.button
        className={`${styles.badge} ${suspectCount > 0 ? styles.hasSuspects : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <AlertTriangle className={styles.icon} size={18} />
        <span className={styles.label}>
          {suspectCount > 0 ? `${suspectCount} suspect${suspectCount > 1 ? 's' : ''}` : 'Anti-triche actif'}
        </span>
        {suspectCount > 0 && (
          isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />
        )}
      </motion.button>

      <AnimatePresence>
        {isExpanded && suspects.length > 0 && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
          >
            <div className={styles.panelHeader}>
              <span>Joueurs suspects</span>
              <button
                className={styles.closeButton}
                onClick={() => setIsExpanded(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.suspectList}>
              {suspects.map((suspect) => (
                <div key={suspect.playerId} className={styles.suspectItem}>
                  <div className={styles.suspectInfo}>
                    <span className={styles.suspectName}>{suspect.playerName}</span>
                    <span className={styles.flagCount}>{suspect.totalFlags} flag{suspect.totalFlags > 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.reasons}>
                    {suspect.reasons.map((reason, idx) => (
                      <span key={idx} className={styles.reasonTag}>
                        {REASON_LABELS[reason.type] || reason.type}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
