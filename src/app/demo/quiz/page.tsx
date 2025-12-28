'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Play, Users, Gamepad2 } from 'lucide-react'

// Generate random session ID and code
function generateSessionId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

function generateSessionCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export default function QuizDemoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionCode, setSessionCode] = useState('')

  useEffect(() => {
    // Generate IDs on mount
    setSessionId(generateSessionId())
    setSessionCode(generateSessionCode())
  }, [])

  const startDemo = () => {
    setLoading(true)
    // Store session info in localStorage for demo mode
    localStorage.setItem(
      `quiz-session-${sessionId}`,
      JSON.stringify({
        sessionId,
        sessionCode,
        createdAt: Date.now(),
        isDemo: true,
      })
    )
    router.push(`/host/quiz/${sessionId}?code=${sessionCode}&demo=true`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative z-10 max-w-md w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <motion.div
            className="text-6xl mb-4"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎯
          </motion.div>
          <h1 className="text-4xl font-black text-white mb-2">
            Quiz <span className="text-[#D4AF37]">Live</span>
          </h1>
          <p className="text-gray-400">Mode démonstration</p>
        </div>

        {/* Info card */}
        <div className="bg-[#1a1a2e]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 mb-6">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-[#D4AF37]" />
            Comment ça marche ?
          </h2>
          <ul className="space-y-3 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-[#D4AF37] font-bold">1.</span>
              <span>Cliquez sur &quot;Démarrer la démo&quot; pour créer une session</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D4AF37] font-bold">2.</span>
              <span>Ouvrez le QR code ou le lien dans un autre onglet/téléphone pour rejoindre</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D4AF37] font-bold">3.</span>
              <span>Jouez ! Les données restent locales (BroadcastChannel)</span>
            </li>
          </ul>
        </div>

        {/* Session info */}
        {sessionCode && (
          <div className="bg-[#1a1a2e]/80 backdrop-blur-xl rounded-2xl p-4 border border-white/10 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-gray-400 text-sm">Code PIN</span>
                <p className="text-2xl font-black text-white tracking-wider">{sessionCode}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-400 text-sm">Session ID</span>
                <p className="text-sm text-gray-500 font-mono">{sessionId.slice(0, 16)}...</p>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#1a1a2e]/60 rounded-xl p-4 border border-white/5">
            <Users className="h-6 w-6 text-[#D4AF37] mb-2" />
            <p className="text-white font-semibold text-sm">Multi-joueurs</p>
            <p className="text-gray-500 text-xs">Même navigateur ou réseau local</p>
          </div>
          <div className="bg-[#1a1a2e]/60 rounded-xl p-4 border border-white/5">
            <div className="text-2xl mb-2">🛡️</div>
            <p className="text-white font-semibold text-sm">Anti-triche</p>
            <p className="text-gray-500 text-xs">Validation temps réel</p>
          </div>
        </div>

        {/* Start button */}
        <motion.button
          onClick={startDemo}
          disabled={loading || !sessionId}
          className="w-full py-4 px-6 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#1a1a2e] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              Démarrer la démo
            </>
          )}
        </motion.button>

        <p className="text-center text-gray-500 text-sm mt-4">
          10 questions de culture générale incluses
        </p>
      </motion.div>
    </div>
  )
}
