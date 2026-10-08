// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

import { Metadata } from 'next'
import BlogArticle, { buildBlogJsonLd, type BlogArticleContent } from '@/components/marketing/BlogArticle'

const SLUG = 'questions-pour-faire-connaissance'
const URL = `https://animajet.fr/blog/${SLUG}`
const PUBLISHED = '2026-10-08'
const MODIFIED = '2026-10-08'
const TITLE = '60 questions pour faire connaissance en groupe (soirée, travail, mariage)'
const DESCRIPTION =
  "60 questions classées par thème pour faire connaissance en soirée, au travail ou au mariage, et un jeu pour les poser à toute la salle en même temps."
const HERO = '/images/games/matching-v2.png'

export const metadata: Metadata = {
  title: '60 questions pour faire connaissance en groupe',
  description: DESCRIPTION,
  keywords: [
    'questions pour faire connaissance',
    'question pour apprendre à connaître quelqu\'un',
    'questions tu préfères',
    'questions brise-glace',
    'questions pour faire connaissance en groupe',
    'questions pour faire connaissance au travail',
    'jeu de questions soirée',
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: '60 questions pour faire connaissance en groupe',
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
    q: 'Quelle est la meilleure question pour faire connaissance ?',
    a: "Une question à laquelle tout le monde peut répondre en une seconde, mais qui donne envie de demander « pourquoi ? ». « Plutôt mer ou montagne ? » fonctionne mieux que « Parle-moi de toi » : la réponse est facile, et la discussion vient toute seule.",
  },
  {
    q: 'Comment poser des questions à un grand groupe sans que ce soit long ?',
    a: "Évitez le tour de table : avec 50 personnes, il prend une heure. Faites répondre tout le monde en même temps, à main levée, en changeant de côté de la salle, ou depuis le téléphone avec un jeu comme Matching, où chacun découvre ensuite avec qui il a le plus de réponses en commun.",
  },
  {
    q: 'Quelles questions éviter pour faire connaissance ?',
    a: "Tout ce qui touche à l'argent, à la politique, à la religion, au physique ou à la vie amoureuse. Évitez aussi les questions qui obligent à se dévoiler devant tout le monde : le but est de mettre à l'aise, pas de mettre sur la sellette.",
  },
  {
    q: 'Quelles questions poser pour faire connaissance au travail ?',
    a: "Restez sur les goûts et les habitudes, jamais sur la vie privée : la pause café idéale, la playlist pour travailler, le pire trajet du matin. Les questions « tu préfères » marchent particulièrement bien, car elles ne demandent aucune confidence.",
  },
  {
    q: 'Combien de questions prévoir pour une soirée ?',
    a: "Pour un jeu collectif, 10 questions suffisent largement : c'est environ 8 minutes avec Matching. Au-delà de 15 à 20, l'attention baisse. Gardez les autres pour une deuxième partie plus tard dans la soirée.",
  },
]

const content: BlogArticleContent = {
  eyebrow: 'Idées de soirée',
  title: TITLE,
  intro:
    "«&nbsp;Alors, tu fais quoi dans la vie&nbsp;?&nbsp;» C'est la question que tout le monde pose, et celle qui mène le moins loin. Les meilleures <strong>questions pour faire connaissance</strong> sont plus légères&nbsp;: on y répond en une seconde, mais elles révèlent un goût, une habitude, une manie, et elles donnent envie de continuer la discussion. Voici 60 questions classées par thème, à poser en tête-à-tête, en petit groupe ou à toute une salle. La plupart sont au format «&nbsp;tu préfères&nbsp;», le plus efficace pour briser la glace.",
  heroImage: HERO,
  heroAlt: 'Questions pour faire connaissance affichées sur écran géant pendant une soirée',
  datePublished: PUBLISHED,
  dateModified: MODIFIED,
  readingTime: '9 min',
  author,
  sections: [
    {
      id: 'bonne-question',
      heading: 'Ce qui fait une bonne question pour faire connaissance',
      body: [
        "Une bonne question pour faire connaissance a trois qualités. Elle est <em>facile</em>&nbsp;: personne ne doit réfléchir plus de trois secondes. Elle est <em>sans risque</em>&nbsp;: aucune réponse n'est gênante ou jugée. Et elle est <em>révélatrice</em>&nbsp;: la réponse dit quelque chose de la personne et appelle naturellement un «&nbsp;ah bon, pourquoi&nbsp;?&nbsp;».",
        "C'est pour ça que les questions à choix («&nbsp;plutôt ceci ou cela&nbsp;?&nbsp;») fonctionnent si bien en groupe&nbsp;: tout le monde peut répondre en même temps, et chacun découvre immédiatement qui pense comme lui. Les questions ouvertes, elles, sont plus adaptées au tête-à-tête, une fois la glace brisée.",
      ],
    },
    {
      id: 'tu-preferes',
      heading: 'Les « tu préfères » du quotidien (10 questions)',
      body: [
        "Les plus simples pour commencer. Personne ne se trompe, et les débats démarrent tout seuls.",
        "<ul><li>Plutôt mer ou montagne&nbsp;?</li><li>Lève-tôt ou couche-tard&nbsp;?</li><li>Chat ou chien&nbsp;?</li><li>Série ou film&nbsp;?</li><li>Message vocal ou message écrit&nbsp;?</li><li>La batterie de ton téléphone&nbsp;: toujours à 100&nbsp;% ou tu vis à 3&nbsp;%&nbsp;?</li><li>Douche du matin ou douche du soir&nbsp;?</li><li>Tout ranger tout de suite ou laisser traîner jusqu'au week-end&nbsp;?</li><li>Arriver en avance ou pile à l'heure (voire un peu en retard)&nbsp;?</li><li>Été ou hiver&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'gourmandise',
      heading: 'Gourmandise et apéro (10 questions)',
      body: [
        "La nourriture est le sujet le plus universel qui soit, et le plus passionné. Succès garanti autour d'un buffet.",
        "<ul><li>Team sucré ou salé&nbsp;?</li><li>L'ananas sur la pizza&nbsp;: oui sans honte, ou jamais de la vie&nbsp;?</li><li>Fondue, raclette ou tartiflette&nbsp;?</li><li>Ton apéro idéal&nbsp;: terrasse au soleil, canapé entre amis, bar animé ou pique-nique&nbsp;?</li><li>Au resto, tu prends toujours le même plat ou celui que tu ne connais pas&nbsp;?</li><li>Croissant ou pain au chocolat (ou chocolatine)&nbsp;?</li><li>Le fromage&nbsp;: avant ou après le dessert&nbsp;?</li><li>Ketchup ou mayonnaise&nbsp;?</li><li>Le petit-déjeuner&nbsp;: sacré ou facultatif&nbsp;?</li><li>Tu cuisines pour le plaisir ou par obligation&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'voyages',
      heading: 'Voyages et vacances (10 questions)',
      body: [
        "Des questions qui font voyager et qui lancent les anecdotes («&nbsp;une fois, en camping…&nbsp;»).",
        "<ul><li>Tes vacances idéales&nbsp;: road trip, club tout compris, city trip ou camping&nbsp;?</li><li>Valise bouclée la veille ou une semaine avant&nbsp;?</li><li>Plage à ne rien faire ou programme chargé du matin au soir&nbsp;?</li><li>Avion, train ou voiture&nbsp;?</li><li>Hôtel, location ou tente&nbsp;?</li><li>Tu goûtes la spécialité locale ou tu restes sur ce que tu connais&nbsp;?</li><li>Partir loin une fois par an ou souvent, pas loin&nbsp;?</li><li>Le pays où tu repartirais demain&nbsp;?</li><li>Tu prends cent photos ou aucune&nbsp;?</li><li>Le pire souvenir de vacances qui te fait rire aujourd'hui&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'sorties',
      heading: 'Musique et sorties (10 questions)',
      body: [
        "Parfaites en soirée&nbsp;: elles annoncent l'ambiance et révèlent les futurs piliers de la piste de danse.",
        "<ul><li>Sur la piste de danse, tu es le premier à y aller, tu te fais prier ou tu filmes les autres&nbsp;?</li><li>Le karaoké&nbsp;: j'adore, seulement après minuit, ou jamais&nbsp;?</li><li>Ta playlist en voiture&nbsp;: années 80, rap, rock ou variété française&nbsp;?</li><li>Concert ou théâtre&nbsp;?</li><li>Soirée qui finit à 23&nbsp;h ou au lever du soleil&nbsp;?</li><li>Grosse fête ou petit comité&nbsp;?</li><li>La chanson que tu connais par cœur sans l'avouer&nbsp;?</li><li>Festival en plein air ou salle de concert&nbsp;?</li><li>Week-end parfait&nbsp;: grasse matinée, rando, festival ou brunch entre amis&nbsp;?</li><li>Le premier concert de ta vie&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'imaginaire',
      heading: 'Questions décalées et imaginaires (10 questions)',
      body: [
        "Pour faire rire et sortir du quotidien. Elles marchent très bien en milieu de partie, quand l'ambiance est lancée.",
        "<ul><li>Un super-pouvoir&nbsp;: voler, te téléporter, être invisible ou lire dans les pensées&nbsp;?</li><li>Tu gagnes au loto, premier réflexe&nbsp;: une maison, un tour du monde, gâter tes proches ou ne rien dire à personne&nbsp;?</li><li>Vivre sans musique ou sans téléphone pendant un an&nbsp;?</li><li>Remonter le temps ou voir le futur&nbsp;?</li><li>Être capable de parler toutes les langues ou de parler aux animaux&nbsp;?</li><li>Une île déserte&nbsp;: tu emportes un livre, une guitare ou un couteau suisse&nbsp;?</li><li>Être célèbre ou être riche, mais pas les deux&nbsp;?</li><li>Le métier que tu ferais dans une autre vie&nbsp;?</li><li>Zombies&nbsp;: tu fonces dans le tas ou tu te caches au grenier&nbsp;?</li><li>Le personnage de film qui te ressemble le plus&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'plus-loin',
      heading: 'Pour aller plus loin en petit groupe (10 questions)',
      body: [
        "Des questions ouvertes, à garder pour un dîner ou une discussion à quelques-uns, une fois que tout le monde est à l'aise.",
        "<ul><li>Qu'est-ce qui te fait rire à coup sûr&nbsp;?</li><li>Le meilleur conseil qu'on t'ait jamais donné&nbsp;?</li><li>Une passion que personne ne soupçonne chez toi&nbsp;?</li><li>Ce que tu aimerais apprendre cette année&nbsp;?</li><li>Le plus beau paysage que tu aies vu&nbsp;?</li><li>Le petit plaisir qui illumine ta journée&nbsp;?</li><li>La dernière fois que tu as fait quelque chose pour la première fois&nbsp;?</li><li>Le livre, le film ou la série que tu conseilles à tout le monde&nbsp;?</li><li>L'endroit où tu te sens le mieux&nbsp;?</li><li>Ce dont tu es le plus fier, en dehors du travail&nbsp;?</li></ul>",
      ],
    },
    {
      id: 'adapter',
      heading: 'Adapter les questions au contexte',
      body: [
        "Les mêmes questions ne s'utilisent pas partout. Voici comment piocher dans la liste selon l'événement&nbsp;:",
      ],
      table: {
        head: ['Contexte', 'Thèmes conseillés', 'À éviter'],
        rows: [
          ['Soirée entre amis d’amis', 'Tous, surtout décalées et sorties', 'Rien de trop personnel au début'],
          ['Travail, séminaire', 'Quotidien, gourmandise, voyages', 'Vie privée, salaire, opinions'],
          ['Mariage', 'Gourmandise, sorties, voyages', 'Ex, couple, questions sur les mariés trop intimes'],
          ['Soirée célibataires', 'Quotidien, décalées, sorties', 'Physique, vie amoureuse passée'],
        ],
      },
    },
    {
      id: 'jeu',
      heading: 'Transformer ces questions en jeu pour toute la salle',
      body: [
        "Poser des questions à deux ou trois personnes, c'est facile. À 80 invités, c'est une autre histoire&nbsp;: le tour de table devient interminable. La solution est de faire répondre <strong>tout le monde en même temps</strong>.",
        "C'est exactement le principe de <a href=\"/jeu-points-communs\">Matching, le jeu des points communs</a>. Vous choisissez entre 5 et 20 questions à 2, 3 ou 4 réponses (la plupart de celles de cet article fonctionnent telles quelles), chaque invité répond depuis son téléphone sans application, et l'écran géant révèle les tendances de la salle&nbsp;: «&nbsp;87&nbsp;% d'entre vous vivent avec la batterie à 3&nbsp;%&nbsp;».",
        "À la fin, chaque joueur découvre <strong>en privé</strong> les 5 personnes qui ont répondu le plus comme lui. Personne ne voit les réponses des autres, et chacun choisit s'il veut apparaître dans le classement des autres. Il ne reste plus qu'à aller se présenter. Pour d'autres formats, voyez nos <a href=\"/blog/jeux-brise-glace-soiree\">12 jeux brise-glace pour lancer une soirée</a>.",
      ],
      cards: [
        { title: 'Choisissez vos questions', desc: 'Partez du pack de 20 questions prêtes ou piochez dans cette liste, puis sauvegardez-les.' },
        { title: 'Les invités répondent', desc: 'Un QR code, un pseudo, et chacun vote depuis son téléphone, sans rien installer.' },
        { title: 'La salle découvre ses points communs', desc: 'Les tendances sur l’écran géant, puis le Top 5 privé sur chaque téléphone.' },
      ],
    },
    {
      id: 'avis-dj',
      heading: "Le conseil d'un DJ animateur",
      body: [
        "Sur le terrain, j'ai remarqué une chose&nbsp;: les questions qui marchent le mieux ne sont jamais les plus profondes, ce sont les plus <em>clivantes</em>. «&nbsp;L'ananas sur la pizza&nbsp;» déclenche plus de conversations que n'importe quelle question existentielle, parce que tout le monde a un avis tranché et qu'aucun avis n'est grave.",
        "Mon conseil&nbsp;: commencez par trois questions très légères pour que tout le monde se lance, placez une question décalée au milieu pour faire rire, et gardez celle qui divise le plus la salle pour la fin.",
      ],
    },
  ],
  faq,
  related: [
    { label: 'Matching, le jeu des points communs', href: '/jeu-points-communs' },
    { label: '12 jeux brise-glace pour lancer une soirée', href: '/blog/jeux-brise-glace-soiree' },
    { label: 'Icebreaker en entreprise', href: '/blog/icebreaker-entreprise' },
    { label: 'Soirée célibataires : briser la glace', href: '/blog/animation-soiree-celibataires' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Animation de soirée privée', href: '/animation-soiree-privee' },
  ],
  cta: {
    title: 'Posez vos questions à toute la salle',
    text: 'Avec Matching, vos invités répondent depuis leur téléphone et découvrent avec qui ils ont le plus de points communs, sans application. Testez AnimaJet gratuitement pendant 24h.',
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
