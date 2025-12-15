'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { toast } from 'sonner'

// Game card data
const games = [
  {
    id: 'mystery',
    name: 'Photo Mystère',
    emoji: '🔍',
    description: 'Devinez la photo cachée',
    path: '/admin/jeux/mystery',
    available: true,
  },
  {
    id: 'lineup',
    name: 'Le Bon Ordre',
    emoji: '🏃',
    description: "2 équipes s'affrontent",
    path: '/admin/jeux/lineup',
    available: true,
  },
  {
    id: 'vote',
    name: 'Vote Photo',
    emoji: '🗳️',
    description: 'Votez pour la meilleure photo',
    path: '/admin/jeux/vote',
    available: true,
  },
  {
    id: 'wheel',
    name: 'Roue de la Fortune',
    emoji: '🎡',
    description: 'Défis et gages aléatoires',
    path: '/admin/jeux/wheel',
    available: true,
  },
  {
    id: 'defis',
    name: 'Défis Photo',
    emoji: '📸',
    description: 'Réalisez des défis photo',
    path: '/admin/jeux/defis',
    available: true,
  },
  {
    id: 'quiz',
    name: 'Quiz',
    emoji: '❓',
    description: 'Questions-réponses interactif',
    path: '/admin/jeux/quiz',
    available: true,
  },
  {
    id: 'blindtest',
    name: 'Blind Test',
    emoji: '🎵',
    description: 'Devinez les musiques',
    path: '/admin/jeux/blindtest',
    available: true,
  },
]

export default function JeuxPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  // Reset all games on page load
  async function resetAllGames(sessionId: string) {
    try {
      await supabase
        .from('sessions')
        .update({
          // Reset Photo Mystère
          mystery_photo_enabled: false,
          mystery_photo_active: false,
          mystery_is_playing: false,
          mystery_current_round: 1,
          mystery_revealed_tiles: [],
          mystery_photo_state: null,
          // Reset Lineup
          lineup_active: false,
          lineup_is_running: false,
          lineup_is_paused: false,
          lineup_is_game_over: false,
          lineup_current_number: '',
          lineup_show_winner: false,
          lineup_team1_score: 0,
          lineup_team2_score: 0,
          lineup_time_left: 60,
          lineup_current_points: 10,
          // Reset Vote Photo
          vote_active: false,
          vote_is_open: false,
          vote_show_results: false,
          vote_show_podium: false,
          vote_timer_left: null,
          // Reset Wheel
          wheel_active: false,
          wheel_is_spinning: false,
          wheel_result: null,
          // Reset Challenges
          challenges_active: false,
          challenges_current: null,
          // Reset Quiz
          quiz_active: false,
          quiz_current_question: 0,
          quiz_is_answering: false,
          quiz_show_results: false,
          quiz_time_left: null,
          // Reset Blind Test
          blindtest_active: false,
          blindtest_current_song: 0,
          blindtest_is_playing: false,
          blindtest_show_answer: false,
          blindtest_time_left: null,
        })
        .eq('id', sessionId)

      console.log('[Jeux] All games reset on page load')
    } catch (err) {
      console.error('Error resetting games:', err)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      setSession(data)

      // Reset all games on page load (ensures clean state)
      await resetAllGames(data.id)
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#1A1A1E] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#1A1A1E]">
      {/* Header */}
      <header className="bg-[#242428] border-b border-[rgba(255,255,255,0.1)]">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/dashboard')}
            className="text-white hover:text-[#D4AF37]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 text-sm">{session.name}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="h-[calc(100vh-180px)] flex flex-col">

          {/* Header compact */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <div>
                <h1 className="text-xl font-bold text-white">Jeux & Animations</h1>
                <p className="text-gray-400 text-sm">Sélectionnez un jeu pour l&apos;activer</p>
              </div>
            </div>
          </div>

          {/* Grille des jeux - 2 colonnes */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {games.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => game.available && router.push(game.path)}
                className={`
                  rounded-xl p-4 flex flex-col transition-all
                  ${game.available
                    ? 'bg-[#242428] cursor-pointer hover:border-[#D4AF37] border-2 border-transparent hover:shadow-lg hover:shadow-[#D4AF37]/20'
                    : 'bg-[#242428]/50 border-2 border-dashed border-gray-700 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    game.available ? 'bg-[#D4AF37]/20' : 'bg-gray-700/50'
                  }`}>
                    <span className="text-2xl">{game.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold truncate ${game.available ? 'text-white' : 'text-gray-400'}`}>
                      {game.name}
                    </h3>
                    <p className={`text-xs truncate ${game.available ? 'text-gray-400' : 'text-gray-500'}`}>
                      {game.description}
                    </p>
                  </div>
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center justify-between mt-2">
                  {game.available ? (
                    <>
                      <span className="text-xs text-gray-500">Cliquez pour configurer</span>
                      <span className="text-[#D4AF37]">→</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 w-full text-center">Bientôt disponible</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
