'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBuzz — préparation des manches (avant le lancement).
// Choix du mode (libre / manches préparées), liste des manches, éditeur d'une
// manche, bibliothèque. Tout est facultatif dans une manche.
// Briques réutilisées SANS modification : AudioTrimmer (Quiz), compressAudio,
// compressImage (via media-client).

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  BarChart3, BookOpen, Check, ChevronDown, ChevronUp, Copy, ImageIcon, Loader2, Music, Plus, Save, Trash2, Upload, X,
} from 'lucide-react'
import { toast } from 'sonner'
import Buzzer from '@/components/buzzer/Buzzer'
import { LoadBuzzerSetModal, SaveBuzzerSetModal } from '@/components/buzzer/prep/PrepLibrary'
import type { DraftSaveStatus } from '@/hooks/useBuzzerPrepDraft'
import { buzzerMediaUrl, MediaUploadError, uploadBuzzerMedia, type UploadStage } from '@/lib/buzzer/media-client'
import {
  PREP_LIMITS, emptyRound, formatSeconds, isEmptyRound, newRoundId,
  type BuzzerMediaKind, type PrepDraft, type PrepRound, type PrepVote,
} from '@/lib/buzzer/prep'

const AudioTrimmer = dynamic(() => import('@/app/admin/jeux/quiz/AudioTrimmer'), { ssr: false })

const displayFont = { fontFamily: 'var(--font-bz-display), "Arial Black", sans-serif' } as const
const fieldClass = 'w-full rounded-xl bg-[#111114] border border-white/10 focus:border-[#D4AF37] outline-none px-3 py-2.5 text-white text-sm'
const smallBtn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-white/10 text-gray-200 hover:border-[#D4AF37]/40 disabled:opacity-40'
const iconBtn = 'w-8 h-8 inline-grid place-items-center rounded-lg border border-white/10 text-gray-300 hover:border-[#D4AF37]/40 disabled:opacity-30'
const sectionClass = 'rounded-xl bg-black/20 border border-white/[0.07] p-4 flex flex-col gap-3'
const goldBadge = 'inline-grid place-items-center rounded-full text-[#1A1A1E] bg-[radial-gradient(circle_at_40%_30%,#fff3c4,#d4af37_60%,#8a6516)]'
const LETTERS = ['A', 'B', 'C', 'D']

const STAGE_LABEL: Record<UploadStage, string> = {
  compressing: 'Compression…',
  uploading: 'Envoi…',
  checking: 'Vérification…',
}

// ---------------------------------------------------------------------
// Choix du mode
// ---------------------------------------------------------------------

export function PrepModeChooser({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const card = (prep: boolean) => {
    const selected = enabled === prep
    return (
      <label
        className={`relative cursor-pointer rounded-2xl p-4 flex items-center gap-4 border transition ${
          selected
            ? 'border-[#D4AF37] bg-gradient-to-br from-[#D4AF37]/15 via-violet-600/10 to-transparent shadow-[0_0_0_4px_rgba(212,175,55,0.08)]'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input type="radio" name="bz-play-mode" className="sr-only" checked={selected} onChange={() => onChange(prep)} />
        <Buzzer state={prep ? 'open' : 'off'} size="64px" mini />
        <span className="flex flex-col gap-1 min-w-0">
          <span className="text-white flex items-center gap-2" style={displayFont}>
            {prep ? 'Manches préparées' : 'Mode libre'}
            {prep && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37] text-[#1A1A1E] font-sans font-bold">NOUVEAU</span>}
          </span>
          <span className="text-sm text-[#9a94b5] leading-snug">
            {prep
              ? 'Blind test ou quiz préparé à l’avance : question, extrait qui s’arrête au buzz, réponse, image et vote de la salle.'
              : 'Comme aujourd’hui : vous posez les questions au micro, AnimaBuzz donne la parole au plus rapide.'}
          </span>
        </span>
        {selected && <Check className="absolute right-3 top-3 h-5 w-5 text-[#1A1A1E] bg-[#D4AF37] rounded-full p-0.5" aria-hidden />}
      </label>
    )
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Comment voulez-vous jouer ?">
      <h2 className="text-white text-lg" style={displayFont}>Comment voulez-vous jouer ?</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {card(false)}
        {card(true)}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------
// Éditeur
// ---------------------------------------------------------------------

interface PrepEditorProps {
  sessionId: string
  draft: PrepDraft
  setDraft: (update: (prev: PrepDraft) => PrepDraft) => void
  status: DraftSaveStatus
  error: string | null
}

type Uploads = Record<string, { kind: BuzzerMediaKind; stage: UploadStage } | undefined>

export default function PrepEditor({ sessionId, draft, setDraft, status, error }: PrepEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(draft.rounds[0]?.id ?? null)
  const [uploads, setUploads] = useState<Uploads>({})
  const [showSave, setShowSave] = useState(false)
  const [showLoad, setShowLoad] = useState(false)

  const rounds = draft.rounds
  const selectedIndex = rounds.findIndex((r) => r.id === selectedId)
  const selected = selectedIndex >= 0 ? rounds[selectedIndex] : null

  // Manche sélectionnée supprimée (ou liste rechargée) : on se replace sur la première.
  useEffect(() => {
    if (!selected && rounds.length > 0) setSelectedId(rounds[0].id)
  }, [selected, rounds])

  const setRounds = (fn: (list: PrepRound[]) => PrepRound[]) => setDraft((d) => ({ ...d, rounds: fn(d.rounds) }))
  const updateRound = (id: string, patch: Partial<PrepRound>) => setRounds((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  function addRound() {
    if (rounds.length >= PREP_LIMITS.maxRounds) {
      toast.error(`${PREP_LIMITS.maxRounds} manches au maximum`)
      return
    }
    const r = emptyRound()
    setRounds((list) => [...list, r])
    setSelectedId(r.id)
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta
    if (to < 0 || to >= rounds.length) return
    setRounds((list) => {
      const next = [...list]
      ;[next[index], next[to]] = [next[to], next[index]]
      return next
    })
  }

  function duplicate(r: PrepRound) {
    if (rounds.length >= PREP_LIMITS.maxRounds) {
      toast.error(`${PREP_LIMITS.maxRounds} manches au maximum`)
      return
    }
    const copy: PrepRound = { ...r, id: newRoundId(), vote: r.vote ? { ...r.vote, choices: [...r.vote.choices] } : null }
    setRounds((list) => {
      const i = list.findIndex((x) => x.id === r.id)
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]
    })
    setSelectedId(copy.id)
  }

  function removeRound(r: PrepRound, n: number) {
    if (!isEmptyRound(r) && !window.confirm(`Supprimer la manche ${n} ?`)) return
    setRounds((list) => list.filter((x) => x.id !== r.id))
  }

  function clearAll() {
    if (rounds.length === 0) return
    if (!window.confirm('Vider la liste ? Toutes les manches de cette session seront retirées (votre bibliothèque n’est pas touchée).')) return
    setDraft((d) => ({ ...d, name: '', rounds: [] }))
  }

  async function upload(roundId: string, kind: BuzzerMediaKind, file: File) {
    setUploads((u) => ({ ...u, [`${roundId}:${kind}`]: { kind, stage: 'compressing' } }))
    try {
      const path = await uploadBuzzerMedia(sessionId, file, kind, (stage) =>
        setUploads((u) => ({ ...u, [`${roundId}:${kind}`]: { kind, stage } })),
      )
      if (kind === 'audio') updateRound(roundId, { audioPath: path, audioName: file.name.slice(0, PREP_LIMITS.audioNameMaxLength), audioStart: null, audioEnd: null })
      else updateRound(roundId, { imagePath: path })
      toast.success(kind === 'audio' ? 'Extrait enregistré' : 'Image enregistrée')
    } catch (e) {
      toast.error(e instanceof MediaUploadError ? e.message : 'Envoi impossible, réessayez.')
    } finally {
      setUploads((u) => ({ ...u, [`${roundId}:${kind}`]: undefined }))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de la liste et bibliothèque */}
      <section className="card-gold rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-[#D4AF37]/15 text-[#D4AF37]"><BookOpen className="h-4 w-4" aria-hidden /></span>
        <input
          aria-label="Nom de la liste"
          value={draft.name}
          maxLength={PREP_LIMITS.nameMaxLength}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Nom de la liste (ex : Blind test du mariage)"
          className="min-w-[200px] flex-1 bg-transparent text-white font-semibold outline-none border-b border-transparent focus:border-[#D4AF37]/50 py-1"
        />
        <span className="text-xs px-2.5 py-1 rounded-full border border-white/15 text-gray-300">{rounds.length} manche{rounds.length > 1 ? 's' : ''}</span>
        <SaveStatus status={status} error={error} />
        <span className="flex flex-wrap gap-2">
          <button type="button" className={smallBtn} onClick={() => setShowLoad(true)}><BookOpen className="h-4 w-4" aria-hidden />Ouvrir la bibliothèque</button>
          <button type="button" className={smallBtn} onClick={() => setShowSave(true)} disabled={rounds.length === 0}><Save className="h-4 w-4" aria-hidden />Enregistrer</button>
          <button type="button" className={`${smallBtn} text-red-300 border-red-300/25`} onClick={clearAll} disabled={rounds.length === 0}><Trash2 className="h-4 w-4" aria-hidden />Tout vider</button>
        </span>
      </section>

      <div className="flex flex-wrap gap-4 items-start">
        {/* Liste des manches */}
        <section className="card-gold rounded-xl p-4 flex flex-col gap-2 flex-[1_1_340px] min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-white" style={displayFont}>Les manches</h3>
            <button type="button" onClick={addRound} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-[#1A1A1E] bg-gradient-to-br from-[#F4D03F] to-[#D4AF37]">
              <Plus className="h-4 w-4" aria-hidden />Ajouter une manche
            </button>
          </div>
          {rounds.length === 0 ? (
            <p className="text-sm text-[#9a94b5] py-6 text-center">Aucune manche. Ajoutez-en une ou chargez une liste de votre bibliothèque.</p>
          ) : (
            <ol className="flex flex-col gap-1.5 max-h-[560px] overflow-y-auto pr-1">
              {rounds.map((r, i) => {
                const isSel = r.id === selected?.id
                return (
                  <li key={r.id}>
                    <div
                      className={`grid grid-cols-[22px_40px_minmax(0,1fr)_auto] gap-2.5 items-center p-2 rounded-xl border cursor-pointer ${
                        isSel ? 'border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/15 to-[#D4AF37]/[0.03]' : 'border-transparent bg-white/[0.035] hover:border-white/10'
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <span className={`text-center text-sm ${isSel ? 'text-[#D4AF37]' : 'text-[#7d7891]'}`} style={displayFont}>{i + 1}</span>
                      <RoundThumb round={r} />
                      <span className="min-w-0 flex flex-col gap-1">
                        <button type="button" className="text-left truncate text-sm font-bold text-white" onClick={() => setSelectedId(r.id)}>
                          {r.question || <span className="text-[#7d7891] font-normal italic">Sans question</span>}
                        </button>
                        <RoundChips round={r} />
                      </span>
                      <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={iconBtn} aria-label={`Monter la manche ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" className={iconBtn} aria-label={`Descendre la manche ${i + 1}`} disabled={i === rounds.length - 1} onClick={() => move(i, 1)}><ChevronDown className="h-4 w-4" /></button>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Éditeur de la manche sélectionnée */}
        <section className="card-gold rounded-xl p-5 flex flex-col gap-4 flex-[999_1_560px] min-w-0">
          {!selected ? (
            <p className="text-sm text-[#9a94b5] py-10 text-center">Sélectionnez ou ajoutez une manche pour la préparer.</p>
          ) : (
            <RoundForm
              key={selected.id}
              round={selected}
              index={selectedIndex}
              uploads={uploads}
              onChange={(patch) => updateRound(selected.id, patch)}
              onUpload={(kind, file) => void upload(selected.id, kind, file)}
              onDuplicate={() => duplicate(selected)}
              onRemove={() => removeRound(selected, selectedIndex + 1)}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-gray-300 border-t border-white/[0.07] pt-4">
            <input
              type="checkbox"
              className="accent-[#D4AF37] w-4 h-4"
              checked={draft.settings.resumeAfterRight}
              onChange={(e) => setDraft((d) => ({ ...d, settings: { ...d.settings, resumeAfterRight: e.target.checked } }))}
            />
            Après une bonne réponse, la musique reprend jusqu’à la fin de l’extrait
          </label>
        </section>
      </div>

      {showSave && (
        <SaveBuzzerSetModal
          initialName={draft.name}
          rounds={rounds}
          settings={draft.settings}
          onSaved={(name) => setDraft((d) => ({ ...d, name }))}
          onClose={() => setShowSave(false)}
        />
      )}
      {showLoad && (
        <LoadBuzzerSetModal
          hasRounds={rounds.length > 0}
          onClose={() => setShowLoad(false)}
          onLoad={(saved) => {
            const loaded = Array.isArray(saved.rounds) ? saved.rounds.slice(0, PREP_LIMITS.maxRounds) : []
            setDraft((d) => ({ ...d, name: saved.name, rounds: loaded, settings: { ...d.settings, ...(saved.settings ?? {}) } }))
            setSelectedId(loaded[0]?.id ?? null)
            setShowLoad(false)
            toast.success(`« ${saved.name} » chargée`)
          }}
        />
      )}
    </div>
  )
}

function SaveStatus({ status, error }: { status: DraftSaveStatus; error: string | null }) {
  if (status === 'error' || error) {
    return <span className="text-xs text-orange-300 max-w-[340px]" role="alert">Non enregistré : {error ?? 'réessayez.'}</span>
  }
  if (status === 'saving') return <span className="text-xs text-[#9a94b5] inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />Enregistrement…</span>
  if (status === 'saved') return <span className="text-xs text-emerald-300 inline-flex items-center gap-1"><Check className="h-3 w-3" aria-hidden />Enregistré</span>
  return null
}

function RoundThumb({ round }: { round: PrepRound }) {
  if (round.imagePath) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={buzzerMediaUrl(round.imagePath)} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-[#f3d77a]/60" />
  }
  return (
    <span className="w-10 h-10 rounded-lg grid place-items-center bg-white/[0.06] text-[#7d7891]" aria-hidden>
      {round.audioPath ? <Music className="h-4 w-4" /> : round.vote ? <BarChart3 className="h-4 w-4" /> : <span className="text-xs">—</span>}
    </span>
  )
}

function RoundChips({ round }: { round: PrepRound }) {
  const chip = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border'
  return (
    <span className="flex flex-wrap gap-1">
      {round.audioPath ? (
        <span className={`${chip} border-white/15 text-gray-300`}>
          <Music className="h-3 w-3" aria-hidden />
          {round.audioStart !== null && round.audioEnd !== null ? `${formatSeconds(round.audioStart)} → ${formatSeconds(round.audioEnd)}` : 'Audio'}
        </span>
      ) : (
        <span className={`${chip} border-white/10 text-[#7d7891]`}>Sans audio</span>
      )}
      {round.imagePath && <span className={`${chip} border-white/15 text-gray-300`}>Image</span>}
      {round.vote && <span className={`${chip} border-violet-400/60 text-violet-200`}>Vote de la salle</span>}
    </span>
  )
}

// ---------------------------------------------------------------------
// Formulaire d'une manche
// ---------------------------------------------------------------------

interface RoundFormProps {
  round: PrepRound
  index: number
  uploads: Uploads
  onChange: (patch: Partial<PrepRound>) => void
  onUpload: (kind: BuzzerMediaKind, file: File) => void
  onDuplicate: () => void
  onRemove: () => void
}

function RoundForm({ round, index, uploads, onChange, onUpload, onDuplicate, onRemove }: RoundFormProps) {
  const audioInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const audioUpload = uploads[`${round.id}:audio`]
  const imageUpload = uploads[`${round.id}:image`]
  const n = index + 1

  const pick = (kind: BuzzerMediaKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onUpload(kind, file)
  }

  const setVote = (vote: PrepVote | null) => onChange({ vote })
  const vote = round.vote

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-white text-lg" style={displayFont}>
          <span className={`${goldBadge} w-8 h-8 text-sm`}>{n}</span>
          Manche {n}
        </h3>
        <span className="flex flex-wrap gap-2">
          <button type="button" className={smallBtn} onClick={onDuplicate}><Copy className="h-4 w-4" aria-hidden />Dupliquer</button>
          <button type="button" className={`${smallBtn} text-red-300`} onClick={onRemove}><Trash2 className="h-4 w-4" aria-hidden />Supprimer</button>
        </span>
      </div>
      <p className="text-xs text-[#9a94b5] -mt-2">Tout est facultatif. Une manche vide se joue comme en mode libre.</p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`q-${round.id}`} className="text-sm font-semibold text-gray-300">Question affichée sur l’écran géant</label>
        <input
          id={`q-${round.id}`}
          className={fieldClass}
          value={round.question ?? ''}
          maxLength={PREP_LIMITS.questionMaxLength}
          placeholder="Ex : Qui chante ce tube ?"
          onChange={(e) => onChange({ question: e.target.value })}
        />
      </div>

      {/* Extrait audio */}
      <div className={sectionClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-white text-sm" style={displayFont}>
            <span className="w-7 h-7 rounded-lg grid place-items-center bg-[#D4AF37]/15 text-[#D4AF37]"><Music className="h-4 w-4" aria-hidden /></span>
            Extrait audio <span className="font-sans text-xs text-[#9a94b5] font-normal">· joué sur votre ordinateur uniquement</span>
          </h4>
          <span className="flex gap-2">
            <input ref={audioInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" className="hidden" onChange={pick('audio')} />
            <button type="button" className={smallBtn} disabled={!!audioUpload} onClick={() => audioInput.current?.click()}>
              {audioUpload ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              {audioUpload ? STAGE_LABEL[audioUpload.stage] : round.audioPath ? 'Remplacer' : 'Ajouter un extrait'}
            </button>
            {round.audioPath && !audioUpload && (
              <button type="button" className={smallBtn} onClick={() => onChange({ audioPath: null, audioName: null, audioStart: null, audioEnd: null })}>
                <X className="h-4 w-4" aria-hidden />Retirer
              </button>
            )}
          </span>
        </div>
        {round.audioPath ? (
          <>
            <p className="text-xs text-[#9a94b5] truncate">{round.audioName ?? 'Extrait'}</p>
            <AudioTrimmer
              key={round.audioPath}
              audioUrl={buzzerMediaUrl(round.audioPath)}
              initialStart={round.audioStart}
              initialEnd={round.audioEnd}
              onValidate={(start, end) => {
                onChange({ audioStart: start, audioEnd: end })
                toast.success('Découpe enregistrée')
              }}
            />
            <p className="text-xs text-[#9a94b5]">
              {round.audioStart !== null && round.audioEnd !== null
                ? <><b className="text-[#D4AF37]">Début {formatSeconds(round.audioStart)}</b> · <b className="text-[#D4AF37]">Fin {formatSeconds(round.audioEnd)}</b> · durée {Math.round(round.audioEnd - round.audioStart)} s</>
                : 'Pas de découpe : l’extrait sera joué depuis le début.'}
            </p>
          </>
        ) : (
          <p className="text-xs text-[#9a94b5]">MP3, M4A, WAV, OGG ou FLAC, {PREP_LIMITS.audioMaxBytes / 1024 / 1024} Mo au maximum. La musique se coupe au premier buzz.</p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Réponse */}
        <div className={sectionClass}>
          <label htmlFor={`a-${round.id}`} className="flex items-center gap-2 text-white text-sm" style={displayFont}>
            <span className="w-7 h-7 rounded-lg grid place-items-center bg-emerald-400/15 text-emerald-300"><Check className="h-4 w-4" aria-hidden /></span>
            Réponse attendue
          </label>
          <input
            id={`a-${round.id}`}
            className={fieldClass}
            value={round.answer ?? ''}
            maxLength={PREP_LIMITS.answerMaxLength}
            placeholder="Ex : Pharrell Williams — Happy"
            onChange={(e) => onChange({ answer: e.target.value })}
          />
          <p className="text-xs text-[#9a94b5]">Vue par vous seul pendant la manche, révélée sur l’écran géant après « Bonne réponse ».</p>
        </div>

        {/* Image */}
        <div className={sectionClass}>
          <h4 className="flex items-center gap-2 text-white text-sm" style={displayFont}>
            <span className="w-7 h-7 rounded-lg grid place-items-center bg-pink-400/15 text-pink-300"><ImageIcon className="h-4 w-4" aria-hidden /></span>
            Image de révélation
          </h4>
          <div className="flex items-center gap-3">
            {round.imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={buzzerMediaUrl(round.imagePath)} alt="Image de révélation" className="w-[72px] h-[72px] rounded-lg object-cover ring-2 ring-[#f3d77a]/70" />
            ) : (
              <span className="w-[72px] h-[72px] rounded-lg grid place-items-center bg-white/[0.05] text-[#7d7891]" aria-hidden><ImageIcon className="h-6 w-6" /></span>
            )}
            <span className="flex flex-col gap-2">
              <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" className="hidden" onChange={pick('image')} />
              <button type="button" className={smallBtn} disabled={!!imageUpload} onClick={() => imageInput.current?.click()}>
                {imageUpload ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                {imageUpload ? STAGE_LABEL[imageUpload.stage] : round.imagePath ? 'Remplacer' : 'Ajouter une image'}
              </button>
              {round.imagePath && !imageUpload && (
                <button type="button" className={smallBtn} onClick={() => onChange({ imagePath: null })}><X className="h-4 w-4" aria-hidden />Retirer</button>
              )}
            </span>
          </div>
          <p className="text-xs text-[#9a94b5]">Pochette, photo des mariés…</p>
        </div>
      </div>

      {/* Vote de la salle */}
      <div className={`${sectionClass} border-violet-400/40 bg-gradient-to-br from-violet-600/15 to-violet-600/[0.03]`}>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-violet-500"
            checked={!!vote}
            onChange={(e) => setVote(e.target.checked ? { question: '', choices: ['', ''], correct: null } : null)}
          />
          <span className="w-7 h-7 rounded-lg grid place-items-center bg-violet-500/20 text-violet-200"><BarChart3 className="h-4 w-4" aria-hidden /></span>
          <span className="text-white text-sm" style={displayFont}>Vote de la salle après la manche</span>
        </label>
        {vote && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`vq-${round.id}`} className="text-sm font-semibold text-gray-300">Question du vote</label>
              <input
                id={`vq-${round.id}`}
                className={fieldClass}
                value={vote.question}
                maxLength={PREP_LIMITS.voteQuestionMaxLength}
                placeholder="Ex : Qui écoute ce titre en boucle ?"
                onChange={(e) => setVote({ ...vote, question: e.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {vote.choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`${goldBadge} w-7 h-7 text-xs shrink-0`} style={displayFont}>{LETTERS[i]}</span>
                  <input
                    className={`${fieldClass} ${vote.correct === i ? 'border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]' : ''}`}
                    aria-label={`Choix ${LETTERS[i]}`}
                    value={c}
                    maxLength={PREP_LIMITS.choiceMaxLength}
                    placeholder={`Choix ${LETTERS[i]}`}
                    onChange={(e) => setVote({ ...vote, choices: vote.choices.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                  {vote.choices.length > PREP_LIMITS.minChoices && (
                    <button
                      type="button"
                      className={iconBtn}
                      aria-label={`Retirer le choix ${LETTERS[i]}`}
                      onClick={() => {
                        const choices = vote.choices.filter((_, j) => j !== i)
                        const correct = vote.correct === null || vote.correct === i ? null : vote.correct > i ? vote.correct - 1 : vote.correct
                        setVote({ ...vote, choices, correct })
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {vote.choices.length < PREP_LIMITS.maxChoices && (
                <button type="button" className={smallBtn} onClick={() => setVote({ ...vote, choices: [...vote.choices, ''] })}>
                  <Plus className="h-4 w-4" aria-hidden />Ajouter un choix ({PREP_LIMITS.maxChoices} au maximum)
                </button>
              )}
              <span className="flex-1" />
              <label htmlFor={`vc-${round.id}`} className="text-xs text-[#9a94b5]">Bonne réponse du vote</label>
              <select
                id={`vc-${round.id}`}
                className="rounded-xl bg-[#111114] border border-white/10 px-3 py-2 text-white text-sm"
                value={vote.correct ?? ''}
                onChange={(e) => setVote({ ...vote, correct: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Aucune</option>
                {vote.choices.map((c, i) => <option key={i} value={i}>{LETTERS[i]}{c.trim() ? ` · ${c.trim()}` : ''}</option>)}
              </select>
            </div>
            <p className="text-xs text-[#9a94b5]">Le vote ne démarre jamais tout seul : vous l’ouvrez pendant la soirée, ou vous le sautez.</p>
          </>
        )}
      </div>
    </>
  )
}
