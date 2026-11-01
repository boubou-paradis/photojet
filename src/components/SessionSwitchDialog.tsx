// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { quoteSessionNames, switchButtonLabel, type ActiveSessionInfo } from '@/lib/sessions/activation'

interface SessionSwitchDialogProps {
  /** Sessions déjà actives ; `null` ferme la fenêtre. */
  others: ActiveSessionInfo[] | null
  targetName: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function SessionSwitchDialog({ others, targetName, busy, onCancel, onConfirm }: SessionSwitchDialogProps) {
  const names = quoteSessionNames(others ?? [])
  const target = targetName ? `“${targetName}”` : 'cette session'
  const several = (others?.length ?? 0) > 1
  const inProgress = (others ?? []).filter((session) => session.busy)

  return (
    <Dialog open={others !== null} onOpenChange={(open) => { if (!open && !busy) onCancel() }}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#242428] border-[rgba(255,255,255,0.1)] [overflow-wrap:anywhere]">
        <DialogHeader>
          <DialogTitle className="text-white">
            {several ? `Les sessions ${names} sont déjà actives.` : `La session ${names} est déjà active.`}
          </DialogTitle>
          <DialogDescription className="text-[#B0B0B5]">
            Un seul événement peut être actif à la fois. Désactiver {names} et activer {target} ?
          </DialogDescription>
        </DialogHeader>

        {inProgress.length > 0 && (
          <p role="alert" className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="min-w-0">
              Attention, un événement semble en cours sur {quoteSessionNames(inProgress)}. Les invités ne pourront plus envoyer de photos ni rejoindre.
            </span>
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy} className="h-auto min-h-9 whitespace-normal border-[rgba(255,255,255,0.1)] text-white">
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="h-auto min-h-9 whitespace-normal bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {switchButtonLabel(targetName)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
