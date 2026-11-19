'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo, loto musical : fenêtre « Mes playlists » de la régie.
// Bibliothèque du COMPTE (réutilisable d'une soirée à l'autre). Une partie en
// cours joue sa copie figée : modifier ou supprimer une playlist ici ne la
// touche jamais.
// Découpe des extraits : AudioTrimmer du Quiz, importé SANS modification.

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  MUSIC_ARTIST_MAX, MUSIC_MAX_TRACKS, MUSIC_MIN_TRACKS, MUSIC_PLAYLIST_NAME_MAX, MUSIC_TITLE_MAX, guessFromFilename, playlistProblem,
} from '@/lib/bingo/music'
import {
  deletePlaylist, discardMusic, fetchPlaylists, MusicError, savePlaylist, uploadMusic, type LibraryPlaylist, type LibraryTrack,
} from '@/lib/bingo/music-client'
import type { ConfirmRequest } from './ConfirmDialog'

const AudioTrimmer = dynamic(() => import('@/app/admin/jeux/quiz/AudioTrimmer'), { ssr: false })

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`)

export const SACEM_NOTE = 'Vous devez disposer des droits de diffusion des morceaux (SACEM, etc.) : AnimaJet ne fournit aucune musique.'

interface Draft { id?: string; name: string; tracks: LibraryTrack[] }

export function PlaylistLibrary({ onClose, onChanged, notify, askConfirm }: {
  onClose: () => void
  /** Liste à jour (pour le choix de la playlist au lancement). */
  onChanged: (lists: LibraryPlaylist[]) => void
  notify: (text: string, kind?: 'error' | 'info') => void
  askConfirm: (r: ConfirmRequest) => void
}) {
  const [lists, setLists] = useState<LibraryPlaylist[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const reload = useCallback(async () => {
    try {
      const l = await fetchPlaylists()
      setLists(l)
      setLoadError(null)
      onChanged(l)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Lecture impossible')
    }
  }, [onChanged])
  useEffect(() => {
    let off = false
    fetchPlaylists()
      .then((l) => {
        if (off) return
        setLists(l)
        onChanged(l)
      })
      .catch((e) => { if (!off) setLoadError(e instanceof Error ? e.message : 'Lecture impossible') })
    return () => { off = true }
  }, [onChanged])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !draft) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, draft])

  return (
    <div className="bgo-modal" role="dialog" aria-modal="true" aria-label="Mes playlists" data-testid="playlists-modal">
      <div className="card bgo pl-card">
        {draft ? (
          <PlaylistEditor
            initial={draft}
            notify={notify}
            askConfirm={askConfirm}
            onDone={async () => {
              setDraft(null)
              await reload()
            }}
          />
        ) : (
          <>
            <h4>Mes playlists</h4>
            <p className="note" style={{ marginTop: 0 }}>
              Gardées avec votre compte, réutilisables à chaque soirée. {MUSIC_MIN_TRACKS} à {MUSIC_MAX_TRACKS} titres par playlist.
              Une partie en cours n’est jamais touchée par vos modifications.
            </p>
            {loadError && <div className="banner bad" style={{ margin: '10px 0' }}>{loadError} <button className="btn sm ghost" onClick={() => void reload()}>Réessayer</button></div>}
            {!lists && !loadError && <p className="note">Chargement…</p>}
            {lists?.length === 0 && <p className="note">Aucune playlist pour l’instant.</p>}
            <div className="pl-list">
              {lists?.map((p) => (
                <div key={p.id} className="opt" data-testid="playlist-row">
                  <div className="t">
                    <b>{p.name}</b>
                    <span>{p.tracks.length} titre{p.tracks.length > 1 ? 's' : ''} · {p.problem ?? 'prête à jouer'}</span>
                  </div>
                  <button className="btn sm ghost" onClick={() => setDraft({ id: p.id, name: p.name, tracks: p.tracks })}>Modifier</button>
                  <button
                    className="btn sm danger"
                    onClick={() => askConfirm({
                      title: `Supprimer « ${p.name} » ?`,
                      message: 'La playlist et ses morceaux seront effacés de votre compte.',
                      note: 'Une partie en cours avec cette playlist continue normalement.',
                      check: 'J’ai compris : la playlist sera supprimée.',
                      confirm: 'Supprimer la playlist',
                      onConfirm: async () => {
                        try {
                          await deletePlaylist(p.id)
                          notify('Playlist supprimée.')
                        } catch (e) {
                          notify(e instanceof Error ? e.message : 'Suppression impossible', 'error')
                        }
                        await reload()
                      },
                    })}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
            <p className="note">{SACEM_NOTE}</p>
            <div className="acts">
              <button className="btn ghost" onClick={onClose}>Fermer</button>
              <button className="btn gold" onClick={() => setDraft({ name: '', tracks: [] })} disabled={!lists || lists.length >= 50} data-testid="playlist-new">
                + Nouvelle playlist
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ éditeur

function PlaylistEditor({ initial, notify, askConfirm, onDone }: {
  initial: Draft
  notify: (text: string, kind?: 'error' | 'info') => void
  askConfirm: (r: ConfirmRequest) => void
  onDone: () => Promise<void>
}) {
  const [name, setName] = useState(initial.name)
  const [tracks, setTracks] = useState<LibraryTrack[]>(initial.tracks)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<{ done: number; total: number; stage: string } | null>(null)
  const [trimId, setTrimId] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopAt = useRef<number>(0)
  // Morceaux envoyés pendant cette édition : effacés si on abandonne sans enregistrer.
  const fresh = useRef<Set<string>>(new Set())
  const dirty = useRef(false)

  useEffect(() => () => audioRef.current?.pause(), [])

  const update = (id: string, patch: Partial<LibraryTrack>) => {
    dirty.current = true
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function preview(t: LibraryTrack) {
    const a = audioRef.current ?? (audioRef.current = new Audio())
    if (playing === t.id) {
      a.pause()
      setPlaying(null)
      return
    }
    a.ontimeupdate = () => { if (a.currentTime >= stopAt.current) { a.pause(); setPlaying(null) } }
    a.onended = () => setPlaying(null)
    a.src = t.url
    stopAt.current = t.end
    a.currentTime = t.start
    void a.play().then(() => setPlaying(t.id)).catch(() => notify('Lecture impossible sur ce navigateur.', 'error'))
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const room = MUSIC_MAX_TRACKS - tracks.length
    const list = Array.from(files).slice(0, Math.max(0, room))
    if (files.length > room) notify(`${MUSIC_MAX_TRACKS} titres au maximum : ${files.length - room} fichier(s) ignoré(s).`, 'error')
    let done = 0
    const errors: string[] = []
    for (const f of list) {
      setUploading({ done, total: list.length, stage: 'Envoi' })
      try {
        const up = await uploadMusic(f, (s) => setUploading({ done, total: list.length, stage: s === 'compressing' ? 'Compression' : s === 'uploading' ? 'Envoi' : 'Vérification' }))
        fresh.current.add(up.path)
        dirty.current = true
        const g = guessFromFilename(f.name)
        setTracks((ts) => [...ts, { id: newId(), title: g.title || 'Sans titre', artist: g.artist, path: up.path, url: up.url, start: up.start, end: up.end }])
      } catch (e) {
        errors.push(e instanceof MusicError ? e.message : `« ${f.name} » : envoi impossible.`)
      }
      done++
    }
    setUploading(null)
    if (errors.length) notify(errors.slice(0, 3).join(' '), 'error')
    else notify(`${list.length} morceau${list.length > 1 ? 'x' : ''} ajouté${list.length > 1 ? 's' : ''}.`)
  }

  async function save() {
    if (!name.trim()) {
      notify('Donnez un nom à la playlist.', 'error')
      return
    }
    setSaving(true)
    try {
      await savePlaylist({ id: initial.id, name: name.trim(), tracks: tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist, path: t.path, start: t.start, end: t.end })) })
      fresh.current.clear()
      dirty.current = false
      notify('Playlist enregistrée.')
      await onDone()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Enregistrement impossible', 'error')
    } finally {
      setSaving(false)
    }
  }

  function leave() {
    const drop = () => {
      // Morceaux envoyés mais jamais enregistrés : effacés (le serveur garde tout ce qui est cité ailleurs).
      for (const p of fresh.current) discardMusic(p)
      fresh.current.clear()
      void onDone()
    }
    if (!dirty.current) return drop()
    askConfirm({
      title: 'Quitter sans enregistrer ?',
      message: 'Les changements de cette playlist seront perdus.',
      check: 'J’ai compris : mes changements ne sont pas enregistrés.',
      confirm: 'Quitter sans enregistrer',
      onConfirm: async () => drop(),
    })
  }

  const problem = playlistProblem(tracks)
  const busy = saving || uploading !== null
  return (
    <div data-testid="playlist-editor">
      <h4>{initial.id ? 'Modifier la playlist' : 'Nouvelle playlist'}</h4>
      <div className="field" style={{ marginBottom: 10 }}>
        <input
          autoComplete="off"
          name="nom-playlist"
          placeholder="Nom de la playlist (ex. Années 80)"
          aria-label="Nom de la playlist"
          maxLength={MUSIC_PLAYLIST_NAME_MAX}
          value={name}
          onChange={(e) => { dirty.current = true; setName(e.target.value) }}
          data-testid="playlist-name"
        />
      </div>
      <div className="pl-head">
        <span className={tracks.length < MUSIC_MIN_TRACKS ? 'warn' : 'okc'}>
          {tracks.length} / {MUSIC_MAX_TRACKS} titres{tracks.length < MUSIC_MIN_TRACKS ? ` · encore ${MUSIC_MIN_TRACKS - tracks.length} pour jouer` : ' · prête à jouer'}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/flac,.mp3,.m4a,.aac,.wav,.ogg,.flac"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
          data-testid="playlist-files"
        />
        <button className="btn sm gold" onClick={() => fileRef.current?.click()} disabled={busy || tracks.length >= MUSIC_MAX_TRACKS}>
          + Ajouter des morceaux
        </button>
      </div>
      {uploading && (
        <div className="banner info" style={{ margin: '8px 0' }} role="status" data-testid="playlist-uploading">
          {uploading.stage}… morceau {Math.min(uploading.done + 1, uploading.total)} sur {uploading.total}. Gardez cette fenêtre ouverte.
        </div>
      )}
      {problem && tracks.length >= MUSIC_MIN_TRACKS && <div className="banner warn" style={{ margin: '8px 0' }}>{problem}</div>}

      <ol className="pl-tracks" aria-label="Titres de la playlist">
        {tracks.map((t, i) => (
          <li key={t.id} data-testid="playlist-track">
            <div className="row">
              <span className="num">{i + 1}</span>
              <input
                className="input" autoComplete="off" name={`titre-${i}`} aria-label={`Titre du morceau ${i + 1}`}
                maxLength={MUSIC_TITLE_MAX} value={t.title} onChange={(e) => update(t.id, { title: e.target.value })}
              />
              <input
                className="input" autoComplete="off" name={`artiste-${i}`} aria-label={`Artiste du morceau ${i + 1}`} placeholder="Artiste"
                maxLength={MUSIC_ARTIST_MAX} value={t.artist} onChange={(e) => update(t.id, { artist: e.target.value })}
              />
              <button className="btn sm ghost" onClick={() => preview(t)} aria-label={playing === t.id ? 'Arrêter' : `Écouter l’extrait du morceau ${i + 1}`}>
                {playing === t.id ? '■' : '▶'} {fmt(t.start)}–{fmt(t.end)}
              </button>
              <button className="btn sm ghost" onClick={() => setTrimId(trimId === t.id ? null : t.id)} aria-expanded={trimId === t.id}>Découper</button>
              <button
                className="btn sm danger" aria-label={`Retirer le morceau ${i + 1}`}
                onClick={() => {
                  dirty.current = true
                  if (fresh.current.has(t.path)) {
                    fresh.current.delete(t.path)
                    discardMusic(t.path)
                  }
                  setTracks((ts) => ts.filter((x) => x.id !== t.id))
                }}
              >
                ✕
              </button>
            </div>
            {trimId === t.id && (
              <div className="trim">
                <AudioTrimmer
                  key={t.path}
                  audioUrl={t.url}
                  initialStart={t.start}
                  initialEnd={t.end}
                  onValidate={(start, end) => {
                    if (end - start < 3 || end - start > 120) {
                      notify('L’extrait doit durer entre 3 secondes et 2 minutes.', 'error')
                      return
                    }
                    update(t.id, { start, end })
                    setTrimId(null)
                    notify('Extrait enregistré dans le brouillon (pensez à « Enregistrer »).')
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
      {tracks.length === 0 && <p className="note">Ajoutez vos morceaux (MP3, M4A, WAV, OGG ou FLAC, 15 Mo au maximum chacun). Titre et artiste sont devinés d’après le nom du fichier (« Artiste - Titre.mp3 »).</p>}
      <p className="note">{SACEM_NOTE}</p>
      <div className="acts">
        <button className="btn ghost" onClick={leave} disabled={busy}>Retour</button>
        <button className="btn gold" onClick={() => void save()} disabled={busy} data-testid="playlist-save">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </div>
  )
}
