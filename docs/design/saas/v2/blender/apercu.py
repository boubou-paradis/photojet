# Aperçu : pose les rendus RGBA sur fond sombre (planche) pour contrôle visuel.
import sys, os
from PIL import Image
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
noms = sys.argv[1:]
ims = [Image.open(os.path.join(V2, "renders", n + ".png")).convert("RGBA") for n in noms]
W = max(i.width for i in ims); H = sum(i.height for i in ims) + 10 * len(ims)
c = Image.new("RGBA", (W, H), (8, 6, 12, 255)); y = 0
for i in ims: c.alpha_composite(i, (0, y)); y += i.height + 10
c.convert("RGB").save(os.path.join(V2, "renders", "_apercu.jpg"), quality=92); print(c.size)
