# AnimaBingo · mode Tombola — proposition (rien n'est codé)

Fichiers de cette proposition :
- `docs/tombola/maquette.html` + `maquette.png` : choix du jeu, régie 1366×768, confirmation « Absent », grand écran (tirage et accueil), téléphone (4 états) ;
- `docs/tombola/20261124_bingo_tombola.sql` : migration **non appliquée** (brouillon, déplacée dans `supabase/migrations/` après validation).

## 1. Principe

La tombola est un **jeu AnimaBingo à part**, avec ses propres tables et sa propre fonction de régie. **Aucune fonction ni table du loto n'est modifiée** (`bingo_runtime`, `bingo_admin`, `bingo_public_state`, cartons…). Le loto classique et le loto musical restent donc exactement comme aujourd'hui.

Ce qui est partagé avec le loto :
- la colonne existante `sessions.bingo_active` (« AnimaBingo est à l'écran ») ;
- l'extinction des autres jeux au lancement ;
- le canal temps réel privé `bingo:<session>` de l'écran et de la régie, avec un nouvel événement « tombola » ;
- la boule, la machine et le décor du grand écran ;
- la télécommande (PageDown = tirer).

**Un seul jeu AnimaBingo à la fois.** Si un loto existe, la tombola ne démarre pas : la régie propose d'abord « Quitter le loto », et l'inverse vaut aussi. C'est ce qui permet de ne rien changer au loto.

## 2. Tickets

- **Papier** : une ou plusieurs plages, par exemple 1–250, ou 1–250 et 400–450. Numéros de 1 à 9 999, 20 plages au plus.
- **Téléphone** : l'invité scanne le QR de la soirée et reçoit automatiquement un numéro, affiché en grand (« Votre ticket : n° 312 »). Un seul ticket par téléphone.
  - Les numéros téléphone commencent à la **centaine suivant le papier** : 1–250 donne 301, 302, 303… L'animateur peut changer ce départ tant qu'aucun ticket n'est donné.
  - **Aucun conflit possible** : la base refuse toute plage papier qui atteint le premier numéro téléphone.
- Papier et téléphone peuvent être utilisés **ensemble**, ou l'un sans l'autre.
- **Pendant le tirage**, on peut **ajouter** des plages papier (tickets vendus en retard), jamais en retirer.
- **Téléphone rechargé** : le téléphone garde un jeton et la base ne stocke que son empreinte. Il retrouve donc toujours le même numéro, même après une panne ou une fois la distribution fermée.
- **Aucune donnée personnelle** : ni nom, ni pseudo. Il n'y a donc aucun champ de saisie côté invité, donc aucun risque de proposition de carte bancaire.

## 3. Tirage

- **Tirer** pioche au hasard (hasard fort, comme le loto) parmi les numéros distribués, papier et téléphone, qui ne sont **pas encore sortis**. Bouton à la souris, ou PageDown sur la télécommande.
- **Aucun doublon** : la base interdit qu'un numéro sorte deux fois (contrainte d'unicité). Un double clic ne tire jamais deux numéros, grâce au même garde-fou que le loto.
- Chaque numéro sorti devient un gagnant : **Lot 1, Lot 2, Lot 3…** dans l'ordre, sans nom de lot.
- **« Absent »** et **« Déjà gagnant »** s'appliquent au **dernier numéro sorti** seulement, à la souris, avec confirmation. Le numéro est retiré et le lot est remis en jeu au tirage suivant. Une erreur de clic peut être annulée (« remettre gagnant ») tant qu'on n'a pas tiré le numéro suivant.
- Le numéro de lot n'est **pas enregistré**, il est recalculé : c'est le rang parmi les gagnants. Il est donc toujours juste, même après un « Absent » ou une panne.
- **Fin de la distribution téléphone** : elle se ferme automatiquement au premier tirage. Voir la question 1.

## 4. Grand écran

- **Avant le tirage** : « TOMBOLA », le QR « Votre ticket sur votre téléphone », et le nombre de tickets papier et téléphone.
- **Pendant le tirage** :
  - la machine avec des boules tirées des **vrais numéros** de la tombola ;
  - le numéro sorti dans une grosse boule, avec **« LOT 12 »** ;
  - à droite, la liste des gagnants (les 12 derniers lots sur l'écran géant ; la régie en montre davantage).
- **Numéros au-delà de 90** : la boule s'adapte à 3 et 4 chiffres (taille du texte réduite), avec une couleur par numéro. La règle de couleur du loto (par dizaine, de 1 à 90) n'est pas réutilisée, elle s'arrête à 90.
- Comme pour le loto, le numéro apparaît au même instant sur l'écran et sur les téléphones, après 0,9 s de suspense.

## 5. Téléphone

- Le ticket est affiché en grand. Il est **« vivant »** (reflet animé), pour qu'une capture d'écran se repère.
- **Pendant le tirage** : nombre de lots attribués et dernier numéro sorti.
- **Quand son numéro sort** : « 🎉 Votre numéro est sorti ! Présentez-vous auprès de l'animateur ». Si l'animateur déclare ensuite le numéro absent : « Votre numéro est sorti mais a été déclaré absent ».
- **Distribution fermée** (nouveau téléphone) : « Le tirage a commencé : la distribution des tickets est terminée ».
- **Aucun temps réel** : lecture de l'état public toutes les 3 s, mise en cache 1 s par le CDN, comme AnimaBingo aujourd'hui.

## 6. Résistance aux pannes

Tout est en base : plages, tickets, numéros sortis, gagnants, absents. Les scénarios :
- **Régie fermée ou PC planté** : en rouvrant AnimaBingo, la régie retrouve la tombola à l'identique (même signal de vie que le loto, écran « en pause » après 90 s).
- **Autre jeu lancé entre-temps** : la tombola est seulement en pause. « Reprendre » la retrouve telle quelle.
- **Téléphone rechargé** : même numéro. S'il était sorti, l'écran « Votre numéro est sorti » revient.
- **Effacement** : seulement par « Terminer la tombola » (double confirmation), ou par la purge automatique après 24 h sans activité (même tâche planifiée que le loto). La suppression d'une session efface aussi sa tombola (cascade).

## 7. Migration (non appliquée)

`docs/tombola/20261124_bingo_tombola.sql` est additive, avec un bloc de retour arrière commenté.

**Tables nouvelles, fermées** (RLS sans policy, droits retirés à anon et authenticated) :
- `bingo_tombola` : une ligne par session (plages papier, départ téléphone, statut, signal de vie) ;
- `bingo_tombola_tickets` : tickets téléphone (numéro, empreinte du jeton) ;
- `bingo_tombola_draws` : numéros sortis dans l'ordre, avec gagnant, absent ou déjà gagnant.

**Fonctions serveur uniquement** (service_role) :
- `bingo_tombola_admin` : lancer ou reprendre, terminer, signal de vie, tickets, ouvrir ou fermer la distribution, tirer, absent ou déjà gagnant ;
- `bingo_tombola_ticket` : ticket téléphone, qui renvoie le même numéro au même jeton ;
- `bingo_tombola_public_state` et `bingo_tombola_notify` : état public et envoi à l'écran ;
- `bingo_tombola_purge_stale` : purge après 24 h sans activité.

**Ce qu'elle ne touche pas** : sessions (aucune colonne, aucun trigger) et les fonctions du loto.

## 8. Fichiers prévus

**Créés**
- `supabase/migrations/20261124_bingo_tombola.sql`
- `supabase/verif_20261124_bingo_tombola.sql`
- `src/lib/bingo/tombola.ts` : types, plages, départ téléphone, couleurs des boules au-delà de 90
- `src/lib/bingo/__tests__/tombola.test.ts`
- `src/lib/bingo/tombola-server.ts`
- `src/app/api/bingo/tombola/admin/route.ts` : régie, propriétaire seulement
- `src/app/api/bingo/tombola/state/route.ts` : état public, cache 1 s
- `src/app/api/bingo/tombola/ticket/route.ts` : ticket téléphone
- `src/app/admin/jeux/bingo/tombola/page.tsx` : régie
- `src/components/bingo/tombola/TombolaScreen.tsx`
- `src/components/bingo/tombola/TombolaPhone.tsx`
- `src/components/bingo/tombola/tombola.css`
- 2 ou 3 annonces vocales ElevenLabs (voix Claire), voir la question 2

**Modifiés (ajouts seulement)**
- `src/app/admin/jeux/bingo/page.tsx` et `src/components/bingo/regie/MusicPicker.tsx` : 3e choix « Tombola », et ouverture de la régie tombola si une tombola existe
- `src/app/api/bingo/admin/route.ts` : loto refusé tant qu'une tombola existe
- `src/app/api/bingo/status/route.ts` et `src/hooks/useBingoStatus.ts` : statut « tombola » quand aucun loto n'existe
- `src/components/games/BingoGame.tsx` : grand écran, affiche TombolaScreen en mode tombola
- `src/app/bingo/[code]/page.tsx` : téléphone, affiche TombolaPhone en mode tombola
- `src/app/invite/[code]/page.tsx` : une condition de plus pour qu'un téléphone qui a un ticket retourne à sa tombola
- `src/components/bingo/screen/Machine.tsx` : option facultative « numéros à montrer » (sans elle, comportement identique)
- `src/components/bingo/Ball.tsx` : taille du texte pour 3 et 4 chiffres (sans effet de 1 à 90)
- `src/app/api/cron/purge-bingo/route.ts` : appel de la purge tombola
- `src/lib/purge/account-purge.ts` : ajout de `bingo_tombola`

**Non touchés** : fonctions SQL du loto, cartons, vérification des quines, loto musical, photos, messages, autres jeux.

## 9. Risques

| Risque | Parade |
|---|---|
| L'invité vide son navigateur ou change de navigateur et reçoit un 2e ticket | La distribution est fermée au premier tirage, et il y a le bouton « Déjà gagnant ». Impossible d'empêcher totalement sans demander une identité, ce qui est hors du cahier des charges. |
| Capture d'écran du ticket d'un autre | Ticket « vivant » (reflet animé). L'animateur demande le téléphone. |
| Loto et tombola lancés en même temps (deux onglets) | Refus en base côté tombola (« loto_running »), refus par le serveur côté loto. |
| Annonce vocale des numéros au-delà de 90 | Les voix enregistrées vont de 1 à 90 : voir la question 2. |
| Couleur et taille des boules au-delà de 90 | Fonction de couleur propre à la tombola, et taille du texte adaptée (ajouts, aucun changement de 1 à 90). |
| Beaucoup de lots (plus de 50) | La régie montre les 30 derniers et le grand écran les 12 derniers, plus un bouton « Voir tous les gagnants ». La page ne défile pas. |
| Syntaxe SQL | Contrôlée à l'application (tout ou rien, une erreur n'applique rien). Utilise `int4multirange` (Postgres 14 ou plus, c'est le cas de Supabase). |

## 10. Tests prévus

Toujours en prod, sur compte et session jetables, supprimés ensuite.
- Tombola papier seule (1–250), téléphone seul, papier et téléphone ensemble (plusieurs plages, aucun conflit, plage refusée si elle chevauche les numéros téléphone).
- « Absent » et « Déjà gagnant » : numéro retiré, lot remis en jeu, annulation, refus sur un numéro qui n'est pas le dernier.
- 300 numéros tirés : aucun doublon, tous dans les numéros distribués, puis « tous les numéros sont sortis ».
- Double clic et tirages simultanés : jamais deux numéros.
- Panne de la régie en plein tirage (onglet fermé puis rouvert, signal de vie coupé) : reprise exacte.
- Autre jeu lancé puis tombola reprise.
- Téléphone rechargé (Android et iPhone) : même numéro, « Votre numéro est sorti » retrouvé.
- Distribution fermée au premier tirage.
- Grand écran : boules de 3 et 4 chiffres.
- Régie sans défilement en 1366×768 et 1920×1080.
- Non-régression du loto classique : lancement, tirage, quine, papier, et refus du loto pendant une tombola.
- Tests unitaires, build, diff. Pas de push sans ton feu vert.

## 11. Questions à valider

1. **Distribution téléphone** : fermeture automatique au premier tirage (recommandé, c'est plus juste), avec un bouton « Rouvrir » dans la régie pour les retardataires ?
2. **Voix** : les voix enregistrées vont de 1 à 90. Je propose deux annonces ElevenLabs (Claire) : « Et le numéro gagnant est… » avant chaque boule, et « Numéro absent, on tire à nouveau ! ». Le numéro lui-même est lu par l'animateur (pas de voix du navigateur). D'accord ?
3. **Départ des numéros téléphone** : à la centaine suivante (1–250 donne 301), ou juste après le papier (251) ?
