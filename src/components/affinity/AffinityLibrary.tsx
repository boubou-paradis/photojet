'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Bibliothèque personnelle de Matching (saved_matchings), comme celle du
// Quiz : sauvegarder les questions sous un nom, les recharger dans n'importe
// quelle session, supprimer. RLS : chacun ne voit que ses propres jeux.

import { useEffect, useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AffinityQuestion, SavedMatching } from '@/lib/affinity/types'
import { createClient } from '@/lib/supabase'

const NAME_MAX = 80

function ModalFrame({ icon, title, subtitle, onClose, children, footer }: {
  icon: string
  title: string
  subtitle: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={title}>
      <div className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 text-lg" aria-hidden>{icon}</div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}

export function SaveMatchingModal({ questions, onClose }: { questions: AffinityQuestion[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const clean = name.trim()
    if (!clean) {
      toast.error('Donnez un nom à votre jeu')
      return
    }
    if (questions.length === 0) {
      toast.error('Ajoutez au moins une question avant de sauvegarder')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Session expirée, reconnectez-vous')
        return
      }
      const { error } = await supabase.from('saved_matchings').insert({ user_id: user.id, name: clean.slice(0, NAME_MAX), questions })
      if (error) throw error
      toast.success('Jeu sauvegardé dans votre bibliothèque')
      onClose()
    } catch (err) {
      console.error('Matching : sauvegarde de la bibliothèque', err)
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalFrame
      icon="💾"
      title="Sauvegarder ce jeu"
      subtitle={`${questions.length} question${questions.length > 1 ? 's' : ''} dans votre bibliothèque`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Annuler</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-xl font-bold flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden>💾</span>}
            Sauvegarder
          </button>
        </div>
      }
    >
      <div className="p-5">
        <label htmlFor="aff-save-name" className="text-gray-400 text-xs">Nom du jeu</label>
        <input
          id="aff-save-name"
          type="text"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !saving) void save() }}
          autoFocus
          placeholder="Ex : Soirée célibataires, Mariage de Julie et Max"
          className="w-full bg-[#2E2E33] text-white rounded-lg px-3 py-2.5 border border-white/10 focus:border-[#D4AF37] focus:outline-none mt-1"
        />
        <p className="text-xs text-gray-500 mt-2">Seules les questions sont sauvegardées. La musique d&apos;ambiance se choisit à chaque partie.</p>
      </div>
    </ModalFrame>
  )
}

export function LoadMatchingModal({ hasQuestions, onLoad, onClose }: {
  hasQuestions: boolean
  onLoad: (saved: SavedMatching) => void
  onClose: () => void
}) {
  const [list, setList] = useState<SavedMatching[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await createClient()
        .from('saved_matchings')
        .select('*')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        console.error('Matching : lecture de la bibliothèque', error)
        toast.error('Erreur lors du chargement de la bibliothèque')
        setList([])
        return
      }
      setList((data as SavedMatching[]) ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function remove(saved: SavedMatching) {
    if (!window.confirm(`Supprimer définitivement « ${saved.name} » de votre bibliothèque ?`)) return
    const { error } = await createClient().from('saved_matchings').delete().eq('id', saved.id)
    if (error) {
      toast.error('Erreur lors de la suppression')
      return
    }
    setList((prev) => (prev ?? []).filter((s) => s.id !== saved.id))
    toast.success('Jeu supprimé de la bibliothèque')
  }

  function load(saved: SavedMatching) {
    if (hasQuestions && !window.confirm(`Charger « ${saved.name} » remplacera les questions actuelles. Continuer ?`)) return
    onLoad(saved)
  }

  return (
    <ModalFrame icon="📂" title="Votre bibliothèque Matching" subtitle="Charger remplace les questions actuelles" onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-5">
        {list === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-white font-semibold">Votre bibliothèque est vide</p>
            <p className="text-sm mt-1">Préparez vos questions puis cliquez sur « Sauvegarder ».</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((saved) => (
              <li key={saved.id} className="flex items-center gap-3 rounded-xl p-3.5 bg-[#1A1A1E]/80 border border-white/5 hover:border-[#D4AF37]/30">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{saved.name}</p>
                  <p className="text-xs text-gray-500">
                    {Array.isArray(saved.questions) ? saved.questions.length : 0} questions · {new Date(saved.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  onClick={() => load(saved)}
                  className="px-3 py-2 bg-[#D4AF37] text-black rounded-lg text-sm font-bold hover:bg-[#F4D03F]"
                >
                  Charger
                </button>
                <button onClick={() => void remove(saved)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Supprimer de la bibliothèque">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalFrame>
  )
}
