# AnimaJet SaaS V2 — page Paramètres « régie » : ressources préfixées « pa- » (n'écrasent rien de validé).
# blender -b --factory-startup --python parametres_res.py -- titre champ
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, aj_lib; importlib.reload(aj_lib)
from aj_lib import *
import plateau; importlib.reload(plateau)


def a_titre(nom, corps):
    """Même lettrage que « IT'S SHOWTIME! » (Segoe UI Black, or champagne), sans ornement : titre de page."""
    W, H = 1400, 200
    scene(W, H, 256)
    plateau.lumiere_titre(W, H)
    softbox("Reflet_diag", (W * U * 0.18, H * U * 0.5, 8), (W * U * 0.035, H * U * 2.4),
            (math.radians(-10), math.radians(10), math.radians(-30)), (1, 0.95, 0.85), 1.6)
    plateau.texte_champagne("Titre", corps, 1300, 0, 130)
    render(nom)


def a_champ(nom):
    """Champ de saisie : cuvette sombre, lèvre métal mat, arête basse chaude — sans reflet sur le fond."""
    W, H, R, M = 400, 88, 18, 20
    scene(W + 2 * M, H + 2 * M, 128)
    studio(W + 2 * M, H + 2 * M, cle=1.4)
    anneau("Levre", W, H, R, 5, 6, 2.4, mat_metal("l", (0.26, 0.22, 0.2), 0.55), prof=0.3)
    plaque("Fond", W - 8, H - 8, R - 4, 1, 0, mat_emis("f", (0.006, 0.005, 0.009), 1.0), z=-2)
    bande("Arete", 0, -H / 2 + 3, W * 0.9, 2.5, mat_lueur("a", (1, 0.72, 0.38), 0.6, 0.5, 1.3), 8)
    render(nom)


ASSETS = {"titre": lambda: a_titre("pa-titre", "PARAMÈTRES"), "champ": lambda: a_champ("pa-champ")}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for k in (argv or list(ASSETS)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        ASSETS[k]()
