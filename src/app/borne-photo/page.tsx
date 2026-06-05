import { Metadata } from 'next'
import AnimationDetailPage, { buildAnimationJsonLd, type AnimationDetailContent } from '@/components/marketing/AnimationDetailPage'

const URL = 'https://animajet.fr/borne-photo'

export const metadata: Metadata = {
  title: 'Borne Photo Connectée | Photobooth avec Impression pour Événements',
  description: 'Une borne photo connectée avec impression instantanée et album partagé. Le photobooth nouvelle génération pour mariages, soirées et événements pro. Sans application. Essai gratuit 24h.',
  keywords: ['borne photo', 'photobooth', 'borne photo mariage', 'borne selfie', 'photobooth impression', 'borne photo événement', 'photobooth connecté'],
  alternates: { canonical: URL },
  openGraph: {
    title: 'Borne Photo Connectée | AnimaJet',
    description: 'Le photobooth nouvelle génération : impression instantanée et album partagé.',
    url: URL,
    type: 'website',
    locale: 'fr_FR',
  },
}

const content: AnimationDetailContent = {
  eyebrow: 'BORNE PHOTO',
  title: 'La borne photo connectée,',
  highlight: 'le photobooth nouvelle génération',
  intro: "Offrez à vos invités une borne photo moderne : ils prennent la pose, récupèrent leurs clichés et impriment instantanément leur souvenir. Le tout connecté à l'album partagé de votre événement, sans le matériel encombrant d'un photobooth classique.",
  image: '/images/borne-photo.png',
  what: [
    "La borne photo AnimaJet est un photobooth connecté qui tourne sur tablette ou écran tactile. Vos invités se prennent en photo, prévisualisent le résultat et peuvent l'imprimer sur le champ pour repartir avec un souvenir physique.",
    "Contrairement aux bornes traditionnelles, tout est intégré à votre événement AnimaJet : les photos rejoignent automatiquement l'album partagé et peuvent s'afficher sur le diaporama de la soirée. Vous personnalisez l'habillage avec votre logo et vos couleurs.",
    "Légère à installer et simple à utiliser, la borne photo est l'animation incontournable des mariages et des soirées d'entreprise : elle crée une file de sourires et laisse à chacun un souvenir à emporter.",
  ],
  steps: [
    { title: 'Installez la borne', desc: 'Sur tablette ou écran tactile, avec votre habillage personnalisé.' },
    { title: 'Les invités posent', desc: 'Ils se prennent en photo et prévisualisent le résultat.' },
    { title: 'Impression instantanée', desc: 'Chacun repart avec son tirage photo souvenir.' },
    { title: 'Album partagé', desc: 'Les photos rejoignent automatiquement l\'album de l\'événement.' },
  ],
  benefits: [
    { emoji: '🖨️', title: 'Impression instantanée', desc: 'Un souvenir physique à emporter, sur le moment.' },
    { emoji: '🎀', title: 'À votre image', desc: 'Habillage, logo et couleurs entièrement personnalisables.' },
    { emoji: '🔗', title: 'Connectée à l\'album', desc: 'Les photos rejoignent l\'album partagé de l\'événement.' },
    { emoji: '🧳', title: 'Sans matériel lourd', desc: 'Fonctionne sur tablette : ni cabine ni équipement encombrant.' },
    { emoji: '😄', title: 'Aimant à sourires', desc: 'Crée une file joyeuse et anime un coin de la soirée.' },
    { emoji: '📺', title: 'Diaporama en direct', desc: 'Les clichés peuvent s\'afficher sur l\'écran géant.' },
  ],
  idealFor: ['Mariages', 'Soirées d\'entreprise', 'Anniversaires', 'Inaugurations', 'Salons & stands', 'Campings'],
  faq: [
    { q: 'Faut-il un matériel spécial pour la borne photo ?', a: "La borne fonctionne sur tablette ou écran tactile. Pour l'impression, il suffit d'une imprimante photo compatible." },
    { q: 'Les photos de la borne rejoignent-elles l\'album ?', a: "Oui, elles s'intègrent automatiquement à l'album partagé de votre événement." },
    { q: 'Puis-je personnaliser l\'habillage de la borne ?', a: "Oui : logo, couleurs et arrière-plan sont entièrement personnalisables." },
    { q: 'La borne convient-elle à un mariage ?', a: "C'est l'une des animations les plus appréciées en mariage, entre souvenirs imprimés et fous rires." },
  ],
  related: [
    { label: 'Partage photo en direct', href: '/partage-photo-evenement' },
    { label: 'Animation mariage', href: '/animation-mariage-interactive' },
    { label: 'Quiz interactif', href: '/quiz-interactif' },
    { label: 'Toutes les animations', href: '/animations-interactives-evenementielles' },
  ],
}

const jsonLd = buildAnimationJsonLd({
  name: 'Borne Photo AnimaJet',
  description: 'Borne photo connectée (photobooth) avec impression instantanée et album partagé, personnalisable et sans matériel encombrant.',
  url: URL,
  serviceType: 'Borne photo / photobooth',
  faq: content.faq,
})

export default function BornePhotoPage() {
  return <AnimationDetailPage content={content} jsonLd={jsonLd} />
}
