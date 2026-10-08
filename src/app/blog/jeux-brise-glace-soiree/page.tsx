// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'jeux-brise-glace-soiree'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-10-08'
const MODIFIED = '2026-10-08'
const TITLE = 'Jeux brise-glace : 12 idées pour lancer une soirée où personne ne se connaît'
const DESCRIPTION =
  "Les invités ne se connaissent pas ? 12 jeux brise-glace simples, testés en soirée, pour que tout le monde se parle dès les premières minutes."
const HERO = '/images/games/matching-v2.png'

export const metadata: Metadata = {
  title: 'Jeux brise-glace : 12 idées pour lancer une soirée',
  description: DESCRIPTION,
  keywords: [
    'jeux brise-glace',
    'jeu brise-glace soirée',
    'jeu brise-glace adulte',
    'jeu pour faire connaissance',
    'icebreaker soirée',
    'animation soirée invités qui ne se connaissent pas',
    'jeu de groupe soirée',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Jeux brise-glace : 12 idées pour lancer une soirée',
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    locale: 'fr_FR',
    publishedTime: PUBLISHED,
    modifiedTime: MODIFIED,
    images: [{ url: HERO, width: 1672, height: 941, alt: TITLE }],
  },
}

const author = {
  name: 'Le fondateur d\'AnimaJet',
  role: 'DJ animateur, fondateur de MG Events Animation',
  bio: "Après des années à animer mariages et soirées derrière les platines, il a conçu AnimaJet pour faire participer toute la salle depuis un téléphone. Chaque conseil de cet article vient du terrain, testé en conditions réelles, soirée après soirée.",
  avatar: '/images/hero-animajet.png',
}

const faq = [
  {
    q: "Qu'est-ce qu'un jeu brise-glace ?",
    a: "C'est un jeu court, placé en début de soirée, dont le seul but est de faire parler entre eux des invités qui ne se connaissent pas. Il ne doit demander aucune compétence, ne mettre personne en difficulté et donner à chacun un sujet de conversation tout trouvé.",
  },
  {
    q: 'Combien de temps doit durer un jeu brise-glace ?',
    a: "Entre 5 et 15 minutes. Au-delà, l'énergie retombe et le jeu devient le programme de la soirée au lieu de la lancer. Mieux vaut deux jeux courts qu'un seul trop long.",
  },
  {
    q: 'Quel jeu brise-glace pour un grand groupe (plus de 50 personnes) ?',
    a: "Choisissez un jeu où tout le monde participe en même temps, sans passer à tour de rôle : le bingo humain, le « tu préfères » où l'on change de côté de la salle, ou un jeu sur téléphone comme Matching, qui fonctionne aussi bien à 20 qu'à 200 joueurs.",
  },
  {
    q: 'Comment faire participer les invités timides ?',
    a: "Évitez les jeux où une personne parle seule devant tout le monde. Préférez les formats en binôme ou les réponses anonymes depuis le téléphone : on participe sans s'exposer, et la conversation vient ensuite, naturellement.",
  },
  {
    q: 'Faut-il une application pour un jeu brise-glace sur téléphone ?',
    a: "Non. Avec AnimaJet, les invités scannent le QR code de la soirée avec l'appareil photo de leur téléphone et jouent directement dans leur navigateur, sans application ni compte à créer.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Idées de soirée',
  title: TITLE,
  intro:
    "Les premières minutes d'une soirée décident souvent de toute la suite. Si les invités restent en petits groupes qui ne se mélangent pas, il est très difficile de rattraper l'ambiance. Les <strong>jeux brise-glace</strong> servent exactement à ça&nbsp;: donner à chacun une raison simple d'aller parler à quelqu'un qu'il ne connaît pas. Voici 12 idées testées en soirée, du jeu sans matériel au jeu sur téléphone, avec pour chacune le bon moment et le bon nombre de participants.",
  heroImage: HERO,
  heroAlt: 'Jeu brise-glace Matching : les invités découvrent leurs points communs sur écran géant',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '8 min',
  author,
  sections: [
    {
      id: 'bon-brise-glace',
      heading: "Ce qui fait un bon jeu brise-glace",
      body: [
        "Un bon <strong>jeu brise-glace</strong> respecte trois règles. Il est <em>court</em>&nbsp;: 5 à 15 minutes, pas plus. Il est <em>sans risque</em>&nbsp;: personne ne doit se retrouver seul au centre de la salle à devoir être drôle. Et surtout, il <em>laisse quelque chose derrière lui</em>&nbsp;: un prénom, un point commun, une anecdote, bref, un sujet de conversation pour la suite de la soirée.",
        "Le piège classique est de choisir un jeu amusant à regarder mais qui ne crée aucun lien entre les invités. Un jeu brise-glace réussi, ce n'est pas celui dont on rit le plus, c'est celui après lequel les gens continuent à se parler.",
      ],
      table: {
        head: ['Situation', 'Jeux conseillés', 'Matériel'],
        rows: [
          ['Moins de 20 invités', 'Deux vérités un mensonge, le post-it sur le front', 'Post-it, stylos'],
          ['20 à 80 invités', 'Bingo humain, 3 points communs en 2 minutes', 'Grilles imprimées'],
          ['Plus de 80 invités', 'Matching, tu préfères dans la salle, quiz par équipes', 'Écran ou rien'],
          ['Invités timides', 'Matching, binômes, réponses anonymes au téléphone', 'Téléphones'],
        ],
      },
    },
    {
      id: 'sans-materiel',
      heading: 'Les jeux brise-glace sans matériel',
      body: [
        "Ils se lancent en une phrase et marchent partout&nbsp;: dans un salon, au vin d'honneur, dans une salle de séminaire.",
      ],
      subsections: [
        {
          heading: '1. Trois points communs en deux minutes',
          body: [
            "On forme des binômes de personnes qui ne se connaissent pas. Consigne&nbsp;: trouver trois points communs en deux minutes, mais interdit de citer les évidences («&nbsp;on est tous les deux à cette soirée&nbsp;»). Au signal, on change de binôme. Trois tours suffisent pour que chacun ait parlé à trois inconnus.",
          ],
        },
        {
          heading: "2. Le « tu préfères » dans la salle",
          body: [
            "Vous posez une question à deux choix («&nbsp;Mer ou montagne&nbsp;?&nbsp;»), et chacun va se placer du côté gauche ou droit de la salle. Les invités voient immédiatement qui pense comme eux, et ils se retrouvent physiquement à côté. Très efficace avec un grand groupe, à condition d'avoir de la place.",
          ],
        },
        {
          heading: '3. Deux vérités, un mensonge',
          body: [
            "Chacun énonce trois affirmations sur lui-même, dont une fausse&nbsp;; les autres doivent trouver laquelle. Idéal en petit comité (moins de 15 personnes), car chacun passe à son tour. Au-delà, le jeu devient long et les derniers passent devant une salle qui décroche.",
          ],
        },
        {
          heading: '4. La ligne silencieuse',
          body: [
            "Les invités doivent se ranger en ligne par date d'anniversaire (jour et mois), sans prononcer un mot. Ils doivent mimer, montrer des doigts, se débrouiller. On vérifie à voix haute à la fin&nbsp;: les erreurs font toujours rire, et on découvre qui est né le même mois que soi.",
          ],
        },
      ],
    },
    {
      id: 'petit-materiel',
      heading: 'Les jeux brise-glace avec un peu de matériel',
      body: [
        "Quelques feuilles et des stylos suffisent. Préparez-les à l'avance, c'est ce qui fait la différence entre un jeu fluide et cinq minutes de flottement.",
      ],
      subsections: [
        {
          heading: '5. Le bingo humain',
          body: [
            "Chaque invité reçoit une grille de cases du type «&nbsp;Trouve quelqu'un qui a déjà vécu à l'étranger&nbsp;» ou «&nbsp;… qui joue d'un instrument&nbsp;». Il faut faire signer chaque case par une personne différente. Le premier qui complète une ligne gagne. C'est l'un des meilleurs jeux pour les groupes de 20 à 80 personnes&nbsp;: tout le monde circule en même temps.",
          ],
        },
        {
          heading: '6. Le post-it sur le front',
          body: [
            "On colle sur le front de chaque invité le nom d'un personnage célèbre qu'il ne voit pas. Il doit le deviner en posant des questions fermées aux autres. Le jeu oblige à aller vers les gens, et il se joue en continu pendant l'apéritif, sans que personne n'ait besoin d'arrêter de manger ou de boire.",
          ],
        },
        {
          heading: "7. L'objet mystère",
          body: [
            "Chaque invité apporte (ou reçoit à l'entrée) un petit objet qui raconte quelque chose de lui. On les mélange sur une table, et chacun doit retrouver à qui appartient l'objet qu'il a tiré. Un jeu plus lent, parfait pour un dîner où l'on a le temps.",
          ],
        },
      ],
    },
    {
      id: 'telephone',
      heading: 'Les jeux brise-glace sur téléphone et écran géant',
      body: [
        "Dès que le groupe dépasse la cinquantaine de personnes, les jeux à tour de rôle ne fonctionnent plus. Les jeux sur téléphone règlent ce problème&nbsp;: tout le monde joue en même temps, et les résultats s'affichent en grand pour toute la salle. Les invités scannent un QR code, sans application à installer.",
      ],
      subsections: [
        {
          heading: '8. Matching, le jeu des points communs',
          body: [
            "C'est le jeu que nous avons conçu spécialement pour briser la glace. Vous posez des questions légères («&nbsp;Ton apéro idéal&nbsp;?&nbsp;», «&nbsp;L'ananas sur la pizza&nbsp;?&nbsp;»), chacun répond depuis son téléphone, et la salle découvre ses tendances sur l'écran géant&nbsp;: «&nbsp;68&nbsp;% de la salle rêve d'une terrasse au soleil&nbsp;».",
            "Le moment fort arrive à la fin&nbsp;: chaque joueur découvre <strong>en privé</strong> sur son téléphone les 5 personnes qui ont répondu le plus comme lui. «&nbsp;J'ai 80&nbsp;% de points communs avec Luna. C'est qui, Luna&nbsp;?&nbsp;» Et les conversations démarrent toutes seules. Personne ne voit les réponses des autres, et apparaître dans le classement des autres reste facultatif. Comptez environ 8 minutes pour 10 questions. Tous les détails sur la page <a href=\"/jeu-points-communs\">Matching, le jeu des points communs</a>.",
          ],
        },
        {
          heading: '9. Le quiz par équipes mélangées',
          body: [
            "Un quiz classique, mais avec une règle&nbsp;: les équipes sont formées au hasard, pas par tables d'amis. Pour répondre, il faut bien se parler. Avec un <a href=\"/quiz-interactif\">quiz interactif</a>, les réponses se font depuis les téléphones et le classement s'affiche en direct, sans comptage de points à la main.",
          ],
        },
        {
          heading: '10. Le blind test',
          body: [
            "La musique est le brise-glace le plus universel qui soit&nbsp;: tout le monde a un avis, et chacun réagit au même moment. Un <a href=\"/blind-test-musical\">blind test musical</a> où l'on buzze depuis son téléphone fait chanter une salle entière en quelques minutes.",
          ],
        },
        {
          heading: '11. Le Bon Ordre en deux équipes',
          body: [
            "Deux équipes s'affrontent pour remettre des éléments dans le bon ordre (dates, tailles, prix…). Le format oblige les membres d'une même équipe à débattre ensemble. À utiliser une fois que les premiers contacts sont faits, pour souder les groupes. Voir <a href=\"/le-bon-ordre\">Le Bon Ordre</a>.",
          ],
        },
        {
          heading: '12. Le défi photo en équipe',
          body: [
            "On donne à chaque équipe une liste de photos à prendre («&nbsp;une pyramide humaine&nbsp;», «&nbsp;quelqu'un qui porte les lunettes d'un autre&nbsp;»). Les photos s'affichent en direct sur l'écran grâce au <a href=\"/partage-photo-evenement\">partage photo</a>, et la salle vote pour la plus réussie.",
          ],
        },
      ],
    },
    {
      id: 'ordre',
      heading: 'Dans quel ordre enchaîner les jeux ?',
      body: [
        "L'ordre compte autant que le choix des jeux. Commencez par un jeu <strong>sans exposition</strong>, où chacun participe sans être regardé&nbsp;: Matching, le bingo humain ou le «&nbsp;tu préfères&nbsp;» dans la salle. C'est ce qui crée les premiers contacts.",
        "Une fois que les invités se sont un peu parlé, passez à un jeu <strong>en équipe</strong> (quiz, blind test, Le Bon Ordre). Les équipes fonctionnent beaucoup mieux quand leurs membres ont déjà échangé deux phrases. Gardez les jeux où une personne passe seule devant tout le monde pour plus tard, quand l'ambiance est installée.",
      ],
      cards: [
        { title: '1. Faire connaissance', desc: 'Matching, bingo humain, tu préfères : tout le monde joue, personne ne s’expose.' },
        { title: '2. Jouer ensemble', desc: 'Quiz et blind test par équipes mélangées pour souder les groupes.' },
        { title: '3. S’amuser en grand', desc: 'Défis, photo en direct et jeux de scène une fois l’ambiance lancée.' },
      ],
    },
    {
      id: 'avis-dj',
      heading: "Le point de vue d'un DJ animateur",
      body: [
        "Ce que j'ai appris en soirée&nbsp;: les invités n'ont presque jamais besoin d'être convaincus de s'amuser, ils ont besoin d'un <em>prétexte</em> pour faire le premier pas. Personne n'ose aborder un inconnu en lui disant «&nbsp;bonjour, parlons&nbsp;». Mais «&nbsp;il paraît qu'on a 8 réponses identiques sur 10&nbsp;», tout le monde ose.",
        "C'est pour ça que nous avons créé Matching&nbsp;: un jeu dont la fin ne s'arrête pas à l'écran, mais se prolonge dans la salle. Pour composer le reste de votre soirée, consultez le <a href=\"/animations-interactives-evenementielles\">guide des animations interactives</a>.",
      ],
    },
  ],
  faq,
  related: [
    { label: 'Matching, le jeu des points communs', href: '/jeu-points-communs' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Blind test musical', href: '/blind-test-musical' },
    { label: 'Animation de soirée privée', href: '/animation-soiree-privee' },
    { label: "Idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
    { label: "Idées d'animation pour soirée d'entreprise", href: '/blog/animation-soiree-entreprise-idees' },
  ],
  cta: {
    title: 'Lancez votre soirée avec Matching',
    text: 'Vos invités répondent depuis leur téléphone et découvrent avec qui ils ont le plus de points communs, sans application. Testez AnimaJet gratuitement pendant 24h.',
  },
}

const jsonLd = buildBlogJsonLd({
  slug: SLUG,
  title: TITLE,
  description: DESCRIPTION,
  image: HERO,
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  author: { name: author.name, role: author.role },
  faq,
})

export default function Page() {
  return <BlogArticle content={content} jsonLd={jsonLd} />
}
