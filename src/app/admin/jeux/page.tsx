'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { toast } from 'sonner'

// Game card data with unique color schemes
const games = [
  {
    id: 'mystery',
    name: 'Photo Mystère',
    emoji: '🔍',
    description: 'Devinez la photo cachée pixel par pixel',
    path: '/admin/jeux/mystery',
    available: true,
    gradient: 'from-cyan-500/20 via-blue-600/20 to-cyan-400/20',
    glowColor: 'rgba(6, 182, 212, 0.5)',
    borderHover: 'hover:border-cyan-400',
    iconBg: 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30',
    accentColor: 'text-cyan-400',
  },
  {
    id: 'lineup',
    name: 'Le Bon Ordre',
    emoji: '🏃',
    description: "2 équipes s'affrontent pour classer les photos",
    path: '/admin/jeux/lineup',
    available: true,
    gradient: 'from-violet-500/20 via-purple-600/20 to-fuchsia-500/20',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    borderHover: 'hover:border-violet-400',
    iconBg: 'bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30',
    accentColor: 'text-violet-400',
  },
  {
    id: 'vote',
    name: 'Vote Photo',
    emoji: '🗳️',
    description: 'Votez pour élire la meilleure photo',
    path: '/admin/jeux/vote',
    available: false,
    gradient: 'from-rose-500/20 via-pink-500/20 to-orange-400/20',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    borderHover: 'hover:border-rose-400',
    iconBg: 'bg-gradient-to-br from-rose-500/30 to-orange-400/30',
    accentColor: 'text-rose-400',
  },
  {
    id: 'wheel',
    name: 'Roue de la Destinée',
    emoji: '🎡',
    description: 'Tournez la roue et découvrez votre défi',
    path: '/admin/jeux/wheel',
    available: true,
    gradient: 'from-amber-500/20 via-yellow-500/20 to-orange-400/20',
    glowColor: 'rgba(212, 175, 55, 0.6)',
    borderHover: 'hover:border-[#D4AF37]',
    iconBg: 'bg-gradient-to-br from-amber-500/30 to-yellow-500/30',
    accentColor: 'text-[#D4AF37]',
  },
  {
    id: 'defis',
    name: 'Défis Photo',
    emoji: '📸',
    description: 'Réalisez des défis photo créatifs',
    path: '/admin/jeux/defis',
    available: true,
    gradient: 'from-emerald-500/20 via-green-500/20 to-teal-400/20',
    glowColor: 'rgba(16, 185, 129, 0.5)',
    borderHover: 'hover:border-emerald-400',
    iconBg: 'bg-gradient-to-br from-emerald-500/30 to-teal-400/30',
    accentColor: 'text-emerald-400',
  },
  {
    id: 'quiz',
    name: 'Quiz',
    emoji: '❓',
    description: 'Questions-réponses interactif en équipe',
    path: '/admin/jeux/quiz',
    available: true,
    gradient: 'from-red-500/20 via-orange-500/20 to-amber-400/20',
    glowColor: 'rgba(239, 68, 68, 0.5)',
    borderHover: 'hover:border-red-400',
    iconBg: 'bg-gradient-to-br from-red-500/30 to-orange-400/30',
    accentColor: 'text-red-400',
  },
]

export default function JeuxPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredGame, setHoveredGame] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      setSession(data)
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37]" />
            <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-[#D4AF37]" />
          </div>
          <p className="text-gray-400 text-sm">Chargement des jeux...</p>
        </motion.div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">Aucune session trouvée</p>
          <Button onClick={() => router.push('/admin/dashboard')}>
            Retour au dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] overflow-hidden">
      {/* Animated background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/3 to-transparent rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-[#1A1A1E]/80 backdrop-blur-xl border-b border-white/5">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/dashboard')}
            className="text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-gray-500 text-sm">{session.name}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8 md:py-12 max-w-7xl">

        {/* Premium Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12 md:mb-16"
        >
          {/* Decorative line */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '120px' }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mb-8"
          />

          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-amber-600/10 mb-6 relative"
          >
            <span className="text-5xl">🎮</span>
            <div className="absolute inset-0 rounded-2xl bg-[#D4AF37]/20 blur-xl animate-pulse" />
          </motion.div>

          {/* Title with glow */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-[#D4AF37] to-white mb-4 relative">
            Jeux & Animations
            <span className="absolute inset-0 text-4xl md:text-5xl lg:text-6xl font-black text-[#D4AF37] blur-2xl opacity-30">
              Jeux & Animations
            </span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400 text-lg md:text-xl flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            <span>Sélectionnez un jeu pour animer votre événement</span>
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
          </motion.p>

          {/* Decorative line */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '120px' }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto mt-8"
          />
        </motion.div>

        {/* Games Grid - 3 columns desktop, 2 tablet, 1 mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: index * 0.08,
                duration: 0.5,
                ease: [0.23, 1, 0.32, 1]
              }}
              onMouseEnter={() => setHoveredGame(game.id)}
              onMouseLeave={() => setHoveredGame(null)}
              onClick={() => game.available && router.push(game.path)}
              className={`
                group relative rounded-2xl cursor-pointer
                transition-all duration-300 ease-out
                ${game.available ? 'hover:scale-[1.03] hover:-translate-y-2' : 'opacity-50 cursor-not-allowed'}
              `}
            >
              {/* Glow effect on hover */}
              <div
                className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
                style={{ background: game.glowColor }}
              />

              {/* Card */}
              <div className={`
                relative h-full rounded-2xl overflow-hidden
                bg-gradient-to-br ${game.gradient}
                border-2 border-white/5 ${game.available ? game.borderHover : ''}
                group-hover:border-opacity-100 transition-all duration-300
                backdrop-blur-sm
              `}>
                {/* Shimmer effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
                </div>

                {/* Inner content */}
                <div className="relative p-6 md:p-8 flex flex-col items-center text-center min-h-[280px]">

                  {/* Icon container with glow */}
                  <div className={`
                    relative w-20 h-20 md:w-24 md:h-24 rounded-2xl ${game.iconBg}
                    flex items-center justify-center mb-6
                    group-hover:scale-110 transition-transform duration-300
                  `}>
                    <span className="text-5xl md:text-6xl relative z-10 transform group-hover:scale-110 transition-transform duration-300">
                      {game.emoji}
                    </span>
                    {/* Icon glow */}
                    <div
                      className="absolute inset-0 rounded-2xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"
                      style={{ background: game.glowColor }}
                    />
                  </div>

                  {/* Game name */}
                  <h3 className={`
                    text-xl md:text-2xl font-bold text-white mb-3
                    group-hover:${game.accentColor} transition-colors duration-300
                  `}>
                    {game.name}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-6 flex-1">
                    {game.description}
                  </p>

                  {/* CTA */}
                  {game.available ? (
                    <div className={`
                      flex items-center gap-2 ${game.accentColor}
                      opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0
                      transition-all duration-300
                    `}>
                      <span className="text-sm font-semibold">Lancer le jeu</span>
                      <motion.span
                        animate={{ x: hoveredGame === game.id ? [0, 5, 0] : 0 }}
                        transition={{ repeat: hoveredGame === game.id ? Infinity : 0, duration: 0.8 }}
                      >
                        →
                      </motion.span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40">
                      <span className="text-amber-400 text-sm font-semibold">Bientôt disponible</span>
                    </div>
                  )}
                </div>

                {/* Corner accent */}
                <div
                  className="absolute top-0 right-0 w-24 h-24 opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{
                    background: `radial-gradient(circle at top right, ${game.glowColor}, transparent 70%)`
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 text-gray-600 text-sm">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gray-700" />
            <span>5 jeux disponibles</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gray-700" />
          </div>
        </motion.div>
      </main>

      {/* CSS for shimmer animation */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(100%) skewX(-12deg); }
        }
      `}</style>
    </div>
  )
}
