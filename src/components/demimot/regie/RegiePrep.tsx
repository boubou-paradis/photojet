'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot, live/Prep.tsx), qui reste la référence.

// Préparation : bibliothèque d'énigmes du compte (gardée d'une soirée à
// l'autre, /api/demimot/library), jeux utilisés pour le tirage, équipes.
// `v` absent : avant le lancement, seule la bibliothèque est affichée.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, Pencil, Plus, Save, Search, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import { cleanText, normalizeForCompare, validateSolution } from '@/lib/demimot/text'
import type { Difficulty, Puzzle } from '@/lib/demimot/types'
import { TEAM_PALETTE, type RegieView } from '@/lib/demimot/view'
import type { Send } from './api'

interface PuzzleSet {
  id: string
  name: string
  puzzleIds: string[]
}
interface Library {
  sets: PuzzleSet[]
  puzzles: Puzzle[]
  limits: { maxPuzzles: number; maxSets: number; maxImportBytes: number }
}

const DIFF: Record<Difficulty, string> = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }
const STARTER_COUNT = 129

type Notify = (t: string, kind?: 'error' | 'info') => void

async function libraryPost(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch('/api/demimot/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> }
  } catch {
    return { ok: false, data: { error: 'Connexion impossible, réessayez.' } }
  }
}

export function RegiePrep({ v, send, notify }: { v: RegieView | null; send: Send | null; notify: Notify }) {
  const [lib, setLib] = useState<Library | null>(null)
  const [sel, setSel] = useState('')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ puzzle: Puzzle; isNew: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/demimot/library', { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setLib((await res.json()) as Library)
    else notify('Bibliothèque d’énigmes inaccessible.', 'error')
  }, [notify])

  useEffect(() => {
    const t = setTimeout(() => void load(), 0)
    return () => clearTimeout(t)
  }, [load])

  const run = async (body: Record<string, unknown>, okText: string) => {
    setBusy(true)
    try {
      const { ok, data } = await libraryPost(body)
      if (!ok) {
        notify(String(data.error ?? 'Enregistrement refusé.'), 'error')
        return null
      }
      notify(okText)
      await load()
      return data
    } finally {
      setBusy(false)
    }
  }

  if (!lib) return <div className="regie-body"><div className="panel">Chargement de la bibliothèque…</div></div>

  const set = lib.sets.find((s) => s.id === sel) ?? null
  const byId = new Map(lib.puzzles.map((p) => [p.id, p]))
  const setOf = (id: string) => lib.sets.find((s) => s.puzzleIds.includes(id))?.id ?? null
  const list = (set ? set.puzzleIds.map((id) => byId.get(id)!).filter(Boolean) : lib.puzzles).filter((p) => !q || normalizeForCompare(`${p.category} ${p.solution}`).includes(normalizeForCompare(q)))
  const chosen = v?.settings.setIds ?? []
  const pool = new Set((chosen.length ? lib.sets.filter((s) => chosen.includes(s.id)).flatMap((s) => s.puzzleIds) : lib.puzzles.map((p) => p.id)).filter((id) => byId.get(id)?.active))
  const need = v ? v.settings.puzzleCount + (v.settings.finale.enabled ? v.settings.finale.puzzles : 0) : 0
  const empty = lib.puzzles.length === 0

  const savePuzzle = (p: Puzzle, setId: string | null, okText: string) => {
    const { id, ...rest } = p
    return run({ action: 'savePuzzle', setId, puzzle: id ? { id, ...rest } : rest }, okText)
  }
  const remove = (p: Puzzle) => {
    if (!window.confirm(`Supprimer définitivement « ${p.solution} » de la bibliothèque ?`)) return
    void run({ action: 'deletePuzzle', id: p.id }, 'Énigme supprimée.')
  }
  const duplicate = (p: Puzzle) => void savePuzzle({ ...p, id: '' }, setOf(p.id), 'Énigme dupliquée.')
  const toggleActive = (p: Puzzle) => void savePuzzle({ ...p, active: !p.active }, setOf(p.id), p.active ? 'Énigme désactivée.' : 'Énigme activée.')
  const toggleSet = (id: string) => send && void send({ type: 'setSettings', settings: { setIds: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] } })
  const newSet = async () => {
    const name = window.prompt('Nom du nouveau jeu d’énigmes :')?.trim()
    if (!name) return
    const data = await run({ action: 'saveSet', name }, 'Jeu créé.')
    if (data?.id) setSel(String(data.id))
  }
  const renameSet = () => {
    if (!set) return
    const name = window.prompt('Nouveau nom du jeu :', set.name)?.trim()
    if (name) void run({ action: 'saveSet', id: set.id, name }, 'Jeu renommé.')
  }
  const deleteSet = async () => {
    if (!set || !window.confirm(`Supprimer le jeu « ${set.name} » et ses ${set.puzzleIds.length} énigme(s) ? Cette suppression est définitive.`)) return
    if (await run({ action: 'deleteSet', id: set.id }, 'Jeu supprimé.')) setSel('')
  }
  const importStarter = () => void run({ action: 'importStarter' }, 'Énigmes de départ ajoutées à votre bibliothèque.')
  const importJson = async (file: File) => {
    if (file.size > lib.limits.maxImportBytes) return notify('Fichier trop volumineux (1 Mo maximum).', 'error')
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      return notify('Ce fichier n’est pas un export À Demi-Mot (JSON illisible).', 'error')
    }
    const replace = window.confirm('Remplacer toute la bibliothèque par ce fichier ?\n\nOK : remplacer tout · Annuler : ajouter à la bibliothèque')
    if (replace && !window.confirm('Confirmer le remplacement complet de la bibliothèque ? Les énigmes actuelles seront supprimées.')) return
    setBusy(true)
    try {
      const { ok, data } = await libraryPost({ action: 'import', mode: replace ? 'replace' : 'merge', file: parsed })
      if (!ok) {
        const issues = (data.issues as { path: string; message: string }[] | undefined) ?? []
        return notify(`Import refusé, rien n’a changé : ${issues.length ? issues.slice(0, 3).map((i) => `${i.path} : ${i.message}`).join(' ; ') : String(data.error ?? '')}`, 'error')
      }
      notify(`Import réussi : ${Number(data.added ?? 0)} ajoutée(s), ${Number(data.updated ?? 0)} mise(s) à jour.`)
      await load()
    } finally {
      setBusy(false)
    }
  }
  const exportHref = `/api/demimot/library?export=1${set ? `&sets=${set.id}` : ''}`

  return (
    <div className="regie-body prep" style={{ gridTemplateColumns: v ? 'minmax(260px, 0.8fr) minmax(0, 1.6fr) minmax(280px, 1fr)' : 'minmax(260px, 0.8fr) minmax(0, 1.6fr)' }}>
      <div className="panel">
        <h3>Jeux d’énigmes</h3>
        <p className="regie-help">{v ? 'Cochez les jeux utilisés pour le tirage (aucun coché : toute la bibliothèque).' : 'Votre bibliothèque est gardée d’une soirée à l’autre.'}</p>
        <button className={`set-row${sel === '' ? ' on' : ''}`} onClick={() => setSel('')}>
          <span className="nm">Toute la bibliothèque</span>
          <span className="cap">{lib.puzzles.length}</span>
        </button>
        {lib.sets.map((s) => (
          <div key={s.id} className={`set-row${sel === s.id ? ' on' : ''}`}>
            {v && <input type="checkbox" aria-label={`Utiliser « ${s.name} » pour la partie`} checked={chosen.includes(s.id)} onChange={() => toggleSet(s.id)} />}
            <button className="nm" onClick={() => setSel(s.id)}>{s.name}</button>
            <span className="cap">{s.puzzleIds.length}</span>
          </div>
        ))}
        <div className="set-actions">
          <button className="btn" onClick={newSet} disabled={busy}><Plus size={15} /> Nouveau jeu</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} /> Importer JSON</button>
          <a className="btn" href={exportHref} download><Download size={15} /> Exporter {set ? 'ce jeu' : 'la bibliothèque'}</a>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="import-file" onChange={(e) => (e.target.files?.[0] && void importJson(e.target.files[0]), (e.target.value = ''))} />
        </div>
        {empty && (
          <div className="why" style={{ marginTop: 12 }} data-testid="starter-note">
            Bibliothèque vide : une partie pioche dans les {STARTER_COUNT} énigmes de départ.
            <div style={{ marginTop: 8 }}>
              <button className="btn" onClick={importStarter} disabled={busy}><Sparkles size={15} /> Copier les énigmes de départ dans ma bibliothèque</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, flex: 1 }}>{set ? set.name : 'Toute la bibliothèque'} <span className="muted">· {list.length} énigme(s)</span></h3>
          {set && <button className="btn" onClick={renameSet} disabled={busy}><Pencil size={14} /> Renommer</button>}
          {set && <button className="btn" onClick={deleteSet} disabled={busy}><Trash2 size={14} /> Supprimer le jeu</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <label className="search">
            <Search size={15} />
            <input id="dm-recherche-enigme" name="dm-recherche-enigme" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une énigme…" aria-label="Rechercher une énigme" />
          </label>
          <button
            className="btn primary"
            onClick={() => setEdit({ isNew: true, puzzle: { id: '', category: set?.name.slice(0, 40) ?? '', solution: '', variants: [], difficulty: 'moyen', points: null, active: true } })}
            data-testid="new-puzzle"
          >
            <Plus size={15} /> Énigme
          </button>
        </div>
        {edit && (
          <Editor
            initial={edit.puzzle}
            isNew={edit.isNew}
            all={lib.puzzles}
            onCancel={() => setEdit(null)}
            onSave={async (p) => {
              const ok = await savePuzzle(p, edit.isNew ? (set?.id ?? null) : setOf(p.id), edit.isNew ? 'Énigme ajoutée.' : 'Énigme enregistrée. Elle s’appliquera à son prochain tirage.')
              if (ok) setEdit(null)
            }}
          />
        )}
        <div className="puzzle-list">
          {list.map((p) => (
            <div key={p.id} className={`puzzle-row${p.active ? '' : ' off'}`}>
              <span className="pill cat">{p.category}</span>
              <div style={{ minWidth: 0 }}>
                <div className="nm">{p.solution}</div>
                <div className="cap">
                  {DIFF[p.difficulty]} · {p.points ?? v?.settings.pointsPerPuzzle ?? 100} pts {p.active ? '' : '· désactivée'}
                  {p.variants.length > 0 && ` · ${p.variants.length} variante(s)`}
                </div>
              </div>
              <div className="row-actions">
                <button className="icon-btn" aria-label={`Modifier « ${p.solution} »`} onClick={() => setEdit({ isNew: false, puzzle: p })}><Pencil size={14} /></button>
                <button className="icon-btn" aria-label="Dupliquer" onClick={() => duplicate(p)} disabled={busy}><Copy size={14} /></button>
                <button className="icon-btn" aria-label={p.active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(p)} disabled={busy}>{p.active ? <X size={14} /> : <Check size={14} />}</button>
                <button className="icon-btn" aria-label="Supprimer" onClick={() => remove(p)} disabled={busy}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="regie-help">Aucune énigme {q ? 'ne correspond à la recherche' : 'dans ce jeu'}.</p>}
        </div>
      </div>

      {v && send && (
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <TeamsEditor v={v} send={send} notify={notify} />
          <div className="panel">
            <h3>Partie</h3>
            <div className="log" style={{ maxHeight: 'none', gap: 8, fontSize: 14 }}>
              <div>Énigmes : <b>{v.settings.puzzleCount}</b> · tirées sans répétition</div>
              <div>
                Mode : <b>Révélation</b>
                {v.settings.lettersRounds > 0 && <> puis <b>Tour de lettres</b> ({Math.min(v.settings.lettersRounds, v.settings.puzzleCount)} dernière(s))</>}
              </div>
              <div>Finale Déclic : <b>{v.settings.finale.enabled ? `activée · ${v.settings.finale.puzzles} énigme(s)` : 'désactivée'}</b></div>
              <div>
                Énigmes disponibles : <b data-testid="pool-size">{empty ? STARTER_COUNT : pool.size}</b> {empty ? <em className="muted">(énigmes de départ)</em> : pool.size < need && <span className="field-error">Il en faut {need} : la partie réutilisera des énigmes déjà jouées.</span>}
              </div>
            </div>
            <p className="regie-help">La partie en cours n’est jamais modifiée en silence : une énigme modifiée prend effet à son prochain tirage.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Editor({ initial, isNew, all, onCancel, onSave }: { initial: Puzzle; isNew: boolean; all: Puzzle[]; onCancel: () => void; onSave: (p: Puzzle) => void }) {
  const [p, setP] = useState(initial)
  const [variants, setVariants] = useState(initial.variants.join('\n'))
  const issues = [...validateSolution(p.solution).map((i) => i.message)]
  if (!p.category.trim()) issues.push('Catégorie obligatoire.')
  if (p.category.length > 40) issues.push('Catégorie : 40 caractères maximum.')
  const dup = all.find((x) => x.id !== p.id && p.solution && normalizeForCompare(x.solution) === normalizeForCompare(p.solution))
  return (
    <form
      className="editor"
      data-testid="editor"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault()
        if (issues.length) return
        onSave({ ...p, category: cleanText(p.category), solution: cleanText(p.solution), variants: variants.split('\n').map((x) => cleanText(x)).filter(Boolean) })
      }}
    >
      <label>
        <span>Catégorie (affichée en titre)</span>
        <input id="dm-ed-categorie" name="dm-ed-categorie" autoComplete="off" value={p.category} maxLength={40} onChange={(e) => setP({ ...p, category: e.target.value })} data-testid="ed-category" />
      </label>
      <label>
        <span>Solution (64 caractères max, mots de 16 lettres max)</span>
        <input id="dm-ed-solution" name="dm-ed-solution" autoComplete="off" value={p.solution} maxLength={64} onChange={(e) => setP({ ...p, solution: e.target.value })} data-testid="ed-solution" />
      </label>
      <label>
        <span>Variantes acceptées (une par ligne, facultatif)</span>
        <textarea id="dm-ed-variantes" name="dm-ed-variantes" autoComplete="off" value={variants} rows={2} onChange={(e) => setVariants(e.target.value)} />
      </label>
      <div className="editor-row">
        <label>
          <span>Difficulté</span>
          <select id="dm-ed-difficulte" name="dm-ed-difficulte" value={p.difficulty} onChange={(e) => setP({ ...p, difficulty: e.target.value as Difficulty })}>
            {Object.entries(DIFF).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>
          <span>Points (vide = réglage de la partie)</span>
          <input id="dm-ed-points" name="dm-ed-points" autoComplete="off" type="number" min={0} max={10000} value={p.points ?? ''} onChange={(e) => setP({ ...p, points: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Active
        </label>
      </div>
      {issues.length > 0 && p.solution && <ul className="field-error">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
      {dup && <p className="why">Doublon possible : « {dup.solution} » existe déjà.</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn primary" type="submit" disabled={issues.length > 0} data-testid="ed-save"><Save size={15} /> {isNew ? 'Ajouter' : 'Enregistrer'}</button>
        <button className="btn" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

function TeamsEditor({ v, send, notify }: { v: RegieView; send: Send; notify: Notify }) {
  const teams = v.public.teams
  const fromTeams = () => teams.map((t) => ({ id: t.id, name: t.name, color: t.color }))
  const key = teams.map((t) => `${t.id}:${t.name}:${t.color}`).join('|')
  const [draft, setDraft] = useState(fromTeams)
  const [draftKey, setDraftKey] = useState(key)
  // Équipes changées ailleurs (autre onglet, renommage) : le brouillon repart de l'état réel.
  if (draftKey !== key) {
    setDraftKey(key)
    setDraft(fromTeams())
  }
  const open = v.phase === 'waiting'
  const dirty = JSON.stringify(draft) !== JSON.stringify(fromTeams())
  const save = async () => {
    if (open) {
      const a = await send({ type: 'setTeams', teams: draft.map((t) => ({ id: t.id || undefined, name: t.name, color: t.color })) })
      if (a?.ok) notify('Équipes enregistrées.')
    } else {
      for (const t of draft) {
        const o = teams.find((x) => x.id === t.id)
        if (o && (o.name !== t.name || o.color !== t.color)) await send({ type: 'renameTeam', teamId: t.id, name: t.name, color: t.color })
      }
      notify('Équipes renommées.')
    }
  }
  return (
    <div className="panel" data-testid="teams-editor">
      <h3><Users size={14} /> Équipes ({draft.length})</h3>
      {!open && <p className="regie-help">Partie lancée : on peut renommer ou recolorer, pas ajouter ni retirer.</p>}
      {draft.map((t, i) => (
        <div key={t.id || `new-${i}`} className="team-edit">
          <input type="color" value={t.color} aria-label={`Couleur de ${t.name}`} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
          <input id={`dm-equipe-${i}`} name={`dm-equipe-${i}`} autoComplete="off" value={t.name} maxLength={28} aria-label={`Nom de l’équipe ${i + 1}`} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          {open && (
            <button className="icon-btn" aria-label={`Retirer ${t.name}`} disabled={draft.length <= 2} onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {open && (
          <button
            className="btn"
            disabled={draft.length >= 10}
            onClick={() => {
              const free = TEAM_PALETTE.find((p) => !draft.some((d) => d.name === p.name || d.color === p.color)) ?? TEAM_PALETTE[draft.length % 10]
              setDraft([...draft, { id: '', name: free.name, color: free.color }])
            }}
          >
            <Plus size={15} /> Équipe
          </button>
        )}
        <button className="btn primary" disabled={!dirty} onClick={save} data-testid="save-teams"><Save size={15} /> Enregistrer</button>
      </div>
    </div>
  )
}
