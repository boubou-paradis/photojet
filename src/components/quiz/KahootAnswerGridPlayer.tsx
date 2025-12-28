'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ANSWER_CONFIG } from './KahootAnswerCardHost'
import styles from './KahootAnswerGridPlayer.module.css'

type AnswerKey = 'A' | 'B' | 'C' | 'D'

interface KahootAnswerGridPlayerProps {
  answers: {
    A: string
    B: string
    C: string
    D: string
  }
  disabled?: boolean
  hideText?: boolean // Anti-cheat: hide answer text, show only shapes
  selectedAnswer?: AnswerKey | null
  correctKey?: AnswerKey | null // Show after reveal
  onSelect: (key: AnswerKey) => void
}

export default function KahootAnswerGridPlayer({
  answers,
  disabled = false,
  hideText = false,
  selectedAnswer,
  correctKey,
  onSelect,
}: KahootAnswerGridPlayerProps) {
  const [localSelected, setLocalSelected] = useState<AnswerKey | null>(null)

  const handleSelect = (key: AnswerKey) => {
    if (disabled || localSelected !== null || selectedAnswer !== null) return
    setLocalSelected(key)
    onSelect(key)
  }

  const selected = selectedAnswer || localSelected
  const showResult = correctKey !== null

  return (
    <div className={styles.grid}>
      {(['A', 'B', 'C', 'D'] as const).map((key) => {
        const config = ANSWER_CONFIG[key]
        const isSelected = selected === key
        const isCorrect = correctKey === key
        const isWrong = showResult && isSelected && !isCorrect
        const isDimmed = selected !== null && !isSelected && !showResult

        return (
          <motion.button
            key={key}
            className={`${styles.button} ${isSelected ? styles.selected : ''} ${isDimmed ? styles.dimmed : ''} ${isCorrect && showResult ? styles.correct : ''} ${isWrong ? styles.wrong : ''}`}
            style={{
              '--answer-color': config.color,
              '--answer-hover': config.hoverColor,
              '--text-color': config.textColor,
            } as React.CSSProperties}
            disabled={disabled || selected !== null}
            onClick={() => handleSelect(key)}
            whileTap={!disabled && selected === null ? { scale: 0.95 } : {}}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: ['A', 'B', 'C', 'D'].indexOf(key) * 0.05 }}
          >
            <span className={styles.shapeIcon}>{config.icon}</span>
            {!hideText && <span className={styles.text}>{answers[key]}</span>}
            {hideText && <span className={styles.label}>{key}</span>}

            {/* Selection indicator */}
            {isSelected && !showResult && (
              <motion.div
                className={styles.selectedOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className={styles.checkmark}>✓</span>
              </motion.div>
            )}

            {/* Result indicators */}
            {showResult && isCorrect && (
              <motion.div
                className={styles.correctOverlay}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <span className={styles.resultIcon}>✓</span>
              </motion.div>
            )}
            {isWrong && (
              <motion.div
                className={styles.wrongOverlay}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <span className={styles.resultIcon}>✗</span>
              </motion.div>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
