import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'
import QuizDeviceShowcase from '@/components/marketing/quiz-mariage/QuizDeviceShowcase'

const URL = 'https://animajet.fr/quiz-mariage'

export const metadata: Metadata = {
  title: 'Quiz Mariage Interactif | Quiz des Mariés sur Écran Géant',
  description: 'Créez un quiz de mariage interactif : « connaissez-vous les mariés ? », blind test musical, réponses depuis le téléphone et classement en direct sur écran géant. Sans application. Essai gratuit 24h.',
  keywords: ['quiz mariage', 'quiz des mariés', 'quiz pour les mariés', 'quiz connaissez-vous les mariés', 'jeu mariage interactif', 'quiz interactif mariage', 'quiz mariage smartphone'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Quiz Mariage Interactif | AnimaJet',
    description: 'Le quiz des mariés sur écran géant : vos invités répondent depuis leur téléphone, le classement s\'affiche en direct.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'QUIZ MARIAGE',
  title: 'Le quiz des mariés',
  highlight: 'qui fait participer toute la salle',
  intro: "« Connaissez-vous vraiment les mariés ? » Créez un quiz de mariage interactif où vos invités répondent depuis leur téléphone et voient le classement s'afficher en direct sur écran géant. Questions sur le couple, blind test musical, anecdotes : l'animation qui réunit toutes les générations, sans application.",
  image: '/images/games/quiz.png',
  what: [
    "Le quiz de mariage est devenu un incontournable de la soirée : il fait participer les invités, déclenche les rires et met le couple à l'honneur. Avec AnimaJet, vous préparez vos propres questions — comment les mariés se sont rencontrés, leur première destination de voyage, leur chanson… — et les invités répondent en quelques secondes depuis leur smartphone. Bonnes réponses, rapidité et classement s'affichent en temps réel sur l'écran.",
    "Vous pouvez mêler les formats : des questions « connaissez-vous les mariés ? », un blind test musical pour réchauffer la piste, et même des photos à la révélation des réponses. Tout passe par un QR code : aucun téléchargement, aucune application, ni pour vous ni pour vos invités. Des enfants aux grands-parents, tout le monde joue depuis son propre téléphone.",
    "Que vous soyez les mariés qui préparez la surprise ou le DJ qui anime la soirée, la mise en place tient en quelques minutes et vous gardez la main sur le rythme. Le quiz se lance entre deux moments forts, relance l'énergie et laisse un souvenir collectif que les invités évoquent encore longtemps après.",
  ],
  steps: [
    { title: 'Préparez vos questions', desc: 'Sur le couple, des anecdotes, ou un blind test musical.' },
    { title: 'Partagez le QR code', desc: 'Les invités rejoignent le quiz en quelques secondes.' },
    { title: 'Lancez le quiz', desc: 'Chacun répond depuis son téléphone, le classement s\'affiche en direct.' },
    { title: 'Couronnez le gagnant', desc: 'Podium sur écran géant et applaudissements garantis.' },
  ],
  benefits: [
    { emoji: '💍', title: 'Quiz des mariés', desc: '« Connaissez-vous les mariés ? » : le format qui fait rire toute la salle.' },
    { emoji: '🎵', title: 'Blind test musical', desc: 'Ajoutez des extraits musicaux pour réchauffer la piste.' },
    { emoji: '🏆', title: 'Classement en direct', desc: 'Bonnes réponses et rapidité affichées en temps réel sur écran géant.' },
    { emoji: '👵', title: 'Toutes les générations', desc: 'Des enfants aux grands-parents : un QR code et tout le monde joue.' },
    { emoji: '✍️', title: 'Questions sur mesure', desc: 'Vous créez vos propres questions, adaptées au couple et aux invités.' },
    { emoji: '📱', title: 'Sans application', desc: 'Vos invités répondent dans leur navigateur, aucun téléchargement.' },
  ],
  idealFor: ['Futurs mariés', 'DJ de mariage', 'Animateurs', 'Témoins & organisateurs', 'Wedding planners', 'Salles de réception'],
  faq: [
    { q: 'Comment créer un quiz « connaissez-vous les mariés ? »', a: "Vous rédigez vos propres questions sur le couple (rencontre, voyage, goûts, anecdotes), puis vos invités y répondent depuis leur téléphone après avoir scanné un QR code. Les bonnes réponses et le classement s'affichent en direct sur l'écran." },
    { q: 'Les invités doivent-ils installer une application ?', a: "Non. Ils scannent un QR code et participent directement dans le navigateur de leur téléphone, sans aucune application ni compte à créer." },
    { q: 'Peut-on ajouter un blind test musical au quiz de mariage ?', a: "Oui. Le quiz permet d'intégrer des extraits musicaux : les invités reconnaissent les titres et répondent depuis leur téléphone, avec un classement en temps réel." },
    { q: 'Qui peut animer le quiz, les mariés ou le DJ ?', a: "Les deux. La préparation se fait en quelques minutes et le pilotage est simple : que vous soyez les mariés qui préparent une surprise ou le DJ qui anime, vous gardez la main sur le déroulé du début à la fin." },
  ],
  related: [
    { label: 'Animation de mariage', href: '/animation-mariage-interactive' },
    { label: 'Blind test mariage', href: '/blind-test-mariage' },
    { label: 'Diaporama live mariage', href: '/diaporama-live-mariage' },
    { label: 'Logiciel DJ mariage', href: '/logiciel-dj-mariage' },
    { label: 'Quiz & blind test', href: '/quiz-interactif' },
    { label: "25 idées d'animation pour mariage", href: '/blog/idees-animation-mariage' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Quiz Mariage Interactif AnimaJet',
  description: 'Quiz de mariage interactif : quiz des mariés, blind test musical, réponses depuis le téléphone et classement en direct sur écran géant, sans application.',
  url: URL,
  serviceType: 'Quiz de mariage interactif',
  faq: content.faq,
})

export default function QuizMariagePage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} hero={<QuizDeviceShowcase />} />
}
