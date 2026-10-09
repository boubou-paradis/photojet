import { describe, expect, it } from 'vitest'
import {
  parseAdminRequest,
  parseJoinRequest,
  parseLaunchArgs,
  parsePlayerAuth,
  parseSettingsArgs,
  resolveTeam,
  teamKey,
} from '../validation'

const SESSION = '2ffb0bbf-2847-43ad-b759-3a8bca7fb5f9'
const PLAYER = '8e7f6a52-3c1d-4b9e-a0f2-5d6c7b8a9e01'
const TOKEN = 'a'.repeat(43)

describe('parseJoinRequest', () => {
  it('accepte un pseudo', () => {
    expect(parseJoinRequest({ code: 'KMRT', nickname: '  Luna ' })).toEqual({ ok: true, value: { code: 'KMRT', nickname: 'Luna', team: null } })
  })
  it('accepte une équipe', () => {
    expect(parseJoinRequest({ code: 'KMRT', team: 'Table 4' })).toEqual({ ok: true, value: { code: 'KMRT', nickname: null, team: 'Table 4' } })
  })
  it('refuse sans pseudo ni équipe', () => {
    expect(parseJoinRequest({ code: 'KMRT' }).ok).toBe(false)
    expect(parseJoinRequest({ code: 'KMRT', nickname: '   ' }).ok).toBe(false)
  })
  it('refuse un code invalide et un pseudo trop long', () => {
    expect(parseJoinRequest({ code: 'K M', nickname: 'Luna' }).ok).toBe(false)
    expect(parseJoinRequest({ code: 'KMRT', nickname: 'x'.repeat(25) }).ok).toBe(false)
  })
})

describe('équipes', () => {
  it('normalise la clé (casse et espaces)', () => {
    expect(teamKey('Table 4')).toBe(teamKey('table4'))
    expect(teamKey('TABLE  4')).toBe(teamKey('table 4'))
  })
  it('liste prédéfinie : seule une équipe de la liste, avec le libellé de l’animateur', () => {
    const teams = ['Table 4', 'Les Bretons']
    expect(resolveTeam('table4', teams)).toEqual({ ok: true, value: { key: teamKey('Table 4'), label: 'Table 4' } })
    expect(resolveTeam('Table 9', teams).ok).toBe(false)
  })
  it('sans liste : saisie libre', () => {
    expect(resolveTeam('Team Rouge', [])).toEqual({ ok: true, value: { key: teamKey('Team Rouge'), label: 'Team Rouge' } })
  })
})

describe('parseLaunchArgs', () => {
  it('accepte les réglages par défaut', () => {
    expect(parseLaunchArgs({ mode: 'solo', windowMs: 1500, timerS: null })).toEqual({
      ok: true,
      value: { mode: 'solo', teams: [], windowMs: 1500, timerS: null },
    })
  })
  it('accepte le verrouillage immédiat (fenêtre 0)', () => {
    expect(parseLaunchArgs({ mode: 'solo', windowMs: 0, timerS: 15 }).ok).toBe(true)
  })
  it('refuse une fenêtre, un chrono ou un mode hors liste', () => {
    expect(parseLaunchArgs({ mode: 'solo', windowMs: 1234, timerS: null }).ok).toBe(false)
    expect(parseLaunchArgs({ mode: 'solo', windowMs: 1500, timerS: 7 }).ok).toBe(false)
    expect(parseLaunchArgs({ mode: 'duo', windowMs: 1500, timerS: null }).ok).toBe(false)
  })
  it('refuse les équipes en double (même clé)', () => {
    expect(parseLaunchArgs({ mode: 'team', teams: ['Table 4', 'table4'], windowMs: 1500, timerS: null }).ok).toBe(false)
  })
  it('refuse plus de 30 équipes', () => {
    const teams = Array.from({ length: 31 }, (_, i) => `Table ${i + 1}`)
    expect(parseLaunchArgs({ mode: 'team', teams, windowMs: 1500, timerS: null }).ok).toBe(false)
  })
})

describe('parseSettingsArgs', () => {
  it('accepte un seul réglage', () => {
    expect(parseSettingsArgs({ timerS: null })).toEqual({ ok: true, value: { timerS: null } })
    expect(parseSettingsArgs({ windowMs: 0 })).toEqual({ ok: true, value: { windowMs: 0 } })
  })
  it('refuse un objet vide ou une valeur hors liste', () => {
    expect(parseSettingsArgs({}).ok).toBe(false)
    expect(parseSettingsArgs({ windowMs: 99 }).ok).toBe(false)
  })
})

describe('parsePlayerAuth', () => {
  it('exige session, joueur et jeton au bon format', () => {
    expect(parsePlayerAuth({ sessionId: SESSION, playerId: PLAYER, token: TOKEN }).ok).toBe(true)
    expect(parsePlayerAuth({ sessionId: SESSION, playerId: PLAYER, token: 'court' }).ok).toBe(false)
    expect(parsePlayerAuth({ sessionId: 'x', playerId: PLAYER, token: TOKEN }).ok).toBe(false)
  })
})

describe('parseAdminRequest', () => {
  it('refuse une action inconnue', () => {
    expect(parseAdminRequest({ sessionId: SESSION, action: 'drop_table' }).ok).toBe(false)
  })
  it('valide les réglages du lancement', () => {
    expect(parseAdminRequest({ sessionId: SESSION, action: 'launch', args: { mode: 'solo', windowMs: 1500, timerS: null } }).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: SESSION, action: 'launch', args: {} }).ok).toBe(false)
  })
  it('exige un joueur valide pour le retrait', () => {
    expect(parseAdminRequest({ sessionId: SESSION, action: 'remove_player', args: { playerId: PLAYER } }).ok).toBe(true)
    expect(parseAdminRequest({ sessionId: SESSION, action: 'remove_player', args: { playerId: '1' } }).ok).toBe(false)
  })
  it('ignore les arguments des actions simples', () => {
    expect(parseAdminRequest({ sessionId: SESSION, action: 'open', args: { hack: true } })).toEqual({
      ok: true,
      value: { sessionId: SESSION, action: 'open', args: {} },
    })
  })
})
