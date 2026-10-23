'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBooth, page admin : écran d'accueil optionnel de la tablette.
// Activé : accueil → toucher → caméra → photo → retour à l'accueil (et
// retour automatique après 1 min sans activité sur l'écran caméra).

import { useEffect, useMemo, useState } from 'react'
import { Hand } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase'
import { WELCOME_DEFAULT_MESSAGE, WELCOME_MESSAGE_MAX } from '@/lib/borne-templates/constants'
import type { Session } from '@/types/database'

type WelcomeFields = Pick<Session, 'borne_welcome_enabled' | 'borne_welcome_message'>

interface WelcomeSettingsProps {
  session: Session
  onSessionChange: (patch: Partial<WelcomeFields>) => void
}

export default function WelcomeSettings({ session, onSessionChange }: WelcomeSettingsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(session.borne_welcome_message ?? '')

  useEffect(() => {
    setMessage(session.borne_welcome_message ?? '')
  }, [session.id, session.borne_welcome_message])

  async function save(patch: Partial<WelcomeFields>, success?: string) {
    setSaving(true)
    try {
      const { error } = await supabase.from('sessions').update(patch).eq('id', session.id)
      if (error) throw error
      onSessionChange(patch)
      if (success) toast.success(success)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  function saveMessage() {
    const clean = message.trim().slice(0, WELCOME_MESSAGE_MAX) || null
    if (clean === (session.borne_welcome_message ?? null)) return
    save({ borne_welcome_message: clean }, 'Message enregistré')
  }

  return (
    <section className="card-gold rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <Hand className="h-6 w-6 text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Écran d&apos;accueil</h2>
            <p className="text-sm text-[#9a94b5] mt-0.5 max-w-xl leading-relaxed">
              Entre deux invités, la tablette affiche un écran d&apos;accueil. Un toucher ouvre la caméra ; retour automatique après chaque photo et après 1 minute sans activité.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-3 text-white font-semibold cursor-pointer">
          {session.borne_welcome_enabled ? 'Activé' : 'Désactivé'}
          <Switch
            checked={!!session.borne_welcome_enabled}
            disabled={saving}
            onCheckedChange={(checked) => save({ borne_welcome_enabled: checked })}
            aria-label="Activer l'écran d'accueil"
          />
        </label>
      </div>

      {session.borne_welcome_enabled && (
        <label className="mt-5 flex flex-col gap-2 text-sm text-[#9a94b5]">
          Message affiché
          <input
            type="text"
            value={message}
            maxLength={WELCOME_MESSAGE_MAX}
            placeholder={WELCOME_DEFAULT_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={saveMessage}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="h-11 rounded-xl border border-white/10 focus:border-[#D4AF37] bg-[#1A1A1E] px-3 text-white text-[15px] outline-none"
          />
          <span className="text-xs">Vide : « {WELCOME_DEFAULT_MESSAGE} ». Le nom de l&apos;événement s&apos;affiche au-dessus s&apos;il est activé dans les paramètres.</span>
        </label>
      )}
    </section>
  )
}
