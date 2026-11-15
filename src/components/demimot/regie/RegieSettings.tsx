'use client'

// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot, live/Regie.tsx), qui reste la référence.

// Réglages : couleur du plateau, règles de la partie, raccourcis.

import { useState } from 'react'
import { Check, Keyboard, Palette, Settings, Volume2, VolumeX } from 'lucide-react'
import type { DemiMotSounds } from '@/hooks/useDemiMotSounds'
import { BUZZ_LABELS, BUZZ_STYLES } from '../sfx'
import type { RegieView } from '@/lib/demimot/view'
import { THEME_IDS, THEMES, resolveTheme, type ThemeId } from '../themes'
import type { Send } from './api'

type NumField = { key: string; label: string; unit: string; get: (v: RegieView) => number; set: (n: number) => Partial<RegieView['settings']>; min: number; max: number; step: number }
const sec = (ms: number) => Math.round(ms / 100) / 10
const FIELDS: NumField[] = [
  { key: 'puzzleCount', label: 'Énigmes par partie', unit: '', get: (v) => v.settings.puzzleCount, set: (n) => ({ puzzleCount: n }), min: 1, max: 50, step: 1 },
  { key: 'lettersRounds', label: 'Dont en Tour de lettres (les dernières)', unit: '', get: (v) => v.settings.lettersRounds, set: (n) => ({ lettersRounds: n }), min: 0, max: 50, step: 1 },
  { key: 'pointsPerPuzzle', label: 'Points par énigme', unit: 'pts', get: (v) => v.settings.pointsPerPuzzle, set: (n) => ({ pointsPerPuzzle: n }), min: 0, max: 10000, step: 10 },
  { key: 'revealIntervalMs', label: 'Intervalle entre deux lettres', unit: 's', get: (v) => sec(v.settings.revealIntervalMs), set: (n) => ({ revealIntervalMs: Math.round(n * 1000) }), min: 0.3, max: 10, step: 0.1 },
  { key: 'answerMs', label: 'Temps de réponse après un buzz', unit: 's', get: (v) => sec(v.settings.answerMs), set: (n) => ({ answerMs: Math.round(n * 1000) }), min: 2, max: 60, step: 1 },
  { key: 'finalWindowMs', label: 'Dernière chance (toutes lettres visibles)', unit: 's', get: (v) => sec(v.settings.finalWindowMs), set: (n) => ({ finalWindowMs: Math.round(n * 1000) }), min: 0, max: 30, step: 1 },
  { key: 'wrongPenalty', label: 'Retrait sur mauvaise réponse', unit: 'pts', get: (v) => v.settings.wrongPenalty, set: (n) => ({ wrongPenalty: n }), min: 0, max: 10000, step: 10 },
  { key: 'turnMs', label: 'Délai d’un tour (Tour de lettres)', unit: 's', get: (v) => sec(v.settings.turnMs), set: (n) => ({ turnMs: Math.round(n * 1000) }), min: 5, max: 120, step: 1 },
]

/** Horodatage du choix de couleur (le plus récent l'emporte). */
const stamp = () => Date.now()

const initialOf = (v: RegieView) => Object.fromEntries(FIELDS.map((f) => [f.key, String(f.get(v))]))

export function RegieSettings({ v, send, notify, sounds }: { v: RegieView; send: Send; notify: (t: string) => void; sounds: DemiMotSounds }) {
  const initial = initialOf(v)
  const settingsKey = JSON.stringify(v.settings)
  const [draft, setDraft] = useState<Record<string, string>>(initial)
  const [finale, setFinale] = useState(v.settings.finale)
  const [seenKey, setSeenKey] = useState(settingsKey)
  if (seenKey !== settingsKey) {
    setSeenKey(settingsKey)
    setDraft(initial)
    setFinale(v.settings.finale)
  }
  const dirty = FIELDS.some((f) => draft[f.key] !== initial[f.key]) || JSON.stringify(finale) !== JSON.stringify(v.settings.finale)
  const locked = v.phase === 'round' && v.public.phase !== 'resolved'
  const invalid = FIELDS.filter((f) => {
    const n = Number(String(draft[f.key]).replace(',', '.'))
    return !Number.isFinite(n) || n < f.min || n > f.max
  })
  const save = async () => {
    const patch: Partial<RegieView['settings']> = { finale }
    for (const f of FIELDS) Object.assign(patch, f.set(Number(String(draft[f.key]).replace(',', '.'))))
    const a = await send({ type: 'setSettings', settings: patch })
    if (a?.ok) notify('Réglages enregistrés.')
  }
  const theme = resolveTheme(v.settings.theme?.id)
  const pickTheme = (id: ThemeId) => void send({ type: 'setSettings', settings: { theme: { id, at: stamp() } } })

  return (
    <div className="regie-body">
      <div className="panel">
        <fieldset className="theme-picker" data-testid="theme-picker">
          <legend><Palette size={14} /> Couleur du plateau</legend>
          <div className="theme-options">
            {THEME_IDS.map((id) => {
              const t = THEMES[id]
              const checked = theme === id
              return (
                <label key={id} className={`theme-option${checked ? ' checked' : ''}`}>
                  <input type="radio" name="dm-plateau-theme" value={id} checked={checked} onChange={() => pickTheme(id)} />
                  <span className="theme-thumb" aria-hidden="true" style={{ background: `linear-gradient(180deg, ${t.swatch[0]}, #050506)`, borderColor: t.metal.polished }}>
                    <i style={{ background: t.hidden.top }} />
                    <i style={{ background: '#F7F7F2' }} />
                    <i style={{ background: t.hidden.top }} />
                    <b style={{ background: t.band.emissive, borderColor: t.metal.polished }} />
                  </span>
                  <span className="theme-name">{t.name}</span>
                  {checked && <Check size={16} className="theme-check" aria-hidden="true" />}
                </label>
              )
            })}
          </div>
          <p className="theme-note">S’applique aussitôt à l’écran géant, sans toucher à la partie.</p>
        </fieldset>
        <h3><Settings size={14} /> Règles</h3>
        {locked && <p className="why" style={{ marginBottom: 10 }}>Énigme en cours : les règles se modifient entre deux énigmes (la couleur du plateau reste modifiable).</p>}
        {FIELDS.map((f) => {
          const bad = invalid.includes(f)
          return (
            <label key={f.key} className="field-row">
              <span>{f.label}</span>
              <span className="field-input">
                <input id={`dm-reglage-${f.key}`} name={`dm-reglage-${f.key}`} autoComplete="off" type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={draft[f.key]} aria-invalid={bad} disabled={locked} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                {f.unit && <em>{f.unit}</em>}
              </span>
              {bad && <small className="field-error">Entre {f.min.toLocaleString('fr-FR')} et {f.max.toLocaleString('fr-FR')}</small>}
            </label>
          )
        })}
        <label className="field-row">
          <span>Finale Déclic</span>
          <span className="field-input">
            <input type="checkbox" checked={finale.enabled} disabled={locked} onChange={(e) => setFinale({ ...finale, enabled: e.target.checked })} /> <em>{finale.enabled ? 'activée' : 'désactivée'}</em>
          </span>
        </label>
        {finale.enabled && (
          <>
            <label className="field-row"><span>Énigmes de finale</span><span className="field-input"><input id="dm-reglage-finale-enigmes" name="dm-reglage-finale-enigmes" autoComplete="off" type="number" min={1} max={10} value={finale.puzzles} disabled={locked} onChange={(e) => setFinale({ ...finale, puzzles: Number(e.target.value) })} /></span></label>
            <label className="field-row"><span>Base de la finale</span><span className="field-input"><input id="dm-reglage-finale-base" name="dm-reglage-finale-base" autoComplete="off" type="number" min={0} max={10000} step={10} value={finale.base} disabled={locked} onChange={(e) => setFinale({ ...finale, base: Number(e.target.value) })} /><em>pts</em></span></label>
            <label className="field-row"><span>Bonus par lettre cachée</span><span className="field-input"><input id="dm-reglage-finale-bonus" name="dm-reglage-finale-bonus" autoComplete="off" type="number" min={0} max={1000} value={finale.bonusPerHidden} disabled={locked} onChange={(e) => setFinale({ ...finale, bonusPerHidden: Number(e.target.value) })} /><em>pts</em></span></label>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primary" disabled={!dirty || locked || invalid.length > 0} onClick={save} data-testid="save-settings"><Check size={16} /> Enregistrer</button>
          <button className="btn" disabled={!dirty} onClick={() => (setDraft(initial), setFinale(v.settings.finale))}>Annuler les modifications</button>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <SoundPanel sounds={sounds} />
        <div className="panel">
          <h3><Keyboard size={14} /> Raccourcis clavier</h3>
          {[['Lancer / reprendre', 'Espace'], ['Bonne réponse', 'V'], ['Mauvaise réponse', 'X'], ['Annuler le buzz', 'A'], ['Pause / reprise', 'P'], ['Révéler une lettre', 'L'], ['Classement', 'C'], ['Écran noir', 'N'], ['Énigme suivante', 'Entrée']].map(([k, val]) => (
            <div key={k} className="team-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <span>{k}</span>
              <kbd className="pill">{val}</kbd>
            </div>
          ))}
          <p className="regie-help">Aucun raccourci n’agit pendant la saisie d’un champ.</p>
        </div>
        <div className="panel">
          <h3><Keyboard size={14} /> Télécommande de présentation</h3>
          {[['Une équipe a la main : bonne réponse', 'Page précédente'], ['Une équipe a la main : mauvaise réponse', 'Page suivante'], ['Personne n’a la main : étape suivante', 'Page suivante'], ['Personne n’a la main : révéler une lettre', 'Page précédente'], ['Classement / plateau', 'B']].map(([k, val]) => (
            <div key={k} className="team-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <span>{k}</span>
              <kbd className="pill">{val}</kbd>
            </div>
          ))}
          <p className="regie-help">« Annuler l’arbitrage » se fait uniquement à la souris.</p>
        </div>
      </div>
    </div>
  )
}

function SoundPanel({ sounds }: { sounds: DemiMotSounds }) {
  const { prefs } = sounds
  return (
    <div className="panel" data-testid="sound-panel">
      <h3>{prefs.on ? <Volume2 size={14} /> : <VolumeX size={14} />} Sons (ce PC uniquement)</h3>
      <div className="field-row">
        <span>Effets sonores</span>
        <span className="field-input">
          <button className={`btn${prefs.on ? ' primary' : ''}`} onClick={() => sounds.setOn(!prefs.on)} aria-pressed={prefs.on} data-testid="sound-toggle">
            {prefs.on ? <Volume2 size={16} /> : <VolumeX size={16} />} {prefs.on ? 'Activés' : 'Coupés'}
          </button>
        </span>
      </div>
      <label className="field-row">
        <span>Volume</span>
        <span className="field-input">
          <input id="dm-son-volume" name="dm-son-volume" autoComplete="off" type="range" min={0} max={100} value={Math.round(prefs.volume * 100)} onChange={(e) => sounds.setVolumeLevel(Number(e.target.value) / 100)} aria-label="Volume des effets" />
          <em>{Math.round(prefs.volume * 100)} %</em>
        </span>
      </label>
      <div className="field-row" style={{ alignItems: 'start' }}>
        <span>Son du buzz</span>
        <span style={{ display: 'grid', gap: 6 }}>
          {BUZZ_STYLES.map((style) => (
            <span key={style} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }} title={BUZZ_LABELS[style][1]}>
                <input type="radio" name="dm-son-buzz" value={style} checked={prefs.buzz === style} onChange={() => sounds.setBuzz(style)} />
                {BUZZ_LABELS[style][0]}
              </label>
              <button className="btn" onClick={() => sounds.test('buzz-style', style)} aria-label={`Écouter : ${BUZZ_LABELS[style][0]}`}>Écouter</button>
            </span>
          ))}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button className="btn" onClick={() => sounds.test('correct')}>Bonne réponse</button>
        <button className="btn" onClick={() => sounds.test('wrong')}>Mauvaise réponse</button>
        <button className="btn" onClick={() => sounds.test('podium')}>Podium</button>
      </div>
      <p className="regie-help">Les sons sortent de ce PC (reliez-le à la sono). Les téléphones ne jouent aucun son. {sounds.ready ? '' : 'Ils s’activent au premier clic dans cette page.'}</p>
    </div>
  )
}
