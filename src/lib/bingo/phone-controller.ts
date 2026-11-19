// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — moteur du téléphone d'un joueur, hors de React.
//
// EXIGENCE : un joueur ne perd JAMAIS sa partie.
// - Cartons, jetons et demande en cours vivent dans le stockage local
//   (phone-store) : rechargement, navigateur fermé, coupure, changement
//   d'onglet → tout revient.
// - Aucune connexion temps réel : l'état public est relu toutes les 3 s
//   (réponse en cache CDN 1 s), tout de suite au retour sur l'onglet ou du réseau.
// - « QUINE ! » hors ligne : la demande est enregistrée sur le téléphone et
//   renvoyée seule dès que le réseau revient (le serveur ne crée jamais de
//   doublon). Le joueur voit si elle est partie ou pas.
// - La mémoire n'est effacée que si le SERVEUR confirme que la partie
//   n'existe plus (410) : jamais sur une simple erreur réseau.

import { BINGO_CLAIM_POLL_MS, BINGO_PHONE_POLL_MS } from './constants'
import { claimToSend, clearMarks, clearMemory, loadMemory, reconcile, saveMemory, toggleMark, type PhoneMemory, type StoredCard } from './phone-store'
import type { BingoPublicState } from './types'

export type PhoneStage = 'loading' | 'join' | 'play' | 'closed'
export type ClaimOutcome = 'accepted' | 'rejected' | null

export interface PhoneSnapshot {
  stage: PhoneStage
  mem: PhoneMemory | null
  pub: BingoPublicState | null
  /** Dernière lecture réussie (sinon « Reconnexion… »). */
  online: boolean
  /** Heure du serveur − heure du téléphone (ms). */
  offset: number
  outcome: ClaimOutcome
  /** Message passager (bandeau du haut). */
  notice: string | null
  joining: boolean
  joinError: string | null
  /** Stockage local indisponible (navigation privée stricte) : prévenir le joueur. */
  volatile: boolean
}

type Fetcher = typeof fetch

const HIDDEN_POLL_MS = 10_000
const NOTICE_MS = 6000

async function postJson(f: Fetcher, url: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  try {
    const r = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
    const json = (await r.json().catch(() => null)) as Record<string, unknown> | null
    return { status: r.status, json }
  } catch {
    return { status: 0, json: null } // réseau coupé
  }
}

export class PhoneController {
  private s: PhoneSnapshot = { stage: 'loading', mem: null, pub: null, online: true, offset: 0, outcome: null, notice: null, joining: false, joinError: null, volatile: false }
  private listeners = new Set<() => void>()
  private pollTimer: ReturnType<typeof setTimeout> | undefined
  private claimTimer: ReturnType<typeof setInterval> | undefined
  private noticeTimer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private checkingMe = false
  private sending = false
  private polling = false

  constructor(private readonly code: string, private readonly f: Fetcher = (...a) => fetch(...a)) {}

  // ---------------------------------------------------------------- abonnement (useSyncExternalStore)
  get = (): PhoneSnapshot => this.s
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  private set(patch: Partial<PhoneSnapshot>) {
    this.s = { ...this.s, ...patch }
    this.listeners.forEach((l) => l())
  }
  private notify(text: string, ms = NOTICE_MS) {
    clearTimeout(this.noticeTimer)
    this.set({ notice: text })
    this.noticeTimer = setTimeout(() => this.set({ notice: null }), ms)
  }
  private remember(mem: PhoneMemory | null) {
    if (mem) {
      const ok = saveMemory(this.code, mem)
      this.set({ mem, volatile: !ok })
    } else {
      clearMemory(this.code)
      this.set({ mem: null })
    }
  }

  // ---------------------------------------------------------------- cycle de vie
  start() {
    if (this.running) return
    this.running = true
    const mem = loadMemory(this.code)
    if (mem) {
      this.set({ mem, stage: 'play' })
      void this.checkMe()
    }
    void this.poll()
    this.claimTimer = setInterval(() => void this.followClaim(), BINGO_CLAIM_POLL_MS)
    document.addEventListener('visibilitychange', this.wake)
    window.addEventListener('online', this.wake)
    window.addEventListener('pageshow', this.wake)
  }
  stop() {
    this.running = false
    clearTimeout(this.pollTimer)
    clearInterval(this.claimTimer)
    clearTimeout(this.noticeTimer)
    document.removeEventListener('visibilitychange', this.wake)
    window.removeEventListener('online', this.wake)
    window.removeEventListener('pageshow', this.wake)
  }
  /** Retour sur l'onglet / du réseau : relecture immédiate, demande renvoyée si besoin. */
  private wake = () => {
    if (document.visibilityState === 'hidden') return
    void this.poll()
    void this.followClaim()
  }

  // ---------------------------------------------------------------- état public
  private async poll() {
    if (!this.running || this.polling) return
    this.polling = true
    clearTimeout(this.pollTimer)
    try {
      const r = await this.f(`/api/bingo/state?code=${encodeURIComponent(this.code)}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      const pub = (await r.json()) as BingoPublicState
      const offset = Date.parse(pub.serverNow) - Date.now()
      this.set({ pub, online: true, offset: Number.isFinite(offset) ? offset : this.s.offset })
      this.onPublic(pub)
    } catch {
      this.set({ online: false })
    } finally {
      this.polling = false
      if (this.running) {
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
        this.pollTimer = setTimeout(() => void this.poll(), hidden ? HIDDEN_POLL_MS : BINGO_PHONE_POLL_MS)
      }
    }
  }

  private onPublic(pub: BingoPublicState) {
    const mem = this.s.mem
    if (!mem) {
      if (this.s.stage === 'loading' || this.s.stage === 'join' || this.s.stage === 'closed') {
        const open = pub.active && pub.status !== 'finished' && !pub.paused
        this.set({ stage: open ? 'join' : 'closed' })
      }
      return
    }
    if (!pub.active) {
      // Autre jeu à l'écran : on garde tout. Sinon le serveur confirme avant d'effacer.
      if (!pub.held) void this.checkMe()
      return
    }
    if (pub.gameId !== mem.gameId) {
      void this.checkMe()
      return
    }
    // Nouvelle partie lancée par l'animateur (numéro de partie changé), même
    // si ce téléphone dormait à ce moment-là : jetons vidés, mêmes cartons.
    // Entre deux étapes d'une même partie, le numéro ne change pas : rien n'est effacé.
    const next = reconcile(mem, pub.gameId, pub.round)
    if (next && next !== mem) {
      this.remember(next)
      this.set({ outcome: null })
      // round 0 = arrivé avant la première lecture : rien à vider, pas de message.
      if (mem.round > 0) this.notify('Nouvelle partie ! Vos cartons ont été vidés.', 10_000)
    }
    const cur = this.s.mem
    if (!cur) return
    const act = claimToSend(cur, pub)
    if (act === 'stale') {
      this.remember({ ...cur, claim: null })
      this.notify('Votre demande n’a pas pu partir à temps : l’étape est passée.')
    } else if (act === 'send') void this.sendClaim()
  }

  /** Le serveur connaît-il encore ce joueur ? Seul un 410 efface la mémoire. */
  private async checkMe() {
    const mem = this.s.mem
    if (!mem || this.checkingMe) return
    this.checkingMe = true
    try {
      const r = await postJson(this.f, '/api/bingo/me', { code: this.code, token: mem.token })
      if (r.status === 200 && r.json) {
        const cards = r.json.cards as StoredCard[]
        const gameId = String(r.json.gameId)
        const cur = this.s.mem ?? mem
        this.remember({ ...cur, gameId, name: String(r.json.name ?? cur.name), cards, marks: gameId === cur.gameId ? cur.marks : {} })
        this.set({ stage: 'play' })
      } else if (r.status === 410) {
        this.remember(null)
        this.set({ outcome: null, stage: this.s.pub?.active && this.s.pub.status !== 'finished' ? 'join' : 'closed' })
        this.notify('Cette partie est terminée.')
      } else if (r.status === 0) {
        this.set({ online: false })
      }
    } finally {
      this.checkingMe = false
    }
  }

  // ---------------------------------------------------------------- arrivée
  async join(name: string) {
    if (this.s.joining) return
    this.set({ joining: true, joinError: null })
    const r = await postJson(this.f, '/api/bingo/join', { code: this.code, name })
    if (r.status === 200 && r.json) {
      const pub = this.s.pub
      const mem: PhoneMemory = {
        v: 1,
        token: String(r.json.token),
        name: String(r.json.name ?? name),
        gameId: String(r.json.gameId),
        round: pub?.active ? pub.round : 0,
        cards: r.json.cards as StoredCard[],
        marks: {},
        claim: null,
        savedAt: Date.now(),
      }
      this.remember(mem)
      this.set({ joining: false, stage: 'play' })
      void this.poll()
      return
    }
    const msg = r.status === 0 ? 'Pas de réseau : réessayez dans un instant.' : String(r.json?.error ?? 'Impossible de rejoindre la partie.')
    this.set({ joining: false, joinError: msg })
  }

  // ---------------------------------------------------------------- jetons
  toggle(cardId: string, n: number) {
    const mem = this.s.mem
    if (!mem || (mem.claim && this.s.outcome === null)) return // carton figé pendant la vérification
    this.remember(toggleMark(mem, cardId, n))
  }

  /** Bouton « Effacer mes jetons » (après confirmation) : les cartons restent les mêmes. */
  clearAll() {
    const mem = this.s.mem
    if (!mem || (mem.claim && this.s.outcome === null)) return // carton figé pendant la vérification
    this.remember(clearMarks(mem))
    this.notify('Jetons effacés.')
  }

  // ---------------------------------------------------------------- « QUINE ! »
  claim(cardId: string) {
    const mem = this.s.mem
    const pub = this.s.pub
    if (!mem || mem.claim || !pub?.active) return
    if (!['running', 'checking', 'celebrating'].includes(pub.status) || pub.phaseIndex >= pub.phases.length) return
    this.remember({
      ...mem,
      claim: { cardId, marks: mem.marks[cardId] ?? [], phaseIndex: pub.phaseIndex, round: pub.round, createdAt: Date.now(), claimId: null },
    })
    this.set({ outcome: null })
    void this.sendClaim()
  }

  private async sendClaim() {
    const mem = this.s.mem
    const c = mem?.claim
    if (!mem || !c || c.claimId !== null || this.sending) return
    this.sending = true
    try {
      const r = await postJson(this.f, '/api/bingo/claim', { code: this.code, token: mem.token, cardId: c.cardId, marks: c.marks })
      const cur = this.s.mem
      if (!cur?.claim) return
      if (r.status === 200 && r.json && typeof r.json.claimId === 'number') {
        this.remember({ ...cur, claim: { ...cur.claim, claimId: r.json.claimId } })
        this.set({ online: true })
        if (r.json.status === 'accepted') this.set({ outcome: 'accepted' })
      } else if (r.status === 0 || r.status >= 500) {
        this.set({ online: r.status !== 0 && this.s.online }) // gardée, renvoyée au prochain passage
      } else {
        // Refus net du serveur (attente 5 s, tirage arrêté, partie finie…) : la demande est abandonnée.
        this.remember({ ...cur, claim: null })
        this.notify(String(r.json?.error ?? 'Demande impossible pour le moment.'))
        if (r.status === 410) void this.checkMe()
      }
    } finally {
      this.sending = false
    }
  }

  /** Demande en cours : renvoi si elle n'est pas partie, sinon suivi de la décision. */
  private async followClaim() {
    const mem = this.s.mem
    const c = mem?.claim
    if (!mem || !c || this.s.outcome) return
    if (c.claimId === null) {
      const pub = this.s.pub
      if (pub?.active) {
        const act = claimToSend(mem, pub)
        if (act === 'send') void this.sendClaim()
      } else void this.sendClaim()
      return
    }
    const r = await postJson(this.f, '/api/bingo/claim', { code: this.code, token: mem.token, claimId: c.claimId })
    const cur = this.s.mem
    if (!cur?.claim || cur.claim.claimId !== c.claimId) return
    if (r.status === 200) {
      const st = r.json?.status
      if (st === 'accepted' || st === 'rejected') this.set({ outcome: st, online: true })
      else if (st === 'gone') this.remember({ ...cur, claim: null })
    } else if (r.status === 410) {
      void this.checkMe()
    } else if (r.status === 0) {
      this.set({ online: false })
    }
  }

  /** Après « Reprendre mon carton » : la demande est rangée. */
  dismiss() {
    const mem = this.s.mem
    if (mem) this.remember({ ...mem, claim: null })
    this.set({ outcome: null })
  }
}
