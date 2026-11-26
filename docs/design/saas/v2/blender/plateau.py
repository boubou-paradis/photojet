# AnimaJet SaaS V2 — page Jeux, proposition « Le Plateau » (galerie premium plateau TV).
# blender -b --factory-startup --python plateau.py -- titre ecrin socle faisceau fond   (sans argument : tout)
# Ressources préfixées « pl- » : n'écrasent rien de la version validée.
import bpy, bmesh, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, aj_lib; importlib.reload(aj_lib)
from aj_lib import *

OR_POLI = (1.0, 0.77, 0.36)
BODONI = "C:/Windows/Fonts/BOD_R.TTF"


def quad_uv(name, pts, mat, z):
    """Quadrilatère libre (bas-g, bas-d, haut-d, haut-g) avec UV 0..1 — support des faisceaux."""
    bm = bmesh.new()
    vs = [bm.verts.new((x * U, y * U, z * U)) for x, y in pts]
    f = bm.faces.new(vs)
    uvl = bm.loops.layers.uv.new("UVMap")
    for lp, uv in zip(f.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]): lp[uvl].uv = uv
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def texte_champagne(name, corps, larg_px, cy_px, haut_max_px):
    """Titre moderne : sans empattements très épais (Segoe UI Black), or champagne poli, relief 3D léger."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.font = bpy.data.fonts.load("C:/Windows/Fonts/seguibl.ttf")
    cu.body = corps; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    cu.size = 1.0; cu.space_character = 1.04
    cu.extrude = 0.06; cu.bevel_depth = 0.014; cu.bevel_resolution = 5
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat_metal(name + "_m", (1.0, 0.8, 0.52), 0.15, brosse=0.06, aniso=0.1, emit=(1, 0.72, 0.42), emit_s=0.14))
    bpy.context.view_layer.update()
    d = ob.dimensions
    k = min(larg_px * U / d.x, haut_max_px * U / d.y)
    ob.scale = (k, k, k); ob.location = (0, cy_px * U, 0.2)
    return ob


def texte_or(name, corps, larg_px, cy_px, haut_max_px):
    """Lettres or extrudées et biseautées, mises à l'échelle pour tenir dans larg_px x haut_max_px."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.font = bpy.data.fonts.load(BODONI)
    cu.body = corps; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    cu.size = 1.0; cu.space_character = 1.22
    cu.extrude = 0.045; cu.bevel_depth = 0.018; cu.bevel_resolution = 4
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat_metal(name + "_m", (1.0, 0.74, 0.32), 0.16, brosse=0.12, aniso=0.2, emit=(1, 0.6, 0.18), emit_s=0.12))
    bpy.context.view_layer.update()
    d = ob.dimensions
    k = min(larg_px * U / d.x, haut_max_px * U / d.y)
    ob.scale = (k, k, k)
    ob.location = (0, cy_px * U, 0.2)
    return ob


def lumiere_titre(W, H):
    studio(W, H, cle=3.0)
    # grande boîte frontale légèrement haute : donne la face dorée ; filet chaud rasant pour les biseaux
    softbox("Face_or", (0, H * U * 0.9, 9), (W * U * 1.6, H * U * 1.0), (math.radians(-18), 0, 0), (1, 0.9, 0.72), 4.0)
    softbox("Face_bas", (0, -H * U * 1.4, 9), (W * U * 1.6, H * U * 0.8), (math.radians(20), 0, 0), (1, 0.62, 0.25), 1.4)
    softbox("Rasant", (0, -H * U * 1.0, 2.0), (W * U * 1.4, 0.6), (math.radians(65), 0, 0), (0.75, 0.45, 1.0), 2.5)


def a_titre_showtime(nom, corps):
    """Même composition que a_titre (canevas, filet, losange, éclats) ; seul le lettrage change."""
    W, H = 1800, 340
    scene(W, H, 256)
    lumiere_titre(W, H)
    # reflet fin qui file en diagonale sur la face des lettres
    softbox("Reflet_diag", (W * U * 0.18, H * U * 0.5, 8), (W * U * 0.035, H * U * 2.4), (math.radians(-10), math.radians(10), math.radians(-30)), (1, 0.95, 0.85), 1.6)
    texte_champagne("Titre", corps, 1380, 40, 165)
    y = -H / 2 + 62
    for sx in (-1, 1):
        polygone(f"Filet{sx}", [(sx * 46, y - 2.5), (sx * 520, y - 0.6), (sx * 520, y + 0.6), (sx * 46, y + 2.5)][::sx], 3, 1.2,
                 mat_metal(f"fl{sx}", OR_POLI, 0.18, emit=(1, 0.66, 0.25), emit_s=0.5), z=4)
    polygone("Losange", [(0, y - 22), (22, y), (0, y + 22), (-22, y)], 8, 4, mat_metal("lo", OR_POLI, 0.14, emit=(1, 0.7, 0.3), emit_s=0.4), z=4, prof=0.6)
    bande("Eclat", 0, y, 700, 10, mat_lueur("ec", (1, 0.78, 0.42), 3.0, 1.4, 1.6), 6)
    bande("EclatV", 0, y, 10, 120, mat_lueur("ev", (1, 0.85, 0.6), 2.0, 1.6, 2.2), 6)
    bande("Halo", 0, y, 300, 60, mat_lueur("ha", (0.65, 0.3, 1.0), 0.8, 1.4, 1.4), 1)
    render(nom)


def a_titre(nom, corps):
    W, H = 1800, 340
    scene(W, H, 256)
    lumiere_titre(W, H)
    texte_or("Titre", corps, 1400, 40, 160)
    # filet d'or sous le titre : deux traits qui s'effilent + losange central + éclat
    y = -H / 2 + 62
    for sx in (-1, 1):
        polygone(f"Filet{sx}", [(sx * 46, y - 2.5), (sx * 520, y - 0.6), (sx * 520, y + 0.6), (sx * 46, y + 2.5)][::sx], 3, 1.2,
                 mat_metal(f"fl{sx}", OR_POLI, 0.18, emit=(1, 0.66, 0.25), emit_s=0.5), z=4)
    polygone("Losange", [(0, y - 22), (22, y), (0, y + 22), (-22, y)], 8, 4, mat_metal("lo", OR_POLI, 0.14, emit=(1, 0.7, 0.3), emit_s=0.4), z=4, prof=0.6)
    bande("Eclat", 0, y, 700, 10, mat_lueur("ec", (1, 0.78, 0.42), 3.0, 1.4, 1.6), 6)
    bande("EclatV", 0, y, 10, 120, mat_lueur("ev", (1, 0.85, 0.6), 2.0, 1.6, 2.2), 6)
    bande("Halo", 0, y, 300, 60, mat_lueur("ha", (0.65, 0.3, 1.0), 0.8, 1.4, 1.4), 1)
    render(nom)


def a_ecrin(nom, survol=False):
    """Écrin d'affiche 9-slice : fenêtre 800x450 ; passe-partout laque noire, double filet d'or poli."""
    IW, IH, B, M, R = 800, 450, 16, 64, 18
    OW, OH = IW + 2 * B, IH + 2 * B
    scene(OW + 2 * M, OH + 2 * M, 192)
    studio(OW + 2 * M, OH + 2 * M, cle=2.6, couleur_bas=(1, 0.7, 0.3) if survol else None, s_bas=3.0)
    cadre_libre("PassePartout", OW, OH, R, IW, IH, 8, 0, 12, 4, mat_verre("laque", base=(0.004, 0.0035, 0.006), rough=0.25, coat=1.0), z=0)
    e = 0.55 if survol else 0.06
    anneau("FiletExt", OW, OH, R, 4, 15, 1.8, mat_metal("fe", OR_POLI, 0.14, emit=(1, 0.66, 0.25), emit_s=e), prof=0.5)
    cadre_libre("FiletInt", IW + 12, IH + 12, 12, IW, IH, 8, 0, 16, 2.5, mat_metal("fi", OR_POLI, 0.12, emit=(1, 0.7, 0.3), emit_s=e), z=0)
    if survol:
        for sy, yy in ((1, OH / 2), (-1, -OH / 2)):
            bande(f"Eclat{sy}", 0, yy, OW * 0.8, 6, mat_lueur(f"ec{sy}", (1, 0.82, 0.5), 9, 0.9, 1.4), 18)
    render(nom)


def a_socle(nom):
    """Socle sous l'affiche (3-slice horizontal) : arête d'or, dessus laqué incliné vers la caméra,
    face avant laque noire mate où s'inscrit le nom ; ombre de contact dessous."""
    W, H, M = 860, 100, 40
    scene(W + 2 * M, H + 2 * M, 192)
    studio(W + 2 * M, H + 2 * M, cle=3.0)
    plaque("Face", W, H - 18, 10, 14, 3, mat_verre("face", base=(0.008, 0.006, 0.011), rough=0.5, coat=0.4), z=0).location.y = -9 * U
    plaque("Dessus", W - 6, 16, 6, 10, 4, mat_metal("dessus", (0.12, 0.09, 0.07), 0.3, brosse=0.6), z=4).location.y = (H / 2 - 9) * U
    bande("Arete", 0, H / 2 - 18, W - 10, 3.2, mat_lueur("ar", (1, 0.75, 0.38), 4.5, 0.35, 1.2), 20)
    bande("Reflet", 0, H / 2 - 2, W * 0.9, 4, mat_lueur("rf", (1, 0.9, 0.7), 1.2, 0.6, 1.3), 20)
    render(nom)


def a_faisceau(nom):
    """Cône de projecteur (vue de face) : étroit en haut, large en bas, s'éteint en descendant."""
    W, H = 1000, 1200
    scene(W, H, 128)
    # quad deux fois plus haut que le canevas : le maximum (v = 0,5) tombe sur le bord haut
    quad_uv("Cone", [(-W * 0.46, -H / 2 - 60), (W * 0.46, -H / 2 - 60), (W * 0.06, H * 1.5), (-W * 0.06, H * 1.5)],
            mat_lueur("cone", (1, 0.78, 0.45), 0.5, 1.6, 0.9), 0)
    quad_uv("Coeur", [(-W * 0.2, -H / 2), (W * 0.2, -H / 2), (W * 0.02, H * 1.5), (-W * 0.02, H * 1.5)],
            mat_lueur("coeur", (1, 0.92, 0.75), 0.35, 2.2, 1.0), 1)
    bande("Sol", 0, -H / 2 + 40, W * 0.9, 120, mat_lueur("sol", (1, 0.8, 0.5), 0.9, 1.4, 1.6), 2)
    render(nom)


def a_fond(nom):
    """Plateau : fond prune profond, rais de lumière depuis les cintres, sol laqué avec horizon d'or."""
    W, H = 2560, 1440
    scene(W, H, 192)
    plaque("Noir", W + 40, H + 40, 0, 2, 0, mat_emis("noir", (0.005, 0.004, 0.008), 1.0), z=-20)
    bande("Brume", 0, 120, W * 1.2, H * 0.9, mat_lueur("br", (0.32, 0.12, 0.55), 0.12, 1.1, 1.2), -15)
    bande("Coeur", 0, 240, W * 0.6, H * 0.5, mat_lueur("co", (0.5, 0.25, 0.8), 0.06, 1.4, 1.4), -14)
    # rais depuis le haut (or au centre, violet sur les côtés)
    for i, (x, ang, c, s) in enumerate([(-900, 16, (0.62, 0.28, 1.0), 0.16), (-380, 6, (1, 0.72, 0.38), 0.10),
                                         (380, -6, (1, 0.72, 0.38), 0.10), (900, -16, (0.62, 0.28, 1.0), 0.16)]):
        quad_uv(f"Rai{i}", [(x - 170 + ang * 30, -H * 0.05), (x + 170 + ang * 30, -H * 0.05), (x + 22, H * 1.2), (x - 22, H * 1.2)],
                mat_lueur(f"rai{i}", c, s, 1.6, 0.8), -10 + i * 0.1)
    yh = -H * 0.18
    bande("Assise", 0, -H / 2, W * 1.3, H * 0.7, mat_lueur("as", (0.25, 0.1, 0.4), 0.06, 1.0, 1.6), -7)
    # bokeh discret en hauteur
    import random; random.seed(7)
    for k in range(26):
        x = random.uniform(-W / 2, W / 2); y = random.uniform(yh + 80, H / 2 - 40); r = random.uniform(14, 40)
        c = (1, 0.75, 0.4) if k % 3 else (0.7, 0.4, 1.0)
        bande(f"Bk{k}", x, y, r, r, mat_lueur(f"bk{k}", c, random.uniform(0.15, 0.4), 1.2, 1.2), -9)
    render(nom)


ASSETS = {
    "titre": lambda: (a_titre("pl-titre", "LE PLATEAU"), a_titre("pl-titre-b", "ENTREZ EN SCÈNE")),
    "showtime": lambda: a_titre_showtime("pl-titre-showtime", "IT’S SHOWTIME!"),
    "ecrin": lambda: (a_ecrin("pl-ecrin"), a_ecrin("pl-ecrin-survol", True)),
    "socle": lambda: a_socle("pl-socle"),
    "faisceau": lambda: a_faisceau("pl-faisceau"),
    "fond": lambda: a_fond("pl-fond"),
}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for k in (argv or list(ASSETS)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        ASSETS[k]()
