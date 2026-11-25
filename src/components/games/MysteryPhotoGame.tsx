'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Maximize, Minimize, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import QRCode from '@/components/QRCode'
import { MysteryPhotoGrid, MysteryPhotoSpeed } from '@/types/database'
import { createClient, createPublicClient } from '@/lib/supabase'
import type { LiveSession } from '@/lib/public-api/columns'
import { getInviteUrl } from '@/lib/utils'
import st from './mystery/MysteryStage.module.css'

// Habillage « plateau TV » AnimaJet 2.0 (maquette V2 validée le 25/11/2026) : décor, cadre et case
// sont des rendus Blender précalculés ; la logique de jeu ci-dessous est inchangée.
const ASSETS = '/photo-mystere'
const STAGE_W = 1920
const STAGE_H = 1080

interface MysteryPhotoGameProps {
  session: LiveSession
  onExit: () => void
}

interface MysteryPhotoData {
  url: string
  audioUrl?: string
}

const SPEED_MAP: Record<MysteryPhotoSpeed, number> = {
  slow: 3000,
  medium: 2000,
  fast: 1000,
}

// Helper function for delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Précharge une image avec tentatives automatiques (réseau instable : un échec
// ponctuel ne doit pas condamner la manche pour de bon comme avant). Fail-open
// uniquement après épuisement des tentatives, pour ne jamais bloquer le plateau.
function preloadImageWithRetry(
  url: string,
  onSettled: () => void,
  isCancelled: () => boolean,
  maxAttempts = 4
) {
  let attempt = 0
  const tryLoad = () => {
    if (isCancelled()) return
    const img = new window.Image()
    img.onload = () => { if (!isCancelled()) onSettled() }
    img.onerror = () => {
      if (isCancelled()) return
      attempt += 1
      if (attempt < maxAttempts) {
        setTimeout(tryLoad, 1000 * attempt) // 1s, 2s, 3s
      } else {
        onSettled() // fail-open après épuisement des tentatives
      }
    }
    img.src = url
    if (img.complete && img.naturalWidth > 0) { if (!isCancelled()) onSettled() } // déjà en cache
  }
  tryLoad()
}

// Confettis du gagnant : valeurs déterministes (aucun Math.random() au rendu)
const CONFETTI = Array.from({ length: 90 }, (_, i) => {
  const r = (k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  const s = 8 + r(1) * 12
  return {
    id: i,
    left: r(2) * 100,
    w: s * 0.7,
    h: s * 1.5,
    color: ['#FFD86B', '#F2B632', '#FFF1B8', '#C9A2FF', '#9B5CFF', '#E8B341'][i % 6],
    duration: 3.5 + r(3) * 2.5,
    delay: -r(4) * 5,
  }
})

// Parcours en zigzag des cases à la révélation finale (ex-parcours Pac-Man, même ordre)
const generatePacmanPath = (rows: number, cols: number) => {
  const path: { row: number; col: number }[] = []
  for (let row = 0; row < rows; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < cols; col++) {
        path.push({ row, col })
      }
    } else {
      for (let col = cols - 1; col >= 0; col--) {
        path.push({ row, col })
      }
    }
  }
  return path
}

export default function MysteryPhotoGame({ session, onExit }: MysteryPhotoGameProps) {
  const [revealedTiles, setRevealedTiles] = useState<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentRound, setCurrentRound] = useState(1)
  const [totalRounds, setTotalRounds] = useState(1)
  const [photos, setPhotos] = useState<MysteryPhotoData[]>([])
  const [showRoundTransition, setShowRoundTransition] = useState(false)

  // Winner animation states
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false)
  const [animationPhase, setAnimationPhase] = useState(0)
  // Position/direction conservées (logique inchangée) ; le personnage n'est plus affiché.
  const [, setPacmanPosition] = useState({ row: 0, col: 0 })
  const [, setPacmanDirection] = useState<'right' | 'left' | 'up' | 'down'>('right')
  const [eatenTiles, setEatenTiles] = useState<number[]>([])

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scène fixe 1920×1080 mise à l'échelle de l'écran (letterbox noir si le ratio diffère)
  const [stageScale, setStageScale] = useState(1)
  useEffect(() => {
    const fit = () => setStageScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Stabilité : guard unmount + refs timing
  const isMountedRef = useRef(true)
  const currentRoundRef = useRef(currentRound)
  const roundTransitionT1Ref = useRef<NodeJS.Timeout | null>(null)
  const roundTransitionT2Ref = useRef<NodeJS.Timeout | null>(null)
  const fadeAudioIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // QR Code visibility (synced with session)
  const [showQR, setShowQR] = useState(session.show_qr_on_screen ?? false)

  // Audio states - Per-photo audio (plays when photo is fully revealed)
  const photoAudioRef = useRef<HTMLAudioElement>(null)
  const [audioVolume, setAudioVolume] = useState(0.8)
  const [isPhotoAudioPlaying, setIsPhotoAudioPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [hasPlayedPhotoAudio, setHasPlayedPhotoAudio] = useState(false)

  // Audio states - Global reveal audio (plays during tile removal)
  const revealAudioRef = useRef<HTMLAudioElement>(null)
  const [revealAudioUrl, setRevealAudioUrl] = useState<string | null>(null)
  const [isRevealAudioPlaying, setIsRevealAudioPlaying] = useState(false)
  const [hasStartedRevealAudio, setHasStartedRevealAudio] = useState(false) // Track if audio started this round

  const supabase = createClient()

  // Parse grid dimensions
  const [cols, rows] = (session.mystery_photo_grid || '12x8').split('x').map(Number)
  const totalTiles = cols * rows
  const speed = SPEED_MAP[session.mystery_photo_speed || 'medium']

  // URL d'une photo pour une manche donnée (helper : sert aussi à précharger la
  // manche cible AVANT de basculer le <img>, cf. transition anti-spoiler plus bas)
  const getPhotoUrlForRound = useCallback((round: number, photosArr: MysteryPhotoData[]) => {
    if (photosArr.length > 0 && round <= photosArr.length) {
      const photoData = photosArr[round - 1]
      if (photoData?.url) {
        return supabase.storage.from('photos').getPublicUrl(photoData.url).data.publicUrl
      }
    }
    if (session.mystery_photo_url) {
      return supabase.storage.from('photos').getPublicUrl(session.mystery_photo_url).data.publicUrl
    }
    return null
  }, [session.mystery_photo_url, supabase])

  // Get current photo URL
  const currentPhotoUrl = useMemo(
    () => getPhotoUrlForRound(currentRound, photos),
    [getPhotoUrlForRound, currentRound, photos]
  )

  // Anti-spoiler : la nouvelle image n'est mise dans le <img> visible qu'une fois
  // PRÉCHARGÉE (décodée). Protège aussi la 1re manche au lancement : tant que
  // readyPhotoUrl est null, le plateau reste couvert par les tuiles opaques (aucune
  // image en clair tant que les tuiles ne sont pas en place).
  const [readyPhotoUrl, setReadyPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!currentPhotoUrl) {
      setReadyPhotoUrl(null)
      return
    }
    let cancelled = false
    preloadImageWithRetry(currentPhotoUrl, () => setReadyPhotoUrl(currentPhotoUrl), () => cancelled)
    return () => { cancelled = true }
  }, [currentPhotoUrl])

  // Get current audio URL
  const currentAudioUrl = useMemo(() => {
    if (photos.length > 0 && currentRound <= photos.length) {
      const photoData = photos[currentRound - 1]
      if (photoData?.audioUrl) {
        const { data } = supabase.storage.from('photos').getPublicUrl(photoData.audioUrl)
        return data.publicUrl
      }
    }
    return null
  }, [photos, currentRound, supabase])

  // Check if current photo has audio (for revelation)
  const hasPhotoAudio = useMemo(() => {
    return !!currentAudioUrl
  }, [currentAudioUrl])

  // Check if global reveal audio is configured
  const hasRevealAudio = useMemo(() => {
    return !!revealAudioUrl
  }, [revealAudioUrl])

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    // Mac : faux plein écran (le conteneur est déjà fixed inset-0). On n'appelle
    // JAMAIS l'API native qui crée un Space macOS → écran principal noir.
    if (isMac) {
      setIsFullscreen(prev => !prev)
      return
    }
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch { /* refusé par le navigateur */ }
  }

  // Cleanup au unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (roundTransitionT1Ref.current) clearTimeout(roundTransitionT1Ref.current)
      if (roundTransitionT2Ref.current) clearTimeout(roundTransitionT2Ref.current)
      if (fadeAudioIntervalRef.current) clearInterval(fadeAudioIntervalRef.current)
      // Pauser explicitement : un <audio> retiré du DOM peut continuer à jouer
      // (surtout le reveal audio en loop) → audio fantôme par-dessus le jeu
      // suivant quand /live change de composant.
      if (revealAudioRef.current) revealAudioRef.current.pause()
      if (photoAudioRef.current) photoAudioRef.current.pause()
    }
  }, [])

  // Sync currentRoundRef
  useEffect(() => { currentRoundRef.current = currentRound }, [currentRound])

  // Sync photosRef : la souscription realtime lit la liste fraîche des photos sans
  // dépendre du state capturé dans sa closure (sinon URL de manche cible périmée)
  const photosRef = useRef(photos)
  useEffect(() => { photosRef.current = photos }, [photos])

  // Détection Mac côté client (navigator absent en SSR)
  useEffect(() => {
    setIsMac(/Mac/i.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent))
  }, [])

  // Listen for fullscreen change (ESC key exits fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Mac : Échap quitte le faux plein écran
  useEffect(() => {
    if (!isMac) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMac])


  // Load global reveal audio URL from session
  useEffect(() => {
    if (session.mystery_reveal_audio) {
      const { data } = supabase.storage.from('photos').getPublicUrl(session.mystery_reveal_audio)
      setRevealAudioUrl(data.publicUrl)
    }
  }, [session.mystery_reveal_audio, supabase])

  // GLOBAL REVEAL AUDIO: Play/pause when game starts/pauses
  useEffect(() => {
    if (isPlaying && revealAudioUrl && !isMuted && revealAudioRef.current) {
      // Only reset to beginning on first start of the round
      if (!hasStartedRevealAudio) {
        revealAudioRef.current.currentTime = 0
        setHasStartedRevealAudio(true)
      }
      // Resume or start playing
      revealAudioRef.current.loop = true
      revealAudioRef.current.play().catch(() => {})
      setIsRevealAudioPlaying(true)
    } else if (!isPlaying && revealAudioRef.current && isRevealAudioPlaying) {
      // Pause audio when game is paused (keep current position)
      revealAudioRef.current.pause()
      setIsRevealAudioPlaying(false)
    }
  }, [isPlaying, revealAudioUrl, isMuted, hasStartedRevealAudio])

  // Stop REVEAL audio when all tiles are revealed
  useEffect(() => {
    if (revealedTiles.length === totalTiles && totalTiles > 0) {
      // Stop reveal audio with fade out
      if (revealAudioRef.current && isRevealAudioPlaying) {
        const fadeOutDuration = 500 // 0.5 second fade out
        const fadeInterval = 50
        const steps = fadeOutDuration / fadeInterval
        const volumeStep = revealAudioRef.current.volume / steps

        if (fadeAudioIntervalRef.current) clearInterval(fadeAudioIntervalRef.current)
        fadeAudioIntervalRef.current = setInterval(() => {
          if (revealAudioRef.current && revealAudioRef.current.volume > volumeStep) {
            revealAudioRef.current.volume -= volumeStep
          } else {
            if (fadeAudioIntervalRef.current) { clearInterval(fadeAudioIntervalRef.current); fadeAudioIntervalRef.current = null }
            if (revealAudioRef.current) {
              revealAudioRef.current.pause()
              revealAudioRef.current.volume = isMuted ? 0 : audioVolume
              revealAudioRef.current.loop = false
            }
            if (isMountedRef.current) setIsRevealAudioPlaying(false)
          }
        }, fadeInterval)
      }
    }
  }, [revealedTiles.length, totalTiles, isRevealAudioPlaying, isMuted, audioVolume])

  // Lance l'audio de la photo révélée, avec tentatives automatiques : un
  // <audio> dont le fetch initial a échoué (réseau instable) ne retente
  // jamais tout seul, même si le réseau redevient bon entre-temps — sans
  // ceci l'audio ne joue plus jamais pour le reste de la manche.
  // Récursion via ref (comme photosRef/currentRoundRef plus haut) pour éviter
  // toute auto-référence de fonction avant déclaration.
  const attemptPlayPhotoAudioRef = useRef((_attempt: number = 0) => {})
  attemptPlayPhotoAudioRef.current = (attempt = 0) => {
    const audioEl = photoAudioRef.current
    if (!audioEl || !isMountedRef.current) return
    const roundAtStart = currentRoundRef.current
    audioEl.currentTime = 0
    audioEl.loop = false
    audioEl.play().then(() => {
      if (!isMountedRef.current) return
      setIsPhotoAudioPlaying(true)
      setHasPlayedPhotoAudio(true)
    }).catch(() => {
      if (!isMountedRef.current) return
      if (attempt < 3) {
        setTimeout(() => {
          // Manche changée entre-temps : l'<audio> pointe sur un autre son, ne pas le relancer
          if (!isMountedRef.current || currentRoundRef.current !== roundAtStart) return
          audioEl.load() // relance le fetch de la ressource avant de réessayer
          attemptPlayPhotoAudioRef.current(attempt + 1)
        }, 1000 * (attempt + 1)) // 1s, 2s, 3s
      } else {
        setHasPlayedPhotoAudio(true) // abandon après 3 tentatives, ne pas boucler indéfiniment
      }
    })
  }
  const attemptPlayPhotoAudio = useCallback((attempt = 0) => attemptPlayPhotoAudioRef.current(attempt), [])

  // Play PER-PHOTO audio when all tiles are revealed
  useEffect(() => {
    if (revealedTiles.length === totalTiles && totalTiles > 0 && currentAudioUrl && !hasPlayedPhotoAudio && !isMuted) {
      // Wait a bit for reveal audio to fade, then play photo audio
      const timer = setTimeout(() => {
        attemptPlayPhotoAudio()
      }, 700)

      return () => clearTimeout(timer)
    }
  }, [revealedTiles.length, totalTiles, currentAudioUrl, hasPlayedPhotoAudio, isMuted, attemptPlayPhotoAudio])

  // Reset audio states when round changes
  useEffect(() => {
    setHasPlayedPhotoAudio(false)
    setIsPhotoAudioPlaying(false)
    setIsRevealAudioPlaying(false)
    setHasStartedRevealAudio(false) // Reset so next round starts from beginning

    // Stop both audio elements
    if (photoAudioRef.current) {
      photoAudioRef.current.pause()
      photoAudioRef.current.currentTime = 0
      photoAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
    if (revealAudioRef.current) {
      revealAudioRef.current.pause()
      revealAudioRef.current.currentTime = 0
      revealAudioRef.current.loop = false
      revealAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
  }, [currentRound, audioVolume, isMuted])

  // Update audio volume for both audio elements
  useEffect(() => {
    if (photoAudioRef.current) {
      photoAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
    if (revealAudioRef.current) {
      revealAudioRef.current.volume = isMuted ? 0 : audioVolume
    }
  }, [audioVolume, isMuted])

  // Audio control functions (for per-photo audio)
  const playPhotoAudio = () => {
    if (photoAudioRef.current && currentAudioUrl) {
      photoAudioRef.current.play()
      setIsPhotoAudioPlaying(true)
    }
  }

  const replayPhotoAudio = () => {
    if (photoAudioRef.current && currentAudioUrl) {
      photoAudioRef.current.currentTime = 0
      photoAudioRef.current.play()
      setIsPhotoAudioPlaying(true)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  // Initialize state from session
  useEffect(() => {
    if (session.mystery_photos) {
      try {
        const parsedPhotos = JSON.parse(session.mystery_photos)
        setPhotos(parsedPhotos)
        setTotalRounds(parsedPhotos.length || 1)
      } catch {
        console.error('Failed to parse mystery_photos')
      }
    }
    setCurrentRound(session.mystery_current_round || 1)
    setTotalRounds(session.mystery_total_rounds || 1)
    setIsPlaying(session.mystery_is_playing || false)
    setRevealedTiles(session.mystery_revealed_tiles || [])
  }, [])

  // Le QR ne figure pas dans les événements reçus par un écran anonyme : il suit la
  // session relue par /live.
  useEffect(() => {
    setShowQR(session.show_qr_on_screen ?? false)
  }, [session.show_qr_on_screen])

  // Subscribe to session changes for real-time sync
  useEffect(() => {
    const publicClient = createPublicClient()
    const channel = publicClient
      .channel(`mystery-game-display-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as LiveSession
          if (!updated.mystery_photo_active) {
            onExit()
            return
          }

          // Liste fraîche des photos issue du payload (évite le state périmé dans
          // la closure de la souscription)
          let nextPhotos = photosRef.current
          if (updated.mystery_photos) {
            try {
              nextPhotos = JSON.parse(updated.mystery_photos)
            } catch {
              console.error('Failed to parse updated mystery_photos')
            }
          }

          const newRound = updated.mystery_current_round || 1
          const prevRound = currentRoundRef.current
          if (newRound !== prevRound && newRound > prevRound) {
            // 1) Rideau opaque + on RECOUVRE tout de suite les tuiles DERRIÈRE le
            //    rideau : leur fondu (0,5 s) se termine bien avant la levée du rideau
            //    (>= 2 s) → tuiles 100 % opaques quand le plateau réapparaît.
            setShowRoundTransition(true)
            setRevealedTiles([])

            // 2) Précharge l'image de la manche cible AVANT de basculer le <img>.
            const nextUrl = getPhotoUrlForRound(newRound, nextPhotos)
            const preloaded = new Promise<void>((resolve) => {
              if (!nextUrl) { resolve(); return }
              preloadImageWithRetry(nextUrl, resolve, () => !isMountedRef.current)
            })
            const celebration = new Promise<void>((resolve) => {
              if (roundTransitionT1Ref.current) clearTimeout(roundTransitionT1Ref.current)
              roundTransitionT1Ref.current = setTimeout(resolve, 2000)
            })

            // 3) Image préchargée ET délai de célébration écoulé → bascule (toujours
            //    sous le rideau + sous tuiles opaques), puis FRAME DE SÉCURITÉ (double
            //    rAF = 1 frame peinte garantie) avant de lever le rideau.
            Promise.all([preloaded, celebration]).then(() => {
              if (!isMountedRef.current) return
              setPhotos(nextPhotos)
              setCurrentRound(newRound)
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (!isMountedRef.current) return
                  setShowRoundTransition(false)
                })
              })
            })
          } else {
            setPhotos(nextPhotos)
            setCurrentRound(newRound)
            setRevealedTiles(updated.mystery_revealed_tiles || [])
          }
          setTotalRounds(updated.mystery_total_rounds || 1)
          setIsPlaying(updated.mystery_is_playing || false)
        }
      )
      .subscribe()

    return () => {
      publicClient.removeChannel(channel)
    }
  }, [session.id, onExit])

  // Listen for winner animation broadcast
  useEffect(() => {
    const winnerChannel = supabase
      .channel(`mystery-winner-${session.code}`)
      .on('broadcast', { event: 'mystery_winner' }, () => {
        startWinnerSequence()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(winnerChannel)
    }
  }, [session.code, supabase, rows, cols])

  // Winner animation sequence
  const startWinnerSequence = async () => {
    if (!isMountedRef.current) return
    setShowWinnerAnimation(true)
    setEatenTiles([])
    setPacmanPosition({ row: 0, col: 0 })
    setPacmanDirection('right')

    setAnimationPhase(1)
    await sleep(800)
    if (!isMountedRef.current) return

    setAnimationPhase(2)
    await pacmanEatAnimation()
    if (!isMountedRef.current) return

    setAnimationPhase(3)
    await sleep(6000)
    if (!isMountedRef.current) return

    setShowWinnerAnimation(false)
    setAnimationPhase(0)
    setEatenTiles([])
  }

  // Pac-Man eating animation
  const pacmanEatAnimation = async () => {
    const path = generatePacmanPath(rows, cols)

    for (let i = 0; i < path.length; i++) {
      if (!isMountedRef.current) return
      const { row, col } = path[i]
      const prevPos = i > 0 ? path[i - 1] : path[0]

      if (col > prevPos.col) setPacmanDirection('right')
      else if (col < prevPos.col) setPacmanDirection('left')
      else if (row > prevPos.row) setPacmanDirection('down')
      else if (row < prevPos.row) setPacmanDirection('up')

      setPacmanPosition({ row, col })
      setEatenTiles(prev => [...prev, row * cols + col])
      await sleep(35)
    }
  }

  // Auto-reveal logic
  useEffect(() => {
    if (!isPlaying) return
    if (revealedTiles.length >= totalTiles) return

    const interval = setInterval(async () => {
      const allTiles = Array.from({ length: totalTiles }, (_, i) => i)
      const hiddenTiles = allTiles.filter(t => !revealedTiles.includes(t))
      if (hiddenTiles.length === 0) return
      const randomIndex = Math.floor(Math.random() * hiddenTiles.length)
      const tileToReveal = hiddenTiles[randomIndex]
      const newRevealedTiles = [...revealedTiles, tileToReveal]
      await supabase
        .from('sessions')
        .update({ mystery_revealed_tiles: newRevealedTiles })
        .eq('id', session.id)
      setRevealedTiles(newRevealedTiles)
    }, speed)

    return () => clearInterval(interval)
  }, [isPlaying, revealedTiles, totalTiles, speed, session.id, supabase])

  // Generate tile elements
  const tiles = useMemo(() => {
    return Array.from({ length: totalTiles }, (_, i) => ({
      id: i,
      revealed: revealedTiles.includes(i),
    }))
  }, [totalTiles, revealedTiles])

  // ---------------------------------------------------------------------------
  // Rendu « plateau TV » (habillage uniquement)
  // ---------------------------------------------------------------------------

  // Taille du plateau : même calcul que la maquette (zone centrale, QR hors plateau)
  const zoneW = STAGE_W - 660 - 60
  const zoneH = STAGE_H - 132 - 42 - 60
  let boardW = zoneW
  let boardH = (boardW * rows) / cols
  if (boardH > zoneH) { boardH = zoneH; boardW = (boardH * cols) / rows }
  const tileGap = Math.max(3, Math.round((boardW / cols) * 0.07))
  const allRevealed = revealedTiles.length === totalTiles && totalTiles > 0
  const hasAudio = hasPhotoAudio || hasRevealAudio

  const stageVars = {
    '--pm-cadre': `url(${ASSETS}/cadre-or-9parties.webp)`,
    '--pm-case': `url(${ASSETS}/case-doree.webp)`,
    '--pm-colonnes': `url(${ASSETS}/calque-colonnes.webp)`,
    '--pm-colonnes-halo': `url(${ASSETS}/calque-colonnes-halo.webp)`,
    '--gap': `${tileGap}px`,
  } as React.CSSProperties

  const boardStyle = { width: boardW + 60, height: boardH + 60 }
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  }

  const decorLayers = (
    <>
      <img className={`${st.decor} ${st.decorBase}`} src={`${ASSETS}/decor-plateau-sans-faisceaux.webp`} alt="" draggable={false} />
      <img className={`${st.decor} ${st.beams}`} src={`${ASSETS}/calque-faisceaux.webp`} alt="" draggable={false} />
      <div className={st.colTint}><div className={st.colGrad} /></div>
      <div className={st.colGlow}><div className={st.colGrad} /></div>
      <img className={`${st.decor} ${st.neonBoost}`} src={`${ASSETS}/calque-neons-halo.webp`} alt="" draggable={false} />
      <img className={`${st.decor} ${st.sweepNeon}`} src={`${ASSETS}/calque-neons-halo.webp`} alt="" draggable={false} />
    </>
  )

  const corner = (pos: string) => (
    <svg className={`${st.corner} ${pos}`} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M4 60 V18 A14 14 0 0 1 18 4 H60" fill="none" stroke="#FFE08A" strokeWidth="5" strokeLinecap="round" />
      <path d="M14 60 V24 A10 10 0 0 1 24 14 H60" fill="none" stroke="#C98612" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="18" r="5" fill="#FFF3C0" />
    </svg>
  )

  return (
    <div ref={containerRef} className={st.root}>
      <div
        className={`${st.stage} ${showWinnerAnimation && animationPhase === 3 ? st.party : ''}`}
        style={{ ...stageVars, transform: `translate(-50%, -50%) scale(${stageScale})` }}
      >
        {decorLayers}

        {!currentPhotoUrl ? (
          <div className={st.empty}>Aucune photo configurée</div>
        ) : (
          <>
            {/* En-tête */}
            {totalRounds > 1 && (
              <div className={`${st.pill} ${st.round}`}>
                {isPlaying && <span className={st.liveDot} />}
                Manche <b>{currentRound} / {totalRounds}</b>
              </div>
            )}
            <div className={`${st.pill} ${st.cases} ${hasAudio ? '' : st.noVol}`}>
              {isPlaying && totalRounds <= 1 && <span className={st.liveDot} />}
              <span>{revealedTiles.length}</span>&nbsp;/&nbsp;<b>{totalTiles}</b>&nbsp;cases
            </div>

            {hasAudio && (
              <>
                <button
                  className={`${st.sq} ${st.vol} ${(isPhotoAudioPlaying || isRevealAudioPlaying) && !isMuted ? st.audioOn : ''}`}
                  onClick={toggleMute}
                  title={isMuted ? 'Activer le son' : 'Couper le son'}
                >
                  {isMuted ? <VolumeX /> : <Volume2 />}
                </button>
                <div className={st.volPop}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : audioVolume}
                    onChange={(e) => {
                      setAudioVolume(parseFloat(e.target.value))
                      if (parseFloat(e.target.value) > 0) setIsMuted(false)
                    }}
                    title="Volume"
                  />
                  {hasPhotoAudio && (
                    <button onClick={replayPhotoAudio} title="Rejouer l'audio de la photo">
                      <RotateCcw />
                    </button>
                  )}
                </div>
              </>
            )}

            <button
              className={`${st.sq} ${st.fs}`}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Quitter plein écran (ESC)' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize /> : <Maximize />}
            </button>

            {/* Plateau */}
            <div className={st.boardZone}>
              <div className={`${st.board} ${allRevealed ? st.revealed : ''}`} style={boardStyle}>
                <div className={st.boardIn}>
                  {readyPhotoUrl && <img src={readyPhotoUrl} alt="Photo Mystère" className={st.photo} />}
                  <div className={st.tiles} style={gridStyle}>
                    {tiles.map((tile) => (
                      <div key={tile.id} className={`${st.tile} ${tile.revealed ? st.gone : ''}`} />
                    ))}
                  </div>
                </div>
                <div className={st.frameShine} />
                {corner(st.tl)}{corner(st.tr)}{corner(st.bl)}{corner(st.br)}
              </div>
            </div>

            <div className={st.progress}>
              <i style={{ width: `${(revealedTiles.length / totalTiles) * 100}%` }} />
            </div>

            {/* QR : colonne réservée à droite, jamais sur le plateau */}
            <div className={`${st.qr} ${showQR ? '' : st.qrOff}`} aria-hidden={!showQR}>
              <div className={st.qrCode}>
                <QRCode value={getInviteUrl(session.code)} size={112} />
              </div>
              <div className={st.qrTxt}>
                <div className={st.qrNum}>#{session.code}</div>
                <div className={st.qrLbl}>Partagez<br />vos photos</div>
              </div>
            </div>

            {/* Rideau entre deux manches (opaque) */}
            <div className={`${st.overlay} ${showRoundTransition ? st.overlayOn : ''}`}>
              <div className={st.card}>
                <svg className={st.star} viewBox="0 0 100 100" aria-hidden="true">
                  <defs>
                    <linearGradient id="pmStar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#FFF3C0" /><stop offset=".5" stopColor="#F2B632" /><stop offset="1" stopColor="#A8680C" />
                    </linearGradient>
                  </defs>
                  <path d="M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36 Z" fill="url(#pmStar)" stroke="#5A3304" strokeWidth="2" />
                </svg>
                <h2><span className={st.tWhite}>Bien</span> <span className={st.tGold}>joué !</span></h2>
                <p>Préparez-vous pour la photo suivante</p>
              </div>
            </div>

            {/* Gagnant : même décor sur les deux étapes */}
            {showWinnerAnimation && (
              <div className={st.winner}>
                {decorLayers}
                <div className={st.boardZone}>
                  <div className={`${st.board} ${animationPhase === 3 ? st.boardOut : ''}`} style={boardStyle}>
                    <div className={st.boardIn}>
                      <img src={currentPhotoUrl} alt="Photo révélée" className={st.photo} />
                      <div className={st.wTiles} style={gridStyle}>
                        {Array.from({ length: totalTiles }, (_, index) => (
                          <div key={index} className={`${st.wTile} ${eatenTiles.includes(index) ? st.eaten : ''}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`${st.w3} ${animationPhase === 3 ? st.w3On : ''}`}>
                  <div className={st.veil} />
                  <div className={st.burst} />
                  <div className={st.rays} />
                  {animationPhase === 3 && CONFETTI.map((c) => (
                    <i
                      key={c.id}
                      className={st.conf}
                      style={{ left: `${c.left}%`, width: c.w, height: c.h, background: c.color, animationDuration: `${c.duration}s`, animationDelay: `${c.delay}s` }}
                    />
                  ))}
                  <div className={st.flash} />
                  <div className={st.center}>
                    <div className={st.kick}>★<i>PHOTO MYSTÈRE</i>★</div>
                    <h1 className={`${st.wtxt} ${st.wBig}`} data-t="WINNER"><span data-t="WINNER">WINNER</span></h1>
                    <p className={`${st.wtxt} ${st.wSub}`} data-t="FÉLICITATIONS !"><span data-t="FÉLICITATIONS !">FÉLICITATIONS !</span></p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hidden audio elements */}
      {/* Per-photo audio (plays when photo is fully revealed) */}
      {currentAudioUrl && (
        <audio
          ref={photoAudioRef}
          src={currentAudioUrl}
          onEnded={() => setIsPhotoAudioPlaying(false)}
          onPlay={() => setIsPhotoAudioPlaying(true)}
          onPause={() => setIsPhotoAudioPlaying(false)}
        />
      )}
      {/* Global reveal audio (plays during tile removal) */}
      {revealAudioUrl && (
        <audio
          ref={revealAudioRef}
          src={revealAudioUrl}
          onEnded={() => setIsRevealAudioPlaying(false)}
          onPlay={() => setIsRevealAudioPlaying(true)}
          onPause={() => setIsRevealAudioPlaying(false)}
        />
      )}
    </div>
  )
}
