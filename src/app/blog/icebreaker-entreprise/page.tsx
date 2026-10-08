// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'icebreaker-entreprise'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-10-08'
const MODIFIED = '2026-10-08'
const TITLE = 'Icebreaker en entreprise : 10 activités pour séminaire, réunion et team building'
const DESCRIPTION =
  "10 icebreakers pour un séminaire, une réunion ou un team building, sans le côté forcé : des activités jouables à 15 comme à 300 collaborateurs."
const HERO = '/images/games/quiz.png'

export const metadata: Metadata = {
  title: 'Icebreaker en entreprise : 10 activités qui marchent',
  description: DESCRIPTION,
  keywords: [
    'icebreaker entreprise',
    'icebreaker séminaire',
    'brise-glace team building',
    'icebreaker réunion',
    'activité brise-glace entreprise',
    'jeu brise-glace collègues',
    'icebreaker grand groupe',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Icebreaker en entreprise : 10 activités qui marchent',
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
    q: "Qu'est-ce qu'un icebreaker en entreprise ?",
    a: "C'est une activité courte, placée en ouverture d'une réunion, d'un séminaire ou d'un team building, qui permet aux participants de se détendre et d'échanger avant d'entrer dans le vif du sujet. Un bon icebreaker dure 5 à 15 minutes et ne met personne en difficulté.",
  },
  {
    q: 'Quel icebreaker pour un grand groupe de collaborateurs ?',
    a: "Au-delà de 50 personnes, oubliez le tour de table. Choisissez une activité où tout le monde participe en même temps : Matching ou un quiz sur téléphone, ou la carte géante où chacun se place selon sa ville d'origine. Les résultats affichés sur grand écran créent un moment collectif.",
  },
  {
    q: 'Comment éviter que l’icebreaker paraisse forcé ?',
    a: "Annoncez-le simplement, gardez-le court, et participez vous-même, managers compris. Évitez les questions personnelles et les mises en scène où une personne passe seule devant les autres. Un icebreaker réussi ressemble à un jeu, pas à un exercice imposé.",
  },
  {
    q: 'Faut-il installer une application pour un icebreaker sur téléphone ?',
    a: "Non. Avec AnimaJet, les collaborateurs scannent un QR code et participent directement dans le navigateur, même avec un téléphone professionnel verrouillé. Aucun compte, aucune installation.",
  },
  {
    q: 'Les réponses des collaborateurs sont-elles confidentielles ?',
    a: "Avec Matching, personne ne voit les réponses individuelles des autres : l'écran n'affiche que des pourcentages pour la salle, et chacun découvre seul son Top 5 des points communs. Chaque participant choisit s'il veut apparaître dans le classement des autres, et les réponses sont effacées au plus tard 24 h après la partie.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Entreprise',
  title: TITLE,
  intro:
    "9&nbsp;h&nbsp;00, premier jour de séminaire. Les équipes du siège d'un côté, celles des agences de l'autre, et tout le monde fixe son café. C'est exactement le moment où un bon <strong>icebreaker en entreprise</strong> change la journée&nbsp;: dix minutes pour que les collaborateurs se parlent, se découvrent et arrivent détendus à la première session. Encore faut-il éviter le jeu gênant qui fait lever les yeux au ciel. Voici 10 activités testées, classées selon la taille du groupe, de la réunion d'équipe à la convention de 300 personnes.",
  heroImage: HERO,
  heroAlt: 'Icebreaker en séminaire d’entreprise : les collaborateurs répondent depuis leur téléphone',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '8 min',
  author,
  sections: [
    {
      id: 'regles',
      heading: 'Les 3 règles d’un icebreaker réussi en entreprise',
      body: [
        "<ul><li><strong>Court</strong>&nbsp;: 5 à 15 minutes. Un icebreaker ouvre la journée, il ne la remplace pas.</li><li><strong>Inclusif</strong>&nbsp;: tout le monde participe, du stagiaire au directeur général, et personne n'est exposé seul devant les autres.</li><li><strong>Professionnel sans être sérieux</strong>&nbsp;: on parle de goûts et d'habitudes, jamais de vie privée, de salaire ou d'opinions.</li></ul>",
        "Le format compte autant que l'activité. Voici quoi choisir selon le contexte&nbsp;:",
      ],
      table: {
        head: ['Contexte', 'Taille', 'Icebreakers conseillés'],
        rows: [
          ['Réunion d’équipe', '5 à 15', 'Météo du jour, deux vérités un mensonge'],
          ['Atelier, formation', '15 à 40', 'Trois points communs, ligne silencieuse, bingo'],
          ['Séminaire', '40 à 150', 'Matching, carte géante, quiz sur l’entreprise'],
          ['Convention, plénière', '150 et plus', 'Matching, quiz interactif sur écran géant'],
        ],
      },
    },
    {
      id: 'petits-groupes',
      heading: 'Pour une réunion ou un atelier (5 à 40 personnes)',
      body: [
        "Avec un petit groupe, on peut se permettre des formats où chacun prend la parole, à condition de rester bref.",
      ],
      subsections: [
        {
          heading: '1. La météo du jour',
          body: [
            "Chacun décrit son humeur du moment par une météo («&nbsp;grand soleil&nbsp;», «&nbsp;brouillard matinal, ça va se lever&nbsp;»). Trente secondes par personne, aucune justification demandée. Idéal pour ouvrir une réunion d'équipe et sentir l'énergie du groupe.",
          ],
        },
        {
          heading: '2. Deux vérités, un mensonge (version pro)',
          body: [
            "Chacun énonce trois affirmations sur son parcours ou ses loisirs, dont une fausse. Les autres votent. On découvre que la comptable a fait du parachutisme et que le directeur commercial a été barman. À réserver aux groupes de moins de 15 personnes.",
          ],
        },
        {
          heading: '3. Trois points communs entre services',
          body: [
            "On forme des binômes de personnes de services différents, qui doivent trouver trois points communs en deux minutes (hors travail). Trois rotations suffisent pour que chacun ait rencontré trois collègues qu'il ne côtoie jamais.",
          ],
        },
        {
          heading: '4. La ligne silencieuse',
          body: [
            "Les participants doivent se ranger par ancienneté dans l'entreprise, sans parler. Les gestes, les doigts levés et les erreurs font rire, et la ligne finale raconte l'histoire de l'équipe&nbsp;: les anciens d'un côté, les nouveaux arrivants de l'autre, qui se découvrent.",
          ],
        },
        {
          heading: '5. Le bingo des collègues',
          body: [
            "Une grille de cases («&nbsp;Trouve un collègue qui parle trois langues&nbsp;», «&nbsp;… qui vient au travail à vélo&nbsp;»). Chacun doit faire signer chaque case par une personne différente. Tout le monde circule pendant la pause café.",
          ],
        },
      ],
    },
    {
      id: 'grands-groupes',
      heading: 'Pour un séminaire ou une convention (40 à 300 personnes et plus)',
      body: [
        "Avec un grand groupe, les formats à tour de rôle sont impossibles. La solution&nbsp;: faire participer tout le monde en même temps, depuis le téléphone, avec les résultats sur l'écran de la salle. Les collaborateurs scannent un QR code et jouent dans leur navigateur, sans application, même avec un téléphone professionnel verrouillé.",
      ],
      subsections: [
        {
          heading: '6. Matching, le jeu des points communs',
          body: [
            "C'est l'icebreaker le plus efficace pour un grand groupe. Les collaborateurs répondent à des questions légères («&nbsp;Ta pause café idéale&nbsp;?&nbsp;», «&nbsp;Lève-tôt ou couche-tard&nbsp;?&nbsp;»), et l'écran révèle les tendances de la salle&nbsp;: «&nbsp;64&nbsp;% d'entre vous sont des couche-tard, la session de 8&nbsp;h&nbsp;30 va être difficile&nbsp;».",
            "À la fin, chacun découvre sur son téléphone les 5 collègues qui ont répondu le plus comme lui, souvent dans un autre service ou une autre ville. Personne ne voit les réponses individuelles des autres, et chacun choisit s'il veut apparaître dans le classement des autres. Les pauses suivantes deviennent «&nbsp;tu es dans mon Top 5&nbsp;!&nbsp;». Comptez environ 8 minutes pour 10 questions. Voir <a href=\"/jeu-points-communs\">Matching, le jeu des points communs</a>.",
          ],
        },
        {
          heading: '7. Le quiz sur l’entreprise',
          body: [
            "«&nbsp;En quelle année a été signé notre premier client&nbsp;?&nbsp;», «&nbsp;Combien de cafés boit-on par jour au siège&nbsp;?&nbsp;». Un <a href=\"/quiz-interactif\">quiz interactif</a> par équipes mélangées, avec le classement en direct sur l'écran. Il valorise la culture d'entreprise tout en créant de la compétition amicale.",
          ],
        },
        {
          heading: '8. La carte géante',
          body: [
            "Une carte de France (ou du monde) est dessinée au sol ou projetée. Chacun va se placer selon sa ville d'origine, puis selon sa destination de vacances préférée. Les collaborateurs se découvrent voisins, et les conversations démarrent sur place.",
          ],
        },
        {
          heading: '9. Le blind test d’ouverture',
          body: [
            "Cinq extraits musicaux pour réveiller la salle avant la plénière, avec des réponses sur téléphone. La musique réunit toutes les générations en deux minutes. Voir le <a href=\"/blind-test-musical\">blind test musical</a>.",
          ],
        },
        {
          heading: '10. Le défi photo d’équipe',
          body: [
            "Pendant le déjeuner, chaque équipe mélangée réalise une série de photos imposées. Les clichés s'affichent en direct sur l'écran grâce au <a href=\"/partage-photo-evenement\">partage photo</a>, et la salle vote. Parfait pour relancer l'après-midi.",
          ],
        },
      ],
    },
    {
      id: 'eviter',
      heading: 'Les erreurs qui font rater un icebreaker',
      body: [
        "Ce qui fait lever les yeux au ciel, ce n'est pas l'icebreaker en soi, c'est la manière. Les erreurs les plus fréquentes&nbsp;:",
        "<ul><li><strong>Trop long</strong>&nbsp;: au-delà de 15 minutes, les participants pensent à leurs mails.</li><li><strong>Trop personnel</strong>&nbsp;: «&nbsp;Racontez votre plus grand échec&nbsp;» n'a rien à faire en ouverture de séminaire.</li><li><strong>Une seule personne sur scène</strong>&nbsp;: les plus introvertis le vivent comme une épreuve.</li><li><strong>Les managers qui ne jouent pas</strong>&nbsp;: s'ils observent au lieu de participer, le message est clair, et l'énergie retombe.</li></ul>",
      ],
    },
    {
      id: 'outil',
      heading: 'Un outil pour tous vos moments d’entreprise',
      body: [
        "AnimaJet réunit Matching, le quiz, le blind test, la roue et le partage photo dans une même plateforme, personnalisable aux couleurs de l'entreprise. Un même outil sert l'icebreaker du matin, les pauses de l'après-midi et la soirée de clôture.",
        "Pour la soirée, consultez nos <a href=\"/blog/animation-soiree-entreprise-idees\">10 idées d'animation pour une soirée d'entreprise</a>, ou découvrez l'<a href=\"/animation-entreprise-interactive\">animation de soirée d'entreprise</a> en détail.",
      ],
      cards: [
        { title: 'Le matin', desc: 'Matching pour que les services et les sites se découvrent dès l’accueil.' },
        { title: 'L’après-midi', desc: 'Quiz sur l’entreprise et blind test pour relancer l’énergie après le déjeuner.' },
        { title: 'Le soir', desc: 'Roue, défis et photos en direct sur grand écran pour la soirée de clôture.' },
      ],
    },
  ],
  faq,
  related: [
    { label: 'Matching, le jeu des points communs', href: '/jeu-points-communs' },
    { label: "10 idées d'animation pour une soirée d'entreprise", href: '/blog/animation-soiree-entreprise-idees' },
    { label: "Animation de soirée d'entreprise", href: '/animation-entreprise-interactive' },
    { label: '60 questions pour faire connaissance', href: '/blog/questions-pour-faire-connaissance' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Alternative à Kahoot', href: '/alternative-kahoot-evenement' },
  ],
  cta: {
    title: 'Lancez votre prochain séminaire avec Matching',
    text: 'Vos collaborateurs répondent depuis leur téléphone et découvrent avec quels collègues ils ont le plus de points communs, sans application. Testez AnimaJet gratuitement pendant 24h.',
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
