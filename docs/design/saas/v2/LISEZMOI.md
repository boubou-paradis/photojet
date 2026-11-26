# AnimaJet SaaS — maquette V2 (tableau de bord, Jeux, Paramètres)

Statut : **les 3 pages sont validées (26/11)** : `tableau-de-bord.html`, `jeux-plateau.html` et `parametres-regie.html`. Aucun fichier de `src/` n'a été modifié. Aucune connexion à Supabase, aucun commit, aucun push, aucun déploiement.

## Ouvrir la maquette

```
cd docs/design/saas/v2
python -m http.server 5191 --bind 127.0.0.1
```

Pages à ouvrir :
- http://127.0.0.1:5191/tableau-de-bord.html
- http://127.0.0.1:5191/jeux.html
- http://127.0.0.1:5191/parametres.html

Données fictives uniquement.

## Méthode

- **Les matières viennent de Blender Cycles (OptiX)** : verre fumé, liserés teintés, biseaux, or poli, tôle brossée, grille perforée, écrin du QR, cadres de jeux, interrupteurs, curseur, jauge, médaillon et pied de page. Les scripts sont dans `blender/`. Le fichier `aj_lib.py` contient les outils communs, `build_ui.py` et `ressources.py` décrivent les ressources, `post.py` combine les deux passes et ajoute le halo.
- **Le CSS ne s'occupe que de la mise en page, du texte et des états.** Les ressources sont posées en 9-slice (`border-image`), ce qui évite toute déformation des angles, quelle que soit la taille.
- **Éléments dynamiques en code** : chiffres, photos, QR, onglets, jauge de connexion et boutons.
- **Visuels des jeux inchangés** : ce sont les images d'origine, simplement placées dans les cadres. Le badge « Notice » est posé sur l'arête du cadre pour ne jamais masquer un visuel.

Rendu utilisé : ressources en 2x. Re-rendu : `blender -b --factory-startup --python blender/build_ui.py -- <groupe>`, puis `python blender/post.py`.

## Contrôle qualité (Chrome DevTools)

Captures dans `captures/` :
- `comparaison-reference-v2.jpg` : ta maquette et la V2 côte à côte, au même cadrage (1672×941) ;
- `passe1` à `passe5` : les passes de correction successives.

Résolutions vérifiées :
- tableau de bord en 1366×768, 1672×941 et 1920×1080, sans défilement ;
- Jeux en 1672×941 et 1366×768 ;
- Paramètres en 1672×941, page complète.

## Points ouverts

- Poids non optimisé : la qualité passe d'abord, l'optimisation viendra après validation.
- La barre et le pied de page sont communs à **toutes** les pages admin, régies des jeux comprises. Leur intégration touchera donc `admin-layout-client.tsx` et `Footer.tsx`, qui sont des composants partagés. Cela demandera ton accord explicite.

## Page Jeux — proposition « Le Plateau » (26/11)

Le tableau de bord est **validé et n'a pas été modifié**, pas plus que `saas.css` et `commun.js`.

- **Page** : `jeux-plateau.html`. L'ancienne version `jeux.html` est conservée pour comparer.
- **Variantes de titre** : `?titre=b` affiche « Entrez en scène ».
- **Démonstration du survol** : `?survol=N` force le survol de la carte N.
- **Ressources Blender** : `blender/plateau.py`, qui produit les fichiers `assets/pl-*` :
  - titre en lettres d'or (Bodoni) ;
  - écrin laqué à double filet d'or, avec sa version survol ;
  - socle porte-nom ;
  - faisceau de projecteur ;
  - fond de plateau.
- **Comparaison** : `captures/comparaison-jeux.jpg`.
- **Visuels des jeux** : inchangés.
- **Titre (26/11)** : « IT’S SHOWTIME! », titre retenu. Lettrage Segoe UI Black, or champagne poli, léger relief, rendu Blender (`assets/pl-titre-showtime.webp`). Le reste de la page est **validé** et inchangé.

## Page Paramètres — proposition « Régie » (26/11)

- **Page** : `parametres-regie.html`. L'ancienne `parametres.html` est conservée pour comparaison.
- **Sommaire fixe à gauche**, groupé par usage (Événement, Grand écran, Borne & impression, Invités, Compte). Il suit le défilement et un point vert signale les modules actifs. `?section=<id>` ouvre directement une section.
- **Titre** : « PARAMÈTRES » au même lettrage que « IT’S SHOWTIME! » (`assets/pa-titre.webp`). Champ de saisie rendu dans Blender (`assets/pa-champ.webp`). Script : `blender/parametres_res.py`.
- **Réglages** : tous ceux de la vraie page sont repris. Une section désactivée (Impression) s'estompe.
- **Contrôle** : vérifié en 1672×941 et 1366×768, sans défilement de la page ni débordement horizontal.
- `saas.css` et `commun.js` ne sont **pas modifiés** (surcharges locales uniquement).
