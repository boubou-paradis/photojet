// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'diaporama-live-mariage-guide'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-07-01'
const MODIFIED = '2026-07-01'
const TITLE = 'Diaporama live à un mariage : le guide pratique pour DJ et animateurs'
const DESCRIPTION =
  "Diaporama live de mariage : comment ça marche, quand le lancer dans la soirée, comment modérer les photos et récupérer la galerie. Le guide terrain d'un DJ animateur."
const HERO = '/photo-qr-partage.png'

export const metadata: Metadata = {
  title: 'Diaporama live mariage : le guide pratique pour DJ',
  description: DESCRIPTION,
  keywords: [
    'diaporama live mariage',
    'diaporama mariage',
    'partage photo mariage QR code',
    'photo invités mariage écran géant',
    'guide diaporama mariage',
    'animation photo mariage DJ',
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
  bio: "Des centaines de mariages animés depuis la régie. Le diaporama live est devenu un incontournable — voici comment l'exploiter au bon moment, sans stress et sans mauvaise surprise.",
  avatar: '/images/hero-animajet.png',
}

const faq = [
  {
    q: 'Comment fonctionne un diaporama live à un mariage ?',
    a: "Les invités scannent un QR code affiché sur les tables ou l'écran, prennent ou choisissent une photo, et celle-ci s'affiche en direct sur le grand écran en quelques secondes. Aucune application à installer. Le DJ ou les mariés peuvent activer une modération pour valider chaque photo avant affichage.",
  },
  {
    q: 'À quel moment lancer le diaporama live pendant le mariage ?',
    a: "Le diaporama tourne idéalement en continu, dès le vin d'honneur et pendant tout le repas. C'est le moment où les invités prennent le plus de photos. On peut le mettre en pause pendant les temps forts (entrée des mariés, discours) puis le relancer.",
  },
  {
    q: 'Faut-il modérer les photos des invités ?',
    a: "C'est recommandé pour un mariage. La modération permet au DJ ou aux mariés de valider chaque photo avant qu'elle n'apparaisse à l'écran, ce qui évite toute mauvaise surprise. Elle se gère en un coup d'œil et ne ralentit pas le flux.",
  },
  {
    q: 'Comment récupérer toutes les photos après le mariage ?',
    a: "Toutes les photos partagées sont rassemblées dans une galerie collaborative téléchargeable. Les mariés la conservent et la partagent avec leurs invités après la fête : un souvenir collectif vu par tous ceux qui étaient présents.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Mariage',
  title: TITLE,
  intro:
    "Le <strong>diaporama live de mariage</strong> est devenu l'une des animations les plus demandées — et pour cause&nbsp;: il transforme l'écran de la salle en album vivant, alimenté en temps réel par les photos des invités. Mais un diaporama live mal géré (photos non modérées, mauvais timing, galerie perdue) peut virer au casse-tête. Voici le guide pratique, côté régie&nbsp;: comment ça marche, quand le lancer, comment modérer, et comment récupérer toutes les photos après la fête.",
  heroImage: HERO,
  heroAlt: 'Diaporama live de mariage : photos des invités affichées en direct sur grand écran',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '7 min',
  author,
  sections: [
    {
      id: 'comment',
      heading: 'Comment fonctionne un diaporama live',
      body: [
        "Le principe est simple&nbsp;: un QR code est affiché sur les tables et sur l'écran. Chaque invité le scanne, prend ou choisit une photo, et celle-ci rejoint le diaporama géant en quelques secondes, sous les yeux de toute la salle. Pas d'application à télécharger, pas de compte à créer — même les invités les moins à l'aise avec la technologie participent.",
        "Résultat&nbsp;: l'écran devient le cœur battant de la soirée. Les invités regardent, rient en se reconnaissant, et continuent d'alimenter le flux. C'est le complément parfait du photographe professionnel, qui capture les moments posés pendant que le diaporama récolte des centaines de points de vue spontanés.",
      ],
    },
    {
      id: 'timing',
      heading: 'Quand le lancer pendant la soirée',
      body: [
        "Le diaporama live donne le meilleur de lui-même en <strong>continu</strong>, dès le vin d'honneur et pendant tout le repas&nbsp;: ce sont les moments où les invités photographient le plus. Voici un repère de minutage&nbsp;:",
      ],
      table: {
        head: ['Moment', 'Diaporama live', 'Conseil'],
        rows: [
          ['Vin d’honneur', 'Actif', 'Le QR code sur les mange-debout : les photos affluent'],
          ['Entrée des mariés', 'En pause', 'On laisse la scène aux mariés'],
          ['Repas', 'Actif', 'Idéal entre les plats, en fond d’écran'],
          ['Discours', 'En pause', 'On coupe pour ne pas distraire'],
          ['Soirée dansante', 'Actif', 'Les photos de la piste enflamment l’écran'],
        ],
      },
    },
    {
      id: 'moderation',
      heading: 'Modérer les photos sans casser le rythme',
      body: [
        "Pour un mariage, la <strong>modération est vivement conseillée</strong>. En l'activant, chaque photo attend la validation du DJ ou des mariés avant d'apparaître à l'écran. Cela évite les mauvaises surprises tout en gardant un flux fluide&nbsp;: la validation se fait en un coup d'œil, d'un simple geste.",
        "Astuce de terrain&nbsp;: confiez la modération à un témoin ou à un proche de confiance si le DJ est occupé. En quelques minutes, il prend le coup de main et le diaporama tourne tout seul.",
      ],
    },
    {
      id: 'galerie',
      heading: 'Récupérer la galerie après le mariage',
      body: [
        "C'est ce que les mariés adorent&nbsp;: à la fin de la soirée, <strong>toutes les photos partagées sont réunies dans une galerie collaborative téléchargeable</strong>. Des centaines de clichés pris par les invités, sous des angles que personne d'autre n'aurait capturés — un vrai complément à l'album du photographe.",
        "Cette galerie se partage ensuite avec l'ensemble des invités&nbsp;: chacun retrouve les photos de la soirée, y compris celles où il apparaît. Un souvenir collectif qui prolonge le mariage bien après le jour J.",
      ],
    },
    {
      id: 'outil',
      heading: 'Le diaporama live avec AnimaJet',
      body: [
        "AnimaJet réunit le diaporama live, le partage photo, la borne photo et l'impression dans une seule plateforme, avec modération intégrée et galerie téléchargeable. Le tout par QR code, sans application, et personnalisable aux couleurs des mariés.",
        "Pour aller plus loin&nbsp;: la page <a href=\"/diaporama-live-mariage\">diaporama live mariage</a>, l'<a href=\"/animation-photo-mariage\">animation photo de mariage</a> complète, ou l'ensemble de l'<a href=\"/animation-mariage-interactive\">animation interactive pour mariage</a>.",
      ],
    },
  ],
  faq,
  related: [
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Animation photo mariage', href: '/animation-photo-mariage' },
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Animation interactive pour mariage', href: '/animation-mariage-interactive' },
    { label: 'Animer un repas de mariage', href: '/blog/animer-repas-mariage' },
  ],
  cta: {
    title: 'Faites vivre l’écran de votre mariage',
    text: 'Les photos de vos invités en direct sur grand écran, avec modération et galerie téléchargeable. Testez AnimaJet gratuitement 24h.',
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
