// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

// Roue de la Destinée 2.0 — plateau 3D du grand écran (démo validée le 27/11/2026 : docs/design/roue/demo).
// Méthode hybride : décor Blender précalculé (murs LED éteints) en fond, roue 3D Three.js par-dessus avec la
// MÊME caméra que Blender ; panneaux LED rallumés diode par diode grâce à une passe de données Blender (murs.exr).
//
// Purement visuel : ce moteur ne décide RIEN. WheelGame lui transmet à chaque image l'angle, la vitesse et la
// phase calculés par son propre moteur (src/lib/wheel-physics.ts), puis les événements « clac » et « résultat ».
// Les lumières suivent ces informations ; elles ne pilotent jamais la roue et ne retardent jamais le résultat.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

const BASE = '/roue3d/'
const DRACO = '/bingo3d/draco/'
const TAU = Math.PI * 2
const FREE_SPEED = 450 // °/s, = FREE_SPEED_DEG_S de wheel-physics (sert seulement à doser les lumières)
const SPIN_UP_S = 0.5

export type WheelPhase = 'idle' | 'spinup' | 'free' | 'decel'

interface Meta {
  camera: { position: number[]; direction: number[]; vfov_deg: number }
  pointer_hinge: number[]
  socle_center: number[]
  r_in: number; r_out: number; r_led: number; n_led: number; r_num: number
  rings: number[]
}

const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b)
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const smooth = (x: number) => { const v = clamp(x); return v * v * (3 - 2 * v) }

// Couleurs des cases validées dans la démo (même ordre que GEMS de wheel-theme.ts : rubis, orange, émeraude,
// bleu, indigo, violet), en valeurs linéaires calées sur le rendu Blender.
const SEG_COLORS: [number, number, number][] = [[0.78, 0.04, 0.10], [0.96, 0.40, 0.06], [0.02, 0.55, 0.20], [0.03, 0.42, 0.85], [0.12, 0.16, 0.62], [0.50, 0.08, 0.80]]
const PAL = { or: lin(1, 0.66, 0.24), violet: lin(0.55, 0.18, 1), bleu: lin(0.12, 0.42, 1), magenta: lin(1, 0.12, 0.62), blanc: lin(1, 0.86, 0.66) }
const PAL_LIST = [PAL.or, PAL.violet, PAL.bleu, PAL.magenta, PAL.blanc]

/** Murs LED : bandes latérales de la passe Blender, collées côte à côte dans murs.exr (colonnes d'écran 0-273 et 1647-1919). */
const MURS = { left: 274, right: 1647, width: 547 }
/** Qualité : facteur de résolution (base Full HD), résolution du halo, anticrénelage. */
const LEVELS = [{ pr: 1.0, bloom: 0.5, msaa: 4 }, { pr: 0.85, bloom: 0.5, msaa: 4 }, { pr: 0.75, bloom: 0.4, msaa: 2 }, { pr: 0.62, bloom: 0.3, msaa: 0 }]

const PAL_GLSL = `
  vec3 pal(float x){ x = fract(x) * 5.0; int i = int(floor(x)); float f = smoothstep(0.0, 1.0, fract(x)); vec3 a = uPal[0], b = uPal[1];
    for (int k = 0; k < 5; k++) { if (k == i) { a = uPal[k]; b = uPal[k == 4 ? 0 : k + 1]; } } return mix(a, b, f); }`

type GlowMat = THREE.MeshPhysicalMaterial & { userData: { glow: { value: number }; glowColor: { value: THREE.Color } } }

export class WheelEngine {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private cam!: THREE.PerspectiveCamera
  private composer!: EffectComposer
  private target!: THREE.WebGLRenderTarget
  private bloom!: UnrealBloomPass
  private meta!: Meta
  private disposables: { dispose(): void }[] = []
  private level = 0
  private size = { w: 0, h: 0 }

  // roue
  private pivot!: THREE.Object3D
  private pointer = new THREE.Group()
  private dyn = new THREE.Group()
  private sepGeo!: THREE.BufferGeometry
  private ledGeo!: THREE.BufferGeometry
  private numGeo: THREE.BufferGeometry[] = []
  private rivetGeo = new THREE.SphereGeometry(0.024, 16, 8).scale(1, 1, 0.55)
  private M: Record<string, THREE.MeshPhysicalMaterial> = {}
  private segMats: GlowMat[] = []
  private numbers: THREE.Mesh[] = []
  private segKey = ''
  private N = 1
  private leds!: THREE.InstancedMesh
  private ledAngle = new Float32Array(0)
  private haloGeo = new THREE.BufferGeometry()
  private haloCol = new Float32Array(0)
  private flash = new THREE.PointLight(lin(1, 0.75, 0.4), 0, 0, 1.4)

  // effets
  private ringU!: Record<string, THREE.IUniform>
  private panU!: Record<string, THREE.IUniform>
  private numCanvas = document.createElement('canvas')
  private numTex!: THREE.CanvasTexture
  private beams: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = []
  private orbit = { a: new Float32Array(140), r: new Float32Array(140), s: new Float32Array(140), y: new Float32Array(140), tw: new Float32Array(140) }
  private oGeo = new THREE.BufferGeometry()
  private burst = { p: new Float32Array(420 * 3), v: new Float32Array(420 * 3), life: new Float32Array(420), c: new Float32Array(420 * 3) }
  private bGeo = new THREE.BufferGeometry()
  private conf!: THREE.InstancedMesh
  private cf = { p: new Float32Array(260 * 3), v: new Float32Array(260 * 3), r: new Float32Array(260 * 3), w: new Float32Array(260 * 3), on: false, t: 0 }

  // état reçu du jeu (lecture seule)
  private angle = 0
  private vel = 0
  private phase: WheelPhase = 'idle'
  private phaseAt = 0
  private winner = -1
  private revealAt = 0
  private flapAt = -1
  private flapDur = 120
  private tickPulse = 0
  // direction lumière
  private L = { energy: 0.45, ringSpeed: 0.05, chase: 0.15, colorShift: 0, ringPhase: [0, 0, 0, 0], panChase: 0 }
  private tmpM = new THREE.Matrix4()
  private tmpC = new THREE.Color()
  private ledCol = new THREE.Color()
  private tmpV = new THREE.Vector3()
  private tmpQ = new THREE.Quaternion()
  private tmpE = new THREE.Euler()
  private one = new THREE.Vector3(1, 1, 1)

  private constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.toneMapping = THREE.NeutralToneMapping // = « Khronos PBR Neutral » du rendu Blender
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
  }

  static async create(canvas: HTMLCanvasElement): Promise<WheelEngine> {
    const e = new WheelEngine(canvas)
    try {
      await e.load()
    } catch (err) {
      e.dispose()
      throw err
    }
    return e
  }

  private track<T extends { dispose(): void }>(x: T): T { this.disposables.push(x); return x }

  private async load() {
    const [meta, fond, hdr, murs, gltf] = await Promise.all([
      fetch(BASE + 'roue.json').then((r) => { if (!r.ok) throw new Error('roue.json'); return r.json() as Promise<Meta> }),
      new THREE.TextureLoader().loadAsync(BASE + 'decor.webp'),
      new HDRLoader().loadAsync(BASE + 'plateau.hdr'),
      new EXRLoader().setDataType(THREE.HalfFloatType).loadAsync(BASE + 'murs.exr'),
      (async () => {
        const draco = new DRACOLoader().setDecoderPath(DRACO)
        try { return await new GLTFLoader().setDRACOLoader(draco).loadAsync(BASE + 'roue.glb') } finally { draco.dispose() }
      })(),
    ])
    this.meta = meta
    const scene = this.scene
    fond.colorSpace = THREE.SRGBColorSpace
    scene.background = this.track(fond)
    const cam = (this.cam = new THREE.PerspectiveCamera(meta.camera.vfov_deg, 16 / 9, 0.1, 100))
    cam.position.fromArray(meta.camera.position)
    cam.lookAt(cam.position.clone().add(new THREE.Vector3().fromArray(meta.camera.direction)))

    // reflets des métaux = panorama Blender du vrai plateau
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = pmrem.fromEquirectangular(hdr).texture
    scene.environment = this.track(env)
    scene.environmentIntensity = 1.0
    hdr.dispose(); pmrem.dispose()

    // éclairage calé sur le rendu Cycles
    const key = new THREE.DirectionalLight(lin(1, 0.93, 0.84), 1.7); key.position.set(0.6, 6.0, 6.5); key.target.position.set(0, 2.3, 0)
    const fillL = new THREE.PointLight(lin(0.62, 0.40, 1.0), 3, 0, 1.6); fillL.position.set(-5, 2.5, 3)
    const fillR = new THREE.PointLight(lin(1.0, 0.65, 0.40), 2.5, 0, 1.6); fillR.position.set(5, 2.5, 3)
    const back = new THREE.DirectionalLight(lin(0.65, 0.30, 1.0), 1.2); back.position.set(0, 5.5, -3.5)
    this.flash.position.set(0, 2.3, 2.2)
    scene.add(key, key.target, fillL, fillR, back, this.flash)

    // modèle Blender
    const G = gltf.scene
    const byName = (n: string) => { const o = G.getObjectByName(n); if (!o) throw new Error(`pièce absente : ${n}`); return o }
    const P = (o: THREE.MeshPhysicalMaterialParameters) => this.track(new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o }))
    this.M = {
      Or_poli: P({ color: lin(1, 0.70, 0.29), metalness: 1, roughness: 0.2, envMapIntensity: 0.9 }),
      Or_brosse: P({ color: lin(1, 0.70, 0.29), metalness: 1, roughness: 0.32, envMapIntensity: 0.8 }),
      Or_sombre: P({ color: lin(0.62, 0.38, 0.12), metalness: 1, roughness: 0.34 }),
      Metal_noir: P({ color: lin(0.018, 0.014, 0.022), metalness: 0.9, roughness: 0.24 }),
      Laque_noire: P({ color: lin(0.006, 0.005, 0.01), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }),
      Ivoire: P({ color: lin(1, 0.95, 0.84), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
      Gemme_rubis: P({ color: lin(0.55, 0.02, 0.06), roughness: 0.05, clearcoat: 1, emissive: lin(0.9, 0.05, 0.1), emissiveIntensity: 0.6 }),
    }
    const replaced = new Set<THREE.Material>()
    G.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      this.track(m.geometry)
      const mat = m.material as THREE.Material
      if (this.M[mat.name]) { replaced.add(mat); m.material = this.M[mat.name] }
    })
    for (const m of replaced) m.dispose()
    this.pivot = byName('ROUE_Pivot')
    // socle : occultant invisible (cache les anneaux au sol derrière lui, ne dessine rien)
    const occMat = this.track(new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }))
    byName('SOCLE').traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = occMat; m.renderOrder = -2 } })
    const sep = byName('SEP_Template') as THREE.Mesh, led = byName('LED_Bulb') as THREE.Mesh
    this.sepGeo = sep.geometry; this.ledGeo = led.geometry
    this.numGeo = Array.from({ length: 20 }, (_, k) => (byName(`NUM_${k + 1}`) as THREE.Mesh).geometry)
    for (const n of [sep, led, ...Array.from({ length: 20 }, (_, k) => byName(`NUM_${k + 1}`))]) n.removeFromParent()
    for (const g of this.numGeo) g.computeBoundingBox()
    this.pointer.position.fromArray(meta.pointer_hinge)
    for (const n of ['POINTEUR', 'POINTEUR_Gemme', 'POINTEUR_Bague']) { const o = byName(n); o.removeFromParent(); o.position.set(0, 0, 0); this.pointer.add(o) }
    scene.add(G, this.pointer)
    this.pivot.add(this.dyn)
    this.track(this.rivetGeo)

    this.buildLeds()
    this.buildRings()
    this.buildPanels(murs)
    this.buildBeams()
    this.buildParticles()

    this.target = this.track(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }))
    this.composer = new EffectComposer(this.renderer, this.target)
    this.composer.addPass(new RenderPass(scene, cam))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 540), 0.35, 0.35, 1.6)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    this.setSegments([1, 2, 3, 4, 5, 6])
    // première compilation des shaders tout de suite (évite un à-coup au premier tirage)
    this.renderer.compile(scene, cam)
  }

  // ──────────────────────────────────────────── construction
  private segMaterial(c: [number, number, number]): GlowMat {
    const m = new THREE.MeshPhysicalMaterial({ color: lin(...c), metalness: 0.55, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.08, envMapIntensity: 0.55 }) as GlowMat
    m.userData = { glow: { value: 0 }, glowColor: { value: lin(1, 0.85, 0.5) } }
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uGlow = m.userData.glow; sh.uniforms.uGlowColor = m.userData.glowColor
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = position.xy;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWp; uniform float uGlow; uniform vec3 uGlowColor;')
        // dégradé radial du rendu Blender : sombre près du moyeu, plein au milieu, assombri au bord
        .replace('#include <color_fragment>', `#include <color_fragment>
          float rr = length(vWp) / 1.45;
          float k = rr < 0.30 ? 0.45 : rr < 0.48 ? mix(0.45, 0.95, (rr - 0.30) / 0.18) : rr < 0.72 ? mix(0.95, 1.0, (rr - 0.48) / 0.24) : mix(1.0, 0.72, clamp((rr - 0.72) / 0.18, 0.0, 1.0));
          diffuseColor.rgb *= mix(0.18, 1.0, k);`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * uGlow * (0.55 + 0.45 * smoothstep(0.3, 0.9, length(vWp) / 1.45));')
    }
    return m
  }

  /** Cases affichées, dans l'ordre de la roue : numéro FIXE de chacune (1 à 20). Couleur = position, comme la 2D. */
  setSegments(numbers: number[]) {
    const key = numbers.join(',')
    if (key === this.segKey || numbers.length === 0) return
    this.segKey = key
    const n = numbers.length
    this.N = n
    for (const c of [...this.dyn.children]) {
      c.removeFromParent()
      const m = c as THREE.Mesh
      if (m.geometry && m.geometry !== this.sepGeo && m.geometry !== this.rivetGeo && !this.numGeo.includes(m.geometry)) m.geometry.dispose()
    }
    this.segMats.forEach((m) => m.dispose()); this.segMats = []; this.numbers = []
    const { r_in: rin, r_out: rout, r_num } = this.meta
    for (let i = 0; i < n; i++) {
      const a0 = TAU * i / n, a1 = TAU * (i + 1) / n, sh = new THREE.Shape(), steps = Math.max(12, Math.round(192 / n))
      for (let k = 0; k <= steps; k++) { const a = a0 + (a1 - a0) * k / steps; if (k) sh.lineTo(rout * Math.sin(a), rout * Math.cos(a)); else sh.moveTo(rout * Math.sin(a), rout * Math.cos(a)) }
      for (let k = steps; k >= 0; k--) { const a = a0 + (a1 - a0) * k / steps; sh.lineTo(rin * Math.sin(a), rin * Math.cos(a)) }
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 1 })
      const mat = this.segMaterial(SEG_COLORS[i % SEG_COLORS.length]); this.segMats.push(mat)
      const mesh = new THREE.Mesh(geo, mat); mesh.position.z = 0.032; this.dyn.add(mesh)
      const s = new THREE.Mesh(this.sepGeo, this.M.Or_poli); s.rotation.z = -a0; this.dyn.add(s)
      for (const r of [rout - 0.035, rin + 0.03]) { const rv = new THREE.Mesh(this.rivetGeo, this.M.Or_poli); rv.position.set(r * Math.sin(a0), r * Math.cos(a0), 0.14); this.dyn.add(rv) }
      const g = this.numGeo[clamp(Math.round(numbers[i]), 1, 20) - 1], am = (a0 + a1) / 2
      const sc = n > 6 ? Math.min(1, 2.2 * Math.sin(Math.PI / n) + 0.1) : 1
      const num = new THREE.Mesh(g, this.M.Ivoire); num.scale.setScalar(sc)
      num.position.set(r_num * Math.sin(am), r_num * Math.cos(am), 0.119 - (g.boundingBox?.max.z ?? 0) * sc)
      this.dyn.add(num); this.numbers.push(num)
    }
    // cases redessinées (case gagnante retirée) : l'éclat ne doit pas passer sur une autre case
    this.winner = -1
  }

  private haloTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    const t = this.track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  private halo!: THREE.Texture

  private buildLeds() {
    const { n_led: NL, r_led } = this.meta
    this.halo = this.haloTexture()
    this.leds = new THREE.InstancedMesh(this.ledGeo, this.track(new THREE.MeshBasicMaterial({ color: 0xffffff })), NL)
    this.ledAngle = new Float32Array(NL)
    for (let i = 0; i < NL; i++) {
      const a = TAU * (i + 0.5) / NL; this.ledAngle[i] = a
      this.tmpM.makeTranslation(r_led * Math.sin(a), r_led * Math.cos(a), 0); this.leds.setMatrixAt(i, this.tmpM); this.leds.setColorAt(i, this.tmpC.setRGB(1, 1, 1))
    }
    this.pivot.add(this.leds)
    const pos = new Float32Array(NL * 3); this.haloCol = new Float32Array(NL * 3)
    for (let i = 0; i < NL; i++) { pos[i * 3] = r_led * Math.sin(this.ledAngle[i]); pos[i * 3 + 1] = r_led * Math.cos(this.ledAngle[i]); pos[i * 3 + 2] = 0.18 }
    this.haloGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.haloGeo.setAttribute('color', new THREE.BufferAttribute(this.haloCol, 3))
    this.track(this.haloGeo)
    this.pivot.add(new THREE.Points(this.haloGeo, this.track(new THREE.PointsMaterial({ size: 0.22, map: this.halo, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))))
  }

  private buildRings() {
    const m = this.meta
    this.ringU = {
      uR: { value: m.rings }, uPhase: { value: [0, 0, 0, 0] }, uHue: { value: [0, 0.25, 0.5, 0.75] },
      uInt: { value: [0.6, 0.6, 0.6, 0.6] }, uArcs: { value: [3, 4, 2, 5] }, uLen: { value: [0.34, 0.22, 0.4, 0.18] },
      uBase: { value: 0.18 }, uPulseR: { value: -10 }, uPulseA: { value: 0 }, uGold: { value: 0 }, uPal: { value: PAL_LIST.map((c) => c.clone()) },
    }
    const mat = this.track(new THREE.ShaderMaterial({
      uniforms: this.ringU, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec2 vP; uniform float uR[4]; uniform float uPhase[4]; uniform float uHue[4]; uniform float uInt[4];
        uniform float uArcs[4]; uniform float uLen[4]; uniform float uBase; uniform float uPulseR; uniform float uPulseA; uniform float uGold; uniform vec3 uPal[5];
        ${PAL_GLSL}
        void main(){
          float d = length(vP); float ang = atan(vP.x, -vP.y) / 6.2831853 + 0.5;
          vec3 col = vec3(0.0);
          for (int k = 0; k < 4; k++) {
            float dd = d - uR[k];
            float core = exp(-dd * dd / 0.0011); float glow = exp(-abs(dd) / 0.22) * 0.32 + exp(-abs(dd) / 0.7) * 0.07;
            float a = fract(ang * uArcs[k] + uPhase[k]);
            float arc = smoothstep(0.0, 0.03, a) * (1.0 - smoothstep(uLen[k] - 0.03, uLen[k], a));
            float head = pow(clamp(a / uLen[k], 0.0, 1.0), 2.5);
            float lum = uBase + arc * (0.35 + 1.9 * head);
            vec3 c = mix(pal(ang + uHue[k]), vec3(1.0, 0.72, 0.3), uGold);
            col += c * (core * 2.2 + glow) * lum * uInt[k];
          }
          float pw = d - uPulseR; col += vec3(1.0, 0.78, 0.42) * exp(-pw * pw / 0.05) * uPulseA;
          col *= smoothstep(6.6, 5.4, d) * smoothstep(2.6, 2.9, d);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }))
    const rings = new THREE.Mesh(this.track(new THREE.PlaneGeometry(14, 14)), mat)
    rings.rotation.x = -Math.PI / 2; rings.position.set(m.socle_center[0], 0.006, m.socle_center[2]); rings.renderOrder = 2
    this.scene.add(rings)
  }

  private buildPanels(murs: THREE.DataTexture) {
    murs.minFilter = murs.magFilter = THREE.NearestFilter; murs.generateMipmaps = false
    this.track(murs)
    this.numCanvas.width = 220; this.numCanvas.height = 560
    this.numTex = this.track(new THREE.CanvasTexture(this.numCanvas))
    this.panU = {
      uData: { value: murs }, uNum: { value: this.numTex }, uT: { value: 0 }, uE: { value: 0.45 }, uV: { value: 0 }, uChase: { value: 0 },
      uTick: { value: 0 }, uCel: { value: 99 }, uWinC: { value: PAL.or.clone() }, uHue: { value: 0 }, uPal: { value: PAL_LIST.map((c) => c.clone()) },
      uMurs: { value: new THREE.Vector3(MURS.left, MURS.right, MURS.width) },
    }
    const mat = this.track(new THREE.ShaderMaterial({
      uniforms: this.panU, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.99999, 1.0); }',
      fragmentShader: `
        precision highp float;
        varying vec2 vUv; uniform sampler2D uData; uniform sampler2D uNum; uniform float uT, uE, uV, uChase, uTick, uCel, uHue;
        uniform vec3 uWinC; uniform vec3 uPal[5]; uniform vec3 uMurs;
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        ${PAL_GLSL}
        void main(){
          float sx = vUv.x * 1920.0;
          bool left = sx < uMurs.x;
          if (!left && sx < uMurs.y) discard;
          float tx = left ? sx / uMurs.z : (uMurs.x + sx - uMurs.y) / uMurs.z;
          vec3 d = texture2D(uData, vec2(tx, vUv.y)).rgb; float k = d.b;
          if (k < 0.015) discard;
          vec2 uv = d.rg / k;                          // UV Blender du mur (grille = UV × (22, 56), comme le matériau Blender)
          vec2 G = vec2(22.0, 56.0); vec2 g = uv * G; vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
          float aa = clamp(max(fwidth(g.x), fwidth(g.y)) * 0.6, 0.02, 0.2);
          float led = 1.0 - smoothstep(0.24 - aa, 0.30 + aa, length(f));
          vec2 cu = (cell + 0.5) / G;
          // partie visible de chaque panneau ramenée à 0..1 : x gauche → droite à l'écran, y bas → haut
          vec2 c = vec2(left ? (cu.x - 0.586) / 0.883 : (cu.x + 0.466) / 0.877, (cu.y + 0.028) / 0.878);
          float x = left ? 1.0 - c.x : c.x;           // 0 = bord côté roue
          float t = uT, rnd = h21(cell + (left ? 7.0 : 0.0));
          // attente : vagues lentes qui montent, violet → magenta, crêtes dorées, scintillement discret
          float w = 0.5 + 0.5 * sin(c.y * 7.0 - t * 0.9 + sin(x * 3.0 + t * 0.35) * 1.3);
          vec3 col = mix(uPal[1], uPal[3], smoothstep(0.1, 0.95, c.y + 0.15 * sin(t * 0.2)));
          col = mix(col, uPal[0], smoothstep(0.82, 1.0, w));
          float lum = 0.12 + 0.75 * w * w;
          float tw = step(0.992, h21(cell + floor(t * 4.0 + rnd * 7.0)));
          lum += tw * 1.6; col = mix(col, uPal[4], tw);
          // rotation : bandes obliques qui filent vers le haut, vitesse = vitesse de la roue
          float sp = smoothstep(0.02, 0.35, uV);
          float b = fract(c.y * 2.5 - x * 0.9 - uChase);
          float band = smoothstep(0.0, 0.05, b) * (1.0 - smoothstep(0.12, 0.42, b));
          vec3 cs = pal(c.y * 0.6 + x * 0.25 + uHue);
          col = mix(col, cs, sp * 0.85); lum = mix(lum, 0.1 + 2.2 * band * band + 0.15 * w, sp);
          // ralentissement : chaque « clac » envoie un éclair qui balaie le panneau
          float sweep = exp(-pow((c.y - (1.0 - uTick) * 1.1) * 14.0, 2.0)) * uTick;
          lum += 1.6 * sweep; col = mix(col, uPal[4], 0.6 * sweep);
          // résultat : onde dorée, puis numéro gagnant en points lumineux
          if (uCel < 8.0) {
            float r = length((c - vec2(0.5, 0.5)) * vec2(1.0, 2.55));
            float ring = exp(-pow((r - uCel * 1.1) * 5.0, 2.0)) * smoothstep(3.0, 0.5, uCel);
            float numOn = smoothstep(0.45, 1.0, uCel) * (1.0 - smoothstep(6.0, 7.5, uCel));
            float nb = step(0.5, texture2D(uNum, vec2(c.x, (c.y - 0.08) / 0.84)).a);
            vec3 bg = mix(uWinC, uPal[0], 0.35);
            float spark = step(0.97, h21(cell + floor(t * 9.0)));
            vec3 cc = nb > 0.5 ? mix(uPal[4], uPal[0], 0.25) : bg;
            float lc = nb > 0.5 ? 2.4 + 0.4 * sin(t * 6.0) : 0.12 + 0.9 * spark;
            col = mix(col, cc, numOn); lum = mix(lum, lc, numOn);
            lum += 2.2 * ring; col = mix(col, uPal[0], min(1.0, ring * 1.5));
          }
          lum *= 0.55 + 0.6 * uE;
          gl_FragColor = vec4(col * lum * led * k * 1.6, 1.0);
        }`,
    }))
    const q = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2, 2)), mat)
    q.frustumCulled = false; q.renderOrder = 1
    this.scene.add(q)
  }

  private drawPanelNumber(n: number) {
    const g = this.numCanvas.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, 220, 560); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
    let size = 260; g.font = `bold ${size}px Georgia, serif`
    const w = g.measureText(String(n)).width
    if (w > 196) { size *= 196 / w; g.font = `bold ${size}px Georgia, serif` }
    g.fillText(String(n), 110, 300)
    this.numTex.needsUpdate = true
  }

  private buildBeams() {
    for (const [x, color] of [[-3.6, lin(0.6, 0.25, 1)], [3.6, lin(1, 0.7, 0.35)]] as const) {
      const geo = this.track(new THREE.CylinderGeometry(0.08, 1.5, 7.5, 32, 1, true)); geo.translate(0, -3.75, 0)
      const m = this.track(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uC: { value: color }, uA: { value: 0.12 } },
        vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y / 7.5; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.6); float a = uA * f * (1.0 - vY) * smoothstep(0.0, 0.08, vY); gl_FragColor = vec4(uC * a, 1.0); }',
      }))
      const o = new THREE.Mesh(geo, m); o.position.set(x, 6.6, -2.0); this.scene.add(o); this.beams.push(o)
    }
  }

  private buildParticles() {
    const o = this.orbit, NO = o.a.length
    for (let i = 0; i < NO; i++) { o.a[i] = Math.random() * TAU; o.r[i] = 1.95 + Math.random() * 0.7; o.s[i] = (0.08 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1); o.y[i] = (Math.random() - 0.5) * 0.5; o.tw[i] = Math.random() * TAU }
    this.oGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NO * 3), 3)); this.oGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NO * 3), 3))
    this.track(this.oGeo)
    this.scene.add(new THREE.Points(this.oGeo, this.track(new THREE.PointsMaterial({ size: 0.075, map: this.halo, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))))
    this.bGeo.setAttribute('position', new THREE.BufferAttribute(this.burst.p, 3)); this.bGeo.setAttribute('color', new THREE.BufferAttribute(this.burst.c, 3))
    this.burst.p.fill(-50)
    this.track(this.bGeo)
    this.scene.add(new THREE.Points(this.bGeo, this.track(new THREE.PointsMaterial({ size: 0.09, map: this.halo, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))))
    const NCF = this.cf.p.length / 3
    this.conf = new THREE.InstancedMesh(this.track(new THREE.PlaneGeometry(0.07, 0.11)), this.track(new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 1.6 })), NCF)
    const tones: [number, number, number][] = [[1, 0.72, 0.3], [1, 0.85, 0.5], [0.95, 0.6, 0.2], [1, 0.95, 0.8]]
    for (let i = 0; i < NCF; i++) this.conf.setColorAt(i, this.tmpC.setRGB(...tones[i % 4]))
    this.conf.visible = false
    this.scene.add(this.conf)
  }

  // ──────────────────────────────────────────── entrées venant du jeu (lecture seule)
  /** À chaque image du moteur de WheelGame. */
  feed(angleDeg: number, velocityDegS: number, phase: WheelPhase) {
    if (phase !== this.phase) {
      this.phaseAt = performance.now()
      if (phase === 'spinup') { this.winner = -1; this.revealAt = 0 }
      if (phase === 'idle') this.stoppedAt = performance.now()
    }
    this.angle = angleDeg; this.vel = velocityDegS; this.phase = phase
  }
  /** Un séparateur vient de passer sous le pointeur. */
  tick() {
    const seg = 360 / this.N
    this.flapAt = performance.now()
    this.flapDur = Math.max(70, Math.min(260, (seg / Math.max(1, this.vel)) * 900))
    this.tickPulse = 1
  }
  /** Révélation du résultat (case gagnante dans l'ordre affiché, numéro fixe). */
  reveal(index: number, number: number | null, reduced: boolean) {
    if (index < 0 || index >= this.N) return
    this.winner = index; this.revealAt = performance.now()
    this.drawPanelNumber(number ?? index + 1)
    this.celebrate(lin(...SEG_COLORS[index % SEG_COLORS.length]), reduced)
  }
  clearReveal() { this.winner = -1; this.revealAt = 0 }
  /** Lancer en cours, arrivée du résultat ou célébration (6 s) : rendu à pleine cadence, aucun repli 2D pendant ce temps. */
  get busy() {
    const now = performance.now()
    // 1,5 s après l'arrêt : le résultat arrive (révélation) ; puis 6 s de célébration
    return this.phase !== 'idle' || now - this.stoppedAt < 1500 || (this.winner >= 0 && this.revealAt > 0 && now - this.revealAt < 6000)
  }
  private stoppedAt = -1e9

  private celebrate(winC: THREE.Color, reduced: boolean) {
    const b = this.burst, NB = b.life.length
    for (let i = 0; i < NB; i++) {
      const a = Math.random() * TAU, sp = 1.5 + Math.random() * 3.2
      b.p.set([Math.sin(a) * 1.75, 2.3 + Math.cos(a) * 1.75, 0.2], i * 3)
      b.v.set([Math.sin(a) * sp, Math.cos(a) * sp + 0.8, (Math.random() - 0.3) * 1.5], i * 3)
      b.life[i] = (reduced ? 0.6 : 1.4) + Math.random() * 1.2
      b.c.set(Math.random() < 0.7 ? [1, 0.75, 0.35] : [winC.r * 1.6, winC.g * 1.6, winC.b * 1.6], i * 3)
    }
    this.bGeo.attributes.color.needsUpdate = true
    if (reduced) return
    const cf = this.cf, NCF = cf.p.length / 3
    cf.on = true; cf.t = 0; this.conf.visible = true
    for (let i = 0; i < NCF; i++) {
      cf.p.set([(Math.random() - 0.5) * 9, 6.2 + Math.random() * 3, (Math.random() - 0.5) * 3 + 0.5], i * 3)
      cf.v.set([(Math.random() - 0.5) * 0.6, -0.9 - Math.random() * 0.9, 0], i * 3)
      cf.r.set([Math.random() * TAU, Math.random() * TAU, Math.random() * TAU], i * 3)
      cf.w.set([(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4], i * 3)
    }
  }

  // ──────────────────────────────────────────── rendu
  get qualityLevel() { return this.level }
  get qualityCount() { return LEVELS.length }
  setQuality(level: number) {
    this.level = clamp(Math.round(level), 0, LEVELS.length - 1)
    this.size = { w: 0, h: 0 }
  }
  /** Taille d'affichage en pixels réels ; la résolution de travail ne dépasse pas Full HD × qualité. */
  resize(displayW: number, displayH: number) {
    const L = LEVELS[this.level]
    const k = Math.min(1, (1920 * L.pr) / Math.max(1, displayW))
    const w = Math.max(320, Math.round(displayW * k)), h = Math.max(180, Math.round(displayH * k))
    if (w === this.size.w && h === this.size.h) return
    this.size = { w, h }
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.composer.setPixelRatio(1)
    this.composer.setSize(w, h)
    this.target.samples = L.msaa
    this.bloom.resolution.set(Math.round(w * L.bloom), Math.round(h * L.bloom))
  }

  tick3d(dt: number, now: number) {
    const t = now / 1000
    const A = this.angle * Math.PI / 180
    this.pivot.rotation.z = -A
    for (const n of this.numbers) n.rotation.z = A // numéros toujours droits (comme la 2D)
    if (this.flapAt > 0) {
      const p = (now - this.flapAt) / this.flapDur
      this.pointer.rotation.z = p >= 1 ? 0 : (p < 0.28 ? p / 0.28 : 1 - (p - 0.28) / 0.72) * 0.3
    }
    this.lights(dt, now, t)
    this.particles(dt, t)
  }

  private lights(dt: number, now: number, t: number) {
    const L = this.L, ringU = this.ringU, panU = this.panU
    const vr = clamp(this.vel / FREE_SPEED, 0, 1.2)
    const since = this.revealAt ? (now - this.revealAt) / 1000 : 99
    const celebrating = since < 6 && this.winner >= 0
    const spinning = this.phase !== 'idle'
    const sinceStart = (now - this.phaseAt) / 1000
    let eT = 0.45 + 0.08 * Math.sin(t * 0.9)
    if (this.phase === 'spinup') eT = 0.7 + 0.3 * smooth(sinceStart / SPIN_UP_S)
    if (this.phase === 'free') eT = 1.0
    if (this.phase === 'decel') eT = 0.55 + 0.45 * vr
    if (celebrating) eT = since < 1.2 ? 1.35 : 0.65 + 0.7 * Math.exp(-(since - 1.2) * 0.8)
    L.energy += (eT - L.energy) * Math.min(1, dt * 4)
    const rsT = spinning ? 0.06 + 0.55 * vr : celebrating ? 0.25 : 0.05
    L.ringSpeed += (rsT - L.ringSpeed) * Math.min(1, dt * 3)
    const dirs = [1, -1, 1, -1], mult = [1, 1.35, 0.8, 1.6]
    const uPhase = ringU.uPhase.value as number[], uHue = ringU.uHue.value as number[], uInt = ringU.uInt.value as number[]
    for (let k = 0; k < 4; k++) { L.ringPhase[k] += dirs[k] * L.ringSpeed * mult[k] * dt; uPhase[k] = L.ringPhase[k] }
    L.colorShift += dt * (0.02 + 0.12 * vr)
    for (let k = 0; k < 4; k++) {
      uHue[k] = L.colorShift * (k % 2 ? -1 : 1) + k * 0.25
      uInt[k] = (0.45 + 0.75 * L.energy) * (0.85 + 0.15 * Math.sin(t * 1.3 + k * 1.7)) + (this.phase === 'decel' ? 0.15 * this.tickPulse : 0)
    }
    ringU.uBase.value = 0.12 + 0.1 * L.energy
    ringU.uGold.value = celebrating ? Math.max(0, 1 - since / 4) * 0.8 : 0
    if (celebrating && since < 3) { ringU.uPulseR.value = 2.4 + since * 3.2; ringU.uPulseA.value = 2.2 * Math.exp(-since * 0.9) }
    else if (this.phase === 'spinup' || (this.phase === 'free' && sinceStart < 0.3)) { const p = this.phase === 'spinup' ? sinceStart : SPIN_UP_S + sinceStart; ringU.uPulseR.value = 2.5 + p * 7; ringU.uPulseA.value = Math.max(0, 1.2 * (1 - p * 1.5)) }
    else ringU.uPulseA.value = 0
    this.tickPulse *= Math.exp(-dt * 10)

    // 48 diodes de la couronne
    const A = this.angle * Math.PI / 180
    L.chase += dt * (spinning ? -(0.15 + 1.6 * vr) : celebrating ? 0.9 : 0.12)
    const idleMode = Math.floor(t / 7) % 4, idleBlend = smooth((t % 7) / 1.2)
    const winC = this.winner >= 0 ? lin(...SEG_COLORS[this.winner % SEG_COLORS.length]) : PAL.or
    const NL = this.ledAngle.length
    const idle = (mode: number, i: number, phi: number): [number, THREE.Color] => {
      switch (mode) {
        case 0: return [0.3 + 0.9 * Math.pow(1 - ((phi * 2 + L.chase) % 1 + 1) % 1, 4), PAL.or]
        case 1: return [0.35 + 0.6 * (0.5 + 0.5 * Math.sin(phi * TAU * 3 - t * 2.2)), PAL.blanc]
        case 2: { const s = smooth((t * 1.2) % 1); return [0.3 + 0.75 * ((i % 2) === (Math.floor(t * 1.2) % 2) ? s : 1 - s), i % 2 ? PAL.violet : PAL.or] }
        default: return [0.55 + 0.2 * Math.sin(t * 1.5 + i), PAL_LIST[Math.floor(((phi + t * 0.08) % 1) * 5) % 5]]
      }
    }
    for (let i = 0; i < NL; i++) {
      const phi = (((this.ledAngle[i] + A) / TAU) % 1 + 1) % 1 // angle à l'écran depuis le haut (0..1)
      let I: number
      let c: THREE.Color
      if (celebrating) {
        const dist = Math.min(phi, 1 - phi), wave = Math.exp(-Math.pow((dist - since * 0.45) * 9, 2))
        I = 0.5 + 1.6 * wave + 0.5 * (0.55 + 0.45 * Math.sin(t * 14 + i * 2.3)) * smooth(since - 0.6)
        c = since < 1.6 ? PAL.or : (i % 2 ? winC : PAL.or)
      } else if (spinning) {
        const x = (((phi * 3 + L.chase) % 1) + 1) % 1
        I = 0.2 + 0.85 * Math.pow(1 - x, 3) + 0.1 * vr
        c = PAL_LIST[Math.floor((((phi + L.colorShift * 2) % 1 + 1) % 1) * 5) % 5]
        if (this.phase === 'decel' && (phi < 0.06 || phi > 0.94)) I += 1.2 * this.tickPulse
      } else {
        const [i1, c1] = idle(idleMode, i, phi), [i0, c0] = idle((idleMode + 3) % 4, i, phi)
        I = i0 + (i1 - i0) * idleBlend; c = this.tmpC.copy(c0).lerp(c1, idleBlend)
      }
      I *= 0.55 + 0.6 * L.energy
      this.ledCol.copy(c).multiplyScalar(0.6 + I * 4.0)
      this.leds.setColorAt(i, this.ledCol)
      this.haloCol[i * 3] = this.ledCol.r * 0.16; this.haloCol[i * 3 + 1] = this.ledCol.g * 0.16; this.haloCol[i * 3 + 2] = this.ledCol.b * 0.16
    }
    if (this.leds.instanceColor) this.leds.instanceColor.needsUpdate = true
    this.haloGeo.attributes.color.needsUpdate = true

    // case gagnante : éclat pulsé de sa propre couleur
    this.segMats.forEach((m, i) => {
      const on = i === this.winner && !spinning
      const g = on ? (0.6 + 0.4 * Math.sin(t * 5)) * (since < 0.4 ? since / 0.4 : 1) : 0
      m.userData.glow.value += (g - m.userData.glow.value) * Math.min(1, dt * 8)
      m.userData.glowColor.value.copy(on ? winC : PAL.or).multiplyScalar(1.3)
    })
    this.flash.intensity = celebrating ? 40 * Math.exp(-since * 2.5) : 0
    this.bloom.strength = 0.25 + 0.2 * L.energy
    // panneaux LED latéraux
    panU.uT.value = t; panU.uE.value = L.energy; panU.uV.value = vr
    panU.uTick.value = this.phase === 'decel' ? this.tickPulse : this.tickPulse * 0.3
    L.panChase += dt * (0.08 + 1.4 * vr); panU.uChase.value = L.panChase; panU.uHue.value = L.colorShift * 1.5
    panU.uCel.value = this.winner >= 0 && since < 8 ? since : 99
    ;(panU.uWinC.value as THREE.Color).copy(winC)
    this.beams.forEach((b, k) => { b.rotation.z = Math.sin(t * 0.25 + k * 2) * 0.22 + (k ? -0.35 : 0.35); b.material.uniforms.uA.value = 0.05 + 0.1 * L.energy })
  }

  private particles(dt: number, t: number) {
    const o = this.orbit, NO = o.a.length
    const pos = this.oGeo.attributes.position.array as Float32Array, col = this.oGeo.attributes.color.array as Float32Array
    const vr = clamp(this.vel / FREE_SPEED, 0, 1.2)
    for (let i = 0; i < NO; i++) {
      o.a[i] += o.s[i] * dt * (1 + 3 * vr)
      const a = o.a[i], r = o.r[i]
      pos[i * 3] = Math.sin(a) * r * 1.08; pos[i * 3 + 1] = 2.3 + Math.cos(a) * r * 0.92 + o.y[i]; pos[i * 3 + 2] = Math.cos(a * 2) * 0.3 - 0.2
      const tw = (0.35 + 0.65 * Math.max(0, Math.sin(t * 3 + o.tw[i]))) * (0.3 + 0.7 * this.L.energy)
      const c = i % 3 ? PAL.or : PAL.violet
      col[i * 3] = c.r * tw; col[i * 3 + 1] = c.g * tw; col[i * 3 + 2] = c.b * tw
    }
    this.oGeo.attributes.position.needsUpdate = true; this.oGeo.attributes.color.needsUpdate = true
    const b = this.burst, NB = b.life.length
    let any = false
    for (let i = 0; i < NB; i++) {
      if (b.life[i] <= 0) { if (b.p[i * 3 + 1] !== -50) { b.p[i * 3 + 1] = -50; any = true } continue }
      any = true; b.life[i] -= dt
      b.v[i * 3 + 1] -= 2.4 * dt
      for (let k = 0; k < 3; k++) { b.v[i * 3 + k] *= 1 - dt * 0.9; b.p[i * 3 + k] += b.v[i * 3 + k] * dt }
    }
    if (any) this.bGeo.attributes.position.needsUpdate = true
    const cf = this.cf
    if (cf.on) {
      cf.t += dt
      const NCF = cf.p.length / 3
      for (let i = 0; i < NCF; i++) {
        for (let k = 0; k < 3; k++) { cf.p[i * 3 + k] += cf.v[i * 3 + k] * dt; cf.r[i * 3 + k] += cf.w[i * 3 + k] * dt }
        cf.v[i * 3] += Math.sin(t * 2 + i) * 0.4 * dt
        this.tmpV.set(cf.p[i * 3], cf.p[i * 3 + 1], cf.p[i * 3 + 2])
        this.tmpQ.setFromEuler(this.tmpE.set(cf.r[i * 3], cf.r[i * 3 + 1], cf.r[i * 3 + 2]))
        this.conf.setMatrixAt(i, this.tmpM.compose(this.tmpV, this.tmpQ, this.one))
      }
      this.conf.instanceMatrix.needsUpdate = true
      if (cf.t > 9) { cf.on = false; this.conf.visible = false }
    }
  }

  render() { this.composer.render() }

  dispose() {
    for (const d of this.disposables) { try { d.dispose() } catch { /* déjà libéré */ } }
    this.disposables = []
    for (const m of this.segMats) m.dispose()
    this.composer?.dispose()
    this.renderer.dispose()
  }
}
