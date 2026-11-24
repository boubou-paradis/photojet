// AnimaBingo · Tombola — scénario complet en PRODUCTION, compte et session JETABLES (supprimés à la fin).
// node tombola-e2e.mjs <repo photojet> <dossier captures> [http://localhost:3200]
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const repo = process.argv[2]
const out = process.argv[3]
const base = process.argv[4] ?? 'http://localhost:3200'
mkdirSync(out, { recursive: true })
const require = createRequire(path.join(repo, 'package.json'))
const { createClient } = require('@supabase/supabase-js')
const { createServerClient } = require('@supabase/ssr')
const pw = createRequire('C:/Users/Admin/Desktop/animajet video/Tutos AnimaJet/travail/package.json')('playwright')
const env = Object.fromEntries(readFileSync(path.join(repo, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
if (!URL_.includes('unesekcovbxeapevuqmc')) throw new Error('Projet inattendu : arrêt.')
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let pass = 0, failN = 0
const results = []
const check = (label, cond, detail = '') => { cond ? pass++ : failN++; results.push(`${cond ? 'OK   ' : 'ÉCHEC'} ${label}${!cond && detail !== '' ? ` → ${JSON.stringify(detail).slice(0, 400)}` : ''}`) }
const section = (t) => results.push(`\n— ${t}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const email = `tombola-e2e-${Date.now()}@example.test`
const password = `T${randomUUID()}a1!`
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
if (ue) throw ue
const userId = u.user.id
const sessionId = randomUUID()
const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('')
const browsers = []
const errors = []
try {
  await admin.from('user_profiles').upsert({ id: userId, email, role: 'owner' })
  const ins = await admin.from('sessions').insert({
    id: sessionId, code, user_id: userId, name: 'Test tombola (jetable)', is_active: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  })
  if (ins.error) throw ins.error
  const jar = new Map()
  const ssr = createServerClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) } })
  if ((await ssr.auth.signInWithPassword({ email, password })).error) throw new Error('login')
  const cookie = () => [...jar].map(([n, v]) => `${n}=${v}`).join('; ')
  const call = async (method, route, body, auth = true) => {
    const r = await fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: cookie() } : {}) }, body: body ? JSON.stringify(body) : undefined })
    let j = null; try { j = await r.json() } catch {}
    return { status: r.status, json: j }
  }
  const T = (body) => call('POST', '/api/bingo/tombola/admin', { sessionId, ...body })
  const L = (body) => call('POST', '/api/bingo/admin', { sessionId, ...body })
  const snapT = async () => (await call('GET', `/api/bingo/tombola/admin?sessionId=${sessionId}`)).json
  const pub = async () => (await call('GET', `/api/bingo/tombola/state?code=${code}&t=${Date.now()}`, null, false)).json
  const status = async () => (await call('GET', `/api/bingo/status?code=${code}`, null, false)).json
  const ticket = (token) => call('POST', '/api/bingo/tombola/ticket', { code, ...(token ? { token } : {}) }, false)
  // Test seulement : on recule l'heure du dernier tirage (sinon 2,5 s entre deux numéros).
  const unlock = () => admin.from('bingo_tombola').update({ last_draw_at: new Date(Date.now() - 3600e3).toISOString(), reveal_at: new Date(Date.now() - 3600e3).toISOString() }).eq('session_id', sessionId)
  const drawAll = async (max) => {
    for (let i = 0; i < max; i++) {
      await unlock()
      const s = (await snapT()).state
      const r = await T({ action: 'draw', expect: s.draws.length + (s.hidden ? 1 : 0) })
      if (r.status !== 200) return { nums: (await snapT()).state.draws.map((d) => d.n), last: r }
      await unlock()
    }
    const s = (await snapT()).state
    return { nums: s.draws.map((d) => d.n), last: null }
  }
  const defaultLoto = { settings: { cardsPerPlayer: 1, voice: 'off', autoMs: 8000, public: { screen: 'machine' } }, phases: ['quine', 'double', 'plein'] }

  // ------------------------------------------------------------ Exclusivité avec le loto
  section('Un seul jeu AnimaBingo à la fois')
  const lotoLaunch = await L({ action: 'launch', ...defaultLoto })
  check('Loto lancé (préparation)', lotoLaunch.status === 200, lotoLaunch)
  const refused = await T({ action: 'launch', paper: [[1, 250]], phoneFrom: 301 })
  check('Tombola refusée pendant un loto (loto_running)', refused.status === 409 && refused.json?.code === 'loto_running', refused)
  check('Régie tombola : lotoRunning = true', (await snapT()).lotoRunning === true)
  check('Loto quitté', (await L({ action: 'exit' })).status === 200)

  // ------------------------------------------------------------ Papier seul 1–250
  section('Tombola papier seule (1–250)')
  let r = await T({ action: 'launch', paper: [[1, 250]], phoneFrom: null })
  check('Lancement papier 1–250', r.status === 200 && r.json?.paperCount === 250 && r.json?.phoneFrom === null, r.json)
  let st = await status()
  check('Statut : mode tombola, en direct', st.mode === 'tombola' && st.live === true && st.present === true, st)
  const lotoDuring = await L({ action: 'launch', ...defaultLoto })
  check('Loto refusé pendant la tombola (tombola_running)', lotoDuring.status === 409 && lotoDuring.json?.code === 'tombola_running', lotoDuring)
  check('Téléphone sans tickets téléphone : refus no_phone', (await ticket()).json?.code === 'no_phone')
  const d1 = await T({ action: 'draw', expect: 0 })
  check('Tirage 1 : caché pendant 0,9 s', d1.status === 200 && d1.json.hidden === true && d1.json.draws.length === 0, d1.json)
  const dbl = await T({ action: 'draw', expect: 0 })
  check('Double clic (même expect) : aucun 2e numéro', dbl.status === 200 && (await admin.from('bingo_tombola_draws').select('seq', { count: 'exact', head: true })).count >= 1)
  const tooFast = await T({ action: 'draw', expect: 1 })
  check('Tirage trop rapide refusé (429)', tooFast.status === 429, tooFast)
  await sleep(1000)
  let p = await pub()
  check('Après la révélation : numéro visible, Lot 1', p.draws.length === 1 && p.draws[0].lot === 1 && p.draws[0].n >= 1 && p.draws[0].n <= 250, p.draws)
  const all250 = await drawAll(260)
  check('250 numéros tirés puis « tous sortis » (empty)', all250.last?.json?.code === 'empty' && all250.nums.length === 250, { n: all250.nums.length, last: all250.last })
  check('Aucun doublon sur 250', new Set(all250.nums).size === 250)
  check('Tous entre 1 et 250', all250.nums.every((n) => n >= 1 && n <= 250))
  check('Quitter la tombola', (await T({ action: 'exit' })).status === 200)
  check('Statut après sortie : plus de tombola', (await status()).mode === undefined)

  // ------------------------------------------------------------ 300 numéros
  section('300 numéros sans doublon')
  await T({ action: 'launch', paper: [[1, 300]], phoneFrom: null })
  const all300 = await drawAll(305)
  check('300 tirés, 300 distincts, 1 à 300, puis empty', all300.nums.length === 300 && new Set(all300.nums).size === 300 && Math.min(...all300.nums) === 1 && Math.max(...all300.nums) === 300 && all300.last?.json?.code === 'empty', { n: all300.nums.length })
  const lots = (await pub()).draws.map((d) => d.lot)
  check('Lots 1 à 300 dans l’ordre', lots.every((l, i) => l === i + 1))
  await T({ action: 'exit' })

  // ------------------------------------------------------------ Téléphone seul
  section('Tombola téléphone seule')
  r = await T({ action: 'launch', paper: [], phoneFrom: 1 })
  check('Lancement téléphone seul', r.status === 200 && r.json.phoneFrom === 1 && r.json.phoneOpen === true, r.json)
  const t1 = await ticket(); const t2 = await ticket(); const t1b = await ticket(t1.json?.token)
  check('Tickets n° 1 et n° 2', t1.json?.number === 1 && t2.json?.number === 2, [t1.json, t2.json])
  check('Même jeton = même numéro', t1b.json?.number === 1)
  check('Aucune donnée personnelle (colonnes du ticket)', Object.keys((await admin.from('bingo_tombola_tickets').select('*').limit(1).single()).data).sort().join(',') === 'created_at,number,token_hash,tombola_id')
  check('Jeton jamais stocké en clair', !(await admin.from('bingo_tombola_tickets').select('token_hash')).data.some((x) => x.token_hash === t1.json.token))
  await T({ action: 'exit' })

  // ------------------------------------------------------------ Papier + téléphone
  section('Papier + téléphone, plusieurs plages')
  r = await T({ action: 'launch', paper: [[1, 250], [260, 270]], phoneFrom: 301 })
  check('Lancement 1–250 + 260–270, téléphone à partir de 301', r.status === 200 && r.json.paperCount === 261 && r.json.phoneFrom === 301, r.json)
  const ov = await T({ action: 'config', paper: [[1, 320]], phoneFrom: 301 })
  check('Plage qui touche les numéros téléphone refusée (overlap)', ov.status === 409 && ov.json?.code === 'overlap', ov)
  const toks = []
  for (let i = 0; i < 5; i++) toks.push((await ticket()).json)
  check('5 tickets téléphone : 301 à 305', toks.map((t) => t.number).join(',') === '301,302,303,304,305', toks.map((t) => t?.number))
  const frozen = await T({ action: 'config', paper: [[1, 250]], phoneFrom: 401 })
  check('Départ téléphone figé dès le premier ticket', frozen.status === 409, frozen)

  // ------------------------------------------------------------ Absent / Déjà gagnant
  section('Absent et Déjà gagnant')
  await unlock(); await T({ action: 'draw', expect: 0 }); await unlock()
  p = await pub()
  check('Distribution fermée au premier tirage', p.phoneOpen === false)
  const late = await ticket()
  check('Nouveau téléphone après le tirage : refus closed', late.json?.code === 'closed', late)
  check('Téléphone déjà servi : même numéro', (await ticket(toks[2].token)).json?.number === 303)
  const reopen = await T({ action: 'phones', open: true })
  check('Rouvrir : nouveau ticket 306', reopen.status === 200 && (await ticket()).json?.number === 306)
  await T({ action: 'phones', open: false })
  await T({ action: 'draw', expect: 1 }); await unlock()
  p = await pub()
  const second = p.draws[1]
  const notLast = await T({ action: 'mark', seq: 1, outcome: 'absent' })
  check('Absent refusé sur un numéro qui n’est pas le dernier', notLast.status === 409 && notLast.json?.code === 'not_last', notLast)
  r = await T({ action: 'mark', seq: 2, outcome: 'absent' })
  check('Absent : n° retiré, pas de lot', r.json.draws[1].o === 'absent' && r.json.draws[1].lot === null)
  await T({ action: 'draw', expect: 2 }); await unlock()
  p = await pub()
  check('Numéro suivant : Lot 2 remis en jeu', p.draws[2].lot === 2, p.draws)
  r = await T({ action: 'mark', seq: 3, outcome: 'already' })
  check('Déjà gagnant : retiré', r.json.draws[2].o === 'already')
  r = await T({ action: 'mark', seq: 3, outcome: 'winner' })
  check('Annulation : remis gagnant (Lot 2)', r.json.draws[2].o === 'winner' && r.json.draws[2].lot === 2)
  check('Un numéro absent ne ressort jamais', !(await drawAll(4)).nums.slice(3).includes(second.n))
  const add = await T({ action: 'config', paper: [[1, 250], [260, 280]], phoneFrom: 301 })
  check('Tirage commencé : ajout de plage accepté', add.status === 200 && add.json.paperCount === 271)
  const remove = await T({ action: 'config', paper: [[1, 200]], phoneFrom: 301 })
  check('Tirage commencé : retrait de plage refusé', remove.status === 409)
  await T({ action: 'exit' })

  // ------------------------------------------------------------ Navigateurs
  browsers.push(await pw.chromium.launch())
  const [chrome] = browsers
  const regieCtx = await chrome.newContext({ viewport: { width: 1366, height: 768 } })
  await regieCtx.addCookies([...jar].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' })))
  // Télécommande allumée (interrupteur de la régie, éteint par défaut sur tous les jeux).
  await regieCtx.addInitScript(() => localStorage.setItem('animajet-remote-control', 'on'))
  const regie = await regieCtx.newPage()
  regie.on('pageerror', (e) => errors.push(`régie: ${e.message}`))
  const noScroll = (pg) => pg.evaluate(() => {
    const se = document.scrollingElement
    const bad = [...document.querySelectorAll('.tmb-regie *')].filter((el) => {
      const cs = getComputedStyle(el)
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1
    }).length
    return { page: se.scrollHeight <= window.innerHeight + 1, inner: bad === 0, h: se.scrollHeight, vh: window.innerHeight }
  })

  section('Régie : préparation (1366×768)')
  await regie.goto(`${base}/admin/jeux/bingo?session=${sessionId}`, { waitUntil: 'networkidle', timeout: 180000 })
  await regie.getByTestId('mode-tombola').waitFor({ timeout: 90000 })
  check('Régie du loto : 3e choix « Tombola »', (await regie.getByTestId('mode-tombola').count()) === 1)
  await regie.getByTestId('mode-tombola').click()
  await regie.getByTestId('tombola-setup').waitFor({ timeout: 90000 })
  check('Préparation : « Tickets téléphone à partir du n° 301 »', (await regie.getByTestId('setup-phone-from').innerText()).includes('à partir du n° 301'))
  await regie.getByTestId('range-to-0').fill('300')
  check('Papier jusqu’à 300 → téléphone à partir du n° 401', (await regie.getByTestId('setup-phone-from').innerText()).includes('401'))
  await regie.getByTestId('range-to-0').fill('250')
  check('Champs de saisie : autocomplete="off"', (await regie.locator('.tmb-range input').evaluateAll((l) => l.every((i) => i.getAttribute('autocomplete') === 'off'))))
  check('Aucun défilement (préparation)', Object.values(await noScroll(regie)).slice(0, 2).every(Boolean), await noScroll(regie))
  await regie.screenshot({ path: path.join(out, 't01-regie-preparation.png') })
  const popup = regieCtx.waitForEvent('page', { timeout: 15000 }).catch(() => null)
  await regie.getByTestId('launch').click()
  const liveTab = await popup
  if (liveTab) await liveTab.close()
  await regie.getByTestId('tombola-regie').locator('[data-testid="draw"]').waitFor({ timeout: 30000 })
  check('Lancée depuis la régie : tombola en base', (await snapT()).state.active === true)
  check('Régie : « Tickets téléphone à partir du n° 301 »', (await regie.getByTestId('phone-from').innerText()).includes('à partir du n° 301'))

  section('Téléphones (Android et iPhone)')
  const android = await (await chrome.newContext({ ...pw.devices['Pixel 7'] })).newPage()
  android.on('pageerror', (e) => errors.push(`android: ${e.message}`))
  await android.goto(`${base}/invite/${code}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await android.waitForURL(`**/tombola/${code}`, { timeout: 60000 })
  await android.getByTestId('phone-number').waitFor({ timeout: 30000 })
  const aNum = (await android.getByTestId('phone-number').innerText()).replace(/\D/g, '')
  check('QR → page tombola → ticket n° 301', aNum === '301', aNum)
  check('Aucun champ de saisie sur le téléphone', (await android.locator('input, textarea').count()) === 0)
  await android.screenshot({ path: path.join(out, 't02-android-ticket.png') })
  await android.reload({ waitUntil: 'domcontentloaded' })
  await android.getByTestId('phone-number').waitFor({ timeout: 30000 })
  check('Téléphone rechargé : même numéro', (await android.getByTestId('phone-number').innerText()).replace(/\D/g, '') === '301')
  await android.goto(`${base}/invite/${code}`, { waitUntil: 'domcontentloaded' })
  await android.waitForURL(`**/tombola/${code}`, { timeout: 60000 })
  await android.getByTestId('phone-number').waitFor({ timeout: 30000 })
  check('QR rescanné : même numéro', (await android.getByTestId('phone-number').innerText()).replace(/\D/g, '') === '301')
  let iphone = null
  try {
    browsers.push(await pw.webkit.launch())
    iphone = await (await browsers[1].newContext({ ...pw.devices['iPhone 13'] })).newPage()
    iphone.on('pageerror', (e) => errors.push(`iphone: ${e.message}`))
    await iphone.goto(`${base}/invite/${code}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await iphone.waitForURL(`**/tombola/${code}`, { timeout: 60000 })
    await iphone.getByTestId('phone-number').waitFor({ timeout: 30000 })
    check('iPhone : ticket n° 302', (await iphone.getByTestId('phone-number').innerText()).replace(/\D/g, '') === '302')
    await iphone.reload({ waitUntil: 'domcontentloaded' })
    await iphone.getByTestId('phone-number').waitFor({ timeout: 30000 })
    check('iPhone rechargé : même numéro', (await iphone.getByTestId('phone-number').innerText()).replace(/\D/g, '') === '302')
  } catch (e) {
    check('iPhone (WebKit) disponible', false, String(e).slice(0, 200))
  }
  await regie.waitForTimeout(4500)
  check('Régie : 2 tickets téléphone (relu en moins de 5 s)', (await regie.getByTestId('phone-count').innerText()).startsWith('2'))

  section('Grand écran (1920×1080)')
  const screenCtx = await chrome.newContext({ viewport: { width: 1920, height: 1080 } })
  const screen = await screenCtx.newPage()
  screen.on('pageerror', (e) => errors.push(`écran: ${e.message}`))
  await screen.goto(`${base}/live/${code}`, { waitUntil: 'networkidle', timeout: 180000 })
  await screen.getByTestId('tombola-lobby').waitFor({ timeout: 60000 })
  check('Écran avant le tirage : accueil avec QR', (await screen.locator('[data-qr]').count()) >= 1)
  await screen.screenshot({ path: path.join(out, 't03-ecran-accueil.png') })

  section('Tirage depuis la régie')
  await regie.getByTestId('draw').click()
  await sleep(400)
  check('Écran : suspense « Et le numéro gagnant est… »', await screen.getByText('Et le numéro gagnant est').count().then((n) => n > 0).catch(() => false))
  await screen.getByTestId('hero-lot').waitFor({ timeout: 20000 })
  check('Écran : LOT 1 affiché', (await screen.getByTestId('hero-lot').innerText()).includes('1'))
  await screen.screenshot({ path: path.join(out, 't04-ecran-lot1.png') })
  await android.waitForTimeout(4500)
  check('Téléphone : « Tirage en cours », dernier numéro', (await android.getByTestId('phone-wait').innerText()).includes('Tirage en cours'))
  await regie.getByTestId('last').waitFor({ timeout: 10000 })
  check('Régie : distribution fermée au 1er tirage', (await regie.getByTestId('phone-open').innerText()) === 'Fermée')
  await regie.screenshot({ path: path.join(out, 't05-regie-tirage.png') })

  // Télécommande : Page ↓ = tirer
  await sleep(2800)
  await regie.locator('h1').click()
  await regie.keyboard.press('PageDown')
  await sleep(2000)
  check('Page ↓ : 2e numéro tiré', (await snapT()).state.draws.length + ((await snapT()).state.hidden ? 1 : 0) === 2, (await snapT()).state.draws.length)

  section('Absent à la souris, avec confirmation')
  await regie.getByTestId('mark-absent').waitFor({ timeout: 10000 })
  await regie.getByTestId('mark-absent').click()
  await regie.getByTestId('mark-confirm').waitFor()
  check('Fenêtre de confirmation « … est absent ? »', (await regie.getByTestId('mark-confirm').innerText()).includes('absent'))
  await regie.screenshot({ path: path.join(out, 't06-regie-absent.png') })
  await regie.keyboard.press('PageDown')
  await sleep(1500)
  const beforeOk = (await snapT()).state
  check('Page ↓ bloquée pendant la confirmation', beforeOk.draws.length === 2)
  await regie.getByTestId('mark-ok').click()
  await sleep(1500)
  check('Absent enregistré', (await snapT()).state.draws[1].o === 'absent')
  await regie.getByTestId('mark-winner').click()
  await sleep(1200)
  check('« Remettre gagnant » annule', (await snapT()).state.draws[1].o === 'winner')

  // Faire sortir le n° 301 (Android) : on tire jusqu'à ce qu'il sorte (le hasard reste en base).
  section('Numéro du téléphone sorti')
  for (let i = 0; i < 260; i++) {
    const s = (await snapT()).state
    if (s.draws.some((d) => d.n === 301)) break
    await unlock()
    const rr = await T({ action: 'draw', expect: s.draws.length + (s.hidden ? 1 : 0) })
    if (rr.status !== 200) break
  }
  await unlock()
  const wonLot = (await pub()).draws.find((d) => d.n === 301)
  await android.waitForTimeout(4500)
  check('Téléphone : « 🎉 Votre numéro est sorti ! Présentez-vous… »', (await android.getByTestId('phone-win').innerText().catch(() => '')).includes('Votre numéro est sorti'))
  await android.screenshot({ path: path.join(out, 't07-android-gagne.png') })
  await android.reload({ waitUntil: 'domcontentloaded' })
  await android.getByTestId('phone-win').waitFor({ timeout: 20000 })
  check('Rechargé : « Votre numéro est sorti » retrouvé', true)
  check(`Ticket : Lot ${wonLot?.lot} affiché`, (await android.getByTestId('phone-ticket').innerText()).includes(`Lot ${wonLot?.lot}`))

  section('Régie sans défilement après beaucoup de lots')
  await regie.reload({ waitUntil: 'networkidle' })
  await regie.getByTestId('winners').waitFor({ timeout: 60000 })
  const sc768 = await noScroll(regie)
  check('Régie 1366×768 après ~250 lots : aucun défilement', sc768.page && sc768.inner, sc768)
  await regie.screenshot({ path: path.join(out, 't09-regie-1366.png') })
  await regie.setViewportSize({ width: 1920, height: 1080 })
  await sleep(800)
  const sc1080 = await noScroll(regie)
  check('Régie 1920×1080 : aucun défilement', sc1080.page && sc1080.inner, sc1080)
  await regie.screenshot({ path: path.join(out, 't10-regie-1920.png') })
  await regie.setViewportSize({ width: 1366, height: 768 })
  await screen.waitForTimeout(1000)
  await screen.screenshot({ path: path.join(out, 't08-ecran-gagnants.png') })

  section('Boules à 3 et 4 chiffres')
  for (const [n, cls] of [[147, 'd3'], [1234, 'd4']]) {
    await T({ action: 'exit' })
    await T({ action: 'launch', paper: [[n, n]], phoneFrom: null })
    await T({ action: 'draw', expect: 0 })
    await sleep(1200)
    await screen.goto(`${base}/live/${code}`, { waitUntil: 'networkidle' })
    await screen.getByTestId('hero-lot').waitFor({ timeout: 60000 })
    const c = await screen.locator('.tmb-hero .ball').first().getAttribute('class')
    check(`Écran : n° ${n} dans la boule, texte réduit (${cls})`, c.includes(cls) && (await screen.locator('.tmb-hero .ball').innerText()).trim() === String(n), c)
    const fits = await screen.locator('.tmb-hero .ball-med span').evaluate((el) => el.scrollWidth <= el.parentElement.clientWidth)
    check(`Écran : n° ${n} tient dans la boule`, fits)
    await screen.screenshot({ path: path.join(out, `t11-ecran-${n}.png`) })
  }
  await T({ action: 'exit' })
  await T({ action: 'launch', paper: [[1, 250]], phoneFrom: null })
  for (let i = 0; i < 5; i++) { await unlock(); await T({ action: 'draw', expect: i }) }
  await unlock()

  section('Pannes')
  // Régie silencieuse 3 min : écran « en pause », téléphone garde tout.
  await admin.from('bingo_tombola').update({ heartbeat_at: new Date(Date.now() - 4 * 60e3).toISOString() }).eq('session_id', sessionId)
  st = await status()
  check('Régie en panne : tombola toujours présente (stale)', st.present === true && st.live === false, st)
  check('État public : paused = true', (await pub()).paused === true)
  const before = (await pub()).draws
  await regie.goto(`${base}/admin/jeux/bingo/tombola?session=${sessionId}`, { waitUntil: 'networkidle' })
  await regie.getByTestId('banner-resumed').waitFor({ timeout: 60000 })
  check('Régie rouverte : bandeau « Tombola reprise… rien n’a été perdu »', (await regie.getByTestId('banner-resumed').innerText()).includes('Rien n’a été perdu'))
  check('Reprise exacte (mêmes numéros, mêmes lots)', JSON.stringify((await pub()).draws) === JSON.stringify(before))
  check('Signal de vie rétabli : en direct', (await status()).live === true)
  await regie.goto(`${base}/admin/jeux/bingo?session=${sessionId}`, { waitUntil: 'networkidle' })
  await regie.waitForURL('**/admin/jeux/bingo/tombola**', { timeout: 60000 })
  check('Régie du loto ouverte : redirigée vers la tombola en cours', true)
  // Autre jeu lancé : pause, rien d'effacé, puis reprise.
  await admin.from('sessions').update({ bingo_active: false, quiz_active: true }).eq('id', sessionId)
  st = await status()
  check('Autre jeu lancé : tombola en pause (held)', st.held === true && st.present === false, st)
  check('État public : held', (await pub()).held === true)
  await regie.reload({ waitUntil: 'networkidle' })
  await regie.getByTestId('banner-held').waitFor({ timeout: 60000 })
  await regie.getByTestId('resume').click()
  await sleep(2000)
  check('Reprendre : tombola de retour à l’identique', (await status()).live === true && JSON.stringify((await pub()).draws) === JSON.stringify(before))
  check('Autre jeu éteint à la reprise', (await admin.from('sessions').select('quiz_active').eq('id', sessionId).single()).data.quiz_active === false)

  section('Fin de tombola')
  await regie.getByTestId('end').click()
  await regie.getByTestId('bingo-confirm-next').click()
  await regie.getByTestId('bingo-confirm-check').check()
  await regie.getByTestId('bingo-confirm-ok').click()
  await sleep(2000)
  check('Terminer (double confirmation) : tout effacé', (await admin.from('bingo_tombola').select('session_id').eq('session_id', sessionId)).data.length === 0)
  await android.waitForTimeout(4000)
  check('Téléphone : « La tombola est terminée »', (await android.getByTestId('phone-off').innerText()).includes('terminée'))

  section('Non-régression du loto')
  r = await L({ action: 'launch', ...defaultLoto })
  check('Loto lancé après la tombola', r.status === 200 && r.json?.active === true, r)
  st = await status()
  check('Statut : loto (sans mode tombola), en direct', st.live === true && st.mode === undefined, st)
  check('Loto : commencer', (await L({ action: 'start' })).status === 200)
  const ball = await L({ action: 'draw', expect: 0 })
  check('Loto : boule tirée (1 à 90)', ball.status === 200, ball)
  const join = await call('POST', '/api/bingo/join', { code, name: 'Emma' }, false)
  check('Loto : un joueur reçoit son carton', join.status === 200 && join.json?.cards?.length === 1, join)
  const lotoPhone = await (await chrome.newContext({ ...pw.devices['Pixel 7'] })).newPage()
  await lotoPhone.goto(`${base}/invite/${code}`, { waitUntil: 'domcontentloaded' })
  await lotoPhone.waitForURL(`**/bingo/${code}`, { timeout: 60000 })
  check('QR pendant un loto : page du loto (pas la tombola)', lotoPhone.url().includes(`/bingo/${code}`))
  check('Tombola refusée pendant le loto', (await T({ action: 'launch', paper: [[1, 10]], phoneFrom: null })).json?.code === 'loto_running')
  check('Loto quitté', (await L({ action: 'exit' })).status === 200)
} catch (e) {
  check('Scénario terminé sans exception', false, String(e?.stack ?? e).slice(0, 600))
} finally {
  for (const b of browsers) await b.close().catch(() => {})
  await admin.from('sessions').delete().eq('id', sessionId)
  await admin.from('user_profiles').delete().eq('id', userId)
  await admin.auth.admin.deleteUser(userId)
  const left = await Promise.all([
    admin.from('sessions').select('id', { count: 'exact', head: true }).eq('id', sessionId),
    admin.from('bingo_tombola').select('session_id', { count: 'exact', head: true }).eq('session_id', sessionId),
    admin.from('bingo_runtime').select('session_id', { count: 'exact', head: true }).eq('session_id', sessionId),
  ])
  results.push(`\nNettoyage : ${left.map((x) => x.count).join(' / ')} ligne(s) restante(s) (session / tombola / loto)`)
  if (errors.length) results.push(`\nErreurs JavaScript : ${errors.length}\n${errors.slice(0, 10).join('\n')}`)
  console.log(results.join('\n'))
  console.log(`\n${pass} OK, ${failN} ÉCHEC`)
}
