# AnimaJet SaaS V2 — ressources d'interface rendues sous Cycles.
# blender -b --factory-startup --python build_ui.py -- tuile panneau bouton ...   (sans argument : tout)
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, aj_lib; importlib.reload(aj_lib)
from aj_lib import *

COUL = {
    "or": (1.0, 0.66, 0.18), "vert": (0.22, 0.95, 0.42), "cyan": (0.12, 0.68, 1.0),
    "violet": (0.62, 0.28, 1.0), "gris": (0.62, 0.62, 0.7), "rouge": (1.0, 0.22, 0.22),
}
OR = (1.0, 0.74, 0.34)
OR_CLAIR = (1.0, 0.86, 0.55)


def cadre_verre(w, h, r, coul, M, rim_t=5, lueur_bas=26.0, lavis=0.0, haut=2.6, rim_emit=0.35, metal=None, ep=12, cle=1.6):
    """Panneau de verre fumé CALME : fond uniforme (lisibilité du texte), liseré métallique teinté,
    éclat lumineux uniquement sur l'arête basse, reflet fin sur l'arête haute."""
    studio(w + 2 * M, h + 2 * M, cle=cle, couleur_bas=coul, s_bas=3.0)
    rim_rgb = metal or tuple(0.35 + 0.65 * c for c in coul)
    plaque("Verre", w - 2, h - 2, r - 1, ep, 7, mat_verre("verre", rough=0.45, coat=0.5, teinte=tuple(0.85 + 0.15 * c for c in coul)))
    anneau("Liseré", w, h, r, rim_t, ep + 4, rim_t * 0.48, mat_metal("lis", rim_rgb, 0.16, emit=coul, emit_s=rim_emit), prof=0.5)
    # éclat sur l'arête basse seulement (uniforme en largeur : pas de raccord visible en 9-slice)
    bande("Eclat", 0, -h / 2 + rim_t * 0.5, w * 0.92, 5, mat_lueur("ecl", tuple(min(1, 0.22 + c) for c in coul), lueur_bas * 0.8, 0.5, 1.4), ep + 6)
    bande("Voile", 0, -h / 2 + 2, w * 0.92, 12, mat_lueur("voi", coul, lueur_bas * 0.06, 0.5, 2.0), ep + 5.5)
    if lavis > 0:
        bande("Lavis", 0, -h / 2 + 40, w * 1.0, 110, mat_lueur("lav", coul, lavis, 1.6, 2.4), ep + 2)
    bande("Haut", 0, h / 2 - rim_t * 0.5, w * 0.92, 3, mat_lueur("hl", (1, 0.93, 0.8), haut * 0.6, 0.5, 1.3), ep + 6)


def a_tuile(nom, coul_key):
    W, H, R, M = 640, 240, 30, 64
    scene(W + 2 * M, H + 2 * M, 160)
    cadre_verre(W, H, R, COUL[coul_key], M)
    render(nom)


def a_puits(nom, coul_key):
    """Écrin creusé de l'icône (carré arrondi enfoncé, fond teinté)."""
    S, M = 120, 30
    scene(S + 2 * M, S + 2 * M, 128)
    c = COUL[coul_key]
    studio(S + 2 * M, S + 2 * M, cle=4.0, couleur_bas=c, s_bas=2.5)
    plaque("Fond", S - 6, S - 6, 24, 3, 2, mat_verre("f", base=tuple(0.02 + 0.10 * k for k in c), rough=0.45, teinte=c))
    anneau("Bord", S, S, 27, 6, 8, 3, mat_metal("b", tuple(0.25 + 0.45 * k for k in c), 0.3, emit=c, emit_s=0.15), prof=0.6)
    bande("Lav", 0, -S / 2 + 12, S * 0.8, 14, mat_lueur("l", c, 0.25, 1.5, 2), 4)
    render(nom)


def a_panneau(nom, coul=(1.0, 0.7, 0.25), rim=None, lueur=14.0, lavis=0.25):
    """Grand panneau (galerie, colonne droite, paramètres) : 9-slice."""
    W, H, R, M = 760, 520, 30, 64
    scene(W + 2 * M, H + 2 * M, 160)
    cadre_verre(W, H, R, coul, M, rim_t=4, lueur_bas=lueur, haut=2.4, rim_emit=0.18, metal=rim or OR)
    render(nom)


def a_bouton(nom, style):
    W, H, R, M = 360, 104, 22, 40
    scene(W + 2 * M, H + 2 * M, 160)
    studio(W + 2 * M, H + 2 * M, cle=5.0 if style == "or" else 2.4)
    if style == "or":   # or poli, bombé
        plaque("Corps", W, H, R, 10, 9, mat_metal("or", (1.0, 0.76, 0.30), 0.2, brosse=0.25, emit=(1, 0.7, 0.2), emit_s=0.25), prof=0.75)
        bande("Reflet", 0, H / 2 - 22, W * 0.86, 30, mat_lueur("rf", (1, 0.97, 0.85), 2.4, 1.6, 1.4), 12)
        bande("Bas", 0, -H / 2 + 6, W * 0.8, 10, mat_lueur("bs", (1, 0.75, 0.3), 6, 1.4, 1.6), 12)
    else:
        c = {"sombre": (0.85, 0.82, 0.9), "orf": OR, "cyan": COUL["cyan"], "rouge": COUL["rouge"], "violet": COUL["violet"]}[style]
        plaque("Corps", W - 2, H - 2, R - 1, 8, 6, mat_verre("v", base=(0.022, 0.019, 0.03), rough=0.3))
        anneau("Bord", W, H, R, 3, 11, 1.4, mat_metal("b", tuple(0.3 + 0.7 * k for k in c), 0.2, emit=c, emit_s=0.6 if style != "sombre" else 0.05))
        bande("Reflet", 0, H / 2 - 16, W * 0.9, 26, mat_lueur("rf", (1, 1, 1), 0.16, 1.6, 1.4), 9)
        if style != "sombre":
            bande("Bas", 0, -H / 2 + 3, W * 0.7, 6, mat_lueur("bs", c, 5, 1.3, 1.5), 12)
    render(nom)


def a_onglet_actif(nom):
    """Onglet / segment sélectionné : pastille or poli (plus plate que le bouton)."""
    W, H, R, M = 300, 84, 18, 34
    scene(W + 2 * M, H + 2 * M, 160)
    studio(W + 2 * M, H + 2 * M, cle=5.0)
    plaque("Corps", W, H, R, 7, 6, mat_metal("or", (1.0, 0.78, 0.34), 0.22, brosse=0.2, emit=(1, 0.7, 0.2), emit_s=0.3), prof=0.7)
    bande("Reflet", 0, H / 2 - 18, W * 0.85, 24, mat_lueur("rf", (1, 0.97, 0.85), 2.0, 1.6, 1.4), 9)
    render(nom)


def a_champ(nom):
    """Champ de saisie / rail : cuvette sombre en creux, arête basse éclairée."""
    W, H, R, M = 400, 88, 20, 20
    scene(W + 2 * M, H + 2 * M, 128)
    studio(W + 2 * M, H + 2 * M, cle=3.0)
    anneau("Lèvre", W, H, R, 7, 6, 3.2, mat_metal("l", (0.3, 0.27, 0.24), 0.62), prof=0.3)
    plaque("Fond", W - 10, H - 10, R - 5, 1, 0, mat_verre("f", base=(0.006, 0.005, 0.009), rough=0.6, coat=0.3), z=-2)
    bande("Arête", 0, -H / 2 + 4, W * 0.8, 3, mat_lueur("a", (1, 0.8, 0.45), 0.5, 1.3, 1.3), 8)
    render(nom)


ASSETS = {
    "tuiles": lambda: [a_tuile(f"tuile-{k}", k) for k in ("or", "vert", "cyan", "violet", "gris")],
    "puits": lambda: [a_puits(f"puits-{k}", k) for k in ("or", "vert", "cyan", "violet", "gris")],
    "panneaux": lambda: (a_panneau("panneau-or"), a_panneau("panneau-violet", coul=(0.62, 0.3, 1.0), rim=(0.82, 0.68, 1.0), lueur=12)),
    "boutons": lambda: [a_bouton(f"bouton-{s}", s) for s in ("sombre", "or", "orf", "cyan", "rouge", "violet")],
    "onglet": lambda: a_onglet_actif("onglet-actif"),
    "champ": lambda: a_champ("champ"),
}

import ressources; importlib.reload(ressources)
ASSETS.update(ressources.SPECIAUX)

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for k in (argv or list(ASSETS)):
        if k in ASSETS:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            ASSETS[k]()
        else:
            # rendu d'un seul élément : tuile-or, bouton-or, ...
            bpy.ops.wm.read_factory_settings(use_empty=True)
            t, v = k.split("-", 1)
            {"tuile": lambda: a_tuile(k, v), "puits": lambda: a_puits(k, v), "bouton": lambda: a_bouton(k, v)}[t]()
