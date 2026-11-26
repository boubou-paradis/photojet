# AnimaJet SaaS V2 — bibliothèque Blender commune (Cycles, caméra orthographique de face).
# Échelle : 1 unité Blender = 100 px de rendu. Les ressources sont rendues en 2x (1 px CSS = 2 px).
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REN = os.path.join(os.path.dirname(HERE), "renders")
os.makedirs(REN, exist_ok=True)
U = 0.01  # 1 px de rendu en unités


def reset():
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves, bpy.data.images, bpy.data.node_groups):
        for b in list(coll):
            try: coll.remove(b)
            except Exception: pass


def scene(w_px, h_px, samples=128):
    reset()
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.transparent_max_bounces = 32
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("GPU indisponible", e)
    sc.render.resolution_x, sc.render.resolution_y = w_px, h_px
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    vt = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
    sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in vt else "Standard"
    sc.view_settings.look = "None"
    if sc.world is None: sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.006, 0.005, 0.009, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    cam.data.type = "ORTHO"; cam.data.ortho_scale = max(w_px, h_px) * U
    cam.location = (0, 0, 20); cam.data.clip_end = 100
    sc.collection.objects.link(cam); sc.camera = cam
    return sc


def render(name):
    """Deux passes : (A) fond transparent -> opacité des objets ; (C) mêmes réglages sur fond noir ->
    couleurs étalonnées. post.py combine : opacité = max(A, intensité de C) => halos et volutes
    gardent leur couleur et se posent en fusion additive sur n'importe quel fond."""
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    bg = sc.world.node_tree.nodes["Background"]
    sc.render.film_transparent = True
    sc.render.filepath = os.path.join(REN, "_" + name + "_a.png")
    bpy.ops.render.render(write_still=True)
    s0 = bg.inputs[1].default_value; bg.inputs[1].default_value = 0.0
    sc.render.film_transparent = False
    sc.render.image_settings.color_mode = "RGB"
    sc.render.filepath = os.path.join(REN, "_" + name + "_c.png")
    bpy.ops.render.render(write_still=True)
    bg.inputs[1].default_value = s0
    print("RENDU", name)


# ---------------------------------------------------------------- matériaux
def _nt(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"]


def mat_verre(name, base=(0.0035, 0.003, 0.0055), rough=0.3, coat=1.0, teinte=None):
    """Verre fumé / laque épaisse : sombre, vernis brillant qui attrape les softbox."""
    m, nt, b = _nt(name)
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.06
    if teinte: b.inputs["Coat Tint"].default_value = (*teinte, 1)
    return m


def mat_metal(name, rgb=(1.0, 0.74, 0.32), rough=0.22, brosse=0.0, aniso=0.0, emit=None, emit_s=0.0):
    m, nt, b = _nt(name)
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    if aniso: b.inputs["Anisotropic"].default_value = aniso
    if brosse:
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 300; n.inputs["Detail"].default_value = 3
        mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.02, 1, 1)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        bu = nt.nodes.new("ShaderNodeBump"); bu.inputs["Strength"].default_value = brosse
        nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], n.inputs[0])
        nt.links.new(n.outputs[0], bu.inputs["Height"]); nt.links.new(bu.outputs[0], b.inputs["Normal"])
        # variation de rugosité qui suit le brossage
        r = nt.nodes.new("ShaderNodeMapRange"); r.inputs[3].default_value = rough * 0.7; r.inputs[4].default_value = rough * 1.4
        nt.links.new(n.outputs[0], r.inputs[0]); nt.links.new(r.outputs[0], b.inputs["Roughness"])
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = emit_s
    return m


def mat_emis(name, rgb, s):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = (*rgb, 1); e.inputs[1].default_value = s
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def mat_lueur(name, rgb, s, sharp_u=1.0, sharp_v=2.0, along=True):
    """Lueur douce sur une bande UV : maximum au centre (u=0.5), s'éteint vers les bouts et les bords ;
    émission + transparence (les couches s'additionnent)."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission"); e.inputs[0].default_value = (*rgb, 1)
    tc = nt.nodes.new("ShaderNodeTexCoord"); sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], sp.inputs[0])

    def bosse(sock, sharp):
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "MULTIPLY_ADD"; a.inputs[1].default_value = 2; a.inputs[2].default_value = -1
        nt.links.new(sock, a.inputs[0])
        ab = nt.nodes.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"; nt.links.new(a.outputs[0], ab.inputs[0])
        iv = nt.nodes.new("ShaderNodeMath"); iv.operation = "SUBTRACT"; iv.inputs[0].default_value = 1; nt.links.new(ab.outputs[0], iv.inputs[1])
        pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = sharp; nt.links.new(iv.outputs[0], pw.inputs[0])
        return pw.outputs[0]
    mu = nt.nodes.new("ShaderNodeMath"); mu.operation = "MULTIPLY"
    nt.links.new(bosse(sp.outputs[0], sharp_u), mu.inputs[0]); nt.links.new(bosse(sp.outputs[1], sharp_v), mu.inputs[1])
    k = nt.nodes.new("ShaderNodeMath"); k.operation = "MULTIPLY"; k.inputs[1].default_value = s
    nt.links.new(mu.outputs[0], k.inputs[0]); nt.links.new(k.outputs[0], e.inputs[1])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent"); ad = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tr.outputs[0], ad.inputs[0]); nt.links.new(e.outputs[0], ad.inputs[1]); nt.links.new(ad.outputs[0], o.inputs[0])
    return m


# ---------------------------------------------------------------- géométrie
def _rrect_verts(w, h, r, seg=14):
    pts = []
    for cx, cy, a0 in [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def _link(name, bm, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if mat: me.materials.append(mat)
    return ob


def plaque(name, w, h, r, ep, biseau, mat, z=0.0, seg=14, prof=0.5):
    """Plaque arrondie extrudée, arête haute biseautée (dimensions en px de rendu)."""
    w, h, r, ep, biseau, z = w * U, h * U, r * U, ep * U, biseau * U, z * U
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in _rrect_verts(w, h, r, seg)]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, ep))
    topf = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMFace) and all(v in top for v in g.verts)]
    if biseau > 0:
        edges = list({e for fc in topf for e in fc.edges})
        bmesh.ops.bevel(bm, geom=edges, offset=biseau, segments=6, affect="EDGES", profile=prof, clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _link(name, bm, mat)


def anneau(name, w, h, r, t, ep, biseau, mat, z=0.0, seg=14, prof=0.5):
    """Cadre (anneau) arrondi : contour extérieur w x h, épaisseur t, relief ep, arêtes arrondies."""
    w, h, r, t, ep, biseau, z = w * U, h * U, r * U, t * U, ep * U, biseau * U, z * U
    bm = bmesh.new()
    outer = [bm.verts.new((x, y, z)) for x, y in _rrect_verts(w, h, r, seg)]
    ri = max(r - t, 0.001)
    inner = [bm.verts.new((x, y, z)) for x, y in _rrect_verts(w - 2 * t, h - 2 * t, ri, seg)]
    n = len(outer)
    faces = [bm.faces.new((outer[i], outer[(i + 1) % n], inner[(i + 1) % n], inner[i])) for i in range(n)]
    ext = bmesh.ops.extrude_face_region(bm, geom=faces)
    top = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, ep))
    topset = set(top)
    edges = [e for e in bm.edges if all(v in topset for v in e.verts) and len(e.link_faces) == 2
             and any(abs(fc.normal.z) < 0.5 for fc in e.link_faces)]
    if biseau > 0:
        bmesh.ops.bevel(bm, geom=edges, offset=biseau, segments=6, affect="EDGES", profile=prof, clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _link(name, bm, mat)


def bande(name, cx, cy, w, h, mat, z, rot=0.0):
    """Rectangle plat UV (u le long de w, v le long de h) — support des lueurs."""
    bm = bmesh.new(); c, s = math.cos(rot), math.sin(rot)
    vs = []
    for (x, y), uv in zip([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], [(0, 0), (1, 0), (1, 1), (0, 1)]):
        vs.append(bm.verts.new(((cx + x * c - y * s) * U, (cy + x * s + y * c) * U, z * U)))
    f = bm.faces.new(vs)
    uvl = bm.loops.layers.uv.new("UVMap")
    for lp, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]): lp[uvl].uv = uv
    return _link(name, bm, mat)


# ---------------------------------------------------------------- éclairage studio
def softbox(name, loc, size, rot, rgb=(1, 1, 1), s=6.0):
    """Panneau lumineux invisible à la caméra (reflets sur vernis et biseaux)."""
    ob = bande(name, 0, 0, size[0] / U, size[1] / U, mat_emis(name + "_m", rgb, s), 0)
    ob.location = loc; ob.rotation_euler = rot
    ob.visible_camera = False
    return ob


def studio(w, h, cle=6.0, couleur_bas=None, s_bas=4.0):
    """Lumière de plateau : grande boîte au-dessus (vers le haut de l'image), filet arrière haut,
    lumière colorée rasante en bas pour la catégorie. w, h en px de rendu."""
    W, H = w * U, h * U
    softbox("SB_haut", (0, H * 0.9, 6), (W * 2.2, H * 1.2), (math.radians(-35), 0, 0), (1, 0.97, 0.92), cle * 0.22)
    softbox("SB_face", (0, 0, 14), (W * 3, H * 3), (0, 0, 0), (0.75, 0.72, 0.85), 0.045)
    softbox("SB_filet", (0, H * 1.2, 1.5), (W * 1.6, 0.4), (math.radians(-70), 0, 0), (1, 0.95, 0.85), cle * 1.6)
    if couleur_bas:
        softbox("SB_bas", (0, -H * 1.1, 1.2), (W * 1.2, 0.5), (math.radians(70), 0, 0), couleur_bas, s_bas)


def cadre_libre(name, ow, oh, orr, iw, ih, ir, icy, ep, biseau, mat, z=0.0, seg=14, prof=0.5):
    """Plaque percée : contour ow x oh (rayon orr), fenêtre iw x ih (rayon ir) décalée de icy vers le haut."""
    s = U
    bm = bmesh.new()
    o = _rrect_verts(ow * s, oh * s, orr * s, seg)
    i = _rrect_verts(iw * s, ih * s, ir * s, seg)
    outer = [bm.verts.new((x, y, z * s)) for x, y in o]
    inner = [bm.verts.new((x, y + icy * s, z * s)) for x, y in i]
    n = len(outer)
    faces = [bm.faces.new((outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k])) for k in range(n)]
    ext = bmesh.ops.extrude_face_region(bm, geom=faces)
    top = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, ep * s))
    ts = set(top)
    edges = [e for e in bm.edges if all(v in ts for v in e.verts) and len(e.link_faces) == 2
             and any(abs(fc.normal.z) < 0.5 for fc in e.link_faces)]
    if biseau > 0:
        bmesh.ops.bevel(bm, geom=edges, offset=biseau * s, segments=6, affect="EDGES", profile=prof, clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _link(name, bm, mat)


def polygone(name, pts_px, ep, biseau, mat, z=0.0, prof=0.5):
    """Plaque à contour libre (liste de points en px), arête haute biseautée."""
    bm = bmesh.new()
    vs = [bm.verts.new((x * U, y * U, z * U)) for x, y in pts_px]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, ep * U))
    topf = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMFace) and all(v in top for v in g.verts)]
    if biseau > 0:
        bmesh.ops.bevel(bm, geom=list({e for fc in topf for e in fc.edges}), offset=biseau * U, segments=5, affect="EDGES", profile=prof, clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _link(name, bm, mat)


def mat_grille(name, pas_px=22, trou=0.34):
    """Tôle noire perforée (grille de haut-parleur) : trous en quinconce, bords des trous éclairés."""
    m, nt, b = _nt(name)
    b.inputs["Base Color"].default_value = (0.02, 0.018, 0.024, 1)
    b.inputs["Metallic"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.38
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); f = 1 / (pas_px * U); mp.inputs["Scale"].default_value = (f, f * 0.5774 * 2, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    # quinconce : décalage d'une demi-maille une rangée sur deux via la texture Brick (mortier = trous)
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0; br.inputs["Mortar Size"].default_value = 0.0
    br.offset = 0.5; br.offset_frequency = 2
    br.inputs["Brick Width"].default_value = 1.0; br.inputs["Row Height"].default_value = 0.5
    # trou rond calculé à la main : position dans la maille
    sx = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(mp.outputs[0], sx.inputs[0])
    row = nt.nodes.new("ShaderNodeMath"); row.operation = "FLOOR"
    ry = nt.nodes.new("ShaderNodeMath"); ry.operation = "MULTIPLY"; ry.inputs[1].default_value = 1.0
    nt.links.new(sx.outputs[1], ry.inputs[0]); nt.links.new(ry.outputs[0], row.inputs[0])
    par = nt.nodes.new("ShaderNodeMath"); par.operation = "MODULO"; par.inputs[1].default_value = 2
    nt.links.new(row.outputs[0], par.inputs[0])
    dx = nt.nodes.new("ShaderNodeMath"); dx.operation = "MULTIPLY_ADD"; dx.inputs[1].default_value = 0.5
    nt.links.new(par.outputs[0], dx.inputs[0]); nt.links.new(sx.outputs[0], dx.inputs[2])
    fx = nt.nodes.new("ShaderNodeMath"); fx.operation = "FRACT"; nt.links.new(dx.outputs[0], fx.inputs[0])
    fy = nt.nodes.new("ShaderNodeMath"); fy.operation = "FRACT"; nt.links.new(sx.outputs[1], fy.inputs[0])
    cx = nt.nodes.new("ShaderNodeMath"); cx.operation = "SUBTRACT"; cx.inputs[1].default_value = 0.5; nt.links.new(fx.outputs[0], cx.inputs[0])
    cy = nt.nodes.new("ShaderNodeMath"); cy.operation = "SUBTRACT"; cy.inputs[1].default_value = 0.5; nt.links.new(fy.outputs[0], cy.inputs[0])
    cmb = nt.nodes.new("ShaderNodeCombineXYZ"); nt.links.new(cx.outputs[0], cmb.inputs[0]); nt.links.new(cy.outputs[0], cmb.inputs[1])
    ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"; nt.links.new(cmb.outputs[0], ln.inputs[0])
    # profil du trou : 0 au centre -> 1 hors trou (pente douce = chanfrein éclairé)
    rg = nt.nodes.new("ShaderNodeMapRange"); rg.inputs[1].default_value = trou * 0.75; rg.inputs[2].default_value = trou
    nt.links.new(ln.outputs["Value"], rg.inputs[0])
    bu = nt.nodes.new("ShaderNodeBump"); bu.inputs["Strength"].default_value = 0.9; bu.inputs["Distance"].default_value = 0.02
    nt.links.new(rg.outputs[0], bu.inputs["Height"]); nt.links.new(bu.outputs[0], b.inputs["Normal"])
    mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
    mx.inputs[6].default_value = (0.0, 0.0, 0.0, 1); mx.inputs[7].default_value = (0.03, 0.028, 0.034, 1)
    nt.links.new(rg.outputs[0], mx.inputs[0]); nt.links.new(mx.outputs[2], b.inputs["Base Color"])
    return m


def sphere_lum(name, x, y, z, r, rgb, s):
    import bpy
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r * U, location=(x * U, y * U, z * U), segments=12, ring_count=6)
    ob = bpy.context.active_object; ob.name = name
    ob.data.materials.append(mat_emis(name + "_m", rgb, s))
    return ob


def ruban(name, pts_px, larg_px, rgb, s, z, sharp_u=0.8, sharp_v=2.0):
    """Ruban lumineux le long d'une courbe (Catmull-Rom), lueur centrée en travers et sur la longueur."""
    P = [pts_px[0]] + pts_px + [pts_px[-1]]
    samp = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(32):
            t = k / 32
            samp.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                     + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(2)))
    samp.append(pts_px[-1])
    L = [0.0]
    for i in range(1, len(samp)): L.append(L[-1] + math.dist(samp[i], samp[i - 1]))
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap"); rows = []
    for i, (x, y) in enumerate(samp):
        a = samp[max(i - 1, 0)]; b = samp[min(i + 1, len(samp) - 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]; n = math.hypot(tx, ty) or 1
        nx, ny = -ty / n, tx / n
        rows.append((bm.verts.new(((x - nx * larg_px / 2) * U, (y - ny * larg_px / 2) * U, z * U)),
                     bm.verts.new(((x + nx * larg_px / 2) * U, (y + ny * larg_px / 2) * U, z * U)), L[i] / L[-1]))
    for i in range(len(rows) - 1):
        a0, a1, u0 = rows[i]; b0, b1, u1 = rows[i + 1]
        f = bm.faces.new((a0, b0, b1, a1))
        for lp, uv in zip(f.loops, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)]): lp[uvl].uv = uv
    return _link(name, bm, mat_lueur(name + "_m", rgb, s, sharp_u, sharp_v))
