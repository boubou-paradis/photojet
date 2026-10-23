'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Modèles AnimaJet : l'animateur saisit son texte (prénoms, date…), voit
// les 4 modèles en vertical et en horizontal, et en ajoute un à sa
// bibliothèque (les deux orientations d'un coup).

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { uploadTemplate } from '@/lib/borne-templates/browser'
import { TEMPLATE_NAME_MAX, type TemplateOrientation } from '@/lib/borne-templates/constants'
import { PRESETS, drawPreset, presetGeometry, type PresetId } from '@/lib/borne-templates/presets'
import type { BorneTemplate } from '@/types/database'
import { PRESET_FONTS, loadPresetFonts } from './fonts'
import { SamplePhoto } from './FrameStage'

interface TemplatePresetsProps {
  open: boolean
  defaultNames: string
  /** Places restantes dans la bibliothèque. */
  remaining: number
  onClose: () => void
  onAdded: (templates: BorneTemplate[]) => void
}

const ORIENTATIONS: TemplateOrientation[] = ['portrait', 'landscape']

function PresetCanvas({ id, orientation, names, date, ready, register }: {
  id: PresetId
  orientation: TemplateOrientation
  names: string
  date: string
  ready: boolean
  register: (key: string, canvas: HTMLCanvasElement | null) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const g = presetGeometry(orientation)
  const key = `${id}-${orientation}`

  useEffect(() => {
    register(key, ref.current)
    return () => register(key, null)
  }, [key, register])

  useEffect(() => {
    if (!ready || !ref.current) return
    const t = setTimeout(() => {
      if (ref.current) drawPreset(ref.current, id, orientation, names, date, PRESET_FONTS)
    }, 250)
    return () => clearTimeout(t)
  }, [ready, id, orientation, names, date])

  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <div className="relative w-full" style={{ aspectRatio: `${g.W} / ${g.H}` }}>
      <div
        className="absolute overflow-hidden"
        style={{ left: pct(g.zone.x, g.W), top: pct(g.zone.y, g.H), width: pct(g.zone.w, g.W), height: pct(g.zone.h, g.H) }}
      >
        <SamplePhoto />
      </div>
      <canvas ref={ref} width={g.W} height={g.H} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

export default function TemplatePresets({ open, defaultNames, remaining, onClose, onAdded }: TemplatePresetsProps) {
  const [names, setNames] = useState(defaultNames)
  const [date, setDate] = useState('')
  const [ready, setReady] = useState(false)
  const [adding, setAdding] = useState<PresetId | null>(null)
  const canvases = useRef(new Map<string, HTMLCanvasElement>())
  const register = useRef((key: string, canvas: HTMLCanvasElement | null) => {
    if (canvas) canvases.current.set(key, canvas)
    else canvases.current.delete(key)
  }).current

  useEffect(() => {
    if (!open) return
    setNames(defaultNames)
    loadPresetFonts().catch(() => {}).finally(() => setReady(true))
  }, [open, defaultNames])

  async function add(id: PresetId, title: string) {
    if (remaining < 2) {
      toast.error('Bibliothèque presque pleine : il faut 2 places (vertical + horizontal).')
      return
    }
    setAdding(id)
    try {
      const added: BorneTemplate[] = []
      for (const o of ORIENTATIONS) {
        const canvas = canvases.current.get(`${id}-${o}`)
        if (!canvas) throw new Error('Aperçu indisponible, réessayez.')
        drawPreset(canvas, id, o, names.trim(), date.trim(), PRESET_FONTS)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!blob) throw new Error('Création du fichier impossible.')
        const label = `${title}${names.trim() ? ` — ${names.trim()}` : ''}`.slice(0, TEMPLATE_NAME_MAX - 13)
        const { template } = await uploadTemplate(blob, `${label} (${o === 'portrait' ? 'vertical' : 'horizontal'})`, 'animajet')
        added.push(template)
      }
      onAdded(added)
      toast.success(`« ${title} » ajouté à votre bibliothèque (vertical + horizontal)`)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Ajout impossible')
    } finally {
      setAdding(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !adding) onClose() }}>
      <DialogContent className="bg-[#242428] border-[#D4AF37]/20 text-white sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogTitle className="text-xl font-bold">Modèles AnimaJet</DialogTitle>
        <DialogDescription className="text-[#9a94b5]">
          Créés pour AnimaJet. Personnalisez le texte, puis ajoutez le modèle à votre bibliothèque (vertical et horizontal).
        </DialogDescription>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-[#9a94b5]">
            Texte principal
            <input
              value={names}
              onChange={(e) => setNames(e.target.value)}
              maxLength={40}
              placeholder="Julie & Thomas"
              className="h-11 rounded-xl border border-white/10 focus:border-[#D4AF37] bg-[#1A1A1E] px-3 text-white outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-[#9a94b5]">
            Texte secondaire
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              maxLength={40}
              placeholder="12 · 06 · 2027"
              className="h-11 rounded-xl border border-white/10 focus:border-[#D4AF37] bg-[#1A1A1E] px-3 text-white outline-none"
            />
          </label>
        </div>

        {!ready && (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" /></div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${ready ? '' : 'invisible h-0 overflow-hidden'}`}>
          {PRESETS.map((p) => (
            <article key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex flex-col gap-3">
              <div className="mx-auto w-2/3"><PresetCanvas id={p.id} orientation="portrait" names={names} date={date} ready={ready} register={register} /></div>
              <PresetCanvas id={p.id} orientation="landscape" names={names} date={date} ready={ready} register={register} />
              <div className="flex items-center justify-between gap-2 mt-auto">
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-[#9a94b5]">{p.use}</p>
                </div>
                <button
                  type="button"
                  onClick={() => add(p.id, p.title)}
                  disabled={adding !== null}
                  className="h-10 px-3.5 rounded-xl text-sm font-bold bg-gradient-to-b from-[#fbe7a3] to-[#D4AF37] text-[#0a0a14] flex items-center gap-1.5 disabled:opacity-50"
                >
                  {adding === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Utiliser
                </button>
              </div>
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
