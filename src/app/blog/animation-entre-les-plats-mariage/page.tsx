// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'animation-entre-les-plats-mariage'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-07-01'
const MODIFIED = '2026-07-01'
const TITLE = 'Animation entre les plats de mariage : que faire sans lasser les invités ?'
const DESCRIPTION =
  "Animer entre les plats d'un mariage sans casser le service : idées courtes, minutage plat par plat et le format qui fait participer toute la salle depuis un téléphone."
const HERO = '/photo-qr-partage.png'

export const metadata: Metadata = {
  title: 'Animation entre les plats mariage : idées courtes et efficaces',
  description: DESCRIPTION,
  keywords: [
    'animation entre les plats mariage',
    'animation repas mariage',
    'idées animation entre les plats',
    'animation mariage courte',
    'jeu entre les plats mariage',
    'animation table mariage',
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
  bio: "25 ans derrière les platines et des centaines de mariages animés. Le moment du repas est le plus délicat de la soirée : trop d'animation tue le service, pas assez et la salle s'endort. Voici ce qui marche vraiment.",
  avatar: '/images/hero-animajet.png',
}

const faq = [
  {
    q: 'Que faire comme animation entre les plats à un mariage ?',
    a: "Privilégiez des formats courts de 3 à 8 minutes qui se lancent et s'arrêtent net : un mini-quiz sur les mariés, une manche de blind test, une photo mystère à deviner, ou le partage des photos des invités en direct sur écran géant. L'idéal est une animation que toute la salle suit depuis son téléphone, sans avoir à se lever ni interrompre le service.",
  },
  {
    q: 'Combien de temps doit durer une animation entre deux plats ?',
    a: "Entre 3 et 8 minutes maximum. Le repas de mariage dure déjà plusieurs heures : une animation trop longue empiète sur le service, refroidit les plats et lasse les invités. Mieux vaut plusieurs séquences courtes, une par changement de plat, qu'un grand jeu de 30 minutes qui coupe le dîner en deux.",
  },
  {
    q: 'À quel moment lancer les animations pendant le repas ?',
    a: "Calez-les sur les temps morts naturels : pendant le débarrassage et le dressage du plat suivant, quand les invités ont fini d'assiette et commencent à discuter. C'est là que l'attention se relâche et qu'une animation courte relance l'énergie sans gêner les serveurs.",
  },
  {
    q: "Comment animer sans déranger le service du traiteur ?",
    a: "Prévenez le maître d'hôtel de votre minutage et calez vos animations sur les inter-plats plutôt que pendant le service. Un format qui se joue depuis le téléphone, sans micro imposé ni déplacement des invités, est le plus compatible avec un service fluide : personne ne quitte sa place, tout se passe sur l'écran.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Mariage',
  title: TITLE,
  intro:
    "L'<strong>animation entre les plats d'un mariage</strong> est un exercice d'équilibriste : il faut occuper les invités pendant les temps morts du repas sans jamais empiéter sur le service ni casser le rythme de la soirée. Trop d'animation et le traiteur s'agace, les plats refroidissent ; pas assez et la salle s'installe dans une longue discussion dont elle ne ressort plus. Après des centaines de repas animés depuis la régie, voici les formats courts qui fonctionnent, le minutage plat par plat, et pourquoi le smartphone est devenu l'outil idéal pour ces séquences express.",
  heroImage: HERO,
  heroAlt: 'Invités participant à une animation de mariage depuis leur téléphone pendant le repas',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '8 min',
  author,
  sections: [
    {
      id: 'pourquoi',
      heading: 'Pourquoi le repas est le moment le plus délicat à animer',
      body: [
        "Le repas concentre les deux tiers d'un mariage en durée, mais c'est le moment où l'énergie retombe le plus facilement. Les invités sont assis, souvent par tablées qui ne se connaissent pas toutes, et l'attente entre deux plats peut s'étirer sur vingt à trente minutes. C'est précisément là que la soirée se joue&nbsp;: une salle qui s'endort pendant le dîner est beaucoup plus dure à faire lever ensuite sur la piste.",
        "L'erreur la plus fréquente&nbsp;: vouloir « meubler » avec une grosse animation de trente minutes. Résultat, on coupe le service, le traiteur s'énerve, et les invités qui voulaient juste discuter décrochent. La bonne approche est inverse&nbsp;: des <strong>séquences courtes et rythmées</strong>, une par inter-plat, qui relancent l'énergie puis rendent la main à la conversation.",
      ],
    },
    {
      id: 'minutage',
      heading: 'Le minutage plat par plat',
      body: [
        "Voici un cadre qui fonctionne sur un repas classique en trois à quatre services. À adapter à votre menu et à votre traiteur, mais l'idée reste la même&nbsp;: une animation calée sur chaque temps de débarrassage.",
      ],
      table: {
        head: ['Moment', 'Format conseillé', 'Durée'],
        rows: [
          ['Après l’entrée', 'Mini-quiz sur les mariés (comment se sont-ils rencontrés ?)', '5 min'],
          ['Avant le plat', 'Une manche de blind test, ambiance montante', '6 min'],
          ['Après le plat', 'Photo mystère ou partage photo des invités en direct', '5 min'],
          ['Avant le dessert', 'Manche finale du quiz + podium sur écran géant', '6 min'],
        ],
      },
    },
    {
      id: 'idees',
      heading: '6 idées d’animation courtes qui fonctionnent',
      body: [
        "Toutes ces animations ont un point commun&nbsp;: elles se lancent en moins d'une minute, se suivent depuis la place de chacun, et s'arrêtent net dès que le plat arrive.",
      ],
      cards: [
        { title: '💍 Le quiz des mariés', desc: "5 questions sur le couple : leur rencontre, leur voyage de noces, une anecdote. Toute la salle répond depuis son téléphone, le classement s'affiche en direct." },
        { title: '🎵 Le blind test express', desc: "Une manche de 6 titres entre deux plats. On reconnaît, on buzze depuis son mobile, on relance la manche suivante au plat d'après." },
        { title: '🖼️ La photo mystère', desc: "Une photo des mariés se dévoile case par case : le premier qui devine gagne. Parfait pour un inter-plat très court." },
        { title: '📸 Le partage photo live', desc: "Les invités envoient leurs photos du jour, elles s'affichent en direct sur l'écran. Ça tourne en fond, sans animation active." },
        { title: '🗳️ Le sondage surprise', desc: "« Qui va attraper le bouquet ? », « Première danse : quel style ? » : un vote rapide qui fait rire et implique tout le monde." },
        { title: '🎡 La roue de la destinée', desc: "On tire au sort une table qui doit relever un petit défi bon enfant : une façon ludique de faire participer sans forcer." },
      ],
    },
    {
      id: 'regles',
      heading: 'Les 4 règles pour ne pas casser le service',
      body: [
        "Une animation de repas réussie se remarque à peine côté logistique. Ces quatre règles font toute la différence avec le maître d'hôtel&nbsp;:",
      ],
      subsections: [
        {
          heading: '1. Se caler sur les inter-plats, jamais pendant le service',
          body: ["Lancez toujours vos séquences pendant le débarrassage, quand les assiettes partent et que le plat suivant n'est pas encore dressé. Vous occupez le temps mort au lieu de le créer."],
        },
        {
          heading: '2. Garder chaque format sous les 8 minutes',
          body: ["Un inter-plat dure rarement plus de vingt minutes. Une animation de 5 à 8 minutes laisse le temps de discuter avant et après, et n'empiète jamais sur la cadence du traiteur."],
        },
        {
          heading: '3. Éviter de faire lever les invités',
          body: ["Les animations qui obligent à se déplacer cassent le repas et compliquent le service. Un format qui se joue depuis le téléphone, à sa place, reste compatible avec un dîner assis."],
        },
        {
          heading: '4. Prévenir le maître d’hôtel de votre minutage',
          body: ["Cinq minutes de coordination en début de soirée évitent tous les couacs&nbsp;: le traiteur sait quand vous prenez la parole, vous savez quand les plats sortent. C'est le secret d'un repas fluide."],
        },
      ],
    },
    {
      id: 'outil',
      heading: 'Pourquoi le smartphone est l’outil idéal pour ces séquences',
      body: [
        "Ce qui rend ces animations courtes possibles, c'est qu'elles ne demandent aucun matériel ni installation. Les invités scannent un <strong>QR code</strong> affiché sur l'écran et participent depuis le navigateur de leur téléphone — <strong>sans installer d'application</strong>. Vous, vous pilotez l'enchaînement depuis votre régie, comme votre mix&nbsp;: vous lancez une manche, vous l'arrêtez, vous passez à la suivante quand le plat arrive.",
        "C'est exactement l'approche d'<a href=\"/animation-mariage-interactive\">AnimaJet pour l'animation de mariage</a>&nbsp;: quiz, blind test, photo mystère et partage photo réunis dans un même outil, affichés sur écran géant, réponses au téléphone. Chaque séquence se prépare à l'avance et se déclenche en un geste, pour ne jamais improviser entre deux plats.",
      ],
    },
  ],
  faq,
  related: [
    { label: 'Animer un repas de mariage', href: '/blog/animer-repas-mariage' },
    { label: "Idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
    { label: 'Quiz de mariage', href: '/quiz-mariage' },
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Animation interactive pour mariage', href: '/animation-mariage-interactive' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
  ],
  cta: {
    title: 'Animez le repas sans casser le service',
    text: "Quiz, blind test et photo mystère en séquences courtes, réponses au téléphone, affichage sur écran géant. Préparez tout à l'avance et déclenchez en un geste. Testez AnimaJet gratuitement 24h.",
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
