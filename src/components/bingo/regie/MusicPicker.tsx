'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo : choix du mode avant le lancement (loto numéros ou loto
// musical) et de la playlist. Le mode ne change plus pendant la partie :
// pour changer, « Quitter le jeu » puis relancer.

import { useEffect, useMemo, useState } from 'react'
import { fetchPlaylists, type LibraryPlaylist } from '@/lib/bingo/music-client'
import { SACEM_NOTE } from './PlaylistLibrary'

export function MusicPicker({ mode, onMode, playlists, onPlaylists, playlistId, onPlaylist, onOpenLibrary }: {
  mode: 'numbers' | 'music'
  onMode: (m: 'numbers' | 'music') => void
  playlists: LibraryPlaylist[] | null
  onPlaylists: (l: LibraryPlaylist[]) => void
  playlistId: string
  onPlaylist: (id: string) => void
  onOpenLibrary: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (mode !== 'music' || playlists) return
    let off = false
    fetchPlaylists()
      .then((l) => { if (!off) onPlaylists(l) })
      .catch((e) => { if (!off) setError(e instanceof Error ? e.message : 'Lecture des playlists impossible') })
    return () => { off = true }
  }, [mode, playlists, onPlaylists])

  const ready = useMemo(() => (playlists ?? []).filter((p) => p.problem === null), [playlists])
  // Playlist choisie supprimée ou devenue incomplète : on la retire du choix.
  useEffect(() => {
    if (playlistId && playlists && !ready.some((p) => p.id === playlistId)) onPlaylist('')
    else if (!playlistId && ready.length === 1) onPlaylist(ready[0].id)
  }, [playlistId, playlists, ready, onPlaylist])

  return (
    <div className="music-pick" data-testid="music-pick">
      <div className="seg" role="group" aria-label="Type de loto" style={{ marginTop: 0 }}>
        <button type="button" aria-pressed={mode === 'numbers'} onClick={() => onMode('numbers')} data-testid="mode-numbers">Loto numéros</button>
        <button type="button" aria-pressed={mode === 'music'} onClick={() => onMode('music')} data-testid="mode-music">Loto musical</button>
      </div>
      {mode === 'music' && (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            Les joueurs cochent des titres de chansons au lieu des numéros. Vous tirez un morceau, la régie joue l’extrait sur cet
            ordinateur (relié à la sono), puis le titre apparaît à l’écran. Tirage au clic uniquement.
          </p>
          {error && <div className="note" style={{ color: '#ffb4b4' }}>{error}</div>}
          <div className="field">
            <select
              aria-label="Playlist de la partie"
              name="choix-playlist"
              value={playlistId}
              onChange={(e) => onPlaylist(e.target.value)}
              data-testid="playlist-select"
            >
              <option value="">{playlists === null ? 'Chargement…' : ready.length ? 'Choisir une playlist…' : 'Aucune playlist prête (30 titres minimum)'}</option>
              {ready.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.tracks.length} titres</option>)}
            </select>
            <button type="button" className="btn ghost" onClick={onOpenLibrary} data-testid="open-library">Mes playlists</button>
          </div>
          <p className="note">
            Les cartons papier sont propres à chaque playlist : ceux imprimés pour une autre playlist, ou pour le loto numéros,
            ne seront pas reconnus pendant cette partie (ils restent gardés). {SACEM_NOTE}
          </p>
        </>
      )}
    </div>
  )
}
