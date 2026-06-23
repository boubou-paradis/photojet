// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'animer-repas-mariage'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-06-23'
const MODIFIED = '2026-06-23'
const TITLE = 'Comment animer un repas de mariage sans casser le rythme du service'
const DESCRIPTION =
  "Animer un repas de mariage sans casser le rythme du service : les erreurs qui plombent la soirée, la durée idéale des animations et le minutage plat par plat."
const HERO = '/images/games/quiz.png'

export const metadata: Metadata = {
  title: 'Animer un repas de mariage sans casser le service',
  description: DESCRIPTION,
  keywords: [
    'comment animer un repas de mariage',
    'animer un repas de mariage',
    'animation repas mariage',
    'animation pendant le repas mariage',
    'jeux repas de mariage',
    'animation entre les plats',
    'minutage repas de mariage',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Animer un repas de mariage sans casser le rythme du service',
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
  bio: "Des centaines de repas de mariage vus depuis la régie : ce qui fait participer la salle, ce qui plombe le service, et le minutage qui change tout. Cet article vient directement du terrain.",
  avatar: '/images/hero-animajet.png',
}

const faq = [
  {
    q: 'Combien de temps doit durer une animation pendant le repas de mariage ?',
    a: "Entre 3 et 5 minutes par animation, placées entre les plats. Au-delà, vous coupez le service et l'attention retombe. Mieux vaut trois animations courtes réparties sur le repas qu'une seule longue.",
  },
  {
    q: 'À quel moment lancer les animations pendant le repas ?',
    a: "Entre les plats, jamais pendant le service. Le créneau idéal : juste après que les assiettes d'un plat sont desservies et avant l'arrivée du suivant. C'est là que la salle est disponible et que les serveurs ne sont pas gênés.",
  },
  {
    q: 'Comment éviter que les discours et le micro monopolisent la soirée ?',
    a: "Cadrez les prises de parole en amont avec les mariés : un créneau dédié, court, et idéalement scindé en deux moments. Les animations participatives (où toute la salle joue depuis son téléphone) sont un excellent contrepoint aux longs discours.",
  },
  {
    q: 'Faut-il prévenir le traiteur des animations ?',
    a: "Oui, impérativement. Une animation mal placée bloque les serveurs et décale tout le service. Calez le minutage des animations avec le maître d'hôtel : c'est la condition pour ne pas casser le rythme.",
  },
  {
    q: 'Quelles animations marchent le mieux pendant le repas ?',
    a: "Les formats courts et collectifs : quiz des mariés, roue de la destinée, photo mystère, blind test. Avec AnimaJet, toute la salle participe depuis son téléphone et le résultat s'affiche sur écran géant, sans rien installer.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Mariage',
  title: TITLE,
  intro:
    "Savoir <strong>comment animer un repas de mariage</strong> sans casser le rythme du service, c'est ce qui sépare une soirée fluide d'un dîner qui s'éternise. Le repas est le moment le plus long de la journée — et le plus risqué. Après des centaines de mariages vus depuis la régie, voici ce qui fonctionne vraiment, les erreurs qui plombent la salle, et le minutage plat par plat pour faire participer vos invités sans jamais gêner le service.",
  heroImage: HERO,
  heroAlt: 'Animation interactive pendant un repas de mariage affichée sur écran géant',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '8 min',
  author,
  sections: [
    {
      id: 'pourquoi',
      heading: 'Pourquoi le repas est le moment le plus délicat à animer',
      body: [
        "Le vin d'honneur se gère tout seul, la soirée dansante aussi. Le repas, lui, dure deux à trois heures, avec des temps morts inévitables entre les plats. C'est là que l'énergie de la salle peut retomber d'un coup — ou au contraire monter, si les animations sont bien placées.",
        "Le piège&nbsp;: le repas n'est pas qu'un moment à « remplir ». C'est un mécanisme à trois acteurs — les invités, les mariés, et <em>le service</em>. Une animation qui ignore le traiteur casse tout. C'est le point que la plupart des guides oublient, et c'est précisément ce qui fait la différence sur le terrain.",
      ],
    },
    {
      id: 'erreurs',
      heading: 'Les erreurs qui cassent le rythme du service',
      body: [
        "Voici ce qui plombe un repas de mariage — vu et revu, soirée après soirée. Si vous ne deviez retenir qu'une chose de cet article, c'est cette liste.",
      ],
      cards: [
        { title: '❌ Enchaîner 15 jeux dès l\'entrée', desc: "On épuise la salle avant le plat principal. L\'attention est un capital limité : ne la dépensez pas d\'un coup." },
        { title: '❌ Laisser le micro 45 minutes aux témoins', desc: "Les longs discours improvisés tuent l\'énergie. Cadrez les prises de parole en amont, courtes et réparties." },
        { title: '❌ Le quiz interminable', desc: "20 questions, c\'est 20 de trop. Passé 5 minutes, les invités décrochent et reviennent à leur assiette." },
        { title: '❌ Les animations qui bloquent les serveurs', desc: "Une animation lancée pendant le service décale tout le repas. Le traiteur ne peut plus avancer, et la soirée prend du retard." },
      ],
    },
    {
      id: 'regles',
      heading: 'Les règles d’un repas de mariage bien animé',
      body: [
        "À l'inverse, voici ce qui fait participer toute la salle sans jamais gêner le service. Quatre règles simples, validées sur le terrain.",
      ],
      cards: [
        { title: '✅ Animer entre les plats', desc: "Le seul bon créneau : assiettes desservies, plat suivant pas encore arrivé. La salle est disponible, les serveurs aussi." },
        { title: '✅ Durée idéale : 3 à 5 minutes', desc: "Assez pour créer un moment fort, assez court pour ne pas couper le service ni lasser. Trois animations courtes valent mieux qu\'une longue." },
        { title: '✅ Faire participer la salle entière', desc: "Pas seulement les témoins ou les plus extravertis : une animation où chacun joue depuis son téléphone embarque tout le monde, des enfants aux grands-parents." },
        { title: '✅ Alterner émotion, rire et repas', desc: "Un quiz qui fait rire, puis un moment d\'émotion, puis on laisse manger. Ce rythme en vagues est le secret d\'un repas qui ne s\'essouffle jamais." },
      ],
    },
    {
      id: 'minutage',
      heading: 'Le minutage idéal d’un repas de mariage animé',
      body: [
        "Voici un repère concret pour répartir les animations sur un repas classique en trois services. Adaptez selon le nombre de plats, mais gardez le principe&nbsp;: <strong>une animation courte entre chaque plat</strong>, jamais pendant.",
      ],
      table: {
        head: ['Moment', 'Animation conseillée', 'Durée'],
        rows: [
          ['Avant l’entrée', 'Mot d’accueil + règle du jeu de la soirée', '2 min'],
          ['Entre entrée et plat', 'Quiz des mariés (« Elle & Lui »)', '4–5 min'],
          ['Entre plat et fromage', 'Roue de la destinée (gage / défi)', '3 min'],
          ['Entre fromage et dessert', 'Photo mystère ou blind test', '4 min'],
          ['Au dessert', 'Moment d’émotion (diaporama, surprise)', '5 min'],
        ],
      },
    },
    {
      id: 'animations',
      heading: 'Quelles animations choisir entre les plats',
      body: [
        "Les meilleurs formats pour le repas sont courts, collectifs et visuels&nbsp;: tout le monde joue en même temps depuis son téléphone, et le résultat s'affiche en grand pour que la salle entière suive.",
      ],
      subsections: [
        {
          heading: 'Le quiz des mariés',
          body: [
            "Le format roi du repas&nbsp;: des questions sur le couple, les invités votent depuis leur table, le suspense monte à l'écran. Parfait juste après l'entrée. Voir le <a href=\"/quiz-mariage\">quiz de mariage</a> en détail.",
          ],
        },
        {
          heading: 'La roue de la destinée',
          body: [
            "Trois minutes chrono pour relancer l'énergie&nbsp;: la <a href=\"/roue-de-la-destinee\">roue de la destinée</a> désigne un invité ou une table pour un gage ou un défi. Idéale entre deux plats lourds.",
          ],
        },
        {
          heading: 'Photo mystère et blind test',
          body: [
            "Une <a href=\"/photo-mystere\">photo mystère</a> qui se dévoile peu à peu, ou un <a href=\"/blind-test-musical\">blind test musical</a> rapide&nbsp;: deux formats addictifs qui s'insèrent sans effort entre fromage et dessert.",
          ],
        },
      ],
    },
    {
      id: 'traiteur',
      heading: 'Coordonner les animations avec le traiteur',
      body: [
        "C'est le réflexe de pro que personne n'explique&nbsp;: <strong>calez votre minutage avec le maître d'hôtel avant le repas</strong>. Demandez-lui le timing prévu des plats, et glissez vos animations dans les creux du service. Une animation de 4 minutes pendant qu'on dessert, c'est invisible pour les serveurs&nbsp;; la même animation pendant qu'on sert, c'est tout le repas qui décale.",
        "Avec une plateforme comme AnimaJet, vous lancez chaque animation en deux secondes depuis l'écran, au moment exact où le créneau s'ouvre&nbsp;: pas de matériel à déployer, pas de temps de mise en place qui empiète sur le service. C'est ce qui rend possible le minutage « entre les plats » sans stress — découvrez l'<a href=\"/animation-mariage-interactive\">animation interactive pour mariage</a>.",
      ],
    },
    {
      id: 'avis-dj',
      heading: "Le point de vue d'un DJ animateur",
      body: [
        "Le secret d'un repas de mariage réussi tient en un mot&nbsp;: <strong>le rythme</strong>. Pas la quantité d'animations, pas leur originalité — le rythme. Une salle qu'on fait participer trois minutes, puis qu'on laisse respirer, puis qu'on émeut, restera avec vous jusqu'au bout de la nuit.",
        "L'animation interactive a changé la donne sur ce point&nbsp;: elle permet de faire jouer 150 personnes en même temps, en 3 minutes, sans micro qui tourne et sans rien installer. C'est exactement ce que je cherchais derrière mes platines, et c'est pour ça que j'ai créé AnimaJet. Pour aller plus loin, lisez aussi nos <a href=\"/blog/idees-animation-mariage\">idées d'animation pour mariage</a>.",
      ],
    },
  ],
  faq,
  related: [
    { label: "Idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
    { label: 'Animation interactive pour mariage', href: '/animation-mariage-interactive' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Roue de la destinée', href: '/roue-de-la-destinee' },
    { label: 'Blind test musical', href: '/blind-test-musical' },
  ],
  cta: {
    title: 'Animez le repas sans casser le rythme',
    text: 'Quiz, roue, photo mystère lancés en 2 secondes depuis l’écran, toute la salle participe depuis son téléphone. Testez AnimaJet gratuitement 24h.',
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
