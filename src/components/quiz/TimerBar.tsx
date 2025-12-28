'use client'

import { motion } from 'framer-motion'
import styles from './TimerBar.module.css'

interface TimerBarProps {
  timeLeftMs: number
  totalMs: number
  showText?: boolean
}

export default function TimerBar({ timeLeftMs, totalMs, showText = true }: TimerBarProps) {
  const progress = Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100))
  const seconds = Math.ceil(timeLeftMs / 1000)
  const isLow = seconds <= 5
  const isCritical = seconds <= 3

  return (
    <div className={styles.container}>
      <div className={styles.barBackground}>
        <motion.div
          className={`${styles.barFill} ${isLow ? styles.low : ''} ${isCritical ? styles.critical : ''}`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </div>
      {showText && (
        <motion.div
          className={`${styles.timeText} ${isCritical ? styles.criticalText : ''}`}
          animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {seconds}s
        </motion.div>
      )}
    </div>
  )
}
