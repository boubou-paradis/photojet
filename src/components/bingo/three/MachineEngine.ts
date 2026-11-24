// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// AnimaBingo — machine de tirage 3D (grand écran uniquement).
// Modèle Blender validé (docs/machine-3d/blender) → public/bingo3d/machine.glb (Draco)
// + machine.json (repères, chemin du conduit, caméra et lumières du studio Blender).
// Réglages calés sur le rendu Cycles validé (docs/machine-3d/glb/comparaison-1.png).
//
// Purement visuel : ce moteur ne décide RIEN. Il montre les boules qu'on lui donne
// et rejoue l'arrivée d'un numéro déjà tiré par le serveur (≤ 2,4 s, jamais bloquant).

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const BASE = '/bingo3d/'
const FAM: [number, number, number][] = [[224, 25, 63], [242, 96, 26], [245, 179, 1], [15, 168, 110], [10, 162, 200], [36, 87, 230], [91, 59, 224], [155, 47, 214], [214, 35, 122]]
const famOf = (n: number) => FAM[n > 90 ? (n * 4) % 9 : Math.min(8, Math.floor((n === 90 ? 89 : n) / 10))]
const UNDERLINED = new Set([6, 9, 16, 19, 61, 66, 68, 86, 89, 91, 98, 99])
const G = 22
/** Ajustements par lumière (Three.js ≠ Cycles), calés sur le rendu validé. */
const LIGHT_MUL: Record<string, number> = { Lum_Contre_violet: 0.07, Lum_Sol_violet: 0.35 }
/** Unités Cycles (W) → Three.js. */
const LIGHT_SCALE = 0.4
/** Cadrage : centre et hauteur de la machine dans l'image 1920×1080 de la caméra Blender. */
const FRAME = { w: 1920, h: 1080, cx: 930, cy: 545, height: 1060 }

type V3 = [number, number, number]
interface Meta {
  R: number; RI: number; BR: number
  reperes: Record<'DRUM_Center' | 'RECEPT_Ball' | 'TUBE_Out' | 'TUBE_In', V3>
  balls_ref: { n: number; position: V3; quaternion_xyzw: [number, number, number, number]; receptacle: boolean }[]
  tube_path: V3[]
  camera: { position: V3; direction: V3; vfov_deg: number }
  lights: { name: string; position: V3; direction: V3; x_axis: V3; y_axis: V3; size: number; size_y: number; power_w: number; color: V3; spread_deg: number }[]
}

interface Ball {
  n: number
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>
  v: THREE.Vector3
  w: THREE.Vector3
  /** Soumise à la physique du tambour. */
  free: boolean
  /** Réservée par l'animation de tirage (jamais retirée par une synchronisation). */
  reserved: boolean
}

interface DrawAnim {
  b: Ball
  t: number
  start: THREE.Vector3 | null
  inside: THREE.Vector3
  pts: THREE.Vector3[]
  lens: number[]
  total: number
  phase: 0 | 1 | 2 | 3
  land: number
  /** Durée jusqu'au réceptacle (s) : la boule s'y pose au moment de l'annonce. */
  T: number
  /** Départ (performance.now) : l'animation suit l'horloge réelle, un à-coup ne la retarde pas. */
  t0: number
  /** Numéro encore inconnu (suspense de la tombola) : la boule attend en bout de conduit. */
  hold: boolean
  /** Progression dans le conduit (0 → 1) à l'image précédente. */
  u: number
  /** Numéro arrivé pendant l'attente : la boule finit sa course à partir de cet instant. */
  release: { at: number; u: number } | null
}

/** Texture équirectangulaire d'une boule : même dessin que les textures Blender (deux pastilles numérotées). */
function ballTexture(n: number): THREE.CanvasTexture {
  const W = 256, H = 128, K = W / 1024 // une boule fait ~45 px à l'écran
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H), d = img.data
  // n = 0 : boule encore anonyme (suspense de la tombola), pastilles blanches sans numéro
  const col = n > 0 ? famOf(n) : [236, 232, 242], R = 0.72
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI, cl = Math.cos(lat)
    const shade = 0.82 + 0.18 * Math.min(1, Math.max(0, (lat + 1.2) / 2.4))
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI
      const py = cl * Math.sin(lon)
      let r = col[0] * shade, gg = col[1] * shade, b = col[2] * shade
      for (const sgn of [-1, 1]) {
        const ang = Math.acos(Math.max(-1, Math.min(1, py * sgn)))
        const m = Math.max(0, Math.min(1, (R - ang) / 0.02))
        r = r * (1 - m) + 250 * m; gg = gg * (1 - m) + 250 * m; b = b * (1 - m) + 250 * m
        const ring = Math.max(0, 1 - Math.abs(ang - R - 0.012) / 0.007) * 0.35
        r *= 1 - ring; gg *= 1 - ring; b *= 1 - ring
      }
      const i = (y * W + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const s = n > 0 ? String(n) : '', fs = (({ 1: 200, 2: 180, 3: 130, 4: 100 } as Record<number, number>)[s.length] ?? 90) * K
  g.fillStyle = '#0e0c14'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `900 ${fs}px "Arial Black", Arial, sans-serif`
  for (const cx of [W / 4, (3 * W) / 4]) {
    g.save(); g.translate(cx, H / 2 + 3 * K); g.scale(0.62, 0.62); g.fillText(s, 0, 0)
    if (UNDERLINED.has(n)) g.fillRect(-35 * K, fs * 0.42, 70 * K, 9 * K)
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8
  return t
}

/** Microrayures d'usinage (rugosité + relief), comme le bruit étiré du rendu Cycles. */
function brushedTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 8; c.height = 1024
  const g = c.getContext('2d')!; const img = g.createImageData(8, 1024)
  let v = 0.5
  for (let y = 0; y < 1024; y++) {
    v = v * 0.55 + Math.random() * 0.45
    const k = Math.round(150 + v * 105)
    for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; img.data[i] = k; img.data[i + 1] = k; img.data[i + 2] = k; img.data[i + 3] = 255 }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); t.colorSpace = THREE.NoColorSpace
  return t
}

/** Sol + cyclo du studio (le dégradé du rendu Blender). */
function studioGeometry(): THREE.BufferGeometry {
  const pts: [number, number][] = [[-25, 0], [5, 0]]
  for (let k = 1; k <= 16; k++) { const a = (Math.PI / 2) * k / 16; pts.push([5 + 3 * Math.sin(a), 3 - 3 * Math.cos(a)]) }
  pts.push([8, 14])
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const ramp = (z: number) => {
    const c0 = [0.008, 0.005, 0.014], c1 = [0.013, 0.006, 0.03], c2 = [0.016, 0.007, 0.036]
    const f = Math.min(1, Math.max(0, z))
    return f < 0.45 ? c0.map((v, i) => v + (c1[i] - v) * (f / 0.45)) : c1.map((v, i) => v + (c2[i] - v) * ((f - 0.45) / 0.55))
  }
  pts.forEach(([yb, zb], i) => {
    for (const x of [-25, 25]) { pos.push(x, zb, -yb); col.push(...ramp(zb)) }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2) }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx); g.computeVertexNormals()
  return g
}

/** Boule anonyme : elle attend à 85 % du conduit que le numéro arrive, puis se pose en 0,25 s. */
const HOLD_U = 0.85
const RELEASE_MS = 250

export interface MachineView {
  /**
   * Numéros encore dans la sphère. La sphère n'est remplie qu'à l'ouverture de l'écran ou au début
   * d'une partie (count = 0) : pendant la partie elle ne fait que PERDRE des boules (jamais de boule ajoutée).
   */
  inside: readonly number[]
  /** Numéro de la boule tirée (réceptacle) ; null si aucune ou pas encore révélé (suspense de la tombola). */
  out: number | null
  /** Identifiant du tirage en cours : le même avant et après la révélation. */
  drawKey: string | null
  /** Boules déjà sorties (0 = sphère pleine). */
  count: number
  /** Heure locale (Date.now) où la boule touche le réceptacle = annonce du numéro. */
  landAt: number | null
  /** Brassage soutenu (suspense de la tombola). */
  spin: boolean
}

export class MachineEngine {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera!: THREE.PerspectiveCamera
  private composer: EffectComposer | null = null
  private root!: THREE.Object3D
  private drum: THREE.Object3D | null = null
  private ballGeo!: THREE.BufferGeometry
  private balls: Ball[] = []
  private inRecept: Ball | null = null
  private drawAnim: DrawAnim | null = null
  private omega = 0.45
  private intensity = 0
  private spinBase = 0
  private C = new THREE.Vector3()
  private RI = 0.97
  private BR = 0.115
  private path: THREE.Vector3[] = []
  private recept = new THREE.Vector3()
  private flDir = new THREE.Vector3()
  private showQuat = new THREE.Quaternion()
  private key: string | null = null
  private disposables: { dispose(): void }[] = []
  private size = { w: 0, h: 0 }

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer = r
    r.setPixelRatio(1)
    r.toneMapping = THREE.NeutralToneMapping // = « Khronos PBR Neutral » du rendu Blender
    r.outputColorSpace = THREE.SRGBColorSpace
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFShadowMap
  }

  /** Crée et charge le moteur (lève une erreur si WebGL ou le modèle manquent). */
  static async create(canvas: HTMLCanvasElement): Promise<MachineEngine> {
    const e = new MachineEngine(canvas)
    try {
      await e.load()
      return e
    } catch (err) {
      e.dispose()
      throw err
    }
  }

  private async load() {
    const meta = (await (await fetch(BASE + 'machine.json')).json()) as Meta
    const draco = new DRACOLoader().setDecoderPath(BASE + 'draco/')
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(BASE + 'machine.glb')
    draco.dispose()
    this.root = gltf.scene
    this.scene.add(this.root)
    const ref = meta.balls_ref.find((r) => r.receptacle)
    if (ref) this.showQuat.set(...ref.quaternion_xyzw)
    this.C.set(...meta.reperes.DRUM_Center)
    this.RI = meta.RI; this.BR = meta.BR
    this.path = meta.tube_path.map((p) => new THREE.Vector3(...p))
    this.recept.set(...meta.reperes.RECEPT_Ball)
    this.flDir.copy(this.path[0]).sub(this.C).normalize()

    const cam = meta.camera
    this.camera = new THREE.PerspectiveCamera(cam.vfov_deg, 16 / 9, 0.1, 80)
    this.camera.position.set(...cam.position)
    this.camera.lookAt(new THREE.Vector3(...cam.position).add(new THREE.Vector3(...cam.direction).multiplyScalar(10)))

    this.applyMaterials()
    // le verre reste fixe (son ouverture reste sous la bride) ; seuls l'anneau et les perles tournent
    this.drum = this.root.getObjectByName('DRUM') ?? null
    const glass = this.root.getObjectByName('DRUM_Verre')
    if (glass && this.drum) this.scene.attach(glass)
    const tpl = this.root.getObjectByName('BALL_Template') as THREE.Mesh | undefined
    if (!tpl) throw new Error('modèle incomplet')
    this.ballGeo = tpl.geometry
    tpl.visible = false

    const studio = new THREE.Mesh(studioGeometry(), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, specularIntensity: 0.7, side: THREE.DoubleSide, envMapIntensity: 0.6 }))
    studio.receiveShadow = true
    this.scene.add(studio)
    this.track(studio.geometry, studio.material)

    await this.buildLighting(meta)

    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.12, 0.3, 9.0))
    this.composer.addPass(new OutputPass())
    // compile les shaders et prépare les ombres maintenant, boules comprises (pas d'à-coup à la première apparition)
    const warm = this.addBall(1, this.C)
    this.renderer.compile(this.scene, this.camera)
    this.renderer.setSize(2, 2, false)
    this.composer.setSize(2, 2)
    this.composer.render()
    this.removeBall(warm)
  }

  private track(...items: ({ dispose(): void } | { dispose(): void }[])[]) {
    for (const it of items) {
      if (Array.isArray(it)) this.disposables.push(...it)
      else this.disposables.push(it)
    }
  }

  private applyMaterials() {
    const brushed = brushedTexture()
    const gold = (rough: number, aniso: number) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.72, 0.3), metalness: 1, roughness: rough, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.25, anisotropy: aniso, anisotropyRotation: 0 })
    const orPoli = gold(0.19, 0); orPoli.envMapIntensity = 1.4
    const orBrosse = gold(0.33, 0.55); orBrosse.color.setRGB(0.95, 0.68, 0.28)
    const mats: Record<string, THREE.Material> = {
      Or_poli: orPoli,
      Or_brosse: orBrosse,
      Alu_noir_brosse: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.022, 0.02, 0.026), metalness: 0.95, roughness: 0.42, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.4, anisotropy: 0.8, clearcoat: 0.15, clearcoatRoughness: 0.1 }),
      Noir_laque: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.01, 0.009, 0.013), metalness: 0.4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }),
      Noir_gorge: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.006, 0.005, 0.008), metalness: 0.3, roughness: 0.5 }),
      // verre « reflets » : il n'ajoute que ses reflets par-dessus la scène → boules nettes, aucune passe de réfraction
      Verre: new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0, ior: 1.49, specularIntensity: 1.0, envMapIntensity: 1.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, premultipliedAlpha: true }),
      LED_violet: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0.36, 0.06, 1.0), emissiveIntensity: 6 }),
      LED_violet_diffus: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.1, 0.8), emissive: new THREE.Color(0.36, 0.06, 1.0), emissiveIntensity: 2.2, roughness: 0.4 }),
    }
    // liseré de Fresnel discret : le contour du verre reste lisible comme sur le rendu Cycles
    const rimMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xf4efff) }, uStrength: { value: 0.16 }, uPow: { value: 3.2 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uStrength; uniform float uPow; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow); gl_FragColor = vec4(uColor * f * uStrength, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    })
    this.track(brushed, Object.values(mats), rimMat)
    const glass: THREE.Mesh[] = []
    const replaced = new Set<THREE.Material>()
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      this.track(m.geometry)
      const old = m.material as THREE.Material
      const name = old?.name
      if (name && mats[name]) { replaced.add(old); m.material = mats[name] } else if (old) this.track(old)
      const isGlass = name === 'Verre'
      m.castShadow = !isGlass && !name?.startsWith('LED')
      m.receiveShadow = !isGlass
      if (isGlass) glass.push(m)
    })
    for (const m of replaced) m.dispose()
    for (const o of glass) { const rim = new THREE.Mesh(o.geometry, rimMat); rim.renderOrder = 5; o.add(rim) }
  }

  /** Studio Blender reconstruit : panneaux émissifs (radiance = P / (π·A)) + HDRI, préfiltré en PMREM. */
  private async buildLighting(M: Meta) {
    const env = new THREE.Scene()
    const hdr = await new HDRLoader().loadAsync(BASE + 'studio.hdr')
    hdr.mapping = THREE.EquirectangularReflectionMapping
    env.background = hdr
    env.backgroundIntensity = 0.22
    env.backgroundRotation.set(0, THREE.MathUtils.degToRad(200), 0)
    const envGeo: { dispose(): void }[] = [hdr]
    // sol et fond du studio : ils masquent l'HDRI comme dans Blender
    const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.004, 0.0025, 0.008), side: THREE.DoubleSide })
    const floor = new THREE.Mesh(studioGeometry(), floorMat)
    env.add(floor); envGeo.push(floor.geometry, floorMat)
    const KEY_SPLIT = 0.5 // la moitié de la lumière principale passe par la lumière directionnelle (ombres)
    for (const L0 of M.lights) {
      const L = { ...L0, power_w: L0.power_w * (LIGHT_MUL[L0.name] ?? 1) }
      const w = L.size, h = L.size_y
      if (L.name === 'Lum_Rasant_violet' || L.name === 'Lum_Sol_violet') {
        // faisceau serré (rasant, halo au sol) : projecteur direct
        const spot = new THREE.SpotLight(new THREE.Color(...L.color), LIGHT_SCALE * L.power_w / Math.PI, 0, THREE.MathUtils.degToRad(L.spread_deg), 0.6, 2)
        spot.position.set(...L.position); spot.target.position.set(...L.position).add(new THREE.Vector3(...L.direction))
        this.scene.add(spot, spot.target)
        continue
      }
      let radiance = LIGHT_SCALE * L.power_w / (Math.PI * w * h)
      if (L.name === 'Lum_Cle') radiance *= 1 - KEY_SPLIT
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...L.color).multiplyScalar(radiance), side: THREE.FrontSide, toneMapped: false })
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      const x = new THREE.Vector3(...L.x_axis).negate(), y = new THREE.Vector3(...L.y_axis), z = new THREE.Vector3(...L.direction)
      panel.matrix.makeBasis(x, y, z).setPosition(...L.position)
      panel.matrixAutoUpdate = false
      env.add(panel); envGeo.push(panel.geometry, mat)
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const envRT = pmrem.fromScene(env, 0.0, 0.1, 100, { size: 512, position: this.C.clone().setY(1.6) })
    pmrem.dispose()
    for (const d of envGeo) d.dispose()
    this.scene.environment = envRT.texture
    this.track(envRT)

    // ombres de contact : lumière directionnelle placée comme la lumière principale Blender
    const key = M.lights.find((l) => l.name === 'Lum_Cle')
    if (key) {
      const kp = new THREE.Vector3(...key.position)
      const target = new THREE.Vector3(0, 1.8, 0)
      const sun = new THREE.DirectionalLight(new THREE.Color(...key.color), LIGHT_SCALE * (KEY_SPLIT * key.power_w) / (Math.PI * kp.distanceToSquared(target)))
      sun.position.copy(kp); sun.target.position.copy(target)
      sun.castShadow = true
      sun.shadow.mapSize.set(1024, 1024)
      Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 2, far: 14 })
      sun.shadow.radius = 4
      sun.shadow.bias = -0.0004
      sun.shadow.normalBias = 0.015
      this.scene.add(sun, sun.target)
      this.track({ dispose: () => sun.dispose() })
    }
    // rebond local : le verre et les boules éclairent le col doré
    const bounce = new THREE.PointLight(0xffe2b8, 1.6, 1.1, 2)
    bounce.position.copy(this.C).add(new THREE.Vector3(0, -0.78, 0.15))
    this.scene.add(bounce)
  }

  // ---------------------------------------------------------------- boules

  private addBall(n: number, position: THREE.Vector3, quaternion?: THREE.Quaternion): Ball {
    const mat = new THREE.MeshPhysicalMaterial({ map: ballTexture(n), roughness: 0.45, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.04, specularIntensity: 0.4, envMapIntensity: 0.75 })
    const mesh = new THREE.Mesh(this.ballGeo, mat)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.position.copy(position)
    if (quaternion) mesh.quaternion.copy(quaternion)
    this.scene.add(mesh)
    const b: Ball = { n, mesh, v: new THREE.Vector3(), w: new THREE.Vector3(), free: true, reserved: false }
    this.balls.push(b)
    return b
  }

  private removeBall(b: Ball) {
    this.scene.remove(b.mesh); b.mesh.material.map?.dispose(); b.mesh.material.dispose()
    this.balls = this.balls.filter((x) => x !== b)
    if (this.inRecept === b) this.inRecept = null
  }

  private relabel(b: Ball, n: number) {
    b.mesh.material.map?.dispose(); b.mesh.material.map = ballTexture(n); b.mesh.material.needsUpdate = true; b.n = n
  }

  /**
   * Boules de la sphère : celles qui ne sont plus dans `inside` sortent (sans bruit).
   * `refill` (ouverture de l'écran, début de partie) : les manquantes sont ajoutées, sinon JAMAIS.
   */
  private syncInside(inside: readonly number[], refill: boolean) {
    const want = new Set(inside)
    for (const b of this.balls.filter((x) => x.free && !x.reserved)) if (!want.has(b.n)) this.removeBall(b)
    if (!refill) return
    const have = new Set(this.balls.filter((b) => b.free || b.reserved).map((b) => b.n))
    for (const n of inside) {
      if (have.has(n)) continue
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 0.6
      this.addBall(n, this.C.clone().add(new THREE.Vector3(Math.cos(a) * rr, -0.2 + Math.random() * 0.5, Math.sin(a) * rr)), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)))
    }
  }

  /** Retire de la sphère toute autre boule portant ce numéro (une boule tirée n'y est jamais deux fois). */
  private dropDuplicates(n: number, keep: Ball | null) {
    for (const b of this.balls.filter((x) => x !== keep && x.n === n && x.free && !x.reserved)) this.removeBall(b)
  }

  private placeOut(n: number | null) {
    if (this.drawAnim) this.finishDraw()
    if (n === null) { if (this.inRecept) this.removeBall(this.inRecept); return }
    if (this.inRecept?.n !== n) {
      if (this.inRecept) this.removeBall(this.inRecept)
      const b = this.addBall(n, this.recept, this.showQuat)
      b.free = false
      this.inRecept = b
    }
    this.dropDuplicates(n, this.inRecept)
  }

  /** Numéro révélé après coup (tombola) : la boule en route ou déjà posée prend son numéro. */
  private label(n: number) {
    const b = this.drawAnim?.b ?? this.inRecept
    if (!b) { this.placeOut(n); return }
    if (b.n !== n) this.relabel(b, n)
    this.dropDuplicates(n, b)
    const A = this.drawAnim
    if (A?.hold) {
      A.hold = false
      // la boule attendait au bout du conduit : elle se pose maintenant, en même temps que le numéro à l'écran
      if (A.u >= HOLD_U - 1e-3) A.release = { at: performance.now(), u: A.u }
    }
  }

  /** Applique l'état à montrer. Premier appel : tout est posé, physique pré-calculée (rien ne « tombe » à l'ouverture). */
  show(v: MachineView) {
    const first = this.key === null && this.balls.length === 0
    this.spinBase = v.spin ? 0.65 : 0
    // première apparition : sphère remplie et boules déjà posées (rien ne « tombe »), puis le tirage en cours s'il y en a un
    if (first) { this.syncInside(v.inside, true); this.simulate(2) }
    if (v.drawKey !== this.key) {
      this.key = v.drawKey
      const landIn = v.landAt === null ? -1 : (v.landAt - Date.now()) / 1000
      // vu en direct : la boule est aspirée et se pose au moment de l'annonce ; sinon (rechargement, retard) posée directement
      if (v.drawKey !== null && v.count > 0 && landIn > -0.3) this.draw(v.out, Math.min(1.2, Math.max(0.45, landIn)))
      else this.placeOut(v.out)
    } else if (v.out !== null) this.label(v.out)
    else if (v.count === 0 && !this.drawAnim) this.placeOut(null)
    this.syncInside(v.inside, v.count === 0)
  }

  // ---------------------------------------------------------------- physique

  private step(dt: number) {
    const C = this.C, BR = this.BR, RI = this.RI
    const om = new THREE.Vector3(this.omega, 0, 0)
    const rel = new THREE.Vector3(), n = new THREE.Vector3(), wallV = new THREE.Vector3(), tmp = new THREE.Vector3()
    const I = this.intensity
    const free = this.balls.filter((b) => b.free)
    for (const b of free) {
      b.v.y -= G * dt
      if (I > 0) {
        rel.copy(b.mesh.position).sub(C)
        if (rel.y < -0.25) b.v.y += (26 + Math.random() * 30) * I * dt
        b.v.x += (Math.random() - 0.5) * 60 * I * dt
        b.v.z += (Math.random() - 0.5) * 60 * I * dt
        b.v.add(tmp.set(0, -rel.z, rel.y).multiplyScalar(8 * I * dt))
      }
      b.v.multiplyScalar(1 - 0.15 * dt)
      b.mesh.position.addScaledVector(b.v, dt)
      rel.copy(b.mesh.position).sub(C)
      const d = rel.length(), lim = RI - BR - 0.002
      if (d > lim) {
        n.copy(rel).divideScalar(d)
        b.mesh.position.copy(C).addScaledVector(n, lim)
        const vn = b.v.dot(n)
        if (vn > 0) b.v.addScaledVector(n, -1.5 * vn)
        wallV.copy(om).cross(tmp.copy(n).multiplyScalar(RI))
        tmp.copy(b.v).sub(wallV); tmp.addScaledVector(n, -tmp.dot(n))
        b.v.addScaledVector(tmp, -Math.min(1, 5 * dt))
        b.w.copy(n).cross(tmp).multiplyScalar(-1 / BR)
      } else b.w.multiplyScalar(1 - 0.4 * dt)
    }
    const min = BR * 2
    for (let i = 0; i < free.length; i++) {
      const a = free[i]
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j]
        rel.copy(b.mesh.position).sub(a.mesh.position)
        const d2 = rel.lengthSq()
        if (d2 >= min * min || d2 === 0) continue
        const d = Math.sqrt(d2); n.copy(rel).divideScalar(d)
        const push = (min - d) / 2
        a.mesh.position.addScaledVector(n, -push); b.mesh.position.addScaledVector(n, push)
        const vrel = tmp.copy(b.v).sub(a.v).dot(n)
        if (vrel < 0) { const jimp = (-1.8 * vrel) / 2; a.v.addScaledVector(n, -jimp); b.v.addScaledVector(n, jimp) }
      }
    }
    // la boule tirée écarte les autres pendant sa montée (aucune interpénétration)
    const P = this.drawAnim && !this.drawAnim.b.free ? this.drawAnim.b : null
    if (P) {
      for (const b of free) {
        rel.copy(b.mesh.position).sub(P.mesh.position)
        const d2 = rel.lengthSq()
        if (d2 >= min * min || d2 === 0) continue
        const d = Math.sqrt(d2); n.copy(rel).divideScalar(d)
        b.mesh.position.addScaledVector(n, min - d)
        const vn = b.v.dot(n); if (vn < 0) b.v.addScaledVector(n, -1.6 * vn)
      }
    }
    const q = new THREE.Quaternion()
    for (const b of free) {
      const wl = b.w.length()
      if (wl > 1e-4) b.mesh.quaternion.premultiply(q.setFromAxisAngle(tmp.copy(b.w).divideScalar(wl), wl * dt))
    }
  }

  private simulate(seconds: number) { for (let i = 0; i < seconds * 240; i++) this.step(1 / 240) }

  // ---------------------------------------------------------------- tirage

  /**
   * Sortie visuelle d'une boule (numéro déjà tiré par le serveur, ou inconnu pendant le suspense de la tombola).
   * La boule est aspirée vers l'ouverture, remonte le conduit poussée par l'air et touche le réceptacle
   * exactement à T secondes (annonce du numéro). Le brassage continue derrière ; calme avant 2,4 s.
   */
  private draw(n: number | null, T: number) {
    if (this.drawAnim) this.finishDraw() // un nouveau tirage interrompt proprement le précédent
    const inside = this.C.clone().addScaledVector(this.flDir, this.RI - this.BR - 0.02)
    const free = this.balls.filter((b) => b.free && !b.reserved)
    let b = n !== null ? free.find((x) => x.n === n) : undefined
    if (!b) {
      // numéro absent de la sphère ou encore inconnu : la boule la plus proche de l'ouverture est aspirée
      b = free.sort((p, q) => p.mesh.position.distanceToSquared(inside) - q.mesh.position.distanceToSquared(inside))[0]
      if (b && n !== null) { this.relabel(b, n); this.dropDuplicates(n, b) }
    }
    if (b && n === null) this.relabel(b, 0)
    if (!b) { if (n !== null) this.placeOut(n); return }
    b.reserved = true
    const pts = [inside, ...this.path, this.recept.clone()]
    const lens = [0]
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]))
    this.drawAnim = { b, t: 0, start: null, inside, pts, lens, total: lens[lens.length - 1], phase: 0, land: 0, T, t0: performance.now(), hold: n === null, u: 0, release: null }
  }

  private finishDraw() {
    const A = this.drawAnim
    if (!A) return
    if (this.inRecept && this.inRecept !== A.b) this.removeBall(this.inRecept)
    A.b.free = false; A.b.reserved = false
    A.b.mesh.position.copy(this.recept)
    A.b.mesh.quaternion.copy(this.showQuat)
    A.b.mesh.material.emissive.set(0x000000)
    this.inRecept = A.b
    this.drawAnim = null
  }

  private pointAt(A: DrawAnim, s: number) {
    let i = 1
    while (i < A.lens.length - 1 && A.lens[i] < s) i++
    const t = (s - A.lens[i - 1]) / Math.max(1e-6, A.lens[i] - A.lens[i - 1])
    return A.pts[i - 1].clone().lerp(A.pts[i], Math.min(1, Math.max(0, t)))
  }

  tick(dt: number) {
    const A = this.drawAnim
    let animI = 0
    if (A) {
      A.t = (performance.now() - A.t0) / 1000
      const t = A.t, T = A.T
      const t1 = 0.08 * T, t2 = 0.38 * T // aspiration de t1 à t2, conduit de t2 à T
      animI = A.phase === 3 ? 0 : 1 // le brassage retombe dès que la boule est posée
      if (t >= t1 && A.phase === 0) { A.phase = 1; A.b.free = false; A.start = A.b.mesh.position.clone() }
      const m = A.b.mesh
      const prev = m.position.clone()
      if (A.phase === 1 && A.start) {
        // aspirée : part doucement puis accélère vers l'ouverture
        const u = Math.min(1, (t - t1) / (t2 - t1)), e = u * u
        const mid = A.start.clone().lerp(A.inside, 0.6).addScaledVector(this.flDir, 0.08)
        m.position.copy(A.start).lerp(mid, e).lerp(mid.clone().lerp(A.inside, e), e)
        m.material.emissive.setRGB(0.1, 0.08, 0.14).multiplyScalar(e)
        if (u >= 1) A.phase = 2
      } else if (A.phase === 2) {
        // poussée par l'air : entre vite dans le conduit, ralentit en arrivant au réceptacle
        let u = Math.min(1, (t - t2) / (T - t2))
        if (A.hold) u = Math.min(u, HOLD_U)
        else if (A.release) u = Math.min(1, A.release.u + ((performance.now() - A.release.at) / RELEASE_MS) * (1 - A.release.u))
        A.u = u
        m.position.copy(this.pointAt(A, A.total * (1 - Math.pow(1 - u, 1.6))))
        if (u >= 1) { A.phase = 3; A.land = t }
      } else if (A.phase === 3) {
        const u = t - A.land
        const h = Math.abs(Math.sin(u * 14)) * 0.05 * Math.exp(-u * 7)
        m.position.copy(this.recept).add(new THREE.Vector3(0, h, 0))
        m.material.emissive.multiplyScalar(0.92)
        if (this.inRecept && this.inRecept !== A.b) this.removeBall(this.inRecept)
        if (u > 0.5) this.finishDraw()
      }
      // roulement cohérent avec le déplacement
      const mv = A.phase === 3 ? new THREE.Vector3() : m.position.clone().sub(prev)
      const dl = mv.length()
      if (dl > 1e-5) {
        const axis = new THREE.Vector3(0, 1, 0).cross(mv).normalize()
        if (axis.lengthSq() > 0.5) m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, dl / this.BR))
      }
      // fin du conduit puis réceptacle : le numéro se tourne vers le public
      if (A.phase >= 2) {
        const u = A.phase === 2 ? Math.max(0, ((t - t2) / (T - t2) - 0.55) / 0.45) : 1
        if (u > 0) m.quaternion.slerp(this.showQuat, Math.min(1, u * u * 0.4 + (A.phase === 3 ? 0.3 : 0)))
      }
    }
    // brassage : monte d'un coup au tirage, retombe en douceur (calme avant 2,4 s)
    const target = Math.max(animI, this.spinBase)
    this.intensity += (target - this.intensity) * Math.min(1, dt * (target > this.intensity ? 12 : 3.2))
    if (this.intensity < 0.01 && target === 0) this.intensity = 0
    this.omega = 0.45 + 2.6 * this.intensity
    if (this.drum) this.drum.rotation.x += this.omega * dt
    for (let i = 0; i < 4; i++) this.step(dt / 4)
  }

  // ---------------------------------------------------------------- rendu

  /** Taille du canevas (pixels réels) ; la machine reste cadrée au centre quelle que soit la forme de la zone. */
  resize(w: number, h: number) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h))
    if (w === this.size.w && h === this.size.h) return
    this.size = { w, h }
    this.renderer.setSize(w, h, false)
    const H = FRAME.height, W = H * (w / h)
    this.camera.aspect = FRAME.w / FRAME.h
    this.camera.setViewOffset(FRAME.w, FRAME.h, FRAME.cx - W / 2, FRAME.cy - H / 2, W, H)
    this.camera.updateProjectionMatrix()
    this.composer?.setSize(w, h)
  }

  render() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    for (const b of [...this.balls]) this.removeBall(b)
    for (const d of this.disposables) { try { d.dispose() } catch { /* déjà libéré */ } }
    this.disposables = []
    this.composer?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
