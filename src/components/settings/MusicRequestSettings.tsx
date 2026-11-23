'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Paramètres : interrupteur « Demandes de musique » (désactivé par défaut).
// Enregistré tout de suite par sa propre route, sans toucher à la ligne
// sessions. Migration absente : le bloc ne s'affiche pas.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Music } from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function MusicRequestSettings({ sessionId, className = '' }: { sessionId: string; className?: string }) {
  const [state, setState] = useState<{ sessionId: string; enabled: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/music/settings?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setState(data?.available ? { sessionId, enabled: data.enabled === true } : null)
      })
      .catch(() => { if (!cancelled) setState(null) })
    return () => { cancelled = true }
  }, [sessionId])

  if (!state || state.sessionId !== sessionId) return null

  async function toggle(enabled: boolean) {
    setSaving(true)
    setState({ sessionId, enabled })
    try {
      const r = await fetch('/api/music/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, enabled }),
      })
      if (!r.ok) throw new Error(String(r.status))
      toast.success(enabled ? 'Demandes de musique activées' : 'Demandes de musique désactivées')
    } catch {
      setState({ sessionId, enabled: !enabled })
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.001 }}
      data-testid="music-settings"
      className={`card-gold rounded-xl lg:col-span-2 transition-all duration-200 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] ${className}`}
    >
      <div className="p-3 border-b border-[rgba(255,255,255,0.1)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center">
            <Music className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Demandes de musique</h3>
            <p className="text-xs text-[#6B6B70]">
              Les invités demandent des morceaux au DJ depuis le QR de la session. Elles s&apos;affichent seulement dans le tableau de bord.
            </p>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-4 max-w-md">
          <div>
            <Label htmlFor="music-requests-switch" className="text-white text-sm">Activer les demandes</Label>
            <p className="text-xs text-[#6B6B70]">Ajoute le choix « Musique » sur le téléphone des invités</p>
          </div>
          <Switch
            id="music-requests-switch"
            checked={state.enabled}
            disabled={saving}
            onCheckedChange={toggle}
          />
        </div>
      </div>
    </motion.div>
  )
}
