'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, FileText } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { Session } from '@/types/database'
import { toast } from 'sonner'
import { fetchUserSession } from '@/lib/session-select'
import '../saas-v2.css'

// Game card data
const games = [
  {
    id: 'mystery',
    name: 'Photo Mystère',
    image: '/images/games/photo-mystere-v2.png',
    description: 'Devinez la photo cachée pixel par pixel',
    path: '/admin/jeux/mystery',
    available: true,
    glowColor: 'rgba(6, 182, 212, 0.5)',
    borderHover: 'hover:border-cyan-400',
    accentColor: 'text-cyan-400',
    notice: '/photo-mystere-regles.pdf',
  },
  {
    id: 'lineup',
    name: 'Le Bon Ordre',
    image: '/images/games/le-bon-ordre-v2.png',
    description: "2 équipes s'affrontent pour remettre les numéros dans l'ordre le plus vite possible",
    path: '/admin/jeux/lineup',
    available: true,
    glowColor: 'rgba(139, 92, 246, 0.5)',
    borderHover: 'hover:border-violet-400',
    accentColor: 'text-violet-400',
    notice: '/le-bon-ordre-regles-du-jeu.pdf',
  },
  {
    id: 'wheel',
    name: 'Roue de la Destinée',
    image: '/images/games/roue-de-la-destinee-v2.png',
    description: 'Tournez la roue et découvrez votre défi',
    path: '/admin/jeux/wheel',
    available: true,
    glowColor: 'rgba(212, 175, 55, 0.6)',
    borderHover: 'hover:border-[#D4AF37]',
    accentColor: 'text-[#D4AF37]',
    notice: '/roue-de-la-destinee-regles.pdf',
  },
  {
    id: 'quiz',
    name: 'Quiz',
    image: '/images/games/quiz-v2.png',
    description: 'Questions-réponses interactif en équipe',
    path: '/admin/jeux/quiz',
    available: true,
    glowColor: 'rgba(239, 68, 68, 0.5)',
    borderHover: 'hover:border-red-400',
    accentColor: 'text-red-400',
    notice: '/quiz-regles.pdf',
  },
  {
    id: 'affinity',
    name: 'Matching',
    image: '/images/games/matching-v2.png',
    description: 'Le jeu des points communs : découvrez qui a répondu comme vous',
    path: '/admin/jeux/matching',
    available: true,
    glowColor: 'rgba(212, 175, 55, 0.5)',
    borderHover: 'hover:border-[#D4AF37]',
    accentColor: 'text-[#D4AF37]',
    notice: '/matching-regles.pdf',
  },
  {
    id: 'buzzer',
    name: 'AnimaBuzz',
    image: '/images/games/animabuzz-xtreme.png',
    description: 'Le buzzer live : le téléphone de vos invités devient un vrai buzzer de jeu',
    path: '/admin/jeux/buzzer',
    available: true,
    glowColor: 'rgba(168, 85, 247, 0.5)',
    borderHover: 'hover:border-violet-400',
    accentColor: 'text-violet-400',
    notice: '/animabuzz-regles.pdf',
  },
  {
    id: 'vote',
    name: 'AnimaVote',
    image: '/images/games/animavote.png',
    description: 'Le vote live : vos invités élisent leur favori depuis leur téléphone',
    path: '/admin/jeux/vote',
    available: true,
    glowColor: 'rgba(212, 175, 55, 0.5)',
    borderHover: 'hover:border-[#D4AF37]',
    accentColor: 'text-[#D4AF37]',
    notice: '/animavote-regles.pdf',
  },
  {
    id: 'demimot',
    name: 'À Demi-Mot',
    image: '/images/games/a-demi-mot-v2.png',
    description: 'Quelques lettres, à vous de trouver : les équipes buzzent pour deviner l’expression',
    path: '/admin/jeux/demimot',
    // Ouvert à tous les abonnés (15/11/2026).
    available: true,
    glowColor: 'rgba(212, 175, 55, 0.5)',
    borderHover: 'hover:border-[#D4AF37]',
    accentColor: 'text-[#D4AF37]',
    notice: '/a-demi-mot-regles.pdf',
  },
  {
    id: 'bingo',
    name: 'AnimaBingo',
    image: '/images/games/animabingo.png',
    description: 'Le loto 90 boules : cartons sur téléphone ou papier, quine vérifiée en un clic',
    path: '/admin/jeux/bingo',
    available: true,
    glowColor: 'rgba(212, 175, 55, 0.5)',
    borderHover: 'hover:border-[#D4AF37]',
    accentColor: 'text-[#D4AF37]',
  },
]

export default function JeuxPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    fetchSession()
  }, [])

  async function fetchSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const data = await fetchUserSession(supabase, user.id, searchParams.get('session'))
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
    // Habillage SaaS V2 « It's showtime! » (maquette validée le 26/11/2026) : styles dans ../saas-v2.css.
    // Logique inchangée : mêmes jeux, mêmes liens (?session=), mêmes notices PDF.
    <div className="saas-v2 v2-pl">
      <div className="v2-pl-sousbarre">
        <button type="button" className="v2-btn v2-petit" onClick={() => router.push('/admin/dashboard')}>
          <ArrowLeft className="h-[17px] w-[17px]" />
          Retour
        </button>
        <div className="v2-verre v2-session-mini">
          <span>{session.name}</span>
          <small>#{session.code}</small>
          <em className={session.is_active ? '' : 'v2-off'}>● {session.is_active ? 'Active' : 'Inactive'}</em>
        </div>
      </div>

      <main className="v2-pl-main">
        <h1 className="v2-pl-titre">
          <Image src="/saas-v2/pl-titre-showtime.webp" alt="" width={1800} height={340} priority unoptimized />
          <span className="v2-sr">It’s showtime! — Jeux</span>
        </h1>

        <div className="v2-pl-galerie">
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              onClick={() => game.available && router.push(`${game.path}?session=${session.id}`)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && game.available) {
                  e.preventDefault()
                  router.push(`${game.path}?session=${session.id}`)
                }
              }}
              role="link"
              tabIndex={game.available ? 0 : -1}
              aria-label={game.name}
              aria-disabled={!game.available}
              className={`v2-pl-jeu ${game.available ? '' : 'v2-ferme'}`}
            >
              <div className="v2-pl-faisceau" />
              <div className="v2-pl-vitrine">
                {/* Badge notice PDF : sur l'arête de l'écrin, jamais sur l'affiche (cartes ouvertes seulement) */}
                {game.available && 'notice' in game && game.notice && (
                  <a
                    href={game.notice as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="v2-pl-notice"
                  >
                    <FileText />
                    Notice
                  </a>
                )}
                <div className="v2-pl-affiche">
                  <Image
                    src={game.image}
                    alt=""
                    fill
                    sizes="(max-width: 560px) 100vw, (max-width: 1023px) 50vw, 20vw"
                  />
                </div>
              </div>
              <div className="v2-pl-socle">
                <span>{game.name}</span>
                <div className="v2-pl-ombre" />
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  )
}
