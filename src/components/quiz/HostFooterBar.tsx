'use client'

import { motion } from 'framer-motion'
import styles from './HostFooterBar.module.css'

interface HostFooterBarProps {
  // State
  quizState: 'LOBBY' | 'RUNNING' | 'ANSWER_REVEAL' | 'LEADERBOARD' | 'FINISHED'
  questionIndex: number
  totalQuestions: number
  playerCount: number

  // Callbacks
  onStart: () => void
  onNext: () => void
  onShowLeaderboard: () => void
  onFinish: () => void
  onReset: () => void

  // Settings
  isAntiCheatEnabled: boolean
  onToggleAntiCheat: (enabled: boolean) => void
  isHideQuestionEnabled: boolean
  onToggleHideQuestion: (enabled: boolean) => void
}

export default function HostFooterBar({
  quizState,
  questionIndex,
  totalQuestions,
  playerCount,
  onStart,
  onNext,
  onShowLeaderboard,
  onFinish,
  onReset,
  isAntiCheatEnabled,
  onToggleAntiCheat,
  isHideQuestionEnabled,
  onToggleHideQuestion,
}: HostFooterBarProps) {
  const canStart = quizState === 'LOBBY' && playerCount > 0
  const canNext = quizState === 'ANSWER_REVEAL' && questionIndex < totalQuestions - 1
  const canShowLeaderboard = quizState === 'ANSWER_REVEAL'
  const canFinish = quizState === 'LEADERBOARD' || (quizState === 'ANSWER_REVEAL' && questionIndex === totalQuestions - 1)
  const isFinished = quizState === 'FINISHED'

  return (
    <div className={styles.container}>
      {/* Left: Settings toggles */}
      <div className={styles.settings}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={isAntiCheatEnabled}
            onChange={(e) => onToggleAntiCheat(e.target.checked)}
            disabled={quizState !== 'LOBBY'}
          />
          <span className={styles.toggleSlider} />
          <span className={styles.toggleLabel}>Anti-triche</span>
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={isHideQuestionEnabled}
            onChange={(e) => onToggleHideQuestion(e.target.checked)}
            disabled={quizState !== 'LOBBY'}
          />
          <span className={styles.toggleSlider} />
          <span className={styles.toggleLabel}>Masquer question (mobile)</span>
        </label>
      </div>

      {/* Center: Status */}
      <div className={styles.status}>
        {quizState === 'LOBBY' && (
          <span className={styles.statusText}>En attente des joueurs...</span>
        )}
        {quizState === 'RUNNING' && (
          <span className={styles.statusText}>Question en cours</span>
        )}
        {quizState === 'ANSWER_REVEAL' && (
          <span className={styles.statusText}>Résultats</span>
        )}
        {quizState === 'LEADERBOARD' && (
          <span className={styles.statusText}>Classement</span>
        )}
        {quizState === 'FINISHED' && (
          <span className={styles.statusText}>Quiz terminé !</span>
        )}
      </div>

      {/* Right: Action buttons */}
      <div className={styles.actions}>
        {quizState === 'LOBBY' && (
          <motion.button
            className={`${styles.button} ${styles.primary}`}
            onClick={onStart}
            disabled={!canStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Démarrer le Quiz
          </motion.button>
        )}

        {canShowLeaderboard && (
          <motion.button
            className={`${styles.button} ${styles.secondary}`}
            onClick={onShowLeaderboard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Classement
          </motion.button>
        )}

        {canNext && (
          <motion.button
            className={`${styles.button} ${styles.primary}`}
            onClick={onNext}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Question suivante
          </motion.button>
        )}

        {canFinish && (
          <motion.button
            className={`${styles.button} ${styles.finish}`}
            onClick={onFinish}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Terminer
          </motion.button>
        )}

        {isFinished && (
          <motion.button
            className={`${styles.button} ${styles.primary}`}
            onClick={onReset}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Relancer
          </motion.button>
        )}
      </div>
    </div>
  )
}
