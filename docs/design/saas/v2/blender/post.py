# Combine les passes Blender (_a opacité, _c couleur sur noir) -> renders/<nom>.png (alpha droit),
# puis export web assets/<nom>.webp. Halo léger optionnel (précalculé, jamais animé côté navigateur).
import os, sys, glob
import numpy as np
from PIL import Image, ImageFilter
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REN, AS = os.path.join(V2, "renders"), os.path.join(V2, "assets")
os.makedirs(AS, exist_ok=True)
HALO = {"pl-titre": 0.35, "pl-ecrin-survol": 1.0, "pl-socle": 0.3, "tuile": 0.3, "ecrin": 0.7, "barre": 0.5, "jauge": 0.6, "pied": 0.5, "cadre-jeu-survol": 0.6, "bouton-or": 0.35, "onglet": 0.35, "curseur": 0.5, "inter-on": 0.4}


def combine(nom):
    A = np.asarray(Image.open(os.path.join(REN, f"_{nom}_a.png")).convert("RGBA")).astype(np.float32) / 255
    C = np.asarray(Image.open(os.path.join(REN, f"_{nom}_c.png")).convert("RGB")).astype(np.float32) / 255
    k = next((v for p, v in HALO.items() if nom.startswith(p)), 0.0)
    if k:
        hi = np.clip((C.max(axis=2, keepdims=True) - 0.45) / 0.55, 0, 1) * C
        him = Image.fromarray((hi * 255).astype(np.uint8)); s = C.shape[1] / 1000
        g = sum(np.asarray(him.filter(ImageFilter.GaussianBlur(max(1, r * s)))).astype(np.float32) / 255 * w for r, w in [(4, 0.5), (14, 0.4), (40, 0.3)])
        C = 1 - (1 - C) * (1 - np.clip(g * k, 0, 1))
    a = np.maximum(A[..., 3:4], C.max(axis=2, keepdims=True))
    rgb = np.where(a > 1e-4, C / np.maximum(a, 1e-4), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), a], axis=2)
    if nom.startswith("pl-ecrin"):       # fenêtre de l'affiche (800x450 à 90 px) : transparente
        out[80:530, 80:880, :] = 0
    if nom.startswith("cadre-jeu"):      # fenêtre de l'image : totalement transparente
        out[92:538, 92:872, :] = 0
    im = Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")
    im.save(os.path.join(REN, nom + ".png"))
    p = os.path.join(AS, nom + ".webp"); im.save(p, "WEBP", quality=94, method=6, exact=True)
    print(nom, im.size, f"{os.path.getsize(p) / 1024:.0f} Ko")


if __name__ == "__main__":
    noms = sys.argv[1:] or sorted({os.path.basename(f)[1:-6] for f in glob.glob(os.path.join(REN, "_*_a.png"))})
    for n in noms: combine(n)
