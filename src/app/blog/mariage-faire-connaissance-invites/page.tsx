// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'mariage-faire-connaissance-invites'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-10-08'
const MODIFIED = '2026-10-08'
const TITLE = 'Mariage : comment faire se rencontrer les deux familles et tous les invités'
const DESCRIPTION =
  "Les deux familles ne se mélangent pas ? Des idées concrètes pour que les invités du mariage fassent connaissance, du vin d'honneur à la soirée."
const HERO = '/photo-qr-partage.png'

export const metadata: Metadata = {
  title: 'Mariage : faire se rencontrer les deux familles',
  description: DESCRIPTION,
  keywords: [
    'faire connaissance invités mariage',
    'mélanger les invités mariage',
    'jeu mariage pour faire connaissance',
    'rapprocher les deux familles mariage',
    'jeu brise-glace mariage',
    'animation vin d\'honneur',
    'plan de table mariage mélanger',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Mariage : faire se rencontrer les deux familles',
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    locale: 'fr_FR',
    publishedTime: PUBLISHED,
    modifiedTime: MODIFIED,
    images: [{ url: HERO, width: 1536, height: 1024, alt: TITLE }],
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
    q: 'Comment mélanger les invités à un mariage ?',
    a: "Agissez à trois moments : le plan de table (tables mixtes avec un point commun entre les invités), le vin d'honneur (un jeu brise-glace où tout le monde participe) et le repas (des jeux par table qui obligent à se parler). Un seul de ces leviers ne suffit pas, les trois ensemble changent l'ambiance.",
  },
  {
    q: 'Quel jeu pour que les invités fassent connaissance au mariage ?',
    a: "Le bingo des invités au vin d'honneur, ou Matching sur téléphone : chacun répond à des questions légères, l'écran révèle les tendances de la salle, puis chaque invité découvre en privé les 5 personnes qui ont répondu le plus comme lui. C'est le prétexte idéal pour aller parler à un cousin qu'on ne connaissait pas.",
  },
  {
    q: 'Faut-il mélanger les familles au plan de table ?',
    a: "Oui, mais avec mesure. Ne mettez jamais quelqu'un seul au milieu d'inconnus : placez les invités par deux ou trois, et réunissez-les par point commun (même passion, même âge, même région) plutôt qu'au hasard. Chacun a ainsi un allié et un sujet de conversation.",
  },
  {
    q: 'Les grands-parents peuvent-ils jouer aux jeux sur téléphone ?',
    a: "Oui. Il suffit de scanner un QR code avec l'appareil photo, sans application à installer, et les écrans de jeu sont volontairement simples. Pour ceux qui n'ont pas de smartphone, proposez-leur de jouer en duo avec un petit-enfant : c'est souvent le plus beau moment du jeu.",
  },
  {
    q: 'À quel moment du mariage placer un jeu pour faire connaissance ?',
    a: "Au vin d'honneur ou au début du repas, juste après l'installation à table. C'est le moment où les invités ne se connaissent pas encore et où un jeu court a le plus d'effet sur la suite de la journée.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Mariage',
  title: TITLE,
  intro:
    "C'est la scène la plus classique des mariages&nbsp;: d'un côté la famille de la mariée, de l'autre celle du marié, et entre les deux, les amis, qui restent entre eux. Les deux camps se sourient poliment au vin d'honneur, puis passent la soirée sans s'adresser la parole. Pourtant, faire en sorte que les <strong>invités du mariage fassent connaissance</strong> ne demande pas grand-chose&nbsp;: quelques bons choix au plan de table, et un ou deux jeux bien placés. Voici ce qui fonctionne, moment par moment.",
  heroImage: HERO,
  heroAlt: 'Invités de mariage qui scannent un QR code pour participer à un jeu',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '8 min',
  author,
  sections: [
    {
      id: 'pourquoi',
      heading: 'Pourquoi les invités ne se mélangent pas',
      body: [
        "Ce n'est ni de la timidité, ni de la mauvaise volonté. À un mariage, chacun connaît <em>un seul</em> des deux mariés, et souvent personne d'autre. Sans prétexte pour aborder un inconnu, on reste naturellement avec son groupe. Et plus la journée avance, plus les groupes se figent.",
        "La bonne nouvelle, c'est que tout se joue dans les deux premières heures. Si les invités ont échangé quelques mots avant le repas, ils continueront à le faire toute la soirée.",
      ],
    },
    {
      id: 'avant',
      heading: 'Avant le jour J : un plan de table qui rapproche',
      body: [
        "Le plan de table est le premier outil pour mélanger les invités, et le plus sous-estimé. Trois principes&nbsp;:",
        "<ul><li><strong>Jamais seul</strong>&nbsp;: placez toujours les invités par deux ou trois personnes qui se connaissent, entourées d'inconnus.</li><li><strong>Un point commun par table</strong>&nbsp;: les passionnés de rando ensemble, les jeunes parents ensemble, les Bretons ensemble. La conversation démarre sur un terrain connu.</li><li><strong>Des tables thématiques</strong>&nbsp;: donnez à chaque table le nom d'un lieu qui compte pour le couple, avec une petite carte qui raconte l'anecdote. Un sujet de conversation tout trouvé.</li></ul>",
      ],
    },
    {
      id: 'vin-honneur',
      heading: "Au vin d'honneur : le moment clé",
      body: [
        "Le vin d'honneur dure souvent 1&nbsp;h&nbsp;30 à 2&nbsp;h, pendant que les mariés font leurs photos. C'est le meilleur moment pour un jeu brise-glace&nbsp;: les invités sont debout, détendus, et n'attendent que ça.",
      ],
      subsections: [
        {
          heading: 'Le bingo des invités',
          body: [
            "Chaque invité reçoit une grille du type «&nbsp;Trouve quelqu'un qui connaît la mariée depuis la maternelle&nbsp;», «&nbsp;… qui a fait le plus long trajet&nbsp;», «&nbsp;… qui était présent le jour de la demande&nbsp;». Il faut faire signer chaque case par une personne différente. Les deux familles sont obligées de se parler, et les anecdotes sur les mariés fusent.",
          ],
        },
        {
          heading: 'Matching, le jeu des points communs',
          body: [
            "Sur un écran (ou un simple téléviseur), affichez le QR code du mariage. Les invités répondent depuis leur téléphone à une dizaine de questions légères («&nbsp;Fondue, raclette ou tartiflette&nbsp;?&nbsp;», «&nbsp;Sur la piste de danse, tu es…&nbsp;»), et l'écran révèle les tendances de la salle.",
            "À la fin, chacun découvre <strong>en privé</strong> les 5 personnes qui ont répondu le plus comme lui. Et très souvent, ce sont des gens de «&nbsp;l'autre famille&nbsp;». «&nbsp;Tu es l'oncle de Julien&nbsp;? On a 9 réponses sur 10 en commun&nbsp;!&nbsp;» Comptez environ 8 minutes pour 10 questions. Voir <a href=\"/jeu-points-communs\">Matching, le jeu des points communs</a>.",
          ],
        },
        {
          heading: 'Le livre d’or à deux mains',
          body: [
            "Variante du livre d'or classique&nbsp;: chaque message doit être écrit par deux invités qui ne se connaissaient pas avant le mariage. Ils doivent se présenter, se trouver un souvenir commun avec les mariés, et signer ensemble.",
          ],
        },
      ],
    },
    {
      id: 'repas',
      heading: 'Pendant le repas : faire jouer les tables',
      body: [
        "Une fois à table, les invités parlent à leurs voisins directs, pas au-delà. Les jeux par table élargissent le cercle.",
        "Le plus efficace est le <a href=\"/quiz-mariage\">quiz des mariés</a> joué par table&nbsp;: chaque table forme une équipe et doit se mettre d'accord avant de répondre. Les deux familles mettent en commun ce qu'elles savent du couple, et découvrent au passage les anecdotes de l'autre camp. Pour placer les jeux sans gêner le service, voyez notre guide <a href=\"/blog/animation-entre-les-plats-mariage\">animation entre les plats</a>.",
      ],
      cards: [
        { title: 'Le quiz des mariés par table', desc: 'Chaque table forme une équipe : il faut mettre en commun ce que les deux familles savent du couple.' },
        { title: 'La roue des tables', desc: 'La roue désigne une table qui doit relever un petit défi avec la table voisine.' },
        { title: 'La Photo Mystère des mariés', desc: 'Une photo d’enfance se dévoile case par case : chaque famille reconnaît “son” marié en premier.' },
      ],
    },
    {
      id: 'soiree',
      heading: 'En soirée : prolonger les rencontres',
      body: [
        "En soirée, la piste de danse fait le travail. Deux astuces pour que les rencontres de la journée continuent&nbsp;: un <a href=\"/blind-test-mariage\">blind test</a> en équipes mélangées avant d'ouvrir la piste (chaque génération apporte ses tubes), et un <a href=\"/diaporama-live-mariage\">diaporama live</a> où défilent les photos prises par les invités. Les photos de groupes «&nbsp;mixtes&nbsp;» de la journée sont souvent les plus applaudies.",
      ],
    },
    {
      id: 'questions',
      heading: 'Les questions à poser (et à éviter) à un mariage',
      body: [
        "Pour un jeu de questions entre invités, restez sur des sujets légers et universels&nbsp;: la nourriture, les vacances, la musique, les petites habitudes. Ils permettent à tous les âges de répondre, des neveux aux grands-parents.",
        "À éviter absolument&nbsp;: les ex, les questions trop intimes sur le couple, la politique, l'argent. Vous trouverez une liste prête à l'emploi dans nos <a href=\"/blog/questions-pour-faire-connaissance\">60 questions pour faire connaissance</a>.",
      ],
    },
    {
      id: 'avis-dj',
      heading: "Le point de vue d'un DJ animateur",
      body: [
        "En mariage, je l'ai vu des dizaines de fois&nbsp;: quand les deux familles se sont parlé avant le repas, la piste de danse se remplit plus tôt et plus longtemps. Les gens dansent avec ceux qu'ils ont rencontrés, pas seulement avec leur groupe.",
        "Mon conseil aux mariés&nbsp;: prévoyez un vrai moment pour faire connaissance au vin d'honneur, même court. C'est l'animation la plus discrète de la journée, et celle qui a le plus d'effet sur la suite. Pour d'autres idées, consultez nos <a href=\"/blog/idees-animation-mariage\">25 idées d'animation pour mariage</a>.",
      ],
    },
  ],
  faq,
  related: [
    { label: 'Matching, le jeu des points communs', href: '/jeu-points-communs' },
    { label: "Idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
    { label: 'Animer un repas de mariage', href: '/blog/animer-repas-mariage' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Animation interactive pour mariage', href: '/animation-mariage-interactive' },
    { label: '12 jeux brise-glace pour lancer une soirée', href: '/blog/jeux-brise-glace-soiree' },
  ],
  cta: {
    title: 'Rapprochez vos invités dès le vin d’honneur',
    text: 'Matching, quiz des mariés, blind test et partage photo en direct sur écran géant, sans application. Testez AnimaJet gratuitement pendant 24h.',
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
