'use client'

import { motion } from 'framer-motion'
import styles from './KahootAnswerCardHost.module.css'

// Kahoot-style colors and shapes
export const ANSWER_CONFIG = {
  A: {
    color: '#e21b3c', // Red
    hoverColor: '#c9182f',
    shape: 'triangle',
    icon: '▲',
  },
  B: {
    color: '#1368ce', // Blue
    hoverColor: '#0d5ab8',
    shape: 'diamond',
    icon: '◆',
  },
  C: {
    color: '#d89e00', // Yellow/Orange
    hoverColor: '#c08d00',
    shape: 'circle',
    icon: '●',
  },
  D: {
    color: '#26890c', // Green
    hoverColor: '#1e6f0a',
    shape: 'square',
    icon: '■',
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
