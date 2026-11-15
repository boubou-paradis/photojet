// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.
// Repris du prototype À Demi-Mot (Desktop/a-demi-mot), qui reste la référence.
// À Demi-Mot — studio TV en 3D (Three.js), direction V3 « plateau contemporain ».
// Vue d'un public face au plateau : caméra fixe, faces des lettres frontales.
// Tout ce qui est affiché (lettres, titre, catégorie, pupitres, scores, jauge) vient de l'état reçu :
// l'animation suit le moteur, elle ne décide jamais d'un résultat.
//
// Principes V3 : profils métalliques fins et arrondis (tubes à normales lisses), laque noire,
// champagne satiné pour les finitions, LED diffusées et discrètes, aucune animation permanente.

import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { layoutBoard, type Cell } from '@/lib/demimot/text'
import type { PublicCell } from '@/lib/demimot/view'
import { beamTexture, contactShadowTexture, disposeTextures, drawBand, drawLectern, drawTimer, glowTexture, hiddenTexture, ledTexture, letterTexture, releaseThemeTextures, setAnisotropy } from './textures'
import { DEFAULT_THEME, themeOf, type PlateauTheme, type ThemeId } from '../themes'

export type Quality = 'auto' | 'high' | 'low'

export interface StudioTeam {
  id: string
  name: string
  color: string
  score: number
  state: 'normal' | 'active' | 'blocked' | 'off'
  note?: string
}

export interface StudioState {
  board: { key: string; cells: PublicCell[] }
  category: string | null
  /** Ligne sous la catégorie (« Énigme 4/10 · 100 pts », « Les Zincs a la main »…). */
  line: { text: string; color: string }[]
  code: string
  teams: StudioTeam[]
  /** Jauge lumineuse dans le bas du cadre (temps de réponse, dernière chance). */
  gauge: null | { color: string; endsAt: number; totalMs: number; label?: string }
  clockOffsetMs: number
  /** Couleur d'accent (équipe qui a la main, gagnante) ; null = accent du thème. */
  accent: string | null
  /** Change à chaque victoire : déclenche la brève montée de lumière. */
  celebrateKey: string | null
  /** Masque les pupitres (podium, accueil plein écran). */
  showTeams: boolean
  /** Couleur du plateau (shared/themes.ts). Changée à chaud : aucun état de jeu n'est reconstruit. */
  theme: ThemeId
}

export interface StudioOptions {
  quality: Quality
  reducedMotion: boolean
  onFallback?: (reason: string) => void
}

interface Tile {
  pivot: THREE.Group
  front: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
  shown: boolean
  anim: null | { from: number; to: number; start: number; dur: number }
}

interface Lectern {
  group: THREE.Group
  canvas: HTMLCanvasElement
  tex: THREE.CanvasTexture
  strip: THREE.MeshStandardMaterial
  glow: THREE.MeshBasicMaterial
  key: string
}

// Les couleurs du décor viennent du thème (shared/themes.ts) ; seule la laque noire est commune.
const FLOOR_Y = -2.9
const WALL = { cx: 0, cy: 1.05, w: 18.6, h: 5.7 }
const LETTER_AREA = { w: 17.7, h: 5.05 }
/** Jauge : demi-largeur occupée par la plaque, longueur de chaque segment, largeur de la plaque. */
const GAUGE = { inner: 2.75, len: 4.2, plateW: 5.2 }
/** En-tête : catégorie (titre principal) et ligne d'énigme. */
const HEADER = { catY: 5.55, lineY: 4.72 }
const TILE_MAX = 1.42
const CAM_Y = 2.2
const VFOV = 40

const easeOutBack = (t: number) => 1 + 2.25 * Math.pow(t - 1, 3) + 1.25 * Math.pow(t - 1, 2)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export class StudioScene {
  readonly renderer: THREE.WebGLRenderer
  frames = 0
  private canvas: HTMLCanvasElement
  private opts: StudioOptions
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(VFOV, 16 / 9, 0.1, 200)
  private level: 'high' | 'low'
  private raf = 0
  private last = performance.now()
  private frameTimes: number[] = []
  private slowWindows = 0
  private qualityHoldUntil = 0
  private disposed = false
  private ro: ResizeObserver

  private wall = new THREE.Group()
  private tiles = new Map<number, Tile>()
  private tileGeo: { body?: THREE.BufferGeometry; face?: THREE.PlaneGeometry } = {}
  private mats: Record<string, THREE.Material> = {}
  private boardKey = ''

  private lecterns: Lectern[] = []
  private lecternLayout = ''
  private lecternGroup = new THREE.Group()
  private lecternGeo: THREE.BufferGeometry[] = []

  private catCanvas = document.createElement('canvas')
  private catTex: THREE.CanvasTexture
  private lineCanvas = document.createElement('canvas')
  private lineTex: THREE.CanvasTexture
  private codeCanvas = document.createElement('canvas')
  private codeTex: THREE.CanvasTexture
  private catKey = ''
  private lineKey = ''
  private codeKey = ''

  private gaugeBars: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = []
  private gaugeBase!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  // Plaque « compte à rebours » : nom de l'équipe qui a la main + secondes, sous le mur.
  private timerCanvas = document.createElement('canvas')
  private timerTex!: THREE.CanvasTexture
  private timerPlate!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private timerKey = ''
  private ledPanels: THREE.MeshStandardMaterial[] = []
  private stepStrips: THREE.MeshStandardMaterial[] = []
  private key!: THREE.DirectionalLight
  private accentLight = new THREE.SpotLight('#ffffff', 0, 30, 0.36, 0.7, 1.2)
  private accentColor = new THREE.Color()
  // Thème : références des matières et lumières teintées, mises à jour par applyTheme().
  private theme: PlateauTheme = themeOf(DEFAULT_THEME)
  private themeId = ''
  private pmrem!: THREE.PMREMGenerator
  private envRT: THREE.WebGLRenderTarget | null = null
  private farMat!: THREE.MeshStandardMaterial
  private barMat!: THREE.MeshStandardMaterial
  private ambienceLight!: THREE.SpotLight
  private rimLights: THREE.DirectionalLight[] = []
  private lowRims: THREE.DirectionalLight[] = []
  private beamMats: THREE.MeshBasicMaterial[] = []
  private ledMaps: THREE.Texture[] = []
  private sigCanvas = document.createElement('canvas')
  private sigTex!: THREE.CanvasTexture
  private boost = 0
  private reflector: Reflector | null = null
  private floorVeil!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
  private state: StudioState | null = null
  private celebrated: string | null = null
  private burst: null | { points: THREE.Points; vel: Float32Array; start: number } = null
  private disposables: { dispose(): void }[] = []

  constructor(canvas: HTMLCanvasElement, opts: StudioOptions) {
    this.canvas = canvas
    this.opts = opts
    this.level = opts.quality === 'low' ? 'low' : 'high'
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // Tonemapping neutre : les blancs restent blancs, les noirs restent noirs.
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.setClearColor('#030405')
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    setAnisotropy(this.renderer)
    canvas.addEventListener('webglcontextlost', this.onLost)

    // Environnement « studio » : boîte sombre et quelques boîtes à lumière rectangulaires.
    // C'est lui qui dessine les reflets de contour nets sur les profils arrondis.
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.disposables.push(this.pmrem)
    this.scene.environmentIntensity = 0.55

    this.catCanvas.width = 1400
    this.catCanvas.height = 160
    this.catTex = this.dynTex(this.catCanvas)
    this.lineCanvas.width = 1600
    this.lineCanvas.height = 150
    this.lineTex = this.dynTex(this.lineCanvas)
    this.codeCanvas.width = 1200
    this.codeCanvas.height = 240
    this.codeTex = this.dynTex(this.codeCanvas)
    this.timerCanvas.width = 1400
    this.timerCanvas.height = 200
    this.timerTex = this.dynTex(this.timerCanvas)
    this.sigCanvas.width = 1000
    this.sigCanvas.height = 200
    this.sigTex = this.dynTex(this.sigCanvas)

    this.buildStudio()
    this.applyTheme(DEFAULT_THEME)
    this.scene.add(this.wall, this.lecternGroup)
    this.applyLevel()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    this.resize()
    this.loop()
  }

  private dynTex(c: HTMLCanvasElement) {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    this.disposables.push(t)
    return t
  }

  private mat<T extends THREE.Material>(name: string, make: () => T): T {
    if (!this.mats[name]) this.mats[name] = make()
    return this.mats[name] as T
  }

  // ================================================================ décor
  private buildStudio() {
    const s = this.scene
    // Champagne poli (profils principaux), satiné (pièces secondaires), profond (structure arrière).
    const polished = this.mat('polished', () => new THREE.MeshPhysicalMaterial({ color: '#cccccc', metalness: 1, roughness: 0.2, envMapIntensity: 1.25 }))
    const satin = this.mat('satin', () => new THREE.MeshStandardMaterial({ color: '#aaaaaa', metalness: 1, roughness: 0.42, envMapIntensity: 1.0 }))
    const deep = this.mat('deep', () => new THREE.MeshStandardMaterial({ color: '#777777', metalness: 1, roughness: 0.5, envMapIntensity: 0.8 }))
    const lacquer = this.mat('lacquer', () => new THREE.MeshPhysicalMaterial({ color: '#0D0D10', metalness: 0.0, roughness: 0.38, clearcoat: 0.85, clearcoatRoughness: 0.14, envMapIntensity: 0.7 }))
    const matte = this.mat('matte', () => new THREE.MeshStandardMaterial({ color: '#07080A', metalness: 0.0, roughness: 0.9, envMapIntensity: 0.3 }))

    // Fond de studio sombre, quelques colonnes lointaines à la teinte du thème (profondeur, sans scintillement).
    const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), matte)
    back.position.set(0, 6, -9)
    s.add(back)
    const farMat = (this.farMat = new THREE.MeshStandardMaterial({ color: '#060608', emissiveIntensity: 0.16 }))
    for (const x of [-17, -13.8, 13.8, 17]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 14, 12), farMat)
      bar.position.set(x, 3.5, -7)
      s.add(bar)
    }

    // Sol : laque sombre à vernis satiné. Il renvoie la lumière diffuse du studio (reflets doux)
    // mais aucun miroir : la phrase et les scores ne sont jamais dupliqués au sol.
    const veilMat = new THREE.MeshPhysicalMaterial({ color: '#050607', metalness: 0, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.55 }) as unknown as THREE.MeshStandardMaterial
    this.floorVeil = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), veilMat)
    this.floorVeil.rotation.x = -Math.PI / 2
    this.floorVeil.position.set(0, FLOOR_Y, 4)
    this.floorVeil.receiveShadow = true
    s.add(this.floorVeil)

    // Mur de lettres : fond laqué, lunette laquée à chants arrondis, deux filets champagne.
    const backing = new THREE.Mesh(new THREE.BoxGeometry(WALL.w, WALL.h, 0.3), lacquer)
    backing.position.set(WALL.cx, WALL.cy, -0.35)
    backing.receiveShadow = true
    s.add(backing)
    const bezelOuter = roundedRect(WALL.w + 0.62, WALL.h + 0.62, 0.42)
    bezelOuter.holes.push(roundedRect(WALL.w + 0.04, WALL.h + 0.04, 0.24))
    const bezel = new THREE.Mesh(soft(new THREE.ExtrudeGeometry(bezelOuter, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 24 })), lacquer)
    bezel.position.set(WALL.cx, WALL.cy, -0.2)
    bezel.castShadow = true
    bezel.receiveShadow = true
    s.add(bezel)
    s.add(tubeLoop(roundedRect(WALL.w + 0.1, WALL.h + 0.1, 0.26), 0.032, polished, WALL.cx, WALL.cy, 0.0))
    s.add(tubeLoop(roundedRect(WALL.w + 0.7, WALL.h + 0.7, 0.46), 0.05, satin, WALL.cx, WALL.cy, -0.08))

    // Socle sous le mur + deux marches à chants arrondis, filet champagne et lumière rasante.
    const wallBottom = WALL.cy - WALL.h / 2 - 0.35
    const plinthH = wallBottom - FLOOR_Y
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(WALL.w + 0.4, plinthH, 0.8, 4, 0.06), lacquer)
    plinth.position.set(0, FLOOR_Y + plinthH / 2, -0.25)
    plinth.receiveShadow = true
    s.add(plinth)
    const steps = [
      { w: 21.0, h: 0.3, d: 1.4, z: 1.3, y: FLOOR_Y + 0.15 },
      { w: 19.6, h: 0.3, d: 1.0, z: 0.7, y: FLOOR_Y + 0.45 },
    ]
    for (const st of steps) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(st.w, st.h, st.d, 4, 0.07), lacquer)
      m.position.set(0, st.y, st.z)
      m.receiveShadow = true
      m.castShadow = true
      s.add(m)
      const lip = rod(st.w - 0.3, 0.018, polished)
      lip.position.set(0, st.y + st.h / 2 - 0.035, st.z + st.d / 2 - 0.01)
      s.add(lip)
      const stripMat = new THREE.MeshStandardMaterial({ color: '#0b0b0c', emissiveIntensity: 0.55 })
      this.stepStrips.push(stripMat)
      const strip = new THREE.Mesh(new THREE.BoxGeometry(st.w - 0.5, 0.02, 0.02), stripMat)
      strip.position.set(0, st.y - st.h / 2 + 0.05, st.z + st.d / 2 - 0.03)
      s.add(strip)
    }

    // Jauge : filet lumineux intégré au bas de la lunette (temps de réponse, dernière chance).
    // Le filet se partage en deux segments de part et d'autre de la plaque compte à rebours
    // et se consume vers elle (chaque segment est ancré au bord de la plaque).
    const gy = WALL.cy - WALL.h / 2 - 0.17
    this.gaugeBase = new THREE.Mesh(new THREE.BoxGeometry(2 * (GAUGE.inner + GAUGE.len), 0.07, 0.03), new THREE.MeshStandardMaterial({ color: '#0a0a0c', emissiveIntensity: 0.12 }))
    this.gaugeBase.position.set(0, gy, 0.07)
    s.add(this.gaugeBase)
    const barMat = (this.barMat = new THREE.MeshStandardMaterial({ color: '#000', emissiveIntensity: 2.6 }))
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(GAUGE.len, 0.11, 0.04)
      g.translate((side * GAUGE.len) / 2, 0, 0)
      const bar = new THREE.Mesh(g, barMat)
      bar.position.set(side * GAUGE.inner, gy, 0.082)
      bar.visible = false
      this.gaugeBars.push(bar)
      s.add(bar)
    }
    // Plaque compte à rebours sur la lunette basse : dessinée par-dessus le décor
    // (lisible même quand la rangée arrière de pupitres passe devant, à 10 équipes).
    this.timerPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(GAUGE.plateW, GAUGE.plateW / 7),
      new THREE.MeshBasicMaterial({ map: this.timerTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    )
    this.timerPlate.position.set(0, gy - 0.04, 0.6)
    this.timerPlate.renderOrder = 20
    this.timerPlate.visible = false
    s.add(this.timerPlate)

    // Portique : profil champagne poli en un seul tracé, raccords courbes ; filet satiné en retrait.
    const arch = archPath(10.45, 4.5, 7.05, 6.9)
    s.add(tubeOpen(arch.getSpacedPoints(200), 0.085, polished, 0.12))
    s.add(tubeOpen(archPath(10.05, 4.3, 6.72, 6.5).getSpacedPoints(200), 0.032, deep, -0.3))
    const fill = archPath(10.4, 4.5, 7.0, 6.9)
    fill.lineTo(-10.4, FLOOR_Y)
    const fillMesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(fill.getPoints(80)), 48), lacquer)
    fillMesh.position.z = -0.6
    fillMesh.receiveShadow = true
    s.add(fillMesh)

    // Murs LED latéraux : diffuseurs discrets (pas de points contrastés), filet champagne fin.
    for (const side of [-1, 1]) {
      const g = new THREE.Group()
      const ledMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.75, envMapIntensity: 0.3 })
      this.ledPanels.push(ledMat)
      const panel = new THREE.Mesh(roundedPlane(2.2, 8.4, 0.22), ledMat)
      g.add(panel)
      const casing = new THREE.Mesh(soft(new THREE.ExtrudeGeometry(roundedRect(2.42, 8.62, 0.3), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 16 })), lacquer)
      casing.position.z = -0.16
      g.add(casing)
      g.add(tubeLoop(roundedRect(2.3, 8.5, 0.26), 0.022, satin, 0, 0, 0.02))
      g.position.set(side * 12.1, FLOOR_Y + 4.6, 0.8)
      g.rotation.y = -side * 0.55
      s.add(g)
      // colonne extérieure : tube champagne satiné fin, sans inclinaison
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 13, 24), satin)
      col.position.set(side * 13.7, FLOOR_Y + 6.5, 1.2)
      col.castShadow = true
      s.add(col)
    }

    // En-tête : la catégorie de la manche est le titre principal (cartouche à la teinte du thème),
    // la ligne d'énigme (numéro, points, buzz) dessous. Le nom du jeu n'est plus qu'une signature en haut à gauche.
    const cat = new THREE.Group()
    cat.position.set(0, HEADER.catY, 0.35)
    const capW = 7.6
    const capH = 0.84
    const band = this.mat('band', () => new THREE.MeshPhysicalMaterial({ color: '#15171C', metalness: 0.1, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }))
    const capsule = new THREE.Mesh(soft(new THREE.ExtrudeGeometry(roundedRect(capW, capH, capH / 2), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 24 })), band)
    capsule.position.z = -0.08
    cat.add(capsule)
    cat.add(tubeLoop(roundedRect(capW + 0.12, capH + 0.12, (capH + 0.12) / 2), 0.018, polished, 0, 0, -0.02))
    const catPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 7.0 * (160 / 1400)), new THREE.MeshBasicMaterial({ map: this.catTex, transparent: true, toneMapped: false }))
    catPlane.position.z = 0.03
    cat.add(catPlane)
    s.add(cat)

    const linePlane = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2 * (150 / 1600)), new THREE.MeshBasicMaterial({ map: this.lineTex, transparent: true, toneMapped: false }))
    linePlane.position.set(0, HEADER.lineY, 0.3)
    s.add(linePlane)

    // Cartouches d'angle (signature du jeu, code capitaine) : gélules laquées, filet métal.
    for (const side of [-1, 1]) {
      const g = new THREE.Group()
      const pw = 4.8
      const ph = 0.95
      const body = new THREE.Mesh(soft(new THREE.ExtrudeGeometry(roundedRect(pw, ph, 0.3), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 16 })), lacquer)
      body.position.z = -0.1
      g.add(body)
      g.add(tubeLoop(roundedRect(pw + 0.1, ph + 0.1, 0.34), 0.016, satin, 0, 0, -0.03))
      g.position.set(side * 10.75, 7.5, 0.2)
      if (side === 1) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.3 * (240 / 1200)), new THREE.MeshBasicMaterial({ map: this.codeTex, transparent: true, toneMapped: false }))
        p.position.z = 0.02
        g.add(p)
      } else {
        // Signature discrète « À Demi-Mot » (remplace le logo sur l'écran public).
        const p = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 4.3 * (200 / 1000)), new THREE.MeshBasicMaterial({ map: this.sigTex, transparent: true, toneMapped: false }))
        p.position.z = 0.02
        g.add(p)
      }
      s.add(g)
    }

    // Pont d'éclairage + projecteurs (corps sombres, lentilles douces).
    const steel = this.mat('steel', () => new THREE.MeshStandardMaterial({ color: '#232327', metalness: 0.9, roughness: 0.45 }))
    for (const y of [8.95, 8.55]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 34, 12), steel)
      t.rotation.z = Math.PI / 2
      t.position.set(0, y, 2.5)
      s.add(t)
    }
    const beamTex = beamTexture()
    for (const x of [-11, -6.2, 6.2, 11]) {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.7, 24), this.mat('steel2', () => new THREE.MeshStandardMaterial({ color: '#141416', metalness: 0.7, roughness: 0.4 })))
      head.position.set(x, 8.25, 2.5)
      head.rotation.x = 0.5
      s.add(head)
      const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff7e6', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }))
      lens.position.set(x, 7.98, 2.85)
      lens.scale.set(0.8, 0.8, 1)
      s.add(lens)
      // faisceau très discret derrière le mur : ne passe jamais devant une lettre
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 12), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false }))
      this.beamMats.push(beam.material)
      beam.geometry.translate(0, -6, 0)
      beam.position.set(x * 1.15, 8.4, -1.2)
      beam.rotation.z = x * 0.025
      s.add(beam)
      const spot = new THREE.SpotLight('#ffffff', 34, 30, 0.32, 0.75, 1.4)
      spot.position.set(x, 8.2, 2.5)
      spot.target.position.set(x * 0.45, WALL.cy, 0)
      s.add(spot, spot.target)
    }

    // Lumières : clé blanche (faces à lire), contre-jours (contours), accompagnement à la teinte du thème.
    // Rééquilibrage : un léger ciel/sol et des contours doux pour que les volumes noirs se détachent,
    // sans halo (aucune source visible, aucun sprite ajouté).
    s.add(new THREE.AmbientLight('#ffffff', 0.2))
    s.add(new THREE.HemisphereLight('#AEB6C4', '#0A0A0C', 0.3))
    this.key = new THREE.DirectionalLight('#ffffff', 1.9)
    this.key.position.set(1.5, 9, 16)
    this.key.target.position.set(0, 0, 0)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(2048, 2048)
    Object.assign(this.key.shadow.camera, { left: -15, right: 15, top: 10, bottom: -6, near: 1, far: 40 })
    this.key.shadow.bias = -0.0006
    this.key.shadow.normalBias = 0.02
    this.key.shadow.radius = 4
    s.add(this.key, this.key.target)
    for (const side of [-1, 1]) {
      const rim = new THREE.DirectionalLight('#ffffff', 1.6)
      this.rimLights.push(rim)
      rim.position.set(side * 15, 10, -7)
      rim.target.position.set(0, FLOOR_Y + 1, 4)
      s.add(rim, rim.target)
      // Contre-jour bas et rasant : dessine le profil des pupitres et des marches.
      const low = new THREE.DirectionalLight('#ffffff', 0.9)
      this.lowRims.push(low)
      low.position.set(side * 10, 1.5, -3)
      low.target.position.set(-side * 2, FLOOR_Y + 0.8, 6)
      s.add(low, low.target)
    }
    // Remplissage frontal large et doux (sans ombre) sur les pupitres.
    const frontFill = new THREE.DirectionalLight('#FFFFFF', 0.45)
    frontFill.position.set(0, 2, 22)
    frontFill.target.position.set(0, FLOOR_Y + 1, 5)
    s.add(frontFill, frontFill.target)
    // Lumière d'accompagnement (teinte du thème), dirigée vers le sol devant le plateau.
    const em = (this.ambienceLight = new THREE.SpotLight('#ffffff', 45, 40, 0.7, 0.85, 1.2))
    em.position.set(0, 9, 6)
    em.target.position.set(0, FLOOR_Y, 4)
    s.add(em, em.target)
    this.accentLight.position.set(0, 8, 9)
    s.add(this.accentLight, this.accentLight.target)
  }

  // ================================================================ thème
  /** Applique une couleur de plateau à chaud : matières, lumières, textures et environnement.
   *  Ne touche ni au mur (lettres, état des cases), ni aux pupitres, ni à la caméra. */
  private applyTheme(id: ThemeId) {
    const t = themeOf(id)
    if (t.id === this.themeId) return
    this.theme = t
    this.themeId = t.id
    const m = this.mats as Record<string, THREE.MeshStandardMaterial>
    m.polished?.color.set(t.metal.polished)
    m.satin?.color.set(t.metal.satin)
    m.deep?.color.set(t.metal.deep)
    m.tileEdge?.color.set(t.metal.satin)
    if (m.tileBack) {
      m.tileBack.map = hiddenTexture(t)
      m.tileBack.emissive.set(t.hidden.emissive)
      m.tileBack.emissiveIntensity = t.hidden.emissiveIntensity
      m.tileBack.needsUpdate = true
    }
    if (m.band) {
      m.band.color.set(t.band.color)
      m.band.emissive.set(t.band.emissive)
      m.band.emissiveIntensity = t.band.emissiveIntensity
    }
    this.farMat.emissive.set(t.accent)
    this.gaugeBase.material.emissive.set(t.accent)
    this.barMat.emissive.set(t.gauge)
    for (const sm of this.stepStrips) sm.emissive.set(t.strip)
    for (const b of this.beamMats) b.color.set(t.beam)
    for (const r of this.rimLights) r.color.set(t.rim)
    for (const r of this.lowRims) r.color.set(t.strip)
    this.ambienceLight.color.set(t.accent)
    // Diffuseurs LED : nouvelle trame, ancienne libérée.
    for (const old of this.ledMaps) old.dispose()
    this.ledMaps = this.ledPanels.map((mat) => {
      const led = ledTexture(t).clone()
      led.needsUpdate = true
      led.repeat.set(1, 3)
      mat.emissiveMap = led
      mat.needsUpdate = true
      return led
    })
    releaseThemeTextures(t.id)
    // Environnement de reflets : boîtes à lumière neutres + touche basse à la teinte du thème.
    const envScene = studioEnvironment(t.accent)
    const envRT = this.pmrem.fromScene(envScene, 0.02)
    envScene.traverse((o) => {
      const mm = o as THREE.Mesh
      mm.geometry?.dispose?.()
      ;(mm.material as THREE.Material | undefined)?.dispose?.()
    })
    // Libère la cible de rendu entière (pas seulement sa texture), sinon une texture GPU reste par bascule.
    this.envRT?.dispose()
    this.envRT = envRT
    this.scene.environment = envRT.texture
    // La régénération coûte une image : on ne la compte pas comme un ralentissement (qualité adaptative).
    this.slowWindows = 0
    this.qualityHoldUntil = this.frames + 120
    // Textes en canvas qui dépendent du thème.
    drawBand(this.sigCanvas, [{ text: 'À Demi-Mot', color: t.metal.text }], { size: 92, spacing: 3, weight: 600 })
    this.sigTex.needsUpdate = true
    for (const l of this.lecterns) l.key = ''
    if (!this.state?.accent) this.accentColor.set(t.accent)
  }

  // ================================================================ état
  setState(st: StudioState) {
    if (this.disposed) return
    this.state = st
    if (st.theme !== this.themeId) this.applyTheme(st.theme)
    if (st.board.key !== this.boardKey) this.rebuildWall(st.board.key, st.board.cells)
    else this.updateWall(st.board.cells)

    const catKey = st.category ?? ''
    if (catKey !== this.catKey) {
      this.catKey = catKey
      const catText = (st.category ?? '').toLocaleUpperCase('fr-FR')
      drawBand(this.catCanvas, [{ text: catText, color: '#FFFFFF' }], { size: 100, spacing: catText.length > 18 ? 5 : 14, weight: 700, wrap: true })
      this.catTex.needsUpdate = true
    }
    const lineKey = JSON.stringify(st.line)
    if (lineKey !== this.lineKey) {
      this.lineKey = lineKey
      drawBand(this.lineCanvas, st.line.map((p) => ({ ...p, text: p.text.toLocaleUpperCase('fr-FR') })), { size: 76, spacing: 5, weight: 600 })
      this.lineTex.needsUpdate = true
    }
    if (st.code !== this.codeKey) {
      this.codeKey = st.code
      drawBand(this.codeCanvas, [{ text: 'CAPITAINES · ', color: '#CFCFC8' }, { text: st.code, color: '#FFFFFF' }], { size: 96, spacing: 6, weight: 700 })
      this.codeTex.needsUpdate = true
    }

    this.updateLecterns(st)
    this.accentColor.set(st.accent ?? this.theme.accent)
    if (st.celebrateKey && st.celebrateKey !== this.celebrated) {
      this.celebrated = st.celebrateKey
      this.boost = 1
      this.celebrate()
    }
  }

  // ---------------------------------------------------------------- mur de lettres
  private rebuildWall(key: string, cells: PublicCell[]) {
    this.boardKey = key
    for (const c of [...this.wall.children]) this.wall.remove(c)
    for (const t of this.tiles.values()) t.front.material.dispose()
    this.tiles.clear()
    this.tileGeo.body?.dispose()
    this.tileGeo.face?.dispose()

    const layoutCells: Cell[] = cells.map((c) => ({ ch: c.ch ?? 'M', kind: c.kind }))
    const L = layoutBoard(layoutCells, LETTER_AREA.w / LETTER_AREA.h)
    // Taille dictée par le contenu réel ; plafonnée pour qu'un mot court ne devienne pas un bloc.
    const tw = Math.min(L.tile * LETTER_AREA.w, TILE_MAX)
    const th = tw / 0.78
    const gx = tw * 0.12
    const gy = tw * 0.2
    const depth = tw * 0.24
    // Module mécanique : corps champagne satiné à arêtes arrondies, faces presque bord à bord.
    this.tileGeo.body = new RoundedBoxGeometry(tw, th, depth, 2, tw * 0.055)
    this.tileGeo.face = new THREE.PlaneGeometry(tw * 0.925, th * 0.94)
    const edge = this.mat('tileEdge', () => new THREE.MeshStandardMaterial({ color: this.theme.metal.satin, metalness: 1, roughness: 0.36, envMapIntensity: 1.0 }))
    const back = this.mat('tileBack', () => new THREE.MeshStandardMaterial({ map: hiddenTexture(this.theme), emissive: this.theme.hidden.emissive, emissiveIntensity: this.theme.hidden.emissiveIntensity, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.35 }))

    const rows = L.lines.length
    const totalH = rows * th + (rows - 1) * gy
    L.lines.forEach((line, r) => {
      const lw = line.length * tw + (line.length - 1) * gx
      const y = WALL.cy + totalH / 2 - th / 2 - r * (th + gy)
      line.forEach((ci, k) => {
        if (ci < 0) return
        const cell = cells[ci]
        const pivot = new THREE.Group()
        pivot.position.set(-lw / 2 + tw / 2 + k * (tw + gx), y, 0)
        const body = new THREE.Mesh(this.tileGeo.body!, edge)
        body.castShadow = true
        pivot.add(body)
        // Face blanche mate (aucun reflet sur la lettre), légèrement émissive : blanc franc.
        const frontMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.64, envMapIntensity: 0 })
        const front = new THREE.Mesh(this.tileGeo.face!, frontMat)
        front.position.z = depth / 2 + 0.003
        pivot.add(front)
        const b = new THREE.Mesh(this.tileGeo.face!, back)
        b.position.z = -depth / 2 - 0.003
        b.rotation.x = Math.PI
        pivot.add(b)
        const shown = cell.ch !== null
        if (shown) frontMat.map = frontMat.emissiveMap = letterTexture(cell.ch!)
        pivot.rotation.x = shown ? 0 : Math.PI
        this.wall.add(pivot)
        this.tiles.set(ci, { pivot, front, shown, anim: null })
      })
    })
  }

  private updateWall(cells: PublicCell[]) {
    const now = performance.now()
    const newly = cells.filter((c, i) => c.ch !== null && this.tiles.get(i) && !this.tiles.get(i)!.shown).length
    let order = 0
    cells.forEach((c, i) => {
      const t = this.tiles.get(i)
      if (!t) return
      if (c.ch !== null && !t.shown) {
        t.shown = true
        t.front.material.map = t.front.material.emissiveMap = letterTexture(c.ch)
        t.front.material.needsUpdate = true
        // Résolution : vague synchronisée de gauche à droite ; révélation simple : immédiate.
        const delay = newly > 3 ? order++ * 45 : 0
        t.anim = { from: t.pivot.rotation.x, to: 0, start: now + delay, dur: this.opts.reducedMotion ? 0 : 520 }
      } else if (c.ch === null && t.shown) {
        t.shown = false
        t.anim = { from: t.pivot.rotation.x, to: Math.PI, start: now, dur: this.opts.reducedMotion ? 0 : 280 }
      }
    })
  }

  // ---------------------------------------------------------------- pupitres
  private updateLecterns(st: StudioState) {
    const n = st.showTeams ? st.teams.length : 0
    const layoutKey = `${n}`
    if (layoutKey !== this.lecternLayout) this.buildLecterns(n)
    st.teams.slice(0, n).forEach((t, i) => {
      const l = this.lecterns[i]
      const k = `${this.themeId}|${JSON.stringify(t)}`
      if (k === l.key) return
      l.key = k
      drawLectern(l.canvas, { index: i + 1, ...t }, this.theme.metal.text)
      l.tex.needsUpdate = true
      l.strip.emissive.set(t.color)
      l.strip.emissiveIntensity = t.state === 'active' ? 3.6 : t.state === 'blocked' || t.state === 'off' ? 0.25 : 1.35
      l.glow.color.set(t.color)
      l.glow.opacity = t.state === 'active' ? 0.75 : t.state === 'blocked' || t.state === 'off' ? 0.06 : 0.22
    })
    const active = st.teams.findIndex((t) => t.state === 'active')
    if (active >= 0 && this.lecterns[active]) {
      const p = this.lecterns[active].group.position
      this.accentLight.target.position.set(p.x, p.y + 0.6, p.z)
    }
  }

  private buildLecterns(n: number) {
    this.lecternLayout = `${n}`
    for (const l of this.lecterns) {
      l.tex.dispose()
      l.strip.dispose()
      l.glow.dispose()
    }
    for (const c of [...this.lecternGroup.children]) this.lecternGroup.remove(c)
    for (const g of this.lecternGeo) g.dispose()
    this.lecternGeo = []
    this.lecterns = []
    if (!n) return
    const two = n > 6
    const perRow = two ? Math.ceil(n / 2) : n
    const rowWidth = two ? 16.4 : 17.4
    const gap = two ? 0.55 : n <= 3 ? 1.7 : n <= 4 ? 1.25 : 0.85
    const w = Math.min(3.3, (rowWidth - gap * (perRow - 1)) / perRow)
    const h = two ? 1.3 : 1.85
    const L = lecternGeometry(w, h)
    this.lecternGeo.push(L.geo)
    const lacquer = this.mats.lacquer
    const sideMat = this.mat('lecternSide', () => new THREE.MeshPhysicalMaterial({ color: '#16161A', metalness: 0.2, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.6 }))
    const polished = this.mats.polished
    const satin = this.mats.satin
    const glass = this.mat('screenGlass', () => new THREE.MeshPhysicalMaterial({ color: '#020203', metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 }))
    const shadowMat = this.mat('contactShadow', () => new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, color: '#000' }))

    // Écran : épouse la partie plane et inclinée de la façade, avec une marge de verre noir.
    const sw = w * 0.88
    const sh = L.screen.len * 0.9
    const screenGeo = roundedPlane(sw, sh, Math.min(sw, sh) * 0.08)
    const glassGeo = roundedPlane(sw + 0.1, sh + 0.1, Math.min(sw, sh) * 0.1)
    const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, w - 0.16, 16)
    rodGeo.rotateZ(Math.PI / 2)
    const stripGeo = new THREE.BoxGeometry(w * 0.74, 0.022, 0.022)
    const footGeo = new RoundedBoxGeometry(w - 0.6, 0.12, 0.5, 3, 0.03)
    const shadowGeo = new THREE.PlaneGeometry(w + 0.9, 1.7)
    shadowGeo.rotateX(-Math.PI / 2)
    this.lecternGeo.push(screenGeo, glassGeo, rodGeo, stripGeo, footGeo, shadowGeo)

    for (let i = 0; i < n; i++) {
      const back = two && i < perRow
      const idx = back ? i : two ? i - perRow : i
      const count = two ? (back ? perRow : n - perRow) : n
      const rowW = count * w + (count - 1) * gap
      const g = new THREE.Group()
      const x = -rowW / 2 + w / 2 + idx * (w + gap)
      const z = two ? (back ? 4.3 : 7.3) : 6.0
      const rise = two && back ? 0.45 : 0
      g.position.set(x, FLOOR_Y + rise, z)
      if (two && back) {
        const riser = new THREE.Mesh(new RoundedBoxGeometry(w + gap, 0.45, 1.7, 3, 0.05), lacquer)
        this.lecternGeo.push(riser.geometry)
        riser.position.set(0, -0.225, -0.05)
        riser.receiveShadow = true
        g.add(riser)
        const rlip = new THREE.Mesh(rodGeo, satin)
        rlip.scale.x = (w + gap - 0.1) / (w - 0.16)
        rlip.position.set(0, -0.03, 0.8)
        g.add(rlip)
      }
      const shadow = new THREE.Mesh(shadowGeo, shadowMat)
      shadow.position.set(0, 0.006, 0.05)
      g.add(shadow)
      // pied intégré, en retrait : le corps semble posé avec légèreté
      const foot = new THREE.Mesh(footGeo, sideMat)
      foot.position.set(0, 0.06, -0.12)
      foot.castShadow = true
      g.add(foot)
      const body = new THREE.Mesh(L.geo, [sideMat, lacquer])
      body.castShadow = true
      body.receiveShadow = true
      g.add(body)
      // écran de score encastré dans la façade inclinée
      const c = document.createElement('canvas')
      c.width = 1024
      c.height = Math.round(1024 * (sh / sw))
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const panel = new THREE.Group()
      panel.position.set(0, L.screen.y, L.screen.z)
      panel.rotation.x = -L.screen.tilt
      const glassMesh = new THREE.Mesh(glassGeo, glass)
      panel.add(glassMesh)
      const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
      screen.position.z = 0.004
      panel.add(screen)
      g.add(panel)
      // joncs champagne : arête haute (poli) et nervure entre écran et jupe (poli)
      const rodTop = new THREE.Mesh(rodGeo, polished)
      rodTop.position.set(0, L.rod.y, L.rod.z)
      g.add(rodTop)
      const rib = new THREE.Mesh(rodGeo, polished)
      rib.position.set(0, L.rib.y, L.rib.z)
      g.add(rib)
      // ligne lumineuse à la couleur de l'équipe au pied de la jupe, et lueur portée au sol
      const strip = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveIntensity: 1.35 })
      const sm = new THREE.Mesh(stripGeo, strip)
      sm.position.set(0, L.strip.y, L.strip.z)
      g.add(sm)
      const glow = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), color: '#fff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
      const gm = new THREE.Mesh(shadowGeo, glow)
      gm.scale.set(0.95, 1, 0.6)
      gm.position.set(0, 0.009, L.strip.z + 0.25)
      g.add(gm)
      this.lecternGroup.add(g)
      this.lecterns.push({ group: g, canvas: c, tex, strip, glow, key: '' })
    }
  }

  // ---------------------------------------------------------------- effets
  private celebrate() {
    if (this.opts.reducedMotion || this.level === 'low') return
    this.clearBurst()
    const n = 320
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    const a = new THREE.Color(this.theme.metal.polished)
    const b = new THREE.Color(this.accentColor)
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * WALL.w, WALL.cy - WALL.h / 2 - 0.4, 0.9 + Math.random()], i * 3)
      vel.set([(Math.random() - 0.5) * 5, 5 + Math.random() * 7, 0.5 + Math.random() * 2], i * 3)
      const c = Math.random() < 0.7 ? a : b
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = new THREE.PointsMaterial({ map: glowTexture(), size: 0.14, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    const points = new THREE.Points(g, m)
    this.scene.add(points)
    this.burst = { points, vel, start: performance.now() }
  }

  private clearBurst() {
    if (!this.burst) return
    this.scene.remove(this.burst.points)
    this.burst.points.geometry.dispose()
    ;(this.burst.points.material as THREE.Material).dispose()
    this.burst = null
  }

  // ---------------------------------------------------------------- cadrage
  resize() {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.aspect = aspect
    // Distance choisie pour que la scène tienne en largeur (et en hauteur sur écran très large).
    const t = Math.tan(THREE.MathUtils.degToRad(VFOV / 2))
    const needW = aspect < 1.6 ? 26.5 : 27.4
    const dW = needW / 2 / (t * aspect)
    const dH = 6.6 / t
    const d = Math.max(dW, dH)
    this.camera.position.set(0, CAM_Y + 0.8, d)
    this.camera.lookAt(0, CAM_Y - 1.05, 0)
    this.camera.updateProjectionMatrix()
    if (this.reflector) {
      const dpr = this.renderer.getPixelRatio()
      this.reflector.getRenderTarget().setSize(Math.round(w * dpr * 0.5), Math.round(h * dpr * 0.5))
    }
  }

  private applyLevel() {
    const high = this.level === 'high'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1))
    this.renderer.shadowMap.enabled = high
    this.key.castShadow = high
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true))
    })
    if (this.reflector) {
      this.scene.remove(this.reflector)
      this.reflector.dispose()
      this.reflector = null
    }
  }

  get qualityLevel() {
    return this.level
  }

  stats() {
    const mem = this.renderer.info.memory
    return { frames: this.frames, level: this.level, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, textures: mem.textures, geometries: mem.geometries, theme: this.themeId, shown: this.state?.board.cells.filter((c) => c.kind === 'letter' && c.ch !== null).length ?? 0 }
  }

  // ---------------------------------------------------------------- boucle
  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.frameTimes.push(now - this.last)
    this.last = now
    this.frames++
    if (this.frameTimes.length >= 120) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      this.frameTimes = []
      // Bascule en qualité basse seulement après le démarrage (compilation des shaders, envoi des
      // textures) et sur deux fenêtres lentes consécutives : un à-coup isolé ne suffit pas.
      // Mesure (Chrome, Iris Xe) : le coût vient surtout du nombre de pixels, peu des ombres.
      // Étape 1 : densité de pixels ramenée à 1,25 (matières et ombres conservées) ; étape 2 : niveau bas.
      this.slowWindows = avg > 18 && !document.hidden && this.frames > 240 && this.frames > this.qualityHoldUntil ? this.slowWindows + 1 : 0
      if (this.opts.quality === 'auto' && this.level === 'high' && this.slowWindows >= 2) {
        this.slowWindows = 0
        if (this.renderer.getPixelRatio() > 1.25) {
          this.renderer.setPixelRatio(1.25)
          this.resize()
        } else if (avg > 22) {
          this.level = 'low'
          this.applyLevel()
        }
      } else if (this.opts.quality === 'auto' && this.level === 'low' && this.slowWindows >= 3 && avg > 40) {
        // Même en qualité basse, moins de 25 images/s : PC trop lent, plateau sans 3D.
        this.slowWindows = 0
        this.opts.onFallback?.('too_slow')
      }
    }

    for (const t of this.tiles.values()) {
      if (!t.anim || now < t.anim.start) continue
      const p = t.anim.dur <= 0 ? 1 : Math.min(1, (now - t.anim.start) / t.anim.dur)
      const e = t.anim.to === 0 ? easeOutBack(p) : easeInOut(p)
      t.pivot.rotation.x = t.anim.from + (t.anim.to - t.anim.from) * e
      t.pivot.position.z = Math.sin(p * Math.PI) * 0.4
      if (p >= 1) {
        t.pivot.rotation.x = t.anim.to
        t.pivot.position.z = 0
        t.anim = null
      }
    }

    const st = this.state
    // Jauge : calculée localement depuis l'échéance de l'autorité (jamais de tick réseau).
    if (st?.gauge) {
      const left = Math.max(0, st.gauge.endsAt - (Date.now() + st.clockOffsetMs))
      const f = Math.min(1, left / st.gauge.totalMs)
      for (const b of this.gaugeBars) {
        b.visible = f > 0
        b.scale.x = Math.max(0.001, f)
      }
      this.gaugeBars[0].material.emissive.set(st.gauge.color)
      const secs = Math.ceil(left / 1000)
      const key = `${st.gauge.label ?? ''}|${st.gauge.color}|${secs}`
      if (key !== this.timerKey) {
        this.timerKey = key
        drawTimer(this.timerCanvas, st.gauge.label ?? '', st.gauge.color, secs)
        this.timerTex.needsUpdate = true
      }
      this.timerPlate.visible = left > 0
    } else {
      for (const b of this.gaugeBars) b.visible = false
      this.timerPlate.visible = false
      this.timerKey = ''
    }

    const hasAccent = !!st?.teams.some((t) => t.state === 'active')
    this.accentLight.color.copy(this.accentColor)
    this.accentLight.intensity += ((hasAccent ? 120 : 0) - this.accentLight.intensity) * Math.min(1, dt * 10)
    // Victoire : montée de lumière brève puis retour au calme. Aucun mouvement permanent sinon.
    this.boost = Math.max(0, this.boost - dt / 1.1)
    this.key.intensity = 1.9 + this.boost * 1.2
    for (const m of this.ledPanels) m.emissiveIntensity = 0.5 + this.boost * 0.6
    for (const m of this.stepStrips) m.emissiveIntensity = 0.55 + this.boost * 1.2

    if (this.burst) {
      const age = (now - this.burst.start) / 1000
      const attr = this.burst.points.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += this.burst.vel[i] * dt
        arr[i + 1] += this.burst.vel[i + 1] * dt
        arr[i + 2] += this.burst.vel[i + 2] * dt
        this.burst.vel[i + 1] -= 8 * dt
      }
      attr.needsUpdate = true
      ;(this.burst.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - age / 2)
      if (age > 2) this.clearBurst()
    }

    this.renderer.render(this.scene, this.camera)
  }

  private onLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
    this.opts.onFallback?.('context_lost')
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.clearBurst()
    this.reflector?.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose?.()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose?.()
    })
    for (const l of this.lecterns) l.tex.dispose()
    for (const d of this.disposables) d.dispose()
    for (const t of this.ledMaps) t.dispose()
    this.envRT?.dispose()
    disposeTextures()
    this.renderer.dispose()
  }
}

// ================================================================ environnement
/** Studio virtuel pour les reflets : boîte noire, boîtes à lumière blanches et une touche à la teinte du thème. */
function studioEnvironment(accent: string) {
  const scene = new THREE.Scene()
  const room = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: '#070708', side: THREE.BackSide }))
  scene.add(room)
  const box = (w: number, h: number, color: THREE.ColorRepresentation, k: number, pos: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.rotation.set(...rot)
    scene.add(m)
  }
  // grande boîte à lumière frontale haute (reflet doux sur les dessus)
  box(14, 3, '#ffffff', 3.2, [0, 7.5, 8], [-Math.PI / 2.6, 0, 0])
  // bandes verticales latérales (reflets de contour fins sur les profils)
  box(0.8, 10, '#fff3dc', 5, [-13, 2, 2], [0, Math.PI / 2, 0])
  box(0.8, 10, '#fff3dc', 5, [13, 2, 2], [0, -Math.PI / 2, 0])
  // contre-jours
  box(6, 1.2, '#ffffff', 2.2, [-7, 5, -13], [0, 0, 0])
  box(6, 1.2, '#ffffff', 2.2, [7, 5, -13], [0, 0, 0])
  // sol très atténué à la teinte du thème (ambiance)
  box(24, 10, accent, 0.22, [0, -7.5, 4], [-Math.PI / 2, 0, 0])
  return scene
}

// ================================================================ géométries
/** Normales lissées sur les arrondis et biseaux, arêtes franches conservées au-delà de ~34°. */
function soft(g: THREE.BufferGeometry) {
  const r = toCreasedNormals(g, 0.6)
  if (r !== g) g.dispose()
  return r
}

/** Rectangle à coins arrondis, centré. */
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = w / 2
  const y = h / 2
  const rr = Math.min(r, x, y)
  s.moveTo(-x + rr, -y)
  s.lineTo(x - rr, -y)
  s.quadraticCurveTo(x, -y, x, -y + rr)
  s.lineTo(x, y - rr)
  s.quadraticCurveTo(x, y, x - rr, y)
  s.lineTo(-x + rr, y)
  s.quadraticCurveTo(-x, y, -x, y - rr)
  s.lineTo(-x, -y + rr)
  s.quadraticCurveTo(-x, -y, -x + rr, -y)
  return s
}

/** Plan à coins arrondis avec UV normalisées (écrans, diffuseurs). */
function roundedPlane(w: number, h: number, r: number) {
  const geo = new THREE.ShapeGeometry(roundedRect(w, h, r), 12)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
  uv.needsUpdate = true
  return geo
}

/** Profil métallique fermé (tube à section ronde, normales lisses) suivant un contour. */
function tubeLoop(shape: THREE.Shape, radius: number, mat: THREE.Material, x: number, y: number, z: number) {
  const pts = shape.getSpacedPoints(160).slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, 0))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 220, radius, 8, true), mat)
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

/** Profil métallique ouvert (portique). */
function tubeOpen(points: THREE.Vector2[], radius: number, mat: THREE.Material, z: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, p.y, 0)), false, 'centripetal')
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, radius, 10, false), mat)
  m.position.z = z
  m.castShadow = true
  return m
}

/** Tracé du portique : montants droits, raccords courbes, traverse haute. */
function archPath(halfW: number, shoulderY: number, topY: number, topHalf: number) {
  const p = new THREE.Path()
  p.moveTo(-halfW, FLOOR_Y)
  p.lineTo(-halfW, shoulderY)
  p.bezierCurveTo(-halfW, topY - 0.25, -halfW + 1.0, topY, -topHalf, topY)
  p.lineTo(topHalf, topY)
  p.bezierCurveTo(halfW - 1.0, topY, halfW, topY - 0.25, halfW, shoulderY)
  p.lineTo(halfW, FLOOR_Y)
  return p
}

/** Jonc horizontal (filets de marche). */
function rod(len: number, radius: number, mat: THREE.Material) {
  const g = new THREE.CylinderGeometry(radius, radius, len, 16)
  g.rotateZ(Math.PI / 2)
  return new THREE.Mesh(g, mat)
}

/**
 * Pupitre élancé : profil (z vers l'avant, y vers le haut) extrudé en largeur, chants arrondis.
 * Façade : panneau plan légèrement incliné (écran) puis jupe courbe qui rentre vers le pied.
 * Groupes : 0 = flancs (satiné discret), 1 = façade, dessus et dos (laque).
 */
function lecternGeometry(w: number, h: number) {
  const y0 = 0.12 // dessus du pied
  const yS = y0 + (h - y0) * 0.33 // nervure : bas de l'écran, haut de la jupe
  const zS = 0.5
  const zTop = 0.42
  const p = new THREE.Shape()
  p.moveTo(-0.4, y0)
  p.lineTo(0.02, y0)
  // jupe : courbe qui s'évase depuis le pied rentré jusqu'à la nervure
  p.bezierCurveTo(0.3, y0, zS + 0.01, yS - (yS - y0) * 0.55, zS, yS)
  p.lineTo(zTop, h - 0.08) // panneau d'écran incliné
  p.quadraticCurveTo(zTop - 0.02, h, zTop - 0.13, h) // arête haute arrondie
  p.lineTo(-0.4, h - 0.1) // dessus légèrement descendant vers l'arrière
  p.lineTo(-0.4, y0)
  const bevel = 0.035
  const geo = soft(new THREE.ExtrudeGeometry(p, { depth: w - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 28 }))
  // x du profil → z (façade vers +z) ; extrusion → x ; centrage
  geo.rotateY(-Math.PI / 2)
  geo.translate((w - bevel * 2) / 2, 0, 0)
  // panneau d'écran : segment (zS, yS) → (zTop, h-0.08), décalé vers l'extérieur du biseau
  const yA = yS + 0.05
  const dz = zTop - zS
  const dy = h - 0.08 - yA
  const len = Math.hypot(dz, dy)
  const nz = dy / len
  const ny = -dz / len
  const off = bevel + 0.012
  const tilt = Math.atan2(-dz, dy)
  return {
    geo,
    screen: { y: (yA + h - 0.08) / 2 + ny * off, z: (zS - dz * 0.03 + zTop) / 2 + nz * off, len, tilt },
    rod: { y: h - 0.012, z: zTop - 0.07 + bevel * 0.5 },
    rib: { y: yS + 0.005, z: zS + bevel + 0.004 },
    strip: { y: y0 + 0.02, z: 0.02 + bevel },
  }
}
