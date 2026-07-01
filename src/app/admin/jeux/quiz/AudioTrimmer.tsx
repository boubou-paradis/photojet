// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
//
// Outil de découpe audio (trimmer) — ADMIN uniquement (préparation du quiz par le DJ).
// WaveSurfer.js v7 + plugin Regions, chargés dynamiquement (aucun rendu SSR, chunk séparé).
// Ne fait que sélectionner des points IN/OUT ; le fichier n'est jamais ré-encodé ni découpé.

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Check, Scissors, Loader2 } from 'lucide-react'

/** m:ss depuis un nombre de secondes. */
function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface AudioTrimmerProps {
  /** URL du fichier audio (blob local ou Supabase). */
  audioUrl: string
  /** Point de début sauvegardé (s). */
  initialStart?: number | null
  /** Point de fin sauvegardé (s). */
  initialEnd?: number | null
  /** Appelé au clic sur « Valider la découpe ». */
  onValidate: (start: number, end: number) => void
  /** Couleur d'accent (hex) pour coller au bloc audio concerné. */
  accent?: string
}

export default function AudioTrimmer({
  audioUrl,
  initialStart,
  initialEnd,
  onValidate,
  accent = '#D4AF37',
}: AudioTrimmerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Instances WaveSurfer / Region typées en `any` : la lib est importée dynamiquement.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regionRef = useRef<any>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState<number>(initialStart ?? 0)
  const [end, setEnd] = useState<number>(initialEnd ?? 0)
  const [playing, setPlaying] = useState(false)
  const [dirty, setDirty] = useState(false)

  // (Ré)initialise WaveSurfer à chaque changement d'URL audio.
  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ws: any = null
    setReady(false)
    setError(false)
    setPlaying(false)

    async function init() {
      const [{ default: WaveSurfer }, { default: RegionsPlugin }] = await Promise.all([
        import('wavesurfer.js'),
        import('wavesurfer.js/dist/plugins/regions.esm.js'),
      ])
      if (cancelled || !containerRef.current) return

      const regions = RegionsPlugin.create()
      ws = WaveSurfer.create({
        container: containerRef.current,
        url: audioUrl,
        height: 56,
        waveColor: 'rgba(255,255,255,0.22)',
        progressColor: accent,
        cursorColor: accent,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        plugins: [regions],
      })
      wsRef.current = ws

      // La durée est connue après décodage → on crée l'unique région de sélection.
      ws.on('decode', (dur: number) => {
        if (cancelled) return
        setDuration(dur)
        const s = Math.min(Math.max(initialStart ?? 0, 0), dur)
        const e = initialEnd != null ? Math.min(initialEnd, dur) : dur
        const region = regions.addRegion({
          start: s,
          end: e > s ? e : dur,
          drag: true,
          resize: true,
          color: hexToRgba(accent, 0.18),
        })
        regionRef.current = region
        setStart(region.start)
        setEnd(region.end)
      })

      // Glissement des poignées IN/OUT → synchronise les champs.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      regions.on('region-updated', (r: any) => {
        setStart(r.start)
        setEnd(r.end)
        setDirty(true)
      })

      ws.on('play', () => setPlaying(true))
      ws.on('pause', () => setPlaying(false))
      ws.on('finish', () => setPlaying(false))
      ws.on('ready', () => { if (!cancelled) setReady(true) })
      ws.on('error', () => { if (!cancelled) setError(true) })
    }

    init().catch(() => { if (!cancelled) setError(true) })

    return () => {
      cancelled = true
      try { ws?.destroy() } catch { /* instance déjà détruite */ }
      wsRef.current = null
      regionRef.current = null
    }
    // initialStart/initialEnd ne sont lus qu'au (re)montage : deps volontairement sur audioUrl.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

  // ▶ Écouter la sélection : v7 play(start, end) lit le segment et s'arrête à `end`.
  const playSelection = useCallback(() => {
    const ws = wsRef.current
    if (!ws) return
    if (playing) {
      ws.pause()
      return
    }
    void ws.play(start, end || duration)
  }, [playing, start, end, duration])

  // Édition manuelle des champs (secondes).
  const applyStart = (v: number) => {
    const dur = duration || end
    const s = Math.max(0, Math.min(v, Math.max(0, (end || dur) - 0.1)))
    setStart(s)
    setDirty(true)
    regionRef.current?.setOptions({ start: s, end: end || dur })
  }
  const applyEnd = (v: number) => {
    const dur = duration || v
    const e = Math.min(dur, Math.max(v, start + 0.1))
    setEnd(e)
    setDirty(true)
    regionRef.current?.setOptions({ start, end: e })
  }

  const validate = () => {
    onValidate(start, end || duration)
    setDirty(false)
  }

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
        <Scissors className="h-3.5 w-3.5" style={{ color: accent }} />
        Découper l&apos;extrait
      </div>

      <div className="relative min-h-[56px] rounded-md bg-white/[0.02]">
        <div ref={containerRef} className={ready ? '' : 'opacity-0'} />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyse de la forme d&apos;onde…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400">
            Impossible d&apos;afficher la forme d&apos;onde.
          </div>
        )}
      </div>

      {ready && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              Début
              <input
                type="number"
                min={0}
                max={Math.max(0, (end || duration) - 0.1)}
                step={0.5}
                value={Number(start.toFixed(1))}
                onChange={(e) => applyStart(parseFloat(e.target.value) || 0)}
                className="w-16 rounded border border-white/10 bg-[#1A1A1E] px-1.5 py-1 text-xs text-white"
              />
              <span className="tabular-nums text-gray-500">{fmt(start)}</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-400">
              Fin
              <input
                type="number"
                min={start + 0.1}
                max={duration || undefined}
                step={0.5}
                value={Number((end || duration).toFixed(1))}
                onChange={(e) => applyEnd(parseFloat(e.target.value) || 0)}
                className="w-16 rounded border border-white/10 bg-[#1A1A1E] px-1.5 py-1 text-xs text-white"
              />
              <span className="tabular-nums text-gray-500">{fmt(end || duration)}</span>
            </label>
            <span className="text-[11px] text-gray-600">
              Sélection : {fmt(Math.max(0, (end || duration) - start))}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={playSelection}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: hexToRgba(accent, 0.2) }}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Écouter la sélection'}
            </button>
            <button
              type="button"
              onClick={validate}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-[#0D0D0F] transition-[filter] hover:brightness-110"
              style={{ backgroundColor: accent }}
            >
              <Check className="h-3.5 w-3.5" />
              Valider la découpe
            </button>
            {dirty && <span className="text-[11px] text-yellow-400">Non enregistré</span>}
          </div>
        </>
      )}
    </div>
  )
}
