'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Éditeur d'un vote AnimaVote (maquette validée) : réglages à gauche, choix à
// droite (ajout, duplication, suppression, glisser ou flèches pour réordonner,
// photo recadrée en 4:5 avec l'outil de recadrage existant). Ne fait aucun
// appel lui-même : la page enregistre le brouillon et envoie la photo.

import { useRef, useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, Copy, ImageOff, ImagePlus, Trash2, X } from 'lucide-react'
import CandidatePhoto from '@/components/vote/CandidateVisual'
import { VOTE_COUNTDOWNS_S, VOTE_LIMITS } from '@/lib/vote/constants'
import type { VoteCandidateInput, VoteDisplayMode, VoteDraft, VoteResultsMode, VoteRevealMode } from '@/lib/vote/types'

/** Choix dans l'éditeur : une clé locale stable pour React et le glisser-déposer. */
export type EditorCandidate = VoteCandidateInput & { key: string }
export type EditorDraft = Omit<VoteDraft, 'candidates'> & { candidates: EditorCandidate[] }

let keySeq = 0
export const newKey = () => `c${Date.now().toString(36)}${(keySeq++).toString(36)}`

export const emptyCandidate = (): EditorCandidate => ({ key: newKey(), label: '', number: null, description: null, imageUrl: null, emoji: null, color: null })

export const DEFAULT_DRAFT: EditorDraft = {
  title: '',
  subtitle: null,
  intro: null,
  thanks: null,
  displayMode: 'photo',
  resultsMode: 'hidden',
  allowBlank: false,
  shuffle: true,
  countdownS: 10,
  revealMode: 'podium',
  candidates: [emptyCandidate(), emptyCandidate()],
}

export function toEditorDraft(draft: VoteDraft): EditorDraft {
  return { ...draft, candidates: draft.candidates.map((c) => ({ ...c, key: newKey() })) }
}

/** Contenu envoyé au serveur (clés locales retirées, textes vides → null). */
export function toPayload(draft: EditorDraft): VoteDraft {
  const opt = (s: string | null) => (s && s.trim() ? s.trim() : null)
  return {
    ...draft,
    title: draft.title.trim(),
    subtitle: opt(draft.subtitle),
    intro: opt(draft.intro),
    thanks: opt(draft.thanks),
    candidates: draft.candidates.map((c) => ({
      label: c.label.trim(),
      number: opt(c.number),
      description: opt(c.description),
      imageUrl: c.imageUrl,
      emoji: opt(c.emoji),
      color: c.color,
    })),
  }
}

/** Raison pour laquelle le vote ne peut pas encore être lancé (null = prêt). */
export function draftProblem(draft: EditorDraft): string | null {
  if (!draft.title.trim()) return 'Donnez un titre au vote.'
  const named = draft.candidates.filter((c) => c.label.trim())
  if (named.length < VOTE_LIMITS.minCandidates) return 'Ajoutez au moins 2 choix avec un nom.'
  if (named.length !== draft.candidates.length) return 'Chaque choix doit avoir un nom (ou supprimez les lignes vides).'
  return null
}

interface VoteEditorProps {
  draft: EditorDraft
  onChange: (next: EditorDraft) => void
  /** Clé du choix dont la photo est en cours d'envoi. */
  uploadingKey: string | null
  onPickPhoto: (key: string, file: File) => void
}

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ava-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ava-sw" onClick={() => onChange(!checked)} />
}

export default function VoteEditor({ draft, onChange, uploadingKey, onPickPhoto }: VoteEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const pickFor = useRef<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)

  const set = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) => onChange({ ...draft, [key]: value })
  const setCandidate = (key: string, patch: Partial<EditorCandidate>) =>
    set('candidates', draft.candidates.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const list = draft.candidates
  const full = list.length >= VOTE_LIMITS.maxCandidates

  function move(from: number, to: number) {
    if (to < 0 || to >= list.length || from === to) return
    const next = [...list]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    set('candidates', next)
  }

  function duplicate(index: number) {
    if (full) return
    const next = [...list]
    next.splice(index + 1, 0, { ...list[index], key: newKey(), label: list[index].label.slice(0, VOTE_LIMITS.labelMaxLength) })
    set('candidates', next)
  }

  function remove(index: number) {
    set('candidates', list.filter((_, i) => i !== index))
  }

  // Glisser-déposer : la ligne suit la souris (réordonnée en direct).
  function onDragOver(e: DragEvent, overKey: string) {
    e.preventDefault()
    if (!dragKey || dragKey === overKey) return
    const from = list.findIndex((c) => c.key === dragKey)
    const to = list.findIndex((c) => c.key === overKey)
    move(from, to)
  }

  return (
    <div className="ava-cols">
      <div className="ava-box">
        <h4>Le vote</h4>
        <div className="ava-fld">
          <label htmlFor="av-title">Titre</label>
          <input id="av-title" className="ava-in" value={draft.title} maxLength={VOTE_LIMITS.titleMaxLength} placeholder="Élection Miss Camping 2026" onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="ava-fld">
          <label htmlFor="av-sub">Sous-titre (facultatif)</label>
          <input id="av-sub" className="ava-in" value={draft.subtitle ?? ''} maxLength={VOTE_LIMITS.subtitleMaxLength} placeholder="Votez pour votre candidate préférée" onChange={(e) => set('subtitle', e.target.value)} />
        </div>
        <div className="ava-fld">
          <label htmlFor="av-intro">Message d’attente sur les téléphones (facultatif)</label>
          <textarea id="av-intro" className="ava-in" value={draft.intro ?? ''} maxLength={VOTE_LIMITS.introMaxLength} placeholder="Découvrez les candidates, le vote ouvre dans un instant." onChange={(e) => set('intro', e.target.value)} />
        </div>
        <div className="ava-fld">
          <label htmlFor="av-thanks">Message après le vote (facultatif)</label>
          <textarea id="av-thanks" className="ava-in" value={draft.thanks ?? ''} maxLength={VOTE_LIMITS.thanksMaxLength} placeholder="Merci ! Les résultats seront révélés dans quelques instants." onChange={(e) => set('thanks', e.target.value)} />
        </div>
        <div className="ava-fld">
          <span className="lbl">Présentation sur les téléphones</span>
          <Seg<VoteDisplayMode> label="Présentation" value={draft.displayMode} onChange={(v) => set('displayMode', v)} options={[{ v: 'photo', label: 'Photo' }, { v: 'card', label: 'Carte' }, { v: 'text', label: 'Texte' }]} />
        </div>
        <div className="ava-fld">
          <span className="lbl">Résultats pendant le vote</span>
          <Seg<VoteResultsMode> label="Résultats pendant le vote" value={draft.resultsMode} onChange={(v) => set('resultsMode', v)} options={[{ v: 'hidden', label: <>Cachés <span className="ava-reco">conseillé</span></> }, { v: 'live', label: 'En direct' }]} />
        </div>
        <div className="ava-opt">
          <div>Mélanger l’ordre sur les téléphones<small>Évite l’avantage de la première place. Les numéros ne changent pas.</small></div>
          <Switch label="Mélanger l’ordre" checked={draft.shuffle} onChange={(v) => set('shuffle', v)} />
        </div>
        <div className="ava-opt">
          <div>Autoriser le vote blanc<small>Compté à part, jamais dans les pourcentages.</small></div>
          <Switch label="Autoriser le vote blanc" checked={draft.allowBlank} onChange={(v) => set('allowBlank', v)} />
        </div>
        <div className="ava-opt">
          <div>Compte à rebours de fermeture</div>
          <Seg<number> label="Compte à rebours" value={draft.countdownS} onChange={(v) => set('countdownS', v)} options={VOTE_COUNTDOWNS_S.map((s) => ({ v: s, label: s === 0 ? 'Aucun' : `${s} s` }))} />
        </div>
        <div className="ava-opt">
          <div>Révélation</div>
          <Seg<VoteRevealMode> label="Révélation" value={draft.revealMode} onChange={(v) => set('revealMode', v)} options={[{ v: 'winner', label: 'Gagnant' }, { v: 'podium', label: 'Podium' }, { v: 'full', label: 'Tout' }]} />
        </div>
      </div>

      <div className="ava-box">
        <h4>Choix <small>{draft.displayMode === 'photo' ? 'Photo recadrée en 4:5' : draft.displayMode === 'card' ? 'Emoji et couleur affichés' : 'Nom seul'}</small></h4>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file && pickFor.current) onPickPhoto(pickFor.current, file)
          }}
        />
        <div className="ava-clist">
          {list.map((c, i) => (
            <div
              key={c.key}
              className={`ava-ci${dragKey === c.key ? ' drag' : ''}`}
              onDragOver={(e) => onDragOver(e, c.key)}
              onDrop={(e) => e.preventDefault()}
            >
              <span
                className="hd"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', c.key)
                  setDragKey(c.key)
                }}
                onDragEnd={() => setDragKey(null)}
                aria-hidden
                title="Glisser pour réordonner"
              >⋮⋮</span>
              <button
                type="button"
                className={`pic${uploadingKey === c.key ? ' busy' : ''}`}
                onClick={() => {
                  pickFor.current = c.key
                  fileRef.current?.click()
                }}
                disabled={uploadingKey !== null}
                aria-label={c.imageUrl ? `Changer la photo de ${c.label || 'ce choix'}` : `Ajouter une photo à ${c.label || 'ce choix'}`}
              >
                <CandidatePhoto candidate={{ ...c, label: c.label || '?' }} clean />
                <span className="ov">{uploadingKey === c.key ? 'Envoi…' : c.imageUrl ? 'Changer' : <ImagePlus className="h-3.5 w-3.5 inline" />}</span>
              </button>
              <div className="nbw">
                <input className="ava-in sm nb" value={c.number ?? ''} maxLength={VOTE_LIMITS.numberMaxLength} placeholder="N°" aria-label="Numéro" onChange={(e) => setCandidate(c.key, { number: e.target.value })} />
              </div>
              <div className="tx">
                <input className="ava-in sm" value={c.label} maxLength={VOTE_LIMITS.labelMaxLength} placeholder={`Choix ${i + 1}`} aria-label="Nom" onChange={(e) => setCandidate(c.key, { label: e.target.value })} />
                <input className="ava-in sm" value={c.description ?? ''} maxLength={VOTE_LIMITS.descriptionMaxLength} placeholder="Description (facultatif)" aria-label="Description" onChange={(e) => setCandidate(c.key, { description: e.target.value })} />
                <div className="extra">
                  <input className="ava-in sm" value={c.emoji ?? ''} maxLength={VOTE_LIMITS.emojiMaxLength} placeholder="Emoji" aria-label="Emoji" onChange={(e) => setCandidate(c.key, { emoji: e.target.value })} />
                  <input type="color" className={`ava-color${c.color ? '' : ' auto'}`} title={c.color ? 'Couleur' : 'Couleur automatique (cliquer pour choisir)'} value={c.color ?? '#7c3aed'} aria-label="Couleur" onChange={(e) => setCandidate(c.key, { color: e.target.value })} />
                  {c.color && <button type="button" className="ava-ic" onClick={() => setCandidate(c.key, { color: null })} aria-label="Retirer la couleur" title="Couleur automatique"><X className="h-3.5 w-3.5" /></button>}
                  {c.imageUrl && <button type="button" className="ava-ic danger" onClick={() => setCandidate(c.key, { imageUrl: null })} aria-label="Retirer la photo" title="Retirer la photo"><ImageOff className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
              <div className="ac">
                <button type="button" className="ava-ic" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" className="ava-ic" onClick={() => duplicate(i)} disabled={full} aria-label="Dupliquer"><Copy className="h-3.5 w-3.5" /></button>
                <button type="button" className="ava-ic" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                <button type="button" className="ava-ic danger" onClick={() => remove(i)} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="ava-add" onClick={() => set('candidates', [...list, emptyCandidate()])} disabled={full}>
          + Ajouter un choix
        </button>
        <div className="ava-note">
          <span>{list.length} choix · glisser ⋮⋮ ou flèches pour réordonner</span>
          <span className={list.length > VOTE_LIMITS.recommendedMaxCandidates ? 'warn' : undefined}>
            {list.length > VOTE_LIMITS.recommendedMaxCandidates ? `Au-delà de ${VOTE_LIMITS.recommendedMaxCandidates}, la liste devient longue sur téléphone` : `Conseillé : 2 à ${VOTE_LIMITS.recommendedMaxCandidates} · maximum ${VOTE_LIMITS.maxCandidates}`}
          </span>
        </div>
      </div>
    </div>
  )
}
