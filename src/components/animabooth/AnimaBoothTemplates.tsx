'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBooth, page admin : bibliothèque de templates (partagée entre toutes
// les sessions de l'animateur) et choix du cadre pour la session ouverte.
// Lecture et réglages de session via le client navigateur (RLS) ; import
// et suppression via les routes serveur, qui contrôlent les fichiers.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Frame, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase'
import { getPublicUrl } from '@/lib/image-utils'
import { TEMPLATES_PER_USER, type TemplateOrientation } from '@/lib/borne-templates/constants'
import type { BorneTemplate, Session } from '@/types/database'
import FrameStage, { SamplePhoto } from './FrameStage'
import TemplateImportDialog from './TemplateImportDialog'
import TemplatePresets from './TemplatePresets'

type TemplateSettings = Pick<
  Session,
  'borne_template_enabled' | 'borne_template_portrait_id' | 'borne_template_landscape_id' | 'borne_template_guest_choice'
>

interface SessionUsage {
  id: string
  name: string
  borne_template_portrait_id: string | null
  borne_template_landscape_id: string | null
}

interface AnimaBoothTemplatesProps {
  session: Session
  userId: string
  onSessionChange: (patch: Partial<TemplateSettings>) => void
}

const SLOT_COLUMN = {
  portrait: 'borne_template_portrait_id',
  landscape: 'borne_template_landscape_id',
} as const

const cardClass = 'card-gold rounded-xl p-6'
const iconTile =
  'w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]'

function templateUrl(t: BorneTemplate): string {
  return getPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, t.storage_path)
}

function Thumb({ template, className }: { template: BorneTemplate; className?: string }) {
  return (
    <FrameStage
      templateSrc={templateUrl(template)}
      width={template.width}
      height={template.height}
      zone={template.photo_zones[0]}
      className={className}
    >
      <SamplePhoto />
    </FrameStage>
  )
}

export default function AnimaBoothTemplates({ session, userId, onSessionChange }: AnimaBoothTemplatesProps) {
  const supabase = useMemo(() => createClient(), [])
  const [templates, setTemplates] = useState<BorneTemplate[] | null>(null)
  const [usage, setUsage] = useState<SessionUsage[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [toDelete, setToDelete] = useState<BorneTemplate | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [picking, setPicking] = useState<TemplateOrientation | null>(null)
  const [saving, setSaving] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [tpl, ses] = await Promise.all([
      supabase.from('borne_templates').select('*').order('created_at', { ascending: false }),
      supabase
        .from('sessions')
        .select('id, name, borne_template_portrait_id, borne_template_landscape_id')
        .eq('user_id', userId),
    ])
    if (tpl.error) {
      toast.error('Impossible de charger vos templates')
      setTemplates([])
    } else {
      setTemplates(tpl.data as BorneTemplate[])
    }
    if (!ses.error) setUsage(ses.data as SessionUsage[])
  }, [supabase, userId])

  useEffect(() => {
    load()
  }, [load])

  // La session ouverte fait foi (réglages modifiés sur cette page)
  const usageNow = useMemo(
    () =>
      usage.map((u) =>
        u.id === session.id
          ? { ...u, borne_template_portrait_id: session.borne_template_portrait_id, borne_template_landscape_id: session.borne_template_landscape_id }
          : u
      ),
    [usage, session.id, session.borne_template_portrait_id, session.borne_template_landscape_id]
  )

  function sessionsUsing(id: string): SessionUsage[] {
    return usageNow.filter((u) => u.borne_template_portrait_id === id || u.borne_template_landscape_id === id)
  }

  function chooseFile(file: File | undefined) {
    if (!file) return
    if ((templates?.length ?? 0) >= TEMPLATES_PER_USER) {
      toast.error(`Bibliothèque pleine (${TEMPLATES_PER_USER} templates). Supprimez-en un pour en ajouter un autre.`)
      return
    }
    setImportFile(file)
  }

  function onImported(template: BorneTemplate, warnings: string[]) {
    setImportFile(null)
    setTemplates((list) => [template, ...(list ?? [])])
    toast.success(warnings.length ? 'Template ajouté (voir les avertissements)' : 'Template ajouté à votre bibliothèque')
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/borne/templates?id=${toDelete.id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      const id = toDelete.id
      setTemplates((list) => (list ?? []).filter((t) => t.id !== id))
      setUsage((list) =>
        list.map((u) => ({
          ...u,
          borne_template_portrait_id: u.borne_template_portrait_id === id ? null : u.borne_template_portrait_id,
          borne_template_landscape_id: u.borne_template_landscape_id === id ? null : u.borne_template_landscape_id,
        }))
      )
      const patch: Partial<TemplateSettings> = {}
      if (session.borne_template_portrait_id === id) patch.borne_template_portrait_id = null
      if (session.borne_template_landscape_id === id) patch.borne_template_landscape_id = null
      if (Object.keys(patch).length) onSessionChange(patch)
      toast.success('Template supprimé')
      setToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Suppression impossible')
    } finally {
      setDeleting(false)
    }
  }

  async function saveSettings(patch: Partial<TemplateSettings>) {
    setSaving(true)
    try {
      const { error } = await supabase.from('sessions').update(patch).eq('id', session.id)
      if (error) throw error
      onSessionChange(patch)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const byId = new Map((templates ?? []).map((t) => [t.id, t]))
  const portrait = session.borne_template_portrait_id ? byId.get(session.borne_template_portrait_id) ?? null : null
  const landscape = session.borne_template_landscape_id ? byId.get(session.borne_template_landscape_id) ?? null : null
  const deleteUsers = toDelete ? sessionsUsing(toDelete.id) : []

  return (
    <div className="space-y-6">
      {/* Bibliothèque */}
      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={iconTile}><Frame className="h-6 w-6 text-[#D4AF37]" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">Mes templates photo</h2>
              <p className="text-sm text-[#9a94b5] mt-0.5 max-w-xl leading-relaxed">
                Utilisez vos templates au format PNG transparent (10×15, vertical ou horizontal). Vous pouvez en trouver sur des sites spécialisés ou en créer dans Canva.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#9a94b5]">Partagés entre toutes vos sessions</p>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => {
            chooseFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); chooseFile(e.dataTransfer.files?.[0]) }}
            className={`min-h-[260px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-4 text-[#D4AF37] font-semibold transition-colors ${
              dragOver ? 'border-[#D4AF37] bg-[#D4AF37]/15' : 'border-[#D4AF37]/50 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'
            }`}
          >
            <Upload className="h-9 w-9" />
            Importer un template
            <span className="text-xs font-normal text-[#9a94b5] text-center leading-snug">Glissez un PNG ici<br />ou cliquez pour choisir</span>
          </button>

          {templates === null && (
            <div className="min-h-[260px] rounded-xl border border-white/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
            </div>
          )}

          {templates?.map((t) => {
            const users = sessionsUsing(t.id)
            const activeHere = users.some((u) => u.id === session.id)
            const others = users.filter((u) => u.id !== session.id).length
            return (
              <article
                key={t.id}
                className={`rounded-xl border p-3 flex flex-col gap-2 ${activeHere ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <div className="h-40 rounded-lg bg-[#0D0D0F] flex items-center justify-center overflow-hidden p-2">
                  <Thumb template={t} className={t.orientation === 'portrait' ? 'h-full' : 'w-full'} />
                </div>
                <p className="text-sm font-semibold text-white truncate" title={t.name}>{t.name}</p>
                <p className="text-xs text-[#9a94b5]">{t.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · {t.width} × {t.height} px</p>
                <p className={`text-xs ${activeHere ? 'text-[#D4AF37]' : 'text-[#9a94b5]'}`}>
                  {activeHere ? 'Actif sur cette session' : others > 0 ? `Utilisé par ${others} autre${others > 1 ? 's' : ''} session${others > 1 ? 's' : ''}` : 'Non utilisé'}
                </p>
                <div className="mt-auto flex justify-end">
                  <button
                    type="button"
                    onClick={() => setToDelete(t)}
                    className="px-2.5 py-1 rounded-md text-xs border border-white/10 text-gray-200 hover:border-red-400/50 hover:text-red-300"
                  >
                    Supprimer
                  </button>
                </div>
              </article>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#b16cff]/30 bg-violet-500/[0.08] px-4 py-3">
          <p className="text-sm text-gray-200">Pas encore de template ? Partez d&apos;un modèle AnimaJet et personnalisez le texte (prénoms, date).</p>
          <button
            type="button"
            onClick={() => setPresetsOpen(true)}
            className="h-10 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-b from-[#b16cff] to-[#7c3aed] whitespace-nowrap"
          >
            Voir les modèles AnimaJet
          </button>
        </div>
      </section>

      {/* Cadre de la session */}
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={iconTile}><Camera className="h-6 w-6 text-[#D4AF37]" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">Cadre pour cette session</h2>
              <p className="text-sm text-[#9a94b5] mt-0.5">Les changements s&apos;appliquent dès la photo suivante sur la tablette.</p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-white font-semibold cursor-pointer">
            {session.borne_template_enabled ? 'Cadre activé' : 'Cadre désactivé'}
            <Switch
              checked={session.borne_template_enabled}
              disabled={saving}
              onCheckedChange={(checked) => saveSettings({ borne_template_enabled: checked })}
            />
          </label>
        </div>

        {session.borne_template_enabled && !portrait && !landscape && (
          <p className="mt-4 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fde68a] text-sm px-4 py-3">
            Choisissez au moins un template : sans template, la borne prend les photos sans cadre.
          </p>
        )}

        <div className="mt-5 grid md:grid-cols-2 gap-4">
          {(['portrait', 'landscape'] as const).map((o) => {
            const chosen = o === 'portrait' ? portrait : landscape
            return (
              <div
                key={o}
                className={`rounded-xl border p-4 flex gap-4 items-center ${chosen ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <div className="w-28 h-28 shrink-0 rounded-md bg-[#0D0D0F] flex items-center justify-center overflow-hidden p-1">
                  {chosen ? (
                    <Thumb template={chosen} className={chosen.orientation === 'portrait' ? 'h-full' : 'w-full'} />
                  ) : (
                    <Frame className="h-8 w-8 text-white/20" />
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  <p className="text-xs uppercase tracking-wider font-semibold text-[#9a94b5]">
                    Tablette en {o === 'portrait' ? 'vertical' : 'horizontal'}
                  </p>
                  <p className="text-base font-semibold text-white truncate">{chosen ? chosen.name : 'Aucun template'}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPicking(o)}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-40"
                    >
                      {chosen ? 'Changer' : 'Choisir'}
                    </button>
                    {chosen && (
                      <button
                        type="button"
                        onClick={() => saveSettings({ [SLOT_COLUMN[o]]: null })}
                        disabled={saving}
                        className="px-3.5 py-2 rounded-lg text-sm border border-white/10 text-gray-200 hover:border-white/20 disabled:opacity-40"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div>
            <p className="text-white font-semibold">Laisser les invités choisir « avec » ou « sans » cadre</p>
            <p className="text-sm text-[#9a94b5] mt-0.5">Désactivé : toutes les photos sont prises avec le cadre.</p>
          </div>
          <Switch
            checked={session.borne_template_guest_choice}
            disabled={saving}
            onCheckedChange={(checked) => saveSettings({ borne_template_guest_choice: checked })}
            aria-label="Laisser les invités choisir avec ou sans cadre"
          />
        </div>

        <p className="mt-4 text-sm text-[#9a94b5] leading-relaxed">
          Un seul template choisi ? AnimaBooth l&apos;utilise dans les deux orientations : la photo garde toujours le format du template, donc l&apos;impression 10×15 reste nette.
        </p>
      </section>

      <TemplateImportDialog file={importFile} onClose={() => setImportFile(null)} onImported={onImported} />

      <TemplatePresets
        open={presetsOpen}
        defaultNames={session.name}
        remaining={TEMPLATES_PER_USER - (templates?.length ?? 0)}
        onClose={() => setPresetsOpen(false)}
        onAdded={(added) => {
          setTemplates((list) => [...added.slice().reverse(), ...(list ?? [])])
          setPresetsOpen(false)
        }}
      />

      {/* Choix d'un template pour un emplacement */}
      <Dialog open={picking !== null} onOpenChange={(open) => { if (!open) setPicking(null) }}>
        <DialogContent className="bg-[#242428] border-[#D4AF37]/20 text-white sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>Template pour la tablette en {picking === 'portrait' ? 'vertical' : 'horizontal'}</DialogTitle>
          <DialogDescription className="text-[#9a94b5]">
            {picking === 'portrait' ? 'Templates verticaux (1200 × 1800)' : 'Templates horizontaux (1800 × 1200)'} de votre bibliothèque.
          </DialogDescription>
          {(() => {
            const list = (templates ?? []).filter((t) => t.orientation === picking)
            if (list.length === 0) {
              return (
                <p className="text-sm text-[#9a94b5] py-6 text-center">
                  Aucun template {picking === 'portrait' ? 'vertical' : 'horizontal'} dans votre bibliothèque. Importez-en un d&apos;abord.
                </p>
              )
            }
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {list.map((t) => {
                  const current = picking && session[SLOT_COLUMN[picking]] === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        if (!picking) return
                        await saveSettings({ [SLOT_COLUMN[picking]]: t.id })
                        setPicking(null)
                      }}
                      className={`rounded-xl border p-2 flex flex-col gap-2 text-left ${current ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-white/10 hover:border-[#D4AF37]/50'}`}
                    >
                      <div className="h-36 rounded-md bg-[#0D0D0F] flex items-center justify-center overflow-hidden p-1">
                        <Thumb template={t} className={t.orientation === 'portrait' ? 'h-full' : 'w-full'} />
                      </div>
                      <span className="text-sm font-semibold truncate">{t.name}</span>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <Dialog open={toDelete !== null} onOpenChange={(open) => { if (!open && !deleting) setToDelete(null) }}>
        <DialogContent className="bg-[#1A1A1E] border-red-500/30 text-white max-w-md">
          <DialogTitle>Supprimer « {toDelete?.name} » ?</DialogTitle>
          <DialogDescription className="text-[#9a94b5]">
            Le fichier est supprimé définitivement de votre bibliothèque.
          </DialogDescription>
          {deleteUsers.length > 0 && (
            <div className="rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-sm text-[#fde68a]">
              <p>Ce template est utilisé par {deleteUsers.length > 1 ? 'ces sessions' : 'cette session'} :</p>
              <ul className="list-disc ml-5 mt-1">
                {deleteUsers.map((u) => <li key={u.id}>{u.name}</li>)}
              </ul>
              <p className="mt-1">{deleteUsers.length > 1 ? 'Elles prendront' : 'Elle prendra'} les photos sans ce cadre.</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={deleting}
              className="h-10 px-4 rounded-xl border border-white/10 text-gray-200 hover:border-white/20 disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-10 px-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 border border-red-400/60 flex items-center gap-2 disabled:opacity-60"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
