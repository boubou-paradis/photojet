'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Vérification d'un PNG avant ajout à la bibliothèque : zone détectée,
// aperçu avec une photo d'exemple, contrôles et avertissements. L'envoi
// passe par une URL signée (fichier direct vers le Storage), puis le
// serveur refait tous les contrôles avant d'enregistrer.

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { analyzeTemplateFile, uploadTemplate } from '@/lib/borne-templates/browser'
import { TEMPLATE_NAME_MAX } from '@/lib/borne-templates/constants'
import type { AnalyzeResult } from '@/lib/borne-templates/rules'
import type { BorneTemplate } from '@/types/database'
import FrameStage, { SamplePhoto } from './FrameStage'

interface TemplateImportDialogProps {
  file: File | null
  onClose: () => void
  onImported: (template: BorneTemplate, warnings: string[]) => void
}

const CHECKER = 'repeating-conic-gradient(#3a3a40 0% 25%, #26262b 0% 50%) 50% / 16px 16px'

function defaultName(file: File): string {
  return file.name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, TEMPLATE_NAME_MAX) || 'Mon template'
}

export default function TemplateImportDialog({ file, onClose, onImported }: TemplateImportDialogProps) {
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setAnalysis(null)
    setServerError(null)
    setName(defaultName(file))
    analyzeTemplateFile(file).then((r) => { if (!cancelled) setAnalysis(r) })
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  async function submit() {
    if (!file || !analysis?.ok) return
    const cleanName = name.trim()
    if (!cleanName) {
      setServerError('Donnez un nom au template.')
      return
    }
    setSending(true)
    setServerError(null)
    try {
      const { template, warnings } = await uploadTemplate(file, cleanName)
      onImported(template, warnings)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Enregistrement impossible pour l'instant, réessayez.")
    } finally {
      setSending(false)
    }
  }

  const ok = analysis?.ok ? analysis.value : null
  const zonePct = ok ? Math.round(((ok.zone.w * ok.zone.h) / (ok.width * ok.height)) * 100) : 0

  return (
    <Dialog open={file !== null} onOpenChange={(open) => { if (!open && !sending) onClose() }}>
      <DialogContent className="bg-[#242428] border-[#D4AF37]/20 text-white sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogTitle className="text-xl font-bold">Vérifier le template avant de l&apos;ajouter</DialogTitle>
        <DialogDescription className="text-[#9a94b5]">{file?.name}</DialogDescription>

        {!analysis && (
          <div className="flex items-center gap-3 py-10 justify-center text-[#9a94b5]">
            <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
            Analyse du fichier…
          </div>
        )}

        {analysis && !analysis.ok && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex gap-3">
            <XCircle className="h-5 w-5 text-red-300 shrink-0 mt-0.5" />
            <p className="text-sm text-red-100 leading-relaxed">{analysis.error}</p>
          </div>
        )}

        {ok && previewUrl && (
          <div className="grid gap-5 md:grid-cols-[1fr_1fr_1.3fr] items-start">
            <figure className="flex flex-col gap-2">
              <div className="rounded-lg overflow-hidden" style={{ background: CHECKER }}>
                <FrameStage templateSrc={previewUrl} width={ok.width} height={ok.height} zone={ok.zone} showZone>
                  <div className="w-full h-full" />
                </FrameStage>
              </div>
              <figcaption className="text-xs text-[#9a94b5] text-center">Fichier importé · zone détectée</figcaption>
            </figure>
            <figure className="flex flex-col gap-2">
              <div className="rounded-lg overflow-hidden bg-[#0D0D0F]">
                <FrameStage templateSrc={previewUrl} width={ok.width} height={ok.height} zone={ok.zone}>
                  <SamplePhoto />
                </FrameStage>
              </div>
              <figcaption className="text-xs text-[#9a94b5] text-center">Aperçu avec une photo d&apos;exemple</figcaption>
            </figure>

            <div className="flex flex-col gap-4">
              <ul className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#34d399] shrink-0 mt-0.5" />PNG transparent</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#34d399] shrink-0 mt-0.5" />{ok.width} × {ok.height} px</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#34d399] shrink-0 mt-0.5" />Orientation : {ok.orientation === 'portrait' ? 'verticale' : 'horizontale'}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-[#34d399] shrink-0 mt-0.5" />Zone photo : {ok.zone.w} × {ok.zone.h} px ({zonePct} % du template)</li>
                {ok.warnings.map((w) => (
                  <li key={w} className="flex gap-2 text-[#fbbf24]"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{w}</li>
                ))}
              </ul>

              <label className="flex flex-col gap-2 text-sm text-[#9a94b5]">
                Nom du template
                <input
                  type="text"
                  value={name}
                  maxLength={TEMPLATE_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-xl border border-[#D4AF37] bg-[#1A1A1E] px-3 text-white text-[15px] outline-none"
                />
              </label>
            </div>
          </div>
        )}

        {serverError && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 text-red-100 text-sm px-4 py-3">{serverError}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-11 px-5 rounded-xl border border-white/10 text-gray-200 hover:border-white/20 disabled:opacity-40"
          >
            {analysis && !analysis.ok ? 'Fermer' : 'Annuler'}
          </button>
          {ok && (
            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="h-11 px-5 rounded-xl font-bold bg-gradient-to-b from-[#fbe7a3] to-[#D4AF37] text-[#0a0a14] flex items-center gap-2 disabled:opacity-60"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ajouter à ma bibliothèque
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
