'use client'

import { motion } from 'framer-motion'
import styles from './QuestionCard.module.css'

interface QuestionCardProps {
  questionNumber: number
  totalQuestions: number
  questionText: string
  points?: number
}

export default function QuestionCard({
  questionNumber,
  totalQuestions,
  questionText,
  points,
}: QuestionCardProps) {
  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.header}>
        <span className={styles.questionNumber}>
          Question {questionNumber}/{totalQuestions}
        </span>
        {points && <span className={styles.points}>{points} pts</span>}
      </div>
      <h2 className={styles.questionText}>{questionText}</h2>
    </motion.div>
  )
}
