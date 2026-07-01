// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = '50-questions-quiz-mariage'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-07-01'
const MODIFIED = '2026-07-01'
const TITLE = '50 questions pour réussir un quiz de mariage'
const DESCRIPTION =
  "50 questions originales pour un quiz de mariage interactif, classées par thème : les mariés, leur rencontre, l'enfance, les invités, la musique et les anecdotes."
const HERO = '/images/games/quiz.png'

export const metadata: Metadata = {
  title: '50 questions pour un quiz de mariage interactif',
  description: DESCRIPTION,
  keywords: [
    'questions quiz mariage',
    'quiz mariage questions',
    'idées questions quiz mariage',
    'quiz sur les mariés',
    'questions animation mariage',
    'quiz mariage interactif',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: 'article',
    locale: 'fr_FR',
    publishedTime: PUBLISHED,
    modifiedTime: MODIFIED,
    images: [{ url: HERO, width: 1200, height: 630, alt: TITLE }],
  },
}

const author = {
  name: "Le fondateur d'AnimaJet",
  role: 'DJ animateur, fondateur de MG Events Animation',
  bio: "25 ans derrière les platines et des centaines de mariages animés. Le quiz des mariés est l'animation qui déclenche le plus de rires — à condition de poser les bonnes questions. Voici celles qui marchent à tous les coups.",
  avatar: '/images/hero-animajet.png',
}

const faq = [
  {
    q: 'Combien de questions prévoir pour un quiz de mariage ?',
    a: "Entre 10 et 15 questions pour une manche, soit 8 à 12 minutes de jeu. Piochez dans plusieurs thèmes (les mariés, leur rencontre, les invités) pour varier le rythme. Si l'ambiance est là, gardez quelques questions de côté pour relancer une seconde manche plus tard dans la soirée.",
  },
  {
    q: 'Quelles questions poser dans un quiz de mariage ?',
    a: "Mélangez des questions sur les mariés (leur rencontre, leurs habitudes), sur l'enfance du couple, sur les invités présents et sur la musique. Les meilleures questions sont personnelles et bienveillantes : elles racontent l'histoire du couple et font sourire sans jamais mettre personne mal à l'aise.",
  },
  {
    q: 'Qui prépare les questions du quiz de mariage ?',
    a: "En général, c'est le témoin, un proche ou le DJ animateur qui les prépare avec la complicité de l'entourage, à l'insu des mariés. Vous pouvez aussi interroger les mariés séparément à l'avance pour créer des questions « qui connaît le mieux l'autre ». Toutes les questions se préparent et se sauvegardent à l'avance.",
  },
  {
    q: 'Comment faire répondre les invités à un quiz de mariage ?',
    a: "Le plus simple aujourd'hui est de faire jouer les invités depuis leur téléphone : ils scannent un QR code, répondent dans leur navigateur sans installer d'application, et le classement s'affiche en direct sur écran géant. Plus besoin de feuilles de papier ni de comptage manuel.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Mariage',
  title: TITLE,
  intro:
    "Le quiz des mariés est l'une des animations les plus attendues d'un mariage&nbsp;: elle raconte l'histoire du couple, fait participer toute la salle et déclenche des fous rires garantis. Encore faut-il poser les bonnes <strong>questions de quiz de mariage</strong>. Voici <strong>50 questions originales</strong>, classées par thème, à piocher pour composer votre manche. Elles sont pensées pour être drôles et touchantes, jamais gênantes — un bon quiz de mariage met le couple en valeur, il ne met personne mal à l'aise.",
  heroImage: HERO,
  heroAlt: 'Quiz de mariage interactif affiché sur écran géant, invités répondant au téléphone',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '9 min',
  author,
  sections: [
    {
      id: 'maries',
      heading: 'Les mariés (8 questions)',
      body: [
        "Le cœur du quiz&nbsp;: ce que les invités croient savoir sur le couple. À poser en priorité, ce sont les questions qui font le plus réagir la salle.",
        "<ul><li>Qui a dit « je t'aime » en premier&nbsp;?</li><li>Lequel des deux est le plus en retard&nbsp;?</li><li>Qui fait la cuisine à la maison&nbsp;?</li><li>Lequel des deux ronfle (et refuse de l'admettre)&nbsp;?</li><li>Qui a demandé l'autre en mariage&nbsp;?</li><li>Lequel des deux dépense le plus&nbsp;?</li><li>Qui est le plus tête en l'air&nbsp;?</li><li>Lequel des deux a craqué en premier le jour de la demande&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'rencontre',
      heading: 'La rencontre et le couple (8 questions)',
      body: [
        "L'histoire du couple, celle que tout le monde adore réentendre. Idéales pour ouvrir le quiz sur une note tendre.",
        "<ul><li>Où les mariés se sont-ils rencontrés pour la première fois&nbsp;?</li><li>En quelle année leur histoire a-t-elle commencé&nbsp;?</li><li>Quel a été le lieu de leur premier rendez-vous&nbsp;?</li><li>Quelle a été leur première destination de voyage à deux&nbsp;?</li><li>Combien de temps se sont-ils fréquentés avant d'emménager ensemble&nbsp;?</li><li>Qui a fait le premier pas&nbsp;?</li><li>Quel surnom se donnent-ils&nbsp;?</li><li>Quel est le plat qu'ils commandent toujours au restaurant&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'enfance',
      heading: "L'enfance des mariés (7 questions)",
      body: [
        "Ces questions font ressortir les albums photos et les anecdotes des parents. Un moment souvent très émouvant.",
        "<ul><li>Quel était le métier rêvé de la mariée enfant&nbsp;?</li><li>Quel était le dessin animé préféré du marié&nbsp;?</li><li>Dans quelle ville chacun a-t-il grandi&nbsp;?</li><li>Lequel des deux était le plus turbulent à l'école&nbsp;?</li><li>Quel instrument de musique l'un d'eux a-t-il (mal) appris&nbsp;?</li><li>Quel sport chacun pratiquait-il enfant&nbsp;?</li><li>Quel était leur bonbon préféré à 8 ans&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'invites',
      heading: 'Les invités présents (7 questions)',
      body: [
        "Ces questions impliquent directement la salle et créent une belle dynamique de groupe. Parfaites pour relancer l'énergie en milieu de manche.",
        "<ul><li>Qui a fait le plus long trajet pour venir aujourd'hui&nbsp;?</li><li>Combien de personnes sont présentes dans la salle&nbsp;?</li><li>Qui connaît les mariés depuis le plus longtemps&nbsp;?</li><li>Quel invité a été témoin à son propre mariage récemment&nbsp;?</li><li>Combien de couples présents se sont rencontrés grâce aux mariés&nbsp;?</li><li>Qui sera, selon la salle, le premier sur la piste de danse&nbsp;?</li><li>Qui attrapera le bouquet&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'musique',
      heading: 'Musique et goûts (7 questions)',
      body: [
        "Un pont naturel vers la soirée dansante. Ces questions annoncent l'ambiance et se marient très bien avec une manche de blind test.",
        "<ul><li>Quelle est la chanson de leur premier slow&nbsp;?</li><li>Quel artiste les mariés iraient-ils voir en concert sans hésiter&nbsp;?</li><li>Quel style de musique met le marié de bonne humeur&nbsp;?</li><li>Quelle chanson la mariée chante-t-elle (faux) sous la douche&nbsp;?</li><li>Quel film les mariés peuvent-ils regarder en boucle&nbsp;?</li><li>Quelle sera la chanson de leur ouverture de bal&nbsp;?</li><li>Quel tube fera lever toute la salle ce soir&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'anecdotes',
      heading: 'Anecdotes et souvenirs (7 questions)',
      body: [
        "Les questions qui déclenchent les plus grands éclats de rire, à condition de rester bienveillant. Interrogez les proches en amont pour les préparer.",
        "<ul><li>Quelle est la plus grosse bêtise que le couple a faite en vacances&nbsp;?</li><li>Quel est le talent caché du marié&nbsp;?</li><li>Quelle manie de l'autre chacun a-t-il fini par adopter&nbsp;?</li><li>Quel est le rendez-vous raté dont ils rient encore&nbsp;?</li><li>Quel objet inutile l'un d'eux refuse-t-il de jeter&nbsp;?</li><li>Quelle série les a fait se coucher à 4h du matin&nbsp;?</li><li>Quel a été leur pire achat commun&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'famille',
      heading: 'La famille (6 questions)',
      body: [
        "Pour clôturer sur l'émotion et inclure les deux familles réunies pour l'occasion.",
        "<ul><li>Combien de neveux et nièces les mariés ont-ils au total&nbsp;?</li><li>Quel membre de la famille est le plus proche du couple&nbsp;?</li><li>Quelle recette de famille les mariés se disputent-ils&nbsp;?</li><li>Quel prénom reviendra le plus souvent dans la salle&nbsp;?</li><li>Quelle tradition familiale les mariés comptent-ils transmettre&nbsp;?</li><li>Qui, dans la famille, sera le premier à pleurer ce soir&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'construire',
      heading: 'Comment construire et animer votre quiz',
      body: [
        "Ne mettez pas les 50 questions d'un coup&nbsp;: piochez-en <strong>10 à 15</strong>, en mélangeant les thèmes pour varier le rythme. Alternez une question tendre (la rencontre), une question drôle (une anecdote), une question qui implique la salle (les invités). Gardez la question la plus forte pour la fin, avant d'afficher le podium.",
        "Côté déroulé, le plus efficace est de faire répondre les invités <strong>depuis leur téléphone</strong>&nbsp;: ils scannent un QR code, répondent dans leur navigateur <strong>sans installer d'application</strong>, et le classement s'actualise en direct sur l'écran géant. Plus de feuilles à distribuer, plus de comptage manuel — vous gardez la main sur le rythme comme sur votre mix.",
        "C'est ce que propose <a href=\"/quiz-mariage\">le quiz de mariage AnimaJet</a>&nbsp;: vous préparez et sauvegardez vos questions à l'avance, vous lancez la partie en un geste, et vous pouvez enchaîner avec une manche de <a href=\"/blind-test-mariage\">blind test</a> ou une <a href=\"/animation-mariage-interactive\">animation complète de mariage</a>.",
      ],
    },
  ],
  faq,
  related: [
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Animation interactive pour mariage', href: '/animation-mariage-interactive' },
    { label: "Idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
    { label: 'Animer un repas de mariage', href: '/blog/animer-repas-mariage' },
    { label: 'Organiser un blind test de mariage', href: '/blog/organiser-blind-test-mariage' },
  ],
  cta: {
    title: 'Créez votre quiz de mariage en quelques minutes',
    text: "Préparez vos questions à l'avance, faites répondre vos invités au téléphone et affichez le classement en direct sur écran géant, sans application. Testez AnimaJet gratuitement 24h.",
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
