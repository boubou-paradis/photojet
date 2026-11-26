# AnimaJet SaaS V2 — ressources spéciales : bandeau, écrin QR, cadres de jeux, commandes, pied de page.
import bpy, math, random
from aj_lib import *

OR_POLI = (1.0, 0.76, 0.33)


def a_barre(nom):
    """Bandeau 3840 x 160 (CSS 1920 x 80), d'après la maquette : métal prune sombre brossé sous le logo
    (contraste maximal), courbe lumineuse or/violet après le texte, panneau bronze texturé à pan coupé,
    tôle noire brossée au centre, grille perforée biseautée à droite, filet or/violet en bas."""
    W, H = 3840, 160
    scene(W, H, 192)
    studio(W, H, cle=4.0)
    Y0, Y1 = -H / 2, H / 2
    polygone("Tole", [(-W / 2 - 20, Y0 + 6), (W / 2 + 20, Y0 + 6), (W / 2 + 20, Y1 + 20), (-W / 2 - 20, Y1 + 20)], 6, 0,
             mat_metal("tole", (0.035, 0.032, 0.042), 0.34, brosse=0.35, aniso=0.5))
    # zone logo : prune très sombre brossée, jusqu'à la courbe
    x0, x1 = -W / 2 + 600, -W / 2 + 900
    courbe = [(x0 + (x1 - x0) * (i / 16), Y0 + 8 + (Y1 - Y0 + 10) * (0.5 - 0.5 * math.cos(math.pi * i / 16))) for i in range(17)]
    polygone("Prune", [(-W / 2 - 20, Y0 + 8)] + courbe + [(-W / 2 - 20, Y1 + 20)], 10, 3,
             mat_metal("prune", (0.03, 0.018, 0.036), 0.38, brosse=0.9, aniso=0.7), z=6, prof=0.6)
    # panneau bronze texturé entre la courbe et un pan coupé
    p0, p1 = -W / 2 + 1040, -W / 2 + 1180
    bronze = [(x0 + 20, Y0 + 8), (p0, Y0 + 8), (p1, Y1 + 20)] + [(p[0] + 20, p[1]) for p in reversed(courbe)][:-1]
    polygone("Bronze", bronze, 8, 3, mat_metal("bronze", (0.16, 0.105, 0.05), 0.4, brosse=0.9, aniso=0.6), z=5, prof=0.6)
    # courbe lumineuse : cœur or + aura violette, plus intense en bas
    ruban("CourbeViolet", [(x0 - 260, Y0 + 6)] + courbe, 34, (0.6, 0.22, 1.0), 2.2, 22, 0.9, 2.6)
    ruban("CourbeOr", [(x0 - 200, Y0 + 9)] + [(p[0] + 6, p[1]) for p in courbe], 5, (1.0, 0.72, 0.35), 5, 23, 0.6, 1.6)
    ruban("ArretePan", [(p0 + 4, Y0 + 8), (p1 + 4, Y1 + 20)], 5, (1.0, 0.72, 0.35), 4, 21, 0.7, 1.6)
    gx0, gx1 = W / 2 - 1020, W / 2 - 560
    polygone("Grille", [(gx0 + 110, Y0 + 10), (gx1 - 110, Y0 + 10), (gx1, Y1 + 20), (gx0, Y1 + 20)], 10, 5, mat_grille("grille"), z=6, prof=0.5)
    polygone("Chanfrein", [(gx1 - 100, Y0 + 10), (gx1 - 84, Y0 + 10), (gx1 + 16, Y1 + 20), (gx1, Y1 + 20)], 13, 3,
             mat_metal("ch", (0.5, 0.47, 0.55), 0.25), z=6)
    ruban("Biais", [(W / 2 - 520, Y0 - 5), (W / 2 - 420, Y1 + 10)], 8, (0.75, 0.55, 1.0), 9, 22, 0.9, 1.6)
    polygone("Filet", [(-W / 2 - 20, Y0), (W / 2 + 20, Y0), (W / 2 + 20, Y0 + 4), (-W / 2 - 20, Y0 + 4)], 4, 1.5,
             mat_metal("filet", OR_POLI, 0.2, emit=(1, 0.62, 0.18), emit_s=0.15), z=6)
    ruban("FiletOr", [(-W / 2, Y0 + 3), (x0, Y0 + 3)], 8, (1.0, 0.6, 0.15), 2, 24, 0.6, 2.0)
    ruban("FiletChaud", [(x0 - 200, Y0 + 3), (x0 + 120, Y0 + 3)], 10, (1.0, 0.7, 0.4), 3, 24.5, 0.6, 2.4)
    ruban("FiletViolet", [(W / 2 - 1500, Y0 + 3), (W / 2, Y0 + 3)], 14, (0.6, 0.3, 1.0), 4, 24, 0.6, 2.0)
    render(nom)


def _arc(cx, cy, rx, ry, a0, a1, n=9):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / (n - 1))), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / (n - 1)))) for i in range(n)]


def a_ecrin(nom):
    """Écrin du QR : cadre or poli épais à fenêtre (QR blanc en HTML dessous), volutes lumineuses et paillettes."""
    W, H = 1280, 1000
    FEN, T = 560, 46
    scene(W, H, 256)
    studio(W, H, cle=5.0)
    o = FEN + 2 * T
    cadre_libre("Ecrin", o, o, 64, FEN, FEN, 26, 0, 22, 14, mat_metal("or", OR_POLI, 0.16, brosse=0.2, emit=(1, 0.65, 0.2), emit_s=0.35), z=10, prof=0.62)
    cadre_libre("Levre", FEN + 14, FEN + 14, 32, FEN, FEN, 26, 0, 8, 3, mat_metal("levre", (0.3, 0.22, 0.1), 0.3), z=8)
    bande("Halo", 0, 0, o * 1.9, o * 1.9, mat_lueur("halo", (1.0, 0.62, 0.18), 0.22, 3.0, 3.0), 2)
    ruban("VoluteOr", _arc(-40, -30, 590, 300, 205, 340), 30, (1.0, 0.66, 0.2), 6, 4, 0.8, 2.0)
    ruban("VoluteOrFil", _arc(-40, -30, 590, 300, 205, 340), 6, (1.0, 0.88, 0.6), 14, 4.5, 0.8, 1.5)
    ruban("VoluteOr2", _arc(20, 40, 560, 380, 160, 230), 6, (1.0, 0.62, 0.2), 6, 4.5, 0.8, 1.5)
    ruban("VoluteViolet", _arc(60, 20, 580, 330, -40, 60), 30, (0.62, 0.28, 1.0), 6, 4, 0.8, 2.0)
    ruban("VoluteVioletFil", _arc(60, 20, 580, 330, -40, 60), 6, (0.85, 0.65, 1.0), 13, 4.5, 0.8, 1.5)
    rnd = random.Random(4)
    for i in range(140):
        a = math.radians(rnd.uniform(195, 350) if i % 3 else rnd.uniform(-45, 70))
        rr = rnd.uniform(0.86, 1.14)
        x = -40 + 590 * rr * math.cos(a); y = -30 + 300 * rr * math.sin(a)
        if abs(x) < o / 2 + 10 and abs(y) < o / 2 + 10: continue
        sphere_lum(f"P{i}", x, y, 5, rnd.uniform(1.2, 3.2), (1.0, 0.8, 0.4) if i % 3 else (0.8, 0.6, 1.0), rnd.uniform(4, 14))
    render(nom)


def a_cadre_jeu(nom, survol=False):
    """Cadre de carte de jeu (9-slice) : tôle noire brossée, lèvre or autour de l'image 16:9,
    bandeau-titre en bas avec filet or, équerres or aux coins."""
    IW, IH = 800, 450
    BORD, BAS = 30, 84
    OW, OH = IW + 2 * BORD, IH + BORD + BAS
    M = 60
    scene(OW + 2 * M, OH + 2 * M, 192)
    studio(OW + 2 * M, OH + 2 * M, cle=5.0, couleur_bas=(0.6, 0.3, 1.0), s_bas=2.0)
    icy = (BAS - BORD) / 2
    cadre_libre("Tole", OW, OH, 26, IW, IH, 12, icy, 14, 6, mat_metal("tole", (0.05, 0.045, 0.06), 0.3, brosse=0.5, aniso=0.6), prof=0.55)
    lv = cadre_libre("LevreOr", IW + 18, IH + 18, 17, IW, IH, 12, 0, 9, 4.5, mat_metal("or", OR_POLI, 0.15, emit=(1, 0.65, 0.2), emit_s=0.5 if survol else 0.2), z=12, prof=0.6)
    lv.location.y = icy * U
    anneau("Liseré", OW, OH, 26, 3, 16, 1.4, mat_metal("lis", (1.0, 0.8, 0.45), 0.2, emit=(1, 0.7, 0.3), emit_s=0.6 if survol else 0.12))
    bande("FiletTitre", 0, -OH / 2 + BAS - 6, IW * 0.9, 4, mat_lueur("ft", (1.0, 0.75, 0.3), 6 if survol else 3, 1.2, 1.5), 17)
    # rivets or aux quatre coins du cadre
    for sx in (-1, 1):
        for sy in (-1, 1):
            plaque(f"Rivet{sx}{sy}", 12, 12, 6, 5, 4, mat_metal(f"rv{sx}{sy}", OR_POLI, 0.15, emit=(1, 0.7, 0.3), emit_s=0.5 if survol else 0.15), z=14, seg=10, prof=0.8).location = (sx * (OW / 2 - BORD / 2) * U, (sy * (OH / 2 - BORD / 2) if sy > 0 else -OH / 2 + BAS / 2) * U, 0)
    if survol:
        bande("Aura", 0, 0, OW * 1.08, OH * 1.1, mat_lueur("au", (1.0, 0.7, 0.25), 0.5, 0.6, 0.6), -2)
    render(nom)


def a_interrupteur(nom, on):
    W, H, M = 104, 56, 22
    scene(W + 2 * M, H + 2 * M, 192)
    studio(W + 2 * M, H + 2 * M, cle=4.0)
    if on:
        plaque("Rail", W, H, H / 2, 6, 3, mat_metal("r", (1.0, 0.74, 0.3), 0.25, brosse=0.2, emit=(1, 0.62, 0.15), emit_s=0.9), prof=0.3)
        bande("Lueur", 0, 0, W * 1.3, H * 1.6, mat_lueur("lu", (1.0, 0.7, 0.25), 0.8, 1.2, 1.2), -1)
    else:
        anneau("Rail", W, H, H / 2, 4, 6, 2, mat_metal("r", (0.3, 0.28, 0.34), 0.3), prof=0.4)
        plaque("Fond", W - 6, H - 6, H / 2 - 3, 2, 0, mat_verre("f", base=(0.01, 0.009, 0.013)))
    kx = (W / 2 - H / 2) * (1 if on else -1)
    b = plaque("Bouton", H - 10, H - 10, (H - 10) / 2, 12, 10, mat_metal("b", (0.11, 0.09, 0.08) if on else (0.85, 0.84, 0.9), 0.2), z=4, prof=0.85)
    b.location.x = kx * U
    render(nom)


def a_curseur(nom):
    S, M = 44, 26
    scene(S + 2 * M, S + 2 * M, 192)
    studio(S + 2 * M, S + 2 * M, cle=5.0)
    bande("Lueur", 0, 0, S * 2.2, S * 2.2, mat_lueur("lu", (1.0, 0.7, 0.25), 0.9, 1.2, 1.2), -1)
    plaque("Bouton", S, S, S / 2, 14, 12, mat_metal("b", (1.0, 0.78, 0.36), 0.16, brosse=0.15, emit=(1, 0.65, 0.2), emit_s=0.3), prof=0.85)
    plaque("Centre", 14, 14, 7, 1, 0.5, mat_metal("c", (0.35, 0.25, 0.1), 0.3), z=14)
    render(nom)


def a_jauge(nom):
    W, H, M = 400, 16, 26
    scene(W + 2 * M, H + 2 * M, 160)
    studio(W + 2 * M, H + 2 * M, cle=5.0)
    bande("Lueur", 0, 0, W * 1.08, H * 3.2, mat_lueur("lu", (1.0, 0.7, 0.22), 1.4, 0.4, 1.6), -1)
    plaque("Tube", W, H, H / 2, 8, 7, mat_metal("t", (1.0, 0.78, 0.34), 0.15, emit=(1, 0.66, 0.2), emit_s=1.2), prof=0.9)
    render(nom)


def a_medaillon(nom):
    S, M = 104, 28
    scene(S + 2 * M, S + 2 * M, 192)
    studio(S + 2 * M, S + 2 * M, cle=5.0)
    bande("Lueur", 0, 0, S * 1.7, S * 1.7, mat_lueur("lu", (1.0, 0.7, 0.25), 0.5, 1.2, 1.2), -1)
    plaque("Disque", S, S, S / 2, 6, 3, mat_metal("d", (0.42, 0.3, 0.12), 0.35, brosse=0.4), prof=0.5, seg=24)
    anneau("Bord", S, S, S / 2, 6, 10, 3, mat_metal("b", (1.0, 0.78, 0.36), 0.15, emit=(1, 0.65, 0.2), emit_s=0.4), prof=0.8, seg=24)
    render(nom)


def a_pied(nom):
    W, H = 3840, 120
    scene(W, H, 128)
    studio(W, H, cle=3.0)
    polygone("Bande", [(-W / 2 - 20, -H / 2 - 20), (W / 2 + 20, -H / 2 - 20), (W / 2 + 20, H / 2 - 14), (-W / 2 - 20, H / 2 - 14)], 4, 2,
             mat_metal("b", (0.03, 0.026, 0.036), 0.4, brosse=0.25, aniso=0.4))
    ruban("Arete", [(-W / 2 + 300, H / 2 - 16), (W / 2 - 300, H / 2 - 16)], 10, (1.0, 0.75, 0.35), 5, 8, 0.7, 2.0)
    ruban("AreteV", [(W / 2 - 1400, H / 2 - 16), (W / 2 - 300, H / 2 - 16)], 12, (0.7, 0.4, 1.0), 6, 8.5, 0.8, 2.0)
    render(nom)


def a_vignette(nom):
    W, M = 300, 16
    scene(W + 2 * M, W + 2 * M, 128)
    studio(W + 2 * M, W + 2 * M, cle=4.0)
    anneau("Cadre", W, W, 22, 6, 8, 3, mat_metal("c", (0.3, 0.27, 0.33), 0.25), prof=0.6)
    bande("Reflet", 0, W / 2 - 4, W * 0.7, 3, mat_lueur("r", (1, 0.95, 0.85), 1.8, 1.3, 1.3), 9)
    render(nom)


SPECIAUX = {
    "barre": lambda: a_barre("barre"),
    "ecrin": lambda: a_ecrin("ecrin-qr"),
    "jeu": lambda: (a_cadre_jeu("cadre-jeu"), a_cadre_jeu("cadre-jeu-survol", True)),
    "inter": lambda: (a_interrupteur("inter-on", True), a_interrupteur("inter-off", False)),
    "curseur": lambda: a_curseur("curseur"),
    "jauge": lambda: a_jauge("jauge-or"),
    "medaillon": lambda: a_medaillon("medaillon"),
    "pied": lambda: a_pied("pied"),
    "vignette": lambda: a_vignette("vignette"),
}
