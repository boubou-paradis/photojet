// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DISPLAY_DEFAULT_KEYS,
  defaultsCopyPath,
  describeDisplaySettings,
  filePathsOf,
  isOwnDefaultsPath,
  pickDisplaySettings,
  remapPleinEcran,
  sessionCopyPath,
} from '../settings'

const USER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const SESSION = '33333333-3333-3333-3333-333333333333'

describe('liste fermée des réglages', () => {
  it('ne contient jamais nom, code, modération, impression, état actif, jeux ni verrou', () => {
    const forbidden = /^(name|code|moderation|print|is_active|mystery|lineup|wheel|quiz|buzzer|vote|affinity|album|borne_lock|slideshow_mode|user_id|id$)/
    for (const key of DISPLAY_DEFAULT_KEYS) expect(key).not.toMatch(forbidden)
  })

  it('ignore les clés hors liste et les valeurs invalides', () => {
    const picked = pickDisplaySettings({
      name: 'Mariage', code: '1234', moderation_enabled: true, print_enabled: true, is_active: true,
      quiz_questions: '[]', borne_lock_code: '0000',
      qr_size: 'large', logo_position: 'nulle-part', background_opacity: 400,
      background_color: '#112233', borne_template_portrait_id: 'pas-un-uuid',
    })
    expect(picked).toEqual({ qr_size: 'large', background_color: '#112233' })
  })

  it('garde les null (fond retiré, logo AnimaJet)', () => {
    expect(pickDisplaySettings({ background_image: null, custom_logo: null })).toEqual({
      background_image: null,
      custom_logo: null,
    })
  })
})

describe('copies de fichiers', () => {
  it('les copies du compte ne ressemblent jamais aux fichiers de session', () => {
    const bg = defaultsCopyPath('background', USER, `backgrounds/${SESSION}-1.png`)
    expect(bg).toMatch(new RegExp(`^backgrounds/defaults-${USER}-.+\\.png$`))
    expect(isOwnDefaultsPath('background', USER, bg)).toBe(true)
    expect(isOwnDefaultsPath('background', OTHER, bg)).toBe(false)
    expect(isOwnDefaultsPath('background', USER, `backgrounds/${SESSION}-1.png`)).toBe(false)
    expect(isOwnDefaultsPath('logo', USER, bg)).toBe(false)
  })

  it('refuse les chemins détournés', () => {
    expect(isOwnDefaultsPath('promo', USER, `promos/defaults-${USER}/../${SESSION}/x.png`)).toBe(false)
    expect(isOwnDefaultsPath('promo', USER, 42)).toBe(false)
  })

  it('les copies de session gardent les formes de Paramètres', () => {
    expect(sessionCopyPath('background', SESSION, 'a.jpeg')).toMatch(new RegExp(`^backgrounds/${SESSION}-.+\\.jpeg$`))
    expect(sessionCopyPath('logo', SESSION, 'a.png')).toMatch(new RegExp(`^logos/${SESSION}-.+\\.png$`))
    expect(sessionCopyPath('promo', SESSION, 'a.jpg')).toMatch(new RegExp(`^promos/${SESSION}/.+\\.jpg$`))
  })

  it('deux copies successives ont des chemins différents (cache CDN)', () => {
    expect(defaultsCopyPath('logo', USER, 'a.png')).not.toBe(defaultsCopyPath('logo', USER, 'a.png'))
  })

  it('liste fond, logo et affiches', () => {
    expect(filePathsOf({ background_image: 'b', custom_logo: 'l', promo_affiches: JSON.stringify(['p1', 'p2', 'p1']) }))
      .toEqual(['b', 'l', 'p1', 'p2'])
    expect(filePathsOf({ promo_affiches: 'pas du json' })).toEqual([])
  })
})

describe('affiches en plein écran', () => {
  it('fait partie des réglages copiés', () => {
    expect(pickDisplaySettings({ promo_affiches_plein_ecran: '["p1"]' })).toEqual({ promo_affiches_plein_ecran: '["p1"]' })
    expect(pickDisplaySettings({ promo_affiches_plein_ecran: null })).toEqual({ promo_affiches_plein_ecran: null })
    expect(pickDisplaySettings({ promo_affiches_plein_ecran: 42 })).toEqual({})
  })

  it('le choix suit chaque affiche vers sa copie', () => {
    const copies = new Map([['a', 'A'], ['b', 'B'], ['c', 'C']])
    expect(remapPleinEcran(JSON.stringify(['c', 'a']), copies)).toBe(JSON.stringify(['C', 'A']))
  })

  it('une affiche non copiée ou inconnue perd son choix, sans erreur', () => {
    const copies = new Map([['a', 'A']])
    expect(remapPleinEcran(JSON.stringify(['a', 'perdue', 'a']), copies)).toBe(JSON.stringify(['A']))
    expect(remapPleinEcran(JSON.stringify(['perdue']), copies)).toBeNull()
  })

  it('absente ou illisible : toutes en Ajuster (null)', () => {
    const copies = new Map([['a', 'A']])
    expect(remapPleinEcran(undefined, copies)).toBeNull()
    expect(remapPleinEcran(null, copies)).toBeNull()
    expect(remapPleinEcran('pas du json', copies)).toBeNull()
  })

  it('ne compte pas comme un fichier à copier ou effacer', () => {
    expect(filePathsOf({ promo_affiches: '["p1"]', promo_affiches_plein_ecran: '["p1","autre"]' })).toEqual(['p1'])
  })
})

describe('résumé', () => {
  it('décrit les réglages en français', () => {
    expect(describeDisplaySettings({
      background_type: 'image', background_image: 'b', custom_logo: 'l', logo_size: 'medium', logo_position: 'center',
      show_qr_on_screen: true, qr_size: 'medium', transition_type: 'fade', transition_duration: 5,
      messages_enabled: true, messages_frequency: 4,
    })).toEqual(['Fond image', 'Logo perso (moyen, centre)', 'QR moyen', 'Fondu 5 s', 'Messages toutes les 4 photos'])
  })
})

describe('garde-fous du code', () => {
  const root = join(__dirname, '..', '..', '..')
  it('la purge des comptes efface aussi les réglages par défaut', () => {
    const src = readFileSync(join(root, 'app', 'api', 'cron', 'cleanup-expired', 'route.ts'), 'utf8')
    expect(src).toContain('deleteDisplayDefaults(supabase, userId)')
  })
  it('la suppression d\'un cadre le retire des réglages par défaut', () => {
    const src = readFileSync(join(root, 'app', 'api', 'borne', 'templates', 'route.ts'), 'utf8')
    expect(src).toContain('unlinkTemplateFromDefaults(admin, userId, id)')
  })
  it('la migration ne crée ni trigger ni clé vers sessions', () => {
    const sql = readFileSync(join(root, '..', 'supabase', 'migrations', '20261107_create_account_display_defaults.sql'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase()
    expect(sql).not.toContain('trigger')
    expect(sql).not.toContain('references public.sessions')
    expect(sql).not.toMatch(/update\s+(public\.)?sessions/)
  })
  it('la colonne plein écran est additive, sans trigger ni réécriture', () => {
    const sql = readFileSync(join(root, '..', 'supabase', 'migrations', '20261109_add_promo_affiches_plein_ecran.sql'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').toLowerCase()
    expect(sql).toContain('add column if not exists promo_affiches_plein_ecran text null')
    expect(sql).not.toContain('trigger')
    expect(sql).not.toContain('default')
    expect(sql).not.toContain('drop')
    expect(sql).not.toMatch(/update\s+(public\.)?sessions/)
  })
  it('/live reçoit la colonne par la route serveur', () => {
    const src = readFileSync(join(root, 'lib', 'public-api', 'columns.ts'), 'utf8')
    expect(src).toContain("'promo_affiches_plein_ecran'")
  })
})
