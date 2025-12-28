'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, User, ArrowRight } from 'lucide-react'

// Generate unique player ID
function generatePlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

export default function JoinQuizPage() {
  const params = useParams()
  const router = useRouter()
  const sessionCode = params.sessionCode as string

  const [playerName, setPlayerName] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Generate player ID on mount
    const id = generatePlayerId()
    setPlayerId(id)

    // Try to restore name from localStorage
    const savedName = localStorage.getItem('quiz-player-name')
    if (savedName) {
      setPlayerName(savedName)
    }
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!playerName.trim()) {
      setError('Entrez votre pseudo')
      return
    }

    if (playerName.trim().length < 2) {
      setError('Pseudo trop court (min 2 caractères)')
      return
    }

    if (playerName.trim().length > 20) {
      setError('Pseudo trop long (max 20 caractères)')
      return
    }

    setLoading(true)
    setError('')

    // Save name for next time
    localStorage.setItem('quiz-player-name', playerName.trim())

    // Find session ID from localStorage (demo mode) or use sessionCode
    // In demo mode, we stored the mapping in localStorage
    let sessionId = sessionCode

    // Check localStorage for demo session
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('quiz-session-')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          if (data.sessionCode === sessionCode) {
            sessionId = data.sessionId
            break
          }
        } catch {
          // Ignore
        }
      }
    }

    // Store player info
    localStorage.setItem(
      `quiz-player-${playerId}`,
      JSON.stringify({
        playerId,
        playerName: playerName.trim(),
        sessionCode,
        joinedAt: Date.now(),
      })
    )

    // Navigate to play page
    router.push(`/play/${sessionId}?code=${sessionCode}&playerId=${playerId}&name=${encodeURIComponent(playerName.trim())}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎯
          </motion.div>
          <h1 className="text-3xl font-black text-white mb-2">
            Quiz <span className="text-[#D4AF37]">Live</span>
          </h1>
        </div>

        {/* Session code display */}
        <div className="bg-[#1a1a2e]/80 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-white/10 text-center">
          <span className="text-gray-400 text-sm">Code PIN</span>
          <p className="text-3xl font-black text-white tracking-wider">{sessionCode}</p>
        </div>

        {/* Join form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value)
                  setError('')
                }}
                placeholder="Votre pseudo"
                maxLength={20}
                autoFocus
                className="w-full pl-12 pr-4 py-4 bg-[#1a1a2e]/80 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all text-lg"
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          <motion.button
            type="submit"
            disabled={loading || !playerName.trim()}
            className="w-full py-4 px-6 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#1a1a2e] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                Rejoindre
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </motion.button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Préparez-vous à jouer !
        </p>
      </motion.div>
    </div>
  )
}
