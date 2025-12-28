'use client'

import { AnswerStats } from '@/lib/realtime/types'
import KahootAnswerCardHost from './KahootAnswerCardHost'
import styles from './KahootAnswerGridHost.module.css'

interface KahootAnswerGridHostProps {
  answers: {
    A: string
    B: string
    C: string
    D: string
  }
  stats?: AnswerStats
  correctKey?: 'A' | 'B' | 'C' | 'D'
  showResult?: boolean
}

export default function KahootAnswerGridHost({
  answers,
  stats,
  correctKey,
  showResult = false,
}: KahootAnswerGridHostProps) {
  const totalAnswers = stats?.total || 0

  const getPercentage = (key: 'A' | 'B' | 'C' | 'D') => {
    if (!stats || totalAnswers === 0) return 0
    return (stats[key] / totalAnswers) * 100
  }

  return (
    <div className={styles.grid}>
      {(['A', 'B', 'C', 'D'] as const).map((key) => (
        <KahootAnswerCardHost
          key={key}
          answerKey={key}
          text={answers[key]}
          count={stats?.[key] || 0}
          percentage={getPercentage(key)}
          isCorrect={correctKey === key}
          showResult={showResult}
          totalAnswers={totalAnswers}
        />
      ))}
    </div>
  )
}
