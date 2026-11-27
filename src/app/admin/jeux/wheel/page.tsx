'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import localFont from 'next/font/local'
import {
  ArrowLeft,
  Loader2,
  Monitor,
  FileText,
  X,
  Plus,
  Trash2,
  History,
  Music,
  Volume2,
  VolumeX,
  Upload,
  Play,
  Pause,
  Square,
  Timer,
  Hand,
  FerrisWheel,
  Rocket,
  Trophy,
  Shuffle,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { sendDeactivateBeacon } from '@/lib/games/deactivate-beacon'
import { fetchUserSession } from '@/lib/session-select'
import { Session, WheelSegment, WheelResult, WheelAudioSettings, WheelDrawOrder } from '@/types/database'
import { toast } from 'sonner'
import { compressAudio, needsAudioCompression } from '@/lib/audio-utils'
import WheelPreview from '@/components/games/WheelPreview'
import RemoteControlBadge from '@/components/games/RemoteControlBadge'
import type { RemoteLegendData } from '@/components/games/RemoteLegend'
import { useRemoteControl, useRemoteSwitch } from '@/hooks/useRemoteControl'
import { useLeaveGuard } from '@/hooks/useLeaveGuard'
import rg from './regie.module.css'

// Titre façon carte du jeu (même police que la régie du Bon Ordre)
const cardFont = localFont({ src: './fonts/Anton-Regular.ttf', display: 'swap' })
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// Default segments
const DEFAULT_SEGMENTS: WheelSegment[] = [
  { id: '1', text: 'Chante une chanson', color: '#D4AF37' },
  { id: '2', text: 'Fais 10 pompes', color: '#C0392B' },
  { id: '3', text: 'Imite un animal', color: '#27AE60' },
  { id: '4', text: 'Offre un verre', color: '#2980B9' },
  { id: '5', text: 'Raconte une blague', color: '#8E44AD' },
  { id: '6', text: 'Danse 30 secondes', color: '#F39C12' },
]

// Color palette
const COLORS = [
  '#D4AF37', '#C0392B', '#27AE60', '#2980B9', '#8E44AD', '#F39C12',
  '#1ABC9C', '#E74C3C', '#3498DB', '#9B59B6', '#E67E22', '#16A085',
]

// Mode "ordre prédéfini" — valeur absente/illisible = mode aléatoire
const DEFAULT_DRAW_ORDER: WheelDrawOrder = { enabled: false, order: [] }

function parseDrawOrder(raw: string | null | undefined): WheelDrawOrder {
  if (!raw) return DEFAULT_DRAW_ORDER
  try {
    const parsed = JSON.parse(raw)
    if (parsed && parsed.enabled === true && Array.isArray(parsed.order)) {
      return { enabled: true, order: parsed.order.filter((id: unknown): id is string => typeof id === 'string') }
    }
  } catch { /* JSON invalide → aléatoire */ }
  return DEFAULT_DRAW_ORDER
}

// Ordre effectif : ids de l'ordre qui existent encore, puis segments non classés (ordre de la liste)
function effectiveOrder(order: string[], segs: WheelSegment[]): WheelSegment[] {
  const byId = new Map(segs.map(s => [s.id, s]))
  const seen = new Set<string>()
  const ranked: WheelSegment[] = []
  for (const id of order) {
    const seg = byId.get(id)
    if (seg && !seen.has(id)) { seen.add(id); ranked.push(seg) }
  }
  return [...ranked, ...segs.filter(s => !seen.has(s.id))]
}

export default function WheelPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)

  // Configuration
  const [segments, setSegments] = useState<WheelSegment[]>(DEFAULT_SEGMENTS)
  const [newSegmentText, setNewSegmentText] = useState('')

  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [history, setHistory] = useState<WheelResult[]>([])
  const [spinMode, setSpinMode] = useState<'auto' | 'manual'>('auto')
  const [drawOrder, setDrawOrder] = useState<WheelDrawOrder>(DEFAULT_DRAW_ORDER)
  const pendingResultRef = useRef<{ segment: WheelSegment; index: number } | null>(null)
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const phase2TimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const finishSpinInProgressRef = useRef(false)

  // Audio state
  const [audioSettings, setAudioSettings] = useState<WheelAudioSettings>({
    url: null,
    enabled: true,
    filename: null,
  })
  const [audioUploading, setAudioUploading] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    fetchSession()
  }, [])

  // Setup broadcast channel
  useEffect(() => {
    if (!session) return

    const channel = supabase.channel(`wheel-game-${session.code}`)
    broadcastChannelRef.current = channel
    channel.subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.code, supabase])

  // Cleanup: désactiver la roue quand l'admin quitte la page
  useEffect(() => {
    if (!session?.id) return

    const cleanup = () => {
      // Broadcast que le jeu n'est plus actif
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event: 'wheel_state',
          payload: {
            gameActive: false,
            segments: [],
            isSpinning: false,
            result: null,
          },
        })
      }
      // sendBeacon survit à la fermeture de l'onglet ; un fetch await ici est
      // souvent tué en vol → wheel_active resterait bloqué à true en base.
      if (!sendDeactivateBeacon(session.id, 'wheel')) {
        void supabase.from('sessions').update({ wheel_active: false }).eq('id', session.id).then(() => {})
      }
    }

    // pagehide (pas beforeunload) : ne part que si la page part vraiment,
    // après un éventuel « Annuler » sur la boîte de useLeaveGuard.
    window.addEventListener('pagehide', cleanup)

    return () => {
      if (spinTimeoutRef.current) { clearTimeout(spinTimeoutRef.current); spinTimeoutRef.current = null }
      if (phase2TimeoutRef.current) { clearTimeout(phase2TimeoutRef.current); phase2TimeoutRef.current = null }
      window.removeEventListener('pagehide', cleanup)
      cleanup()
    }
  }, [session?.id, supabase])

  // Calculer les segments utilisés à partir de l'historique
  const usedSegmentIds = useMemo(() => {
    return history.map(h => h.segmentId)
  }, [history])

  // Segments disponibles (non utilisés)
  const availableSegments = useMemo(() => {
    return segments.filter(s => !usedSegmentIds.includes(s.id))
  }, [segments, usedSegmentIds])

  // Vue de contrôle en partie : numéros fixes (position dans la liste, comme
  // l'écran géant) et cases visibles là-bas (la case tirée y reste tant que le
  // résultat est affiché).
  const wheelNumbers = useMemo(() => new Map(segments.map((s, i) => [s.id, i + 1])), [segments])
  const lastDrawnId = history[0]?.segmentId ?? null
  const screenSegments = useMemo(() => {
    return segments.filter(s => !usedSegmentIds.includes(s.id) || (result !== null && s.id === lastDrawnId))
  }, [segments, usedSegmentIds, result, lastDrawnId])

  // Jeu terminé quand tous les segments sont utilisés
  const isGameFinished = useMemo(() => {
    return gameActive && availableSegments.length === 0
  }, [gameActive, availableSegments.length])

  // Broadcast game state
  const broadcastGameState = useCallback((state: {
    gameActive: boolean
    segments: WheelSegment[]
    isSpinning: boolean
    result: string | null
    spinToIndex?: number
    usedSegmentIds?: string[]
    isGameFinished?: boolean
    audioSettings?: WheelAudioSettings
    spinMode?: 'auto' | 'manual'
  }) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'wheel_state',
        payload: state,
      })
    }
  }, [])

  async function fetchSession() {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const data = await fetchUserSession(supabase, user.id, searchParams.get('session'))
      setSession(data)

      // Charger les segments depuis la DB (même si le jeu n'est pas actif)
      if (data.wheel_segments) {
        try {
          setSegments(JSON.parse(data.wheel_segments))
        } catch {
          setSegments(DEFAULT_SEGMENTS)
        }
      }

      setDrawOrder(parseDrawOrder(data.wheel_draw_order))

      // Charger les paramètres audio
      if (data.wheel_audio) {
        try {
          setAudioSettings(JSON.parse(data.wheel_audio))
        } catch {
          // Keep default
        }
      }

      // Initialize game state from session si le jeu est actif
      if (data.wheel_active) {
        setGameActive(true)
        setResult(data.wheel_result ?? null)
        if (data.wheel_history) {
          try {
            setHistory(JSON.parse(data.wheel_history))
          } catch {
            setHistory([])
          }
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err)
      toast.error('Erreur lors du chargement de la session')
    } finally {
      setLoading(false)
    }
  }

  // Sauvegarder les segments dans la DB
  async function saveSegmentsToDatabase(updatedSegments: WheelSegment[]) {
    if (!session) return
    await supabase
      .from('sessions')
      .update({ wheel_segments: JSON.stringify(updatedSegments) })
      .eq('id', session.id)
  }

  // Mode/ordre : enregistrés en base immédiatement (la base fait foi au tirage)
  async function saveDrawOrder(next: WheelDrawOrder) {
    if (!session) return
    setDrawOrder(next)
    const { error } = await supabase
      .from('sessions')
      .update({ wheel_draw_order: JSON.stringify(next) })
      .eq('id', session.id)
    if (error) toast.error("Erreur d'enregistrement de l'ordre")
  }

  function toggleDrawOrder() {
    if (isSpinning) return
    if (drawOrder.enabled) {
      saveDrawOrder({ ...drawOrder, enabled: false })
    } else {
      saveDrawOrder({ enabled: true, order: effectiveOrder(drawOrder.order, segments).map(s => s.id) })
    }
  }

  function moveInDrawOrder(segmentId: string, direction: -1 | 1) {
    if (isSpinning) return
    const ids = effectiveOrder(drawOrder.order, segments).map(s => s.id)
    const from = ids.indexOf(segmentId)
    // Les segments déjà tirés ne sont pas affichés : on saute vers le voisin visible
    const availableIds = new Set(availableSegments.map(s => s.id))
    let to = from + direction
    while (to >= 0 && to < ids.length && !availableIds.has(ids[to])) to += direction
    if (from < 0 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    saveDrawOrder({ enabled: true, order: ids })
  }

  function shuffleDrawOrder() {
    if (isSpinning) return
    const ids = availableSegments.map(s => s.id)
    const listOrder = ids.join('|')
    let shuffled = [...ids]
    for (let attempt = 0; attempt < 10; attempt++) {
      shuffled = [...ids]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      if (ids.length < 2 || shuffled.join('|') !== listOrder) break
    }
    // Les cases déjà tirées restent à la fin (elles ne sortent plus).
    const used = effectiveOrder(drawOrder.order, segments).map(seg => seg.id).filter(id => !ids.includes(id))
    saveDrawOrder({ enabled: true, order: [...shuffled, ...used] })
  }

  function renderDrawOrderCard() {
    const list = effectiveOrder(drawOrder.order, segments).filter(s => availableSegments.some(a => a.id === s.id))
    // Numéro fixe de chaque case sur la roue (position dans la liste complète, comme sur l'écran géant).
    const wheelNumber = (id: string) => segments.findIndex(s => s.id === id) + 1
    const next = list[0]
    // Ordre resté celui de la liste : chaque tirage prend la 1re case restante,
    // la roue s'arrête donc toujours au même endroit (cases 1, 2, 3… dans l'ordre).
    const followsList = list.length > 1 && list.every((seg, i) => seg.id === availableSegments[i]?.id)
    return (
      <div className={rg.box}>
        <div className={rg.lab}>
          <Shuffle />Ordre de sortie
          <button
            onClick={toggleDrawOrder}
            disabled={isSpinning}
            role="switch"
            aria-checked={drawOrder.enabled}
            aria-label={drawOrder.enabled ? 'Ordre prédéfini : ON' : 'Ordre prédéfini : OFF'}
            title={drawOrder.enabled ? 'Ordre prédéfini : ON' : 'Ordre prédéfini : OFF'}
            className={cx(rg.toggle, drawOrder.enabled && rg.toggleOn, rg.labEnd)}
          />
        </div>
        <p className={rg.orderTxt}>
          {drawOrder.enabled ? 'Ordre prédéfini : la roue s’arrête dans cet ordre' : 'Mode aléatoire (par défaut)'}
        </p>
        {drawOrder.enabled && next && (
          <>
            <p className={rg.next} data-testid="next-segment">
              Prochaine case : <b>{next.text}</b>
              <small> (case n°{wheelNumber(next.id)} sur la roue)</small>
            </p>
            {followsList && (
              <p role="alert" className={rg.warn}>
                L’ordre suit encore la liste (cases 1, 2, 3… dans l’ordre) : la roue s’arrêtera toujours au même endroit. Réglez-le avec ▲▼ ou mélangez-le.
              </p>
            )}
            <button onClick={shuffleDrawOrder} disabled={isSpinning || list.length < 2} className={rg.shuffle}>
              <Shuffle />Mélanger l’ordre
            </button>
          </>
        )}
        {drawOrder.enabled && (
          <ul className={cx(rg.list, rg.listOrder)}>
            {list.map((segment, i) => (
              <li key={segment.id}>
                <span className={rg.r}>{i + 1}.</span>
                <span className={cx(rg.n, rg.nSm)} style={{ backgroundColor: segment.color }}>{wheelNumber(segment.id)}</span>
                <span className={rg.tx}>{segment.text}</span>
                <span className={rg.c}>case n°{wheelNumber(segment.id)}</span>
                <button
                  onClick={() => moveInDrawOrder(segment.id, -1)}
                  disabled={i === 0 || isSpinning}
                  aria-label="Monter"
                  className={rg.ib}
                ><ChevronUp /></button>
                <button
                  onClick={() => moveInDrawOrder(segment.id, 1)}
                  disabled={i === list.length - 1 || isSpinning}
                  aria-label="Descendre"
                  className={rg.ib}
                ><ChevronDown /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  function addSegment() {
    if (!newSegmentText.trim()) return
    if (segments.length >= 20) {
      toast.error('Maximum 20 segments')
      return
    }

    const newSegment: WheelSegment = {
      id: Date.now().toString(),
      text: newSegmentText.trim(),
      color: COLORS[segments.length % COLORS.length],
    }
    const updatedSegments = [...segments, newSegment]
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
    setNewSegmentText('')
  }

  function removeSegment(id: string) {
    if (segments.length <= 2) {
      toast.error('Minimum 2 segments')
      return
    }
    const updatedSegments = segments.filter(s => s.id !== id)
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
  }

  function updateSegmentColor(id: string, color: string) {
    const updatedSegments = segments.map(s => s.id === id ? { ...s, color } : s)
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
  }

  function updateSegmentText(id: string, text: string) {
    const updatedSegments = segments.map(s => s.id === id ? { ...s, text } : s)
    setSegments(updatedSegments)
    saveSegmentsToDatabase(updatedSegments)
  }

  // Audio functions
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session) return

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez MP3, WAV ou OGG.')
      return
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50MB)')
      return
    }

    setAudioUploading(true)
    try {
      // Delete old audio if exists
      if (audioSettings.url) {
        const oldPath = audioSettings.url.split('/').pop()
        if (oldPath) {
          await supabase.storage
            .from('wheel-audio')
            .remove([`${session.id}/${oldPath}`])
        }
      }

      // Upload new audio (compressé après validation, avant l'upload)
      const fileToUpload = needsAudioCompression(file) ? await compressAudio(file) : file
      const fileExt = fileToUpload.name.split('.').pop()
      const fileName = `wheel-audio-${Date.now()}.${fileExt}`
      const filePath = `${session.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('wheel-audio')
        .upload(filePath, fileToUpload)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('wheel-audio')
        .getPublicUrl(filePath)

      // Update settings
      const newSettings: WheelAudioSettings = {
        url: publicUrl,
        enabled: true,
        filename: file.name,
        sfxEnabled: audioSettings.sfxEnabled,
      }
      setAudioSettings(newSettings)

      // Save to database
      await supabase
        .from('sessions')
        .update({ wheel_audio: JSON.stringify(newSettings) })
        .eq('id', session.id)

      toast.success('Musique uploadée!')
    } catch (err) {
      console.error('Error uploading audio:', err)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setAudioUploading(false)
      if (audioInputRef.current) {
        audioInputRef.current.value = ''
      }
    }
  }

  async function deleteAudio() {
    if (!session || !audioSettings.url) return

    try {
      // Extract path from URL
      const urlParts = audioSettings.url.split('/wheel-audio/')
      if (urlParts.length > 1) {
        await supabase.storage
          .from('wheel-audio')
          .remove([urlParts[1]])
      }

      // Update settings
      const newSettings: WheelAudioSettings = {
        url: null,
        enabled: false,
        filename: null,
        sfxEnabled: audioSettings.sfxEnabled,
      }
      setAudioSettings(newSettings)

      // Save to database
      await supabase
        .from('sessions')
        .update({ wheel_audio: JSON.stringify(newSettings) })
        .eq('id', session.id)

      // Stop preview if playing
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause()
        setIsPreviewPlaying(false)
      }

      toast.success('Musique supprimée')
    } catch (err) {
      console.error('Error deleting audio:', err)
      toast.error('Erreur lors de la suppression')
    }
  }

  async function toggleAudioEnabled() {
    if (!session) return

    const newSettings: WheelAudioSettings = {
      ...audioSettings,
      enabled: !audioSettings.enabled,
    }
    setAudioSettings(newSettings)

    await supabase
      .from('sessions')
      .update({ wheel_audio: JSON.stringify(newSettings) })
      .eq('id', session.id)
  }

  // Bruitages de l'écran public (absent = activés) : enregistrés avec la musique dans wheel_audio
  // et envoyés à l'écran entre deux tirages seulement (interrupteur bloqué pendant une rotation).
  async function toggleSfxEnabled() {
    if (!session || isSpinning) return

    const newSettings: WheelAudioSettings = {
      ...audioSettings,
      sfxEnabled: audioSettings.sfxEnabled === false,
    }
    setAudioSettings(newSettings)

    if (gameActive) {
      broadcastGameState({
        gameActive: true,
        segments,
        isSpinning: false,
        result,
        usedSegmentIds,
        isGameFinished,
        audioSettings: newSettings,
      })
    }

    await supabase
      .from('sessions')
      .update({ wheel_audio: JSON.stringify(newSettings) })
      .eq('id', session.id)
  }

  function toggleAudioPreview() {
    if (!audioPreviewRef.current || !audioSettings.url) return

    if (isPreviewPlaying) {
      audioPreviewRef.current.pause()
      setIsPreviewPlaying(false)
    } else {
      audioPreviewRef.current.play().catch(() => {})
      setIsPreviewPlaying(true)
    }
  }

  async function launchGame() {
    if (!session || segments.length < 2) {
      toast.error('Ajoutez au moins 2 segments')
      return
    }

    setLaunching(true)
    try {
      // Désactiver tous les autres jeux avant d'activer la roue
      const { error } = await supabase
        .from('sessions')
        .update({
          // Désactiver les autres jeux
          mystery_photo_active: false,
          lineup_active: false,
          // Activer la roue
          wheel_active: true,
          wheel_segments: JSON.stringify(segments),
          wheel_is_spinning: false,
          wheel_result: null,
          wheel_history: JSON.stringify([]),
        })
        .eq('id', session.id)

      if (error) throw error

      setGameActive(true)
      setIsSpinning(false)
      setResult(null)
      setHistory([])

      broadcastGameState({
        gameActive: true,
        segments,
        isSpinning: false,
        result: null,
        usedSegmentIds: [],
        isGameFinished: false,
        audioSettings,
      })

      toast.success('Jeu configuré!')
      window.open(`/live/${session.code}`, 'photojet-live')
    } catch (err) {
      console.error('Error launching game:', err)
      toast.error('Erreur lors du lancement')
    } finally {
      setLaunching(false)
    }
  }

  async function spinWheel() {
    if (!session || isSpinning || availableSegments.length === 0) return

    setIsSpinning(true)
    setResult(null)
    finishSpinInProgressRef.current = false

    // Choose random segment from AVAILABLE segments only
    let randomIndex = Math.floor(Math.random() * availableSegments.length)

    // Mode "ordre prédéfini" : relire mode + ordre en base (source de vérité,
    // pas le state local). Seul l'INDEX change — l'animation est strictement
    // la même qu'en mode aléatoire (WheelGame ne sait pas comment il est choisi).
    const { data: fresh, error: drawOrderError } = await supabase
      .from('sessions')
      .select('wheel_draw_order')
      .eq('id', session.id)
      .single()
    const drawCfg = drawOrderError ? drawOrder : parseDrawOrder(fresh?.wheel_draw_order)
    if (drawCfg.enabled) {
      const availableIds = new Set(availableSegments.map(s => s.id))
      const next = effectiveOrder(drawCfg.order, segments).find(s => availableIds.has(s.id))
      const nextIndex = next ? availableSegments.findIndex(s => s.id === next.id) : -1
      if (nextIndex >= 0) randomIndex = nextIndex
    }
    const selectedSegment = availableSegments[randomIndex]

    // Store pending result for manual mode
    pendingResultRef.current = { segment: selectedSegment, index: randomIndex }

    // Update DB
    await supabase
      .from('sessions')
      .update({
        wheel_is_spinning: true,
        wheel_result: null,
      })
      .eq('id', session.id)

    if (spinMode === 'auto') {
      // Phase 1 : rotation infinie (5s)
      broadcastGameState({
        gameActive: true, segments, isSpinning: true, result: null,
        spinToIndex: undefined, usedSegmentIds, isGameFinished: false,
        audioSettings, spinMode: 'auto',
      })

      // Phase 2 à 5s : décélération de 3s vers la cible
      phase2TimeoutRef.current = setTimeout(() => {
        broadcastGameState({
          gameActive: true, segments, isSpinning: true, result: null,
          spinToIndex: randomIndex, usedSegmentIds, isGameFinished: false,
          audioSettings, spinMode: 'auto',
        })
      }, 5000)

      // Fin à 8s (5s spin + 3s décel)
      spinTimeoutRef.current = setTimeout(() => {
        finishSpin(selectedSegment)
      }, 8000)
    } else {
      // Mode manuel : rotation infinie, attend stopWheel()
      broadcastGameState({
        gameActive: true, segments, isSpinning: true, result: null,
        spinToIndex: undefined, usedSegmentIds, isGameFinished: false,
        audioSettings, spinMode: 'manual',
      })
    }
  }

  async function stopWheel() {
    if (!session || !isSpinning || !pendingResultRef.current) return

    if (spinTimeoutRef.current) { clearTimeout(spinTimeoutRef.current); spinTimeoutRef.current = null }
    if (phase2TimeoutRef.current) { clearTimeout(phase2TimeoutRef.current); phase2TimeoutRef.current = null }

    const { segment: selectedSegment, index: randomIndex } = pendingResultRef.current
    pendingResultRef.current = null // garde anti double STOP : un 2e appel pendant la décélération sort au test ci-dessus

    // Broadcast the stop with target index so wheel animates to result
    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: true, // Still spinning, but now with target
      result: null,
      spinToIndex: randomIndex,
      usedSegmentIds,
      isGameFinished: false,
      audioSettings,
      spinMode: 'manual',
    })

    // Wait for the deceleration animation (3 seconds)
    setTimeout(() => {
      finishSpin(selectedSegment)
    }, 3000)
  }

  async function finishSpin(selectedSegment: WheelSegment) {
    if (!session || finishSpinInProgressRef.current) return
    finishSpinInProgressRef.current = true

    const newResult: WheelResult = {
      segmentId: selectedSegment.id,
      text: selectedSegment.text,
      timestamp: new Date().toISOString(),
    }
    const newHistory = [newResult, ...history].slice(0, 20) // Keep last 20
    const newUsedSegmentIds = [...usedSegmentIds, selectedSegment.id]
    const newAvailableCount = segments.length - newUsedSegmentIds.length
    const gameFinished = newAvailableCount === 0

    setIsSpinning(false)
    setResult(selectedSegment.text)
    setHistory(newHistory)
    pendingResultRef.current = null

    await supabase
      .from('sessions')
      .update({
        wheel_is_spinning: false,
        wheel_result: selectedSegment.text,
        wheel_history: JSON.stringify(newHistory),
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: false,
      result: selectedSegment.text,
      usedSegmentIds: newUsedSegmentIds,
      isGameFinished: gameFinished,
      audioSettings,
    })

    finishSpinInProgressRef.current = false
    toast.success(`Résultat: ${selectedSegment.text}`)

    if (gameFinished) {
      toast.success('🎉 Tous les segments ont été utilisés!', { duration: 5000 })
    }
  }

  async function clearResult() {
    if (!session) return

    setResult(null)

    await supabase
      .from('sessions')
      .update({ wheel_result: null })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: true,
      segments,
      isSpinning: false,
      result: null,
      usedSegmentIds,
      isGameFinished,
      audioSettings,
    })
  }

  async function exitGame() {
    if (!session) return

    // On garde les segments dans la DB, on reset juste l'état du jeu
    setGameActive(false)
    setIsSpinning(false)
    setResult(null)
    setHistory([])
    // Ne pas reset à DEFAULT_SEGMENTS - garder la configuration

    await supabase
      .from('sessions')
      .update({
        wheel_active: false,
        // On garde wheel_segments intact !
        wheel_is_spinning: false,
        wheel_result: null,
        wheel_history: JSON.stringify([]),
      })
      .eq('id', session.id)

    broadcastGameState({
      gameActive: false,
      segments: [],
      isSpinning: false,
      result: null,
    })

    toast.success('Jeu arrêté - Configuration conservée')
    router.push(`/admin/jeux?session=${session.id}`)
  }

  // Fonction pour supprimer toutes les données
  async function clearAllData() {
    if (!session) return

    if (!window.confirm('Supprimer tous les segments ? Cette action est irréversible.')) {
      return
    }

    await supabase
      .from('sessions')
      .update({
        wheel_active: false,
        wheel_segments: null,
        wheel_is_spinning: false,
        wheel_result: null,
        wheel_history: null,
      })
      .eq('id', session.id)

    setGameActive(false)
    setSegments(DEFAULT_SEGMENTS)
    setHistory([])

    toast.success('Toutes les données ont été supprimées')
  }

  // Télécommande de présentation : PageDown = tourner / STOP (manuel), PageUp = masquer le résultat.
  // Actifs uniquement partie lancée, non terminée, interrupteur ON. Mêmes handlers que les boutons.
  // Partie affichée : confirmation avant rechargement (F5) ou fermeture.
  useLeaveGuard(gameActive)

  const [remoteOn, setRemoteOn] = useRemoteSwitch()
  // Une seule décision : exécutée par la touche ET affichée par la légende.
  const remoteActive = gameActive && remoteOn && !isGameFinished
  const wheelNext: 'spin' | 'stop' | null = !isSpinning ? 'spin' : spinMode === 'manual' ? 'stop' : null
  const wheelPrev: 'clear' | null = result && !isSpinning ? 'clear' : null
  useRemoteControl({
    active: remoteActive,
    phase: `${isSpinning}|${spinMode}|${result ?? ''}`,
    onNext: () => {
      if (wheelNext === 'spin') { void spinWheel(); return spinMode === 'auto' ? 8500 : 0 }
      if (wheelNext === 'stop') { void stopWheel(); return 3500 }
    },
    onPrev: () => {
      if (wheelPrev === 'clear') void clearResult()
    },
  })
  const remoteLegend: RemoteLegendData = {
    active: remoteActive,
    inactiveReason: isGameFinished ? 'Partie terminée : télécommande coupée.' : undefined,
    next: wheelNext === 'spin' ? 'faire tourner la roue' : wheelNext === 'stop' ? 'arrêter la roue (STOP)' : null,
    prev: wheelPrev === 'clear' ? 'masquer le résultat' : null,
  }

  if (loading) {
    return (
      <div className={`${rg.page} ${rg.center}`}>
        <Loader2 className={rg.spin} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className={`${rg.page} ${rg.center}`}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>Aucune session trouvée</p>
          <button className={rg.btn} onClick={() => router.push('/admin/dashboard')}>
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  // Habillage « régie » AnimaJet 2.0 (maquette validée le 27/11/2026, calquée sur la régie du Bon Ordre) — handlers et états inchangés.
  const sfxOn = audioSettings.sfxEnabled !== false
  const sfxRow = (
    <div className={rg.aud}>
      <p>{sfxOn ? <Sparkles /> : <VolumeX />}Bruitages du jeu <small className={rg.sub}>lancement, roulement, clacs, arrêt, fanfare</small></p>
      <button
        onClick={toggleSfxEnabled}
        disabled={isSpinning}
        role="switch"
        aria-checked={sfxOn}
        aria-label="Bruitages du jeu"
        className={cx(rg.toggle, sfxOn && rg.toggleOn)}
      />
    </div>
  )

  return (
    <div className={rg.page}>
      <div className={rg.wrap}>
        {/* En-tête */}
        <header className={rg.top}>
          <button className={rg.btn} onClick={() => router.push(`/admin/jeux?session=${session.id}`)}>
            <ArrowLeft />
            Retour
          </button>
          <div className={rg.vsep} />
          <div className={rg.ttl}>
            <div className={rg.thumb}><Image src="/images/games/roue-de-la-destinee-v2.png" alt="" fill sizes="100px" /></div>
            <div>
              <h1 className={`${rg.cardTitle} ${cardFont.className}`} data-t="ROUE DE LA DESTINÉE"><span>ROUE DE LA DESTINÉE</span></h1>
              <small>{session.name}</small>
            </div>
          </div>
          <div className={rg.grow} />
          <RemoteControlBadge enabled={remoteOn} onToggle={setRemoteOn} gameActive={gameActive} finished={isGameFinished} legend={remoteLegend} />
          <div className={rg.vsep} />
          <a href="/roue-de-la-destinee-regles.pdf" target="_blank" rel="noopener noreferrer" className={cx(rg.btn, rg.btnGold)}>
            <FileText />
            Notice
          </a>
          <button onClick={clearAllData} className={cx(rg.btn, rg.red)} title="Supprimer tous les segments">
            <Trash2 />
            Tout vider
          </button>
          {gameActive && (
            <button onClick={() => window.open(`/live/${session.code}`, 'photojet-live')} className={cx(rg.btn, rg.btnViolet)}>
              <Monitor />
              Voir le diaporama
            </button>
          )}
        </header>

        {!gameActive ? (
          /* Configuration */
          <section className={cx(rg.panel, rg.cfgPanel)}>
            <div className={rg.head}>
              <div className={`${rg.thumb} ${rg.thumbBig}`}><Image src="/images/games/roue-de-la-destinee-v2.png" alt="Roue de la Destinée" fill sizes="200px" priority /></div>
              <div>
                <h2 className={`${rg.cardTitle} ${cardFont.className}`} data-t="ROUE DE LA DESTINÉE"><span>ROUE DE LA DESTINÉE</span></h2>
                <p>Tournez la roue et découvrez votre défi</p>
              </div>
            </div>

            <div className={rg.cols}>
              <div className={rg.stack}>
                {/* Segments */}
                <div className={rg.box}>
                  <div className={rg.lab}><FerrisWheel />Défis de la roue<span className={rg.nb}>{segments.length}/20</span></div>
                  <div className={rg.add}>
                    <input
                      value={newSegmentText}
                      onChange={(e) => setNewSegmentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSegment()}
                      placeholder="Nouveau défi..."
                      className={rg.txt}
                    />
                    <button onClick={addSegment} disabled={segments.length >= 20} className={rg.addBtn} aria-label="Ajouter">
                      <Plus />
                    </button>
                  </div>
                  <ul className={cx(rg.list, rg.listSegs)}>
                    {segments.map((segment, index) => (
                      <li key={segment.id}>
                        <span className={rg.n} style={{ backgroundColor: segment.color }} title="Couleur de la case">
                          {index + 1}
                          <input
                            type="color"
                            value={segment.color}
                            onChange={(e) => updateSegmentColor(segment.id, e.target.value)}
                            aria-label="Couleur de la case"
                          />
                        </span>
                        <input
                          value={segment.text}
                          onChange={(e) => updateSegmentText(segment.id, e.target.value)}
                          className={rg.tx}
                        />
                        <button onClick={() => removeSegment(segment.id)} className={cx(rg.ib, rg.ibDel)} aria-label="Supprimer">
                          <Trash2 />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className={rg.hint}>2 défis minimum, 20 maximum · la pastille règle la couleur</div>
                </div>
              </div>

              <div className={rg.stack}>
                {/* Ordre de sortie (mode aléatoire par défaut) */}
                {renderDrawOrderCard()}

                {/* Musique + bruitages */}
                <div className={rg.music}>
                  <div className={rg.eq}>{[30, 44, 22, 50, 36, 26, 46, 32].map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * 0.12}s` }} />)}</div>
                  <div className={rg.mRow}>
                    <div className={rg.mi}><Music /></div>
                    <div><h3>Musique de la roue</h3><small>Son pendant la rotation</small></div>
                  </div>

                  {!audioSettings.url ? (
                    <label className={rg.drop}>
                      {audioUploading ? <Loader2 className={rg.spin} /> : <><Upload />Uploader (MP3, WAV, OGG)</>}
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/ogg,audio/mp3"
                        onChange={handleAudioUpload}
                        className="hidden"
                        disabled={audioUploading}
                      />
                    </label>
                  ) : (
                    <>
                      <div className={rg.aud}>
                        <p><Music />{audioSettings.filename || 'Fichier audio'}</p>
                        <button onClick={toggleAudioPreview} className={cx(rg.iconBtn, rg.iconPlay)} aria-label={isPreviewPlaying ? 'Pause' : 'Écouter'}>
                          {isPreviewPlaying ? <Pause /> : <Play />}
                        </button>
                        <button onClick={deleteAudio} className={cx(rg.iconBtn, rg.iconDel)} aria-label="Supprimer la musique">
                          <Trash2 />
                        </button>
                      </div>
                      <div className={rg.aud}>
                        <p>{audioSettings.enabled ? <Volume2 /> : <VolumeX />}Son activé</p>
                        <button
                          onClick={toggleAudioEnabled}
                          role="switch"
                          aria-checked={audioSettings.enabled}
                          aria-label="Son activé"
                          className={cx(rg.toggle, audioSettings.enabled && rg.toggleOn)}
                        />
                      </div>
                    </>
                  )}
                  {sfxRow}

                  {audioSettings.url && (
                    <audio
                      ref={audioPreviewRef}
                      src={audioSettings.url}
                      onEnded={() => setIsPreviewPlaying(false)}
                    />
                  )}
                </div>

                {/* Prévisualisation */}
                <div className={rg.box}>
                  <div className={rg.lab}><Monitor />Prévisualisation</div>
                  <div className={rg.preview}>
                    <WheelPreview segments={segments} size={280} />
                    <p>La roue se met à jour en temps réel</p>
                  </div>
                </div>
              </div>
            </div>

            <button onClick={launchGame} disabled={launching || segments.length < 2} className={cx(rg.cta, rg.launchCta)}>
              {launching ? <Loader2 className={rg.spin} /> : <><Rocket />Configurer et ouvrir le diaporama</>}
            </button>
          </section>
        ) : (
          /* Partie en cours : commandes à gauche, vue de l'écran géant à droite */
          <section className={rg.panel}>
            <div className={rg.status}>
              <div className={rg.st}>
                <span className={cx(rg.dot, isGameFinished ? rg.dotEnd : isSpinning ? rg.dotRun : result ? rg.dotPause : null)} />
                {isGameFinished ? 'Jeu terminé !' : isSpinning ? 'Rotation...' : result ? 'Résultat affiché' : 'Prêt'}
              </div>
              <div className={rg.stRight}>
                <span className={rg.kbd}>{availableSegments.length}/{segments.length} restants</span>
                <button
                  onClick={toggleSfxEnabled}
                  disabled={isSpinning}
                  className={cx(rg.fxBtn, sfxOn && rg.fxOn)}
                  title="Bruitages de l'écran public (la musique n'est pas concernée)"
                >
                  {sfxOn ? <Volume2 /> : <VolumeX />}
                  Bruitages {sfxOn ? 'activés' : 'coupés'}
                </button>
              </div>
            </div>

            <div className={rg.playCols}>
              <div className={rg.stack}>
                {/* Mode */}
                <div className={rg.modes}>
                  <button onClick={() => setSpinMode('auto')} disabled={isSpinning} className={spinMode === 'auto' ? rg.on : undefined}>
                    <Timer />Auto (8s)
                  </button>
                  <button onClick={() => setSpinMode('manual')} disabled={isSpinning} className={spinMode === 'manual' ? rg.on : undefined}>
                    <Hand />Manuel
                  </button>
                </div>

                {/* Résultat */}
                {result && (
                  <div className={rg.res}>
                    <small className={rg.resLab}>Résultat</small>
                    {lastDrawnId && wheelNumbers.get(lastDrawnId) && (
                      <span className={rg.rn} style={{ backgroundColor: segments.find(s => s.id === lastDrawnId)?.color }}>{wheelNumbers.get(lastDrawnId)}</span>
                    )}
                    <p className={rg.resTxt}>{result}</p>
                  </div>
                )}

                {/* Tourner / STOP */}
                {!isSpinning ? (
                  <button onClick={spinWheel} disabled={isGameFinished} className={cx(rg.big, isGameFinished ? rg.done : cx(rg.gd, rg.spinBtn))}>
                    {isGameFinished ? <><Trophy />Tous les segments utilisés !</> : <><FerrisWheel />FAIRE TOURNER {spinMode === 'manual' ? '(Manuel)' : ''}</>}
                  </button>
                ) : spinMode === 'manual' ? (
                  <button onClick={stopWheel} className={cx(rg.big, rg.stop)}>
                    <Square />
                    STOP !
                  </button>
                ) : (
                  <button disabled className={cx(rg.big, rg.wait)}>
                    <Loader2 />
                    Rotation en cours...
                  </button>
                )}

                {result && !isSpinning && (
                  <button onClick={clearResult} className={cx(rg.big, rg.sk)}>
                    Masquer le résultat
                  </button>
                )}

                {/* Ordre de sortie — modifiable entre deux tirages */}
                {renderDrawOrderCard()}

                {/* Historique */}
                {history.length > 0 && (
                  <div className={rg.box}>
                    <div className={rg.lab}><History />Historique</div>
                    <ul className={cx(rg.list, rg.hist)}>
                      {history.slice(0, 5).map((item, index) => (
                        <li key={index}>
                          <span className={rg.r}>{index + 1}.</span>
                          <span className={rg.tx}>{item.text}</span>
                          {wheelNumbers.get(item.segmentId) && <span className={rg.c}>case n°{wheelNumbers.get(item.segmentId)}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button onClick={exitGame} className={cx(rg.big, rg.q)} style={{ marginTop: 0 }}>
                  <X />
                  Quitter le jeu
                </button>
              </div>

              {/* Les cases telles qu'elles sont sur l'écran géant (numéros fixes) */}
              <div className={cx(rg.box, rg.giant)} data-testid="wheel-live-view">
                <h3><Monitor />Sur l’écran géant</h3>
                <p className={rg.giantSub}>
                  {result ? 'Case tirée en surbrillance' : `${availableSegments.length} case${availableSegments.length > 1 ? 's' : ''} encore sur la roue`}
                </p>
                <div className={rg.preview}>
                  {screenSegments.length >= 2 ? (
                    <WheelPreview segments={screenSegments} size={280} numberOf={wheelNumbers} still highlightId={result ? lastDrawnId : null} />
                  ) : (
                    <p className={rg.last}>
                      {screenSegments.length === 1 ? `Dernière case : n°${wheelNumbers.get(screenSegments[0].id)}` : 'Toutes les cases ont été tirées'}
                    </p>
                  )}
                </div>
                {availableSegments.length > 0 && (
                  <>
                    <div className={cx(rg.lab, rg.restLab)}>Cases restantes</div>
                    <ul className={rg.list}>
                      {availableSegments.map(s => (
                        <li key={s.id}>
                          <span className={cx(rg.n, rg.nSm)} style={{ backgroundColor: s.color }}>{wheelNumbers.get(s.id)}</span>
                          <span className={rg.tx}>{s.text}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
