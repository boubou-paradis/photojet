// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Voix d'AnimaBingo, jouée UNIQUEMENT sur le PC de l'animateur (régie).
// Une seule voix pour tout le jeu : « Claire » (ElevenLabs), enregistrée :
//   numéros  : /sounds/bingo/voix-claire/01…90.mp3
//   annonces : /sounds/bingo/voix-claire/annonces/<id>.mp3 (départ, vérification,
//              gagnant, fausse alerte, phase suivante, fin)
//   bruitages : /sounds/bingo/bruitages/<id>.mp3 (ElevenLabs, effets sonores),
//              joués juste avant l'annonce qu'ils accompagnent. Un bruitage qui
//              ne se charge pas est simplement sauté (la voix passe quand même).
// Tout est chargé d'avance. Les sons passent dans une file : une annonce ne
// coupe jamais un numéro. Si un fichier ne se charge pas ou ne se joue pas :
// voix du navigateur en français (secours), même texte.
// Chaque boule est annoncée au moment où elle apparaît à l'écran (revealAt,
// heure du serveur). Après un rechargement, rien n'est rejoué.

import { useCallback, useEffect, useRef } from 'react'
import { inWords, currentPhase } from '@/lib/bingo/display'
import type { BingoPublicState, Phase } from '@/lib/bingo/types'

/** Annonces enregistrées et leur texte (identique à l'enregistrement, sert aussi de secours). */
export const ANNOUNCEMENTS = {
  'debut': 'C’est parti !',
  'verif-quine': 'Une quine est annoncée ! On vérifie…',
  'verif-double': 'Une double quine est annoncée ! On vérifie…',
  'verif-plein': 'Carton plein annoncé ! On vérifie…',
  'gagne-1': 'Et c’est gagné ! Bravo !',
  'gagne-n': 'Et c’est gagné ! Bravo à nos gagnants !',
  'refus': 'Fausse alerte… On continue !',
  'phase-quine': 'On joue maintenant pour la quine !',
  'phase-double': 'On joue maintenant pour la double quine !',
  'phase-plein': 'On joue maintenant pour le carton plein !',
  'fin': 'La partie est terminée. Merci à tous !',
} as const
export type AnnouncementId = keyof typeof ANNOUNCEMENTS

const VERIF: Record<Phase, AnnouncementId> = { quine: 'verif-quine', double: 'verif-double', plein: 'verif-plein' }
const PHASE: Record<Phase, AnnouncementId> = { quine: 'phase-quine', double: 'phase-double', plein: 'phase-plein' }

/** Bruitages (ElevenLabs), même niveau sonore que la voix, 4 s au plus. */
export const SOUND_EFFECTS = ['debut', 'boule', 'alerte', 'gagne', 'refus', 'phase', 'fin'] as const
export type SoundEffectId = (typeof SOUND_EFFECTS)[number]
export const soundEffectFile = (id: SoundEffectId) => `/sounds/bingo/bruitages/${id}.mp3`

/** Bruitage joué avant chaque annonce. */
const EFFECT_OF: Record<AnnouncementId, SoundEffectId> = {
  'debut': 'debut',
  'verif-quine': 'alerte', 'verif-double': 'alerte', 'verif-plein': 'alerte',
  'gagne-1': 'gagne', 'gagne-n': 'gagne',
  'refus': 'refus',
  'phase-quine': 'phase', 'phase-double': 'phase', 'phase-plein': 'phase',
  'fin': 'fin',
}
/** Le bruit de la boule part un peu avant : le numéro tombe pile quand la boule apparaît. */
const BALL_LEAD_MS = 900

export const voiceFile = (n: number) => `/sounds/bingo/voix-claire/${String(n).padStart(2, '0')}.mp3`
export const announcementFile = (id: AnnouncementId) => `/sounds/bingo/voix-claire/annonces/${id}.mp3`

/** Au-delà, les sons en retard sont abandonnés (on ne rattrape pas une file de 10 annonces). */
const MAX_QUEUE = 6

/** `text` vide = bruitage : jamais de voix de secours, sauté s'il manque. */
type Clip = { key: string; text: string }

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'))
  const prefer = ['google français', 'amélie', 'audrey', 'marie', 'thomas', 'microsoft denise', 'microsoft julie', 'microsoft hortense']
  for (const name of prefer) {
    const v = voices.find((x) => x.name.toLowerCase().includes(name))
    if (v) return v
  }
  return voices.find((v) => v.lang.toLowerCase() === 'fr-fr') ?? voices[0] ?? null
}

type VoicePlayer = { enqueue: (clip: Clip) => void; clear: () => void; stop: () => void }

/** Lecteur à file : les 90 numéros et les annonces chargés une fois, un son à la fois. */
function createVoicePlayer(): VoicePlayer {
  const audio = new Map<string, HTMLAudioElement>()
  const broken = new Set<string>()
  let queue: Clip[] = []
  let playing = false
  // Change à chaque arrêt : la fin d'un son coupé ne relance jamais la file.
  let gen = 0
  const load = (key: string, src: string) => {
    const a = new Audio(src)
    a.preload = 'auto'
    a.addEventListener('error', () => broken.add(key))
    audio.set(key, a)
  }
  for (let n = 1; n <= 90; n++) load(String(n), voiceFile(n))
  for (const id of Object.keys(ANNOUNCEMENTS) as AnnouncementId[]) load(id, announcementFile(id))
  for (const id of SOUND_EFFECTS) load(`sfx:${id}`, soundEffectFile(id))

  function next() {
    const clip = queue.shift()
    if (!clip) {
      playing = false
      return
    }
    playing = true
    let done = false
    const mine = gen
    const finish = () => {
      if (done || mine !== gen) return
      done = true
      next()
    }
    const speak = () => {
      // Secours : voix du navigateur, même texte (un bruitage manquant est sauté).
      if (!clip.text) return finish()
      try {
        const synth = window.speechSynthesis
        if (!synth) return finish()
        const u = new SpeechSynthesisUtterance(clip.text)
        u.lang = 'fr-FR'
        u.rate = 0.92
        const voice = pickVoice()
        if (voice) u.voice = voice
        u.onend = finish
        u.onerror = finish
        synth.speak(u)
        setTimeout(finish, 6000) // certains navigateurs n'envoient jamais « onend »
      } catch {
        finish()
      }
    }
    const a = audio.get(clip.key)
    if (!a || broken.has(clip.key)) return speak()
    try {
      a.currentTime = 0
      a.onended = finish
      a.onerror = () => { broken.add(clip.key); speak() }
      const p = a.play()
      if (p) p.catch(() => speak())
      setTimeout(finish, 8000) // garde-fou : la file ne reste jamais bloquée
    } catch {
      speak()
    }
  }

  return {
    enqueue(clip) {
      queue.push(clip)
      if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
      if (!playing) next()
    },
    clear() {
      queue = []
    },
    stop() {
      gen++
      queue = []
      playing = false
      audio.forEach((a) => a.pause())
      try { window.speechSynthesis?.cancel() } catch { /* pas de voix navigateur */ }
    },
  }
}

export function useBingoVoice(state: BingoPublicState | null, enabled: boolean, clockOffsetMs: number) {
  const seen = useRef<{ gameId: string; round: number; count: number; winners: number; status: string; phaseIndex: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const player = useRef<VoicePlayer | null>(null)

  useEffect(() => {
    if (!enabled || typeof Audio === 'undefined') {
      // Son coupé : on arrête aussi le son en cours, tout de suite.
      player.current?.stop()
      return
    }
    player.current ??= createVoicePlayer()
  }, [enabled])

  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    player.current?.stop()
  }, [])

  const announce = useCallback((id: AnnouncementId) => {
    if (!enabled) return
    player.current?.enqueue({ key: `sfx:${EFFECT_OF[id]}`, text: '' })
    player.current?.enqueue({ key: id, text: ANNOUNCEMENTS[id] })
  }, [enabled])
  const sayNumber = useCallback((n: number) => {
    if (!enabled) return
    player.current?.enqueue({ key: 'sfx:boule', text: '' })
    player.current?.enqueue({ key: String(n), text: inWords(n) })
  }, [enabled])

  useEffect(() => {
    if (!state?.active) {
      seen.current = null
      return
    }
    const cur = { gameId: state.gameId, round: state.round, count: state.count, winners: state.winners.length, status: state.status, phaseIndex: state.phaseIndex }
    const prev = seen.current
    seen.current = cur
    // Premier état après ouverture, autre partie ou nouvelle manche : rien n'est rejoué.
    if (!prev || prev.gameId !== cur.gameId || prev.round !== cur.round) return

    if (prev.status === 'lobby' && cur.status === 'running') announce('debut')
    // Loto musical : aucune annonce de numéro (le morceau joue à la place).
    if (cur.count > prev.count && state.last && !state.music) {
      const last = state.last
      const reveal = state.revealAt ? Date.parse(state.revealAt) - clockOffsetMs : Date.now()
      const wait = Math.min(2500, Math.max(0, reveal - Date.now() - BALL_LEAD_MS))
      timers.current.push(setTimeout(() => sayNumber(last), wait))
    }
    const phase = currentPhase(state)
    if (cur.status === 'checking' && prev.status !== 'checking' && phase) announce(VERIF[phase])
    if (cur.winners > prev.winners) announce(cur.winners - prev.winners > 1 ? 'gagne-n' : 'gagne-1')
    else if (prev.status === 'checking' && cur.status === 'running') announce('refus')
    if (cur.status === 'finished' && prev.status !== 'finished') announce('fin')
    else if (cur.phaseIndex > prev.phaseIndex && phase) announce(PHASE[phase])
  }, [state, clockOffsetMs, announce, sayNumber])

  /** Test de la voix depuis les réglages (déclenché par un clic : autorise le son). */
  const test = useCallback(() => sayNumber(42), [sayNumber])
  return { test }
}
