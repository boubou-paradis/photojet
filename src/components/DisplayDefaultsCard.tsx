'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Paramètres : réglages d'affichage par défaut du compte. Enregistrer copie
// les réglages visuels de la session ouverte ; « Appliquer » ne touche que
// cette session, et seulement après confirmation.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookmarkCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  applyDisplayDefaults,
  deleteDisplayDefaults,
  fetchDisplayDefaults,
  saveDisplayDefaults,
  type DisplayDefaults,
} from '@/lib/display-defaults/client'
import { describeDisplaySettings } from '@/lib/display-defaults/settings'
import type { Session } from '@/types/database'

interface DisplayDefaultsCardProps {
  sessionId: string
  sessionName: string
  /** Termine l'enregistrement automatique en attente avant de lire la base. */
  flushPendingSave: () => Promise<void>
  /** Session relue après application, pour rafraîchir le formulaire. */
  onApplied: (session: Session) => void
}

type Pending = null | 'save' | 'apply' | 'delete'

function formatDate(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', 'h')
  return `${date} à ${time}`
}

export default function DisplayDefaultsCard({ sessionId, sessionName, flushPendingSave, onApplied }: DisplayDefaultsCardProps) {
  const [defaults, setDefaults] = useState<DisplayDefaults | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Pending>(null)
  const [confirm, setConfirm] = useState<Pending>(null)

  useEffect(() => {
    fetchDisplayDefaults()
      .then(setDefaults)
      .catch(() => setDefaults(null))
      .finally(() => setLoaded(true))
  }, [])

  async function run(action: Exclude<Pending, null>) {
    setConfirm(null)
    setBusy(action)
    try {
      if (action === 'save') {
        await flushPendingSave()
        setDefaults(await saveDisplayDefaults(sessionId))
        toast.success('Réglages par défaut enregistrés')
      } else if (action === 'apply') {
        await flushPendingSave()
        const result = await applyDisplayDefaults(sessionId)
        if (result.status === 'none') {
          setDefaults(null)
          toast.error('Aucun réglage par défaut enregistré')
          return
        }
        onApplied(result.session)
        if (result.warnings.length > 0) toast.warning(`Réglages appliqués. ${result.warnings.join(' ')}`)
        else toast.success('Réglages par défaut appliqués à cette session')
      } else {
        await deleteDisplayDefaults()
        setDefaults(null)
        toast.success('Réglages par défaut supprimés')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur technique, réessayez.')
    } finally {
      setBusy(null)
    }
  }

  const summary = describeDisplaySettings(defaults?.settings)

  return (
    <motion.div
      whileHover={{ scale: 1.001 }}
      className="card-gold rounded-xl lg:col-span-2 transition-all duration-200 hover:border-[#D4AF37]/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
    >
      <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
            <BookmarkCheck className="h-5 w-5 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Réglages par défaut du compte</h3>
            <p className="text-sm text-[#6B6B70]">Appliqués automatiquement à chaque nouvelle session</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {!loaded ? (
          <p className="text-sm text-[#6B6B70] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : defaults ? (
          <div className="text-sm">
            <p className="text-[#4CAF50] font-medium">● Enregistrés le {formatDate(defaults.updated_at)}</p>
            <p className="text-[#B0B0B5] mt-1">{summary.join(' · ')}</p>
          </div>
        ) : (
          <p className="text-sm text-[#B0B0B5]">
            Aucun réglage par défaut. Les nouvelles sessions démarrent avec les réglages d&apos;origine.
          </p>
        )}

        <p className="text-xs text-[#6B6B70]">
          Fond, logo, QR code, transitions, messages, affiches promo, accueil et cadres de la borne.
          Le nom, le code, les jeux, la modération et l&apos;impression ne sont jamais copiés.
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            onClick={() => (defaults ? setConfirm('save') : run('save'))}
            disabled={busy !== null || !loaded}
            className="bg-[#D4AF37] hover:bg-[#C5A030] text-[#1A1A1E] font-semibold"
          >
            {busy === 'save' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer comme réglages par défaut
          </Button>
          {defaults && (
            <>
              <button
                type="button"
                onClick={() => setConfirm('apply')}
                disabled={busy !== null}
                className="text-sm text-[#D4AF37] hover:underline disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy === 'apply' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Appliquer mes réglages par défaut à cette session ›
              </button>
              <button
                type="button"
                onClick={() => setConfirm('delete')}
                disabled={busy !== null}
                className="text-sm text-[#6B6B70] hover:text-[#E53935] hover:underline disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy === 'delete' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Supprimer mes réglages par défaut
              </button>
            </>
          )}
        </div>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="bg-[#242428] border-[rgba(255,255,255,0.1)]">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirm === 'apply' && `Appliquer vos réglages par défaut à « ${sessionName} » ?`}
              {confirm === 'save' && 'Remplacer vos réglages par défaut ?'}
              {confirm === 'delete' && 'Supprimer vos réglages par défaut ?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[#B0B0B5] text-sm">
            {confirm === 'apply' &&
              "Seront remplacés sur cette session uniquement : fond, logo, QR code, transitions, messages, affiches promo, accueil et cadres de la borne. Le nom, le code, les jeux et l'impression ne changent pas."}
            {confirm === 'save' &&
              `Les réglages actuels de « ${sessionName} » remplaceront ceux enregistrés le ${defaults ? formatDate(defaults.updated_at) : ''}. Les sessions existantes ne changent pas.`}
            {confirm === 'delete' &&
              "Les nouvelles sessions démarreront avec les réglages d'origine. Les sessions existantes ne changent pas."}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirm(null)}
              className="border-[rgba(255,255,255,0.1)] text-white hover:bg-[#2E2E33]"
            >
              Annuler
            </Button>
            <Button
              onClick={() => confirm && run(confirm)}
              className={confirm === 'delete'
                ? 'bg-[#E53935] hover:bg-[#D32F2F] text-white'
                : 'bg-[#D4AF37] hover:bg-[#C5A030] text-[#1A1A1E] font-semibold'}
            >
              {confirm === 'apply' ? 'Appliquer' : confirm === 'save' ? 'Remplacer' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
