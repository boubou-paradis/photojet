'use client'

import { motion } from 'framer-motion'
import styles from './KahootAnswerCardHost.module.css'

// Kahoot-style colors and shapes - vibrant show colors
export const ANSWER_CONFIG = {
  A: {
    color: '#ff3355', // Vibrant Red
    hoverColor: '#e62e4c',
    darkColor: '#cc2944',
    shape: 'triangle',
    icon: '▲',
    textColor: '#ffffff',
  },
  B: {
    color: '#2d7dff', // Vibrant Blue
    hoverColor: '#2970e6',
    darkColor: '#2463cc',
    shape: 'diamond',
    icon: '◆',
    textColor: '#ffffff',
  },
  C: {
    color: '#ffcc33', // Vibrant Yellow
    hoverColor: '#e6b82e',
    darkColor: '#cca329',
    shape: 'circle',
    icon: '●',
    textColor: '#1a1a2e', // Dark text for contrast
  },
  D: {
    color: '#33cc66', // Vibrant Green
    hoverColor: '#2eb85c',
    darkColor: '#29a352',
    shape: 'square',
    icon: '■',
    textColor: '#ffffff',
  },
} as const

type AnswerKey = 'A' | 'B' | 'C' | 'D'

interface KahootAnswerCardHostProps {
  answerKey: AnswerKey
  text: string
  count?: number
  percentage?: number
  isCorrect?: boolean
  showResult?: boolean
  totalAnswers?: number
}

export default function KahootAnswerCardHost({
  answerKey,
  text,
  count = 0,
  percentage = 0,
  isCorrect = false,
  showResult = false,
  totalAnswers = 0,
}: KahootAnswerCardHostProps) {
  const config = ANSWER_CONFIG[answerKey]

  return (
    <motion.div
      className={`${styles.card} ${showResult && isCorrect ? styles.correct : ''} ${showResult && !isCorrect ? styles.incorrect : ''}`}
      style={{
        '--answer-color': config.color,
        '--answer-hover': config.hoverColor,
        '--answer-dark': config.darkColor,
        '--text-color': config.textColor,
      } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: ['A', 'B', 'C', 'D'].indexOf(answerKey) * 0.1 }}
    >
      {/* Background progress bar for results */}
      {showResult && totalAnswers > 0 && (
        <motion.div
          className={styles.progressBar}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      <div className={styles.content}>
        {/* Shape icon */}
        <span className={styles.shapeIcon}>{config.icon}</span>

        {/* Label */}
        <span className={styles.label}>{answerKey}</span>

        {/* Answer text */}
        <span className={styles.text}>{text}</span>

        {/* Result count */}
        {showResult && (
          <motion.div
            className={styles.resultBadge}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className={styles.count}>{count}</span>
            {totalAnswers > 0 && (
              <span className={styles.percentage}>{Math.round(percentage)}%</span>
            )}
          </motion.div>
        )}

        {/* Correct indicator */}
        {showResult && isCorrect && (
          <motion.div
            className={styles.correctBadge}
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring' }}
          >
            ✓
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
