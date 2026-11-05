// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Download, FileUp, Loader2, X } from 'lucide-react'
import { QUIZ_LIMITS, TransferError } from '@/lib/games/quiz-transfer/format'
import {
  QUIZ_EXPORT_NOTICE,
  QUIZ_IMPORT_FAILED_MESSAGE,
  prepareQuizImport,
  type PreparedQuizImport,
  type StoredQuestion,
  type TransferProgress,
} from '@/lib/games/quiz-transfer/transfer'
import { formatFileSize } from '@/lib/image-utils'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof TransferError ? error.message : fallback
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? 's' : ''}`
}

function penaltyLabel(points: number): string {
  return points === 0 ? 'Aucune' : `-${plural(points, 'pt')}`
}

function ModalFrame({
  icon,
  title,
  subtitle,
  onClose,
  closable,
  children,
  footer,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onClose: () => void
  closable: boolean
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="card-gold rounded-2xl border-[#D4AF37]/30 shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 text-[#D4AF37]">
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </div>
          {closable && (
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">{children}</div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">{footer}</div>
      </motion.div>
    </div>
  )
}

function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div role="status" className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
        {label} ({done}/{total})
      </div>
      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
        <div className="h-full bg-[#D4AF37] transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="flex gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </p>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-white text-right break-words min-w-0">{value}</dd>
    </div>
  )
}

const CANCEL_CLASS = 'px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50'
const PRIMARY_CLASS =
  'px-4 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black rounded-xl font-bold hover:from-[#F4D03F] hover:to-[#D4AF37] flex items-center gap-2 transition-all duration-200 disabled:opacity-60'

export function QuizExportModal({
  questions,
  penaltyPoints,
  defaultName,
  onClose,
  onExport,
}: {
  questions: StoredQuestion[]
  penaltyPoints: number
  defaultName: string
  onClose: () => void
  onExport: (name: string, onProgress: TransferProgress) => Promise<void>
}) {
  const [name, setName] = useState(defaultName)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = progress !== null
  const audioCount = questions.reduce((n, q) => n + (q.audioUrl ? 1 : 0) + (q.questionAudioUrl ? 1 : 0), 0)
  const photoCount = questions.filter((q) => q.photoUrl).length

  async function submit() {
    setError(null)
    setProgress({ done: 0, total: 1 })
    try {
      await onExport(name, (done, total) => setProgress({ done, total }))
    } catch (err) {
      console.error('Quiz export error:', err)
      setError(messageOf(err, "L'export a échoué. Réessayez."))
      setProgress(null)
    }
  }

  return (
    <ModalFrame
      icon={<Download className="h-5 w-5" />}
      title="Exporter le quiz"
      subtitle="Un seul fichier .zip, médias compris"
      onClose={onClose}
      closable={!busy}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={CANCEL_CLASS}>
            Annuler
          </button>
          <button onClick={submit} disabled={busy || name.trim() === ''} className={PRIMARY_CLASS}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger le .zip
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="quiz-export-name" className="text-gray-400 text-xs">
          Nom du quiz
        </label>
        <input
          id="quiz-export-name"
          type="text"
          value={name}
          maxLength={QUIZ_LIMITS.nameLength}
          disabled={busy}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy && name.trim() !== '') submit()
          }}
          placeholder="Ex : Blind test mariage"
          className="w-full bg-[#2E2E33] text-white rounded-lg px-3 py-2.5 border border-[rgba(255,255,255,0.1)] focus:border-[#D4AF37] focus:outline-none mt-1"
        />
      </div>
      <dl className="space-y-1.5">
        <SummaryRow label="Questions" value={String(questions.length)} />
        <SummaryRow label="Audios" value={String(audioCount)} />
        <SummaryRow label="Photos" value={String(photoCount)} />
        <SummaryRow label="Pénalité mauvaise réponse" value={penaltyLabel(penaltyPoints)} />
      </dl>
      <p className="flex gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{QUIZ_EXPORT_NOTICE}</span>
      </p>
      <p className="text-xs text-gray-500">
        La musique d&apos;ambiance et les volumes ne sont pas inclus.
      </p>
      {progress && <ProgressBar label="Préparation du fichier" done={progress.done} total={progress.total} />}
      {error && <ErrorNote message={error} />}
    </ModalFrame>
  )
}

export function QuizImportModal({
  initialFile,
  currentCount,
  onClose,
  onImport,
}: {
  initialFile: File | null
  currentCount: number
  onClose: () => void
  onImport: (prepared: PreparedQuizImport, onProgress: TransferProgress) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const startedRef = useRef(false)
  const [prepared, setPrepared] = useState<PreparedQuizImport | null>(null)
  const [checking, setChecking] = useState<{ done: number; total: number } | null>(null)
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = checking !== null || importing !== null

  async function check(file: File) {
    setError(null)
    setPrepared(null)
    setChecking({ done: 0, total: 1 })
    try {
      setPrepared(await prepareQuizImport(file, (done, total) => setChecking({ done, total })))
    } catch (err) {
      console.error('Quiz import check error:', err)
      setError(messageOf(err, "Ce fichier n'a pas pu être lu."))
    } finally {
      setChecking(null)
    }
  }

  useEffect(() => {
    // Le fichier choisi depuis le bouton « Importer » est vérifié dès l'ouverture.
    if (initialFile && !startedRef.current) {
      startedRef.current = true
      void check(initialFile)
    }
  }, [initialFile])

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void check(file)
  }

  async function confirm() {
    if (!prepared) return
    setError(null)
    setImporting({ done: 0, total: 1 })
    try {
      await onImport(prepared, (done, total) => setImporting({ done, total }))
    } catch (err) {
      console.error('Quiz import error:', err)
      setError(messageOf(err, QUIZ_IMPORT_FAILED_MESSAGE))
    } finally {
      setImporting(null)
    }
  }

  return (
    <ModalFrame
      icon={<FileUp className="h-5 w-5" />}
      title="Importer un quiz"
      subtitle="Fichier .zip exporté depuis AnimaJet"
      onClose={onClose}
      closable={!busy}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={CANCEL_CLASS}>
            Annuler
          </button>
          {prepared ? (
            <button onClick={confirm} disabled={busy} className={PRIMARY_CLASS}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {currentCount > 0 ? 'Remplacer le quiz' : 'Importer ce quiz'}
            </button>
          ) : (
            <button onClick={() => inputRef.current?.click()} disabled={busy} className={PRIMARY_CLASS}>
              <FileUp className="h-4 w-4" />
              Choisir un fichier
            </button>
          )}
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        aria-label="Fichier de quiz"
        onChange={chooseFile}
        className="hidden"
      />
      {!prepared && !checking && !error && (
        <p className="text-sm text-gray-400">
          Choisissez le fichier reçu. Il est entièrement vérifié avant tout changement, et un aperçu
          s&apos;affiche avant l&apos;import.
        </p>
      )}
      {checking && <ProgressBar label="Vérification du fichier" done={checking.done} total={checking.total} />}
      {prepared && (
        <>
          <p className="text-sm text-green-300">✓ Fichier vérifié</p>
          <dl className="space-y-1.5">
            <SummaryRow label="Nom" value={prepared.manifest.name} />
            <SummaryRow label="Questions" value={String(prepared.questions.length)} />
            <SummaryRow label="Audios" value={String(prepared.audioCount)} />
            <SummaryRow label="Photos" value={String(prepared.photoCount)} />
            <SummaryRow label="Pénalité mauvaise réponse" value={penaltyLabel(prepared.manifest.settings.penaltyPoints)} />
            <SummaryRow label="Taille" value={formatFileSize(prepared.totalBytes)} />
          </dl>
          {currentCount > 0 && (
            <p className="flex gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Ce quiz remplacera {plural(currentCount, 'question')} actuelle{currentCount > 1 ? 's' : ''}.
              </span>
            </p>
          )}
        </>
      )}
      {importing && <ProgressBar label="Envoi des médias" done={importing.done} total={importing.total} />}
      {error && <ErrorNote message={error} />}
    </ModalFrame>
  )
}
