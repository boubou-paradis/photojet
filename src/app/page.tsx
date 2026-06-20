// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  Loader2,
  Check,
  Sparkles,
  Facebook,
  Mail,
  Palette,
  ImageIcon,
  Target,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SiteHeader from '@/components/marketing/SiteHeader'
import SiteFooter from '@/components/marketing/SiteFooter'
import DemoVideo from '@/components/marketing/DemoVideo'
import HeroV5 from '@/components/marketing/HeroV5'
import { toast } from 'sonner'

// LES ANIMATIONS DISPONIBLES — uniquement les fonctionnalités réelles
const animations = [
  {
    name: 'Quiz interactif',
    img: '/images/games/quiz.png',
    href: '/quiz-interactif',
    desc: 'Questions à choix multiples, buzzer, classement en direct. Photo et audio à la révélation de la bonne réponse.',
  },
  {
    name: 'Roue de la Destinée',
    img: '/images/games/roue-de-la-destinee.png',
    href: '/roue-de-la-destinee',
    desc: 'La roue jackpot premium : gages, lots, défis. Le suspense monte sur l\'écran géant.',
  },
  {
    name: 'Photo Mystère',
    img: '/images/games/photo-mystere.png',
    href: '/photo-mystere',
    desc: 'Une photo se dévoile peu à peu. Le premier qui devine remporte la manche.',
  },
  {
    name: 'Le Bon Ordre',
    img: '/images/games/le-bon-ordre.png',
    href: '/le-bon-ordre',
    desc: 'Remettez les éléments dans le bon ordre. Réflexion et rapidité pour tous.',
  },
  {
    name: 'Partage photo en direct',
    img: '/photo-qr-partage.png',
    href: '/partage-photo-evenement',
    desc: 'Vos invités envoient leurs photos depuis leur téléphone : elles s\'affichent en direct sur écran géant.',
  },
  {
    name: 'Borne photo',
    img: '/images/borne-photo.png',
    href: '/borne-photo',
    desc: 'Une borne photo connectée avec impression instantanée et album partagé téléchargeable.',
  },
  {
    name: 'Diaporama live',
    img: '/photo-qr-partage.png',
    href: '/diaporama-live-evenement',
    desc: 'Le diaporama géant qui anime l\'écran toute la soirée : photos et messages des invités s\'enchaînent en direct.',
  },
  {
    name: 'Impression photo sur place',
    img: '/images/borne-photo.png',
    href: '/impression-photo-evenement',
    desc: 'Vos invités repartent avec leurs souvenirs imprimés, directement pendant l\'événement.',
  },
]

// POUR QUI ? — segments avec page dédiée
const segments = [
  { emoji: '🎧', label: 'DJ & animateurs', desc: 'Démarquez-vous, fidélisez vos clients, animez sans effort.', href: '/animation-dj-interactive' },
  { emoji: '💍', label: 'Mariages', desc: 'Faites participer tous les invités et créez des souvenirs.', href: '/animation-mariage-interactive' },
  { emoji: '🏢', label: 'Entreprises', desc: 'Team building, séminaires et soirées d\'entreprise.', href: '/animation-entreprise-interactive' },
  { emoji: '⛺', label: 'Campings', desc: 'Des soirées vacanciers qui rassemblent les familles.', href: '/animation-camping-interactive' },
  { emoji: '🍸', label: 'Bars & restaurants', desc: 'Remplissez votre salle en semaine et fidélisez vos clients.', href: '/animation-bar-restaurant-interactive' },
  { emoji: '🎉', label: 'Événementiel', desc: 'Tous vos événements transformés en expérience interactive.', href: '/animation-evenementielle-interactive' },
]

// GALERIE — photos réelles d'événements en priorité (ajoute tes photos dans public/images/gallery/ pour enrichir)
const galleryPhotos = [
  { src: '/photo-qr-partage.png', alt: 'Partage photo en direct sur écran géant lors d\'une soirée AnimaJet', featured: true },
  { src: '/images/games/quiz.png', alt: 'Quiz interactif AnimaJet affiché sur écran géant' },
  { src: '/images/games/roue-de-la-destinee.png', alt: 'Roue de la Destinée AnimaJet en soirée' },
  { src: '/images/borne-photo.png', alt: 'Borne photo connectée AnimaJet' },
  { src: '/images/games/photo-mystere.png', alt: 'Jeu Photo Mystère AnimaJet sur écran géant' },
]

const PRICE = 29.90
const WEEKEND_PASS_PRICE = 14.90

// FAQ — source unique : alimente le JSON-LD ET la section visible (toujours synchronisés)
const faqs = [
  {
    q: 'Comment fonctionne AnimaJet ?',
    a: "Créez votre événement en 2 minutes, partagez le QR code à vos invités, et tout s'affiche en direct sur votre écran géant. Vos invités participent aux jeux et envoient leurs photos depuis leur téléphone.",
  },
  {
    q: 'Faut-il télécharger une application ?',
    a: "Non. Vos invités scannent simplement le QR code avec l'appareil photo de leur téléphone. Aucune application à installer, ni pour vous ni pour eux.",
  },
  {
    q: 'Combien coûte AnimaJet ?',
    a: "L'abonnement est à 29,90€/mois, sans engagement et résiliable à tout moment. Un Pass Événement à 14,90€ existe pour un week-end ponctuel. Vous pouvez aussi tester gratuitement pendant 24h en semaine, sans carte bancaire.",
  },
  {
    q: 'De quoi mes invités ont-ils besoin ?',
    a: "Uniquement d'un smartphone avec une connexion internet. Ils scannent le QR code et participent immédiatement, sans compte à créer.",
  },
  {
    q: 'Puis-je personnaliser AnimaJet à mon image ?',
    a: "Oui. Affichez votre logo, votre arrière-plan et vos couleurs sur tous les écrans et QR codes. Vos invités voient votre identité, pas la nôtre.",
  },
  {
    q: 'AnimaJet convient-il à mon type d\'événement ?',
    a: "Oui : mariages, soirées d'entreprise, campings, bars, restaurants, événements DJ... AnimaJet s'adapte à tous les événements où vous voulez faire participer votre public.",
  },
]

// JSON-LD Structured Data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'AnimaJet',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: "Plateforme d'animation interactive pour événements professionnels : photos en direct, jeux interactifs, QR codes personnalisés.",
      offers: {
        '@type': 'Offer',
        price: '29.90',
        priceCurrency: 'EUR',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
      },
      featureList: [
        'Photos et messages en direct',
        'Diaporama HD temps réel',
        '4 jeux interactifs (Photo Mystère, Le Bon Ordre, Roue de la Destinée, Quiz)',
        'QR codes personnalisés',
        'Borne photo intégrée',
        'Personnalisation logo et arrière-plan',
      ],
    },
    {
      '@type': 'Organization',
      name: 'AnimaJet',
      legalName: 'MG Events Animation',
      url: 'https://animajet.fr',
      logo: 'https://animajet.fr/images/animajet_logo_principal.png',
      sameAs: [
        'https://www.facebook.com/profile.php?id=61585844578617',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: 'French',
      },
    },
    {
      '@type': 'WebSite',
      name: 'AnimaJet',
      url: 'https://animajet.fr',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://animajet.fr/?search={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a,
        },
      })),
    },
  ],
}

const howItWorks = [
  {
    step: '1',
    title: 'Créez votre événement en 2 min',
    description: 'Nom, date, personnalisation',
  },
  {
    step: '2',
    title: 'Partagez le QR code aux invités',
    description: 'Ils scannent avec leur téléphone',
  },
  {
    step: '3',
    title: 'Les photos s\'affichent en direct',
    description: 'Sur votre écran/vidéoprojecteur',
  },
  {
    step: '4',
    title: 'Lancez les jeux interactifs',
    description: 'Quiz musical, Photo Mystère, Le Bon Ordre...',
  },
]

const pricingFeatures = [
  'Photos et messages illimités',
  'Diaporama en direct HD',
  'Borne photo intégrée',
  '4 jeux interactifs (Photo Mystère, Le Bon Ordre, Roue de la Destinée, Quiz)',
  'QR codes personnalisés',
  'Personnalisation logo + arrière-plan',
  'Modération des contenus',
  'Téléchargement album ZIP',
  'Support prioritaire',
]


export default function Home() {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialSuccess, setTrialSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [trialEmail, setTrialEmail] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const searchParams = useSearchParams()

  // Pass week-end
  const [weekendPassEmail, setWeekendPassEmail] = useState('')
  const [weekendPassLoading, setWeekendPassLoading] = useState(false)
  const [showWeekendPassForm, setShowWeekendPassForm] = useState(false)
  const [weekendPassAvailable, setWeekendPassAvailable] = useState(false)
  const [nextPassStart, setNextPassStart] = useState('')

  useEffect(() => {
    // Vérifier la fenêtre week-end côté client (même logique que lib/weekend-pass.ts)
    const paris = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    const dow = paris.getDay()
    const h = paris.getHours()
    const available = (dow === 5 && h >= 12) || dow === 6 || dow === 0 || (dow === 1 && h < 12)
    setWeekendPassAvailable(available)

    if (!available) {
      // Calculer prochain vendredi 12h pour affichage
      let daysToFriday = (5 - dow + 7) % 7 || 7
      if (dow === 5 && h < 12) daysToFriday = 0
      const targetParis = new Date(paris)
      targetParis.setDate(targetParis.getDate() + daysToFriday)
      targetParis.setHours(12, 0, 0, 0)
      setNextPassStart(targetParis.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      }) + ' à 12h00')
    }
  }, [])

  // Check admin status on mount
  useEffect(() => {
    fetch('/api/auth/is-admin')
      .then((r) => r.json())
      .then((data) => { if (data.isAdmin) setIsAdmin(true) })
      .catch(() => {})
  }, [])

  // Show toast if redirected with access=expired or weekend_blocked
  useEffect(() => {
    const access = searchParams.get('access')
    if (access === 'expired') {
      toast.error('Votre essai gratuit a expiré. Abonnez-vous pour continuer !')
    } else if (access === 'weekend_blocked') {
      toast.error("L'essai gratuit est bloqué le week-end. Revenez lundi après 12h ou activez un Pass Événement.")
    }
  }, [searchParams])

  const handleCheckout = async () => {
    if (!email) {
      setError('Entrez votre email')
      return
    }

    setCheckoutLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, promoCode }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Erreur lors du paiement')
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleWeekendPassCheckout = async () => {
    if (!weekendPassEmail) { setError('Entrez votre email'); return }
    setWeekendPassLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: weekendPassEmail, productType: 'weekend_pass' }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Erreur lors du paiement')
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setWeekendPassLoading(false)
    }
  }

  const handleTrialRequest = async (emailToUse: string) => {
    if (!emailToUse) {
      setError('Entrez votre email')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailToUse)) {
      setError('Format d\'email invalide')
      return
    }

    setTrialLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/trial/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse }),
      })

      const data = await response.json()

      if (data.success) {
        setTrialSuccess(true)
        toast.success('Email envoyé ! Vérifiez votre boîte de réception.')
      } else {
        if (data.alreadyUsed) {
          setError('Vous avez déjà utilisé votre essai gratuit. Abonnez-vous pour continuer !')
        } else {
          setError(data.error || 'Erreur lors de l\'envoi')
        }
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setTrialLoading(false)
    }
  }

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen relative overflow-hidden landing-bg">
      {/* Header sticky */}
      <SiteHeader />

      {/* Social buttons - Fixed bottom left (n'entre pas en conflit avec le header) */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 items-start">
        <motion.a
          href="https://www.facebook.com/profile.php?id=61585844578617"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Facebook className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Suivez-nous</span>
        </motion.a>
        <motion.a
          href="https://chat.whatsapp.com/J8SuTrkzsAS0YFMxFhLdC4"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.65 }}
          className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-sm font-medium hidden sm:inline">Assistance</span>
        </motion.a>
      </div>

      {/* Hero V5 */}
      <HeroV5
        trialEmail={trialEmail}
        setTrialEmail={setTrialEmail}
        trialLoading={trialLoading}
        trialSuccess={trialSuccess}
        error={error}
        setError={setError}
        onTrialRequest={handleTrialRequest}
        isAdmin={isAdmin}
      />

      {/* Advantage bar */}
      <div className="relative z-10 w-full bg-[#111] border-y border-white/5 py-5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center lg:justify-between items-center gap-x-6 gap-y-4">
          {[
            { icon: '📡', title: 'Aucune application', desc: 'Aucun téléchargement, aucune installation' },
            { icon: '⏱', title: 'Mise en place express', desc: 'QR code généré en 2 secondes' },
            { icon: '📺', title: 'Affichage en direct', desc: 'Sur écran géant, ambiance garantie' },
            { icon: '👥', title: 'Pour tous vos événements', desc: 'Mariages, soirées, bars, clubs, entreprises' },
            { icon: '🌐', title: '100% en ligne', desc: 'Une simple connexion internet suffit' },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-2.5 text-sm">
              <span className="text-xl">{item.icon}</span>
              <div>
                <span className="text-white font-semibold">{item.title}</span>
                <span className="text-gray-500"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rest of the page */}
      <div className="relative z-10 content-layer">
        {/* Vidéo démo — emplacement premium (remplacer le poster + lien par l'embed vidéo final) */}
        <section id="video" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                EN ACTION
              </span>
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Voyez l&apos;ambiance, pas l&apos;interface
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Quelques secondes pour comprendre ce que vivent vos invités avec AnimaJet.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <DemoVideo />
            </motion.div>
          </div>
        </section>

        {/* How it works Section */}
        <section id="how-it-works" className="py-20 px-4 section-glow">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Comment ça marche ?
              </h2>
              <p className="text-gray-400 text-lg">
                En 4 étapes simples, boostez vos prestations
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howItWorks.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative"
                >
                  {/* Connection line */}
                  {i < howItWorks.length - 1 && (
                    <div className="hidden lg:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-40px)] h-0.5 bg-gradient-to-r from-[#D4AF37]/50 to-[#D4AF37]/20" />
                  )}

                  <div className="card-float rounded-2xl p-6 border-[#D4AF37]/20 hover:border-[#D4AF37]/40 h-full">
                    {/* Step number */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center mb-4 shadow-lg shadow-[#D4AF37]/30">
                      <span className="text-2xl font-bold text-[#0D0D0F]">{item.step}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Les animations disponibles */}
        <section id="animations" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                LES ANIMATIONS
              </span>
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Une animation pour chaque moment
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Vos invités participent depuis leur téléphone, tout s&apos;affiche en direct sur écran géant. Sans application à installer.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {animations.map((a, i) => (
                <motion.div
                  key={a.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.1 }}
                >
                  <Link
                    href={a.href}
                    className="card-float rounded-2xl overflow-hidden border-[#D4AF37]/15 hover:border-[#D4AF37]/40 group flex flex-col h-full"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={a.img}
                        alt={`Animation ${a.name} AnimaJet sur écran géant`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-[#0D0D0F]/20 to-transparent" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-white mb-2">{a.name}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed flex-1">{a.desc}</p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] group-hover:gap-2.5 transition-all">
                        En savoir plus
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                href="/#essai"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C349] to-[#D4AF37] text-[#0D0D0F] font-bold hover:brightness-110 shadow-[0_4px_24px_rgba(212,175,55,0.25)] transition-all"
              >
                Tester gratuitement toutes les animations
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Pour qui ? */}
        <section id="pour-qui" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                POUR QUI ?
              </span>
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Pensé pour les pros de l&apos;événementiel
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Quel que soit votre métier, AnimaJet transforme votre événement en expérience interactive.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {segments.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.08 }}
                >
                  <Link
                    href={s.href}
                    className="card-float rounded-2xl p-6 border-[#D4AF37]/15 hover:border-[#D4AF37]/40 h-full flex flex-col group"
                  >
                    <div className="text-3xl mb-3">{s.emoji}</div>
                    <h3 className="text-lg font-bold text-white mb-1.5">{s.label}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed flex-1">{s.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] group-hover:gap-2.5 transition-all">
                      Découvrir
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Tout explorer — hub & guide */}
        <section className="py-20 px-4 section-glow">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                TOUT EXPLORER
              </span>
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Explorez AnimaJet en profondeur
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Le panorama complet des fonctionnalités et le guide des animations interactives.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Link
                  href="/fonctionnalites"
                  className="card-float rounded-2xl p-8 border-[#D4AF37]/15 hover:border-[#D4AF37]/40 group flex flex-col h-full"
                >
                  <h3 className="text-xl font-bold text-white mb-2">Toutes les fonctionnalités</h3>
                  <p className="text-gray-400 text-sm leading-relaxed flex-1">
                    Quiz, photos en direct, impression sur place, diaporama, jeux interactifs… le panorama complet d&apos;AnimaJet, fonctionnalité par fonctionnalité.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] group-hover:gap-2.5 transition-all">
                    Voir les fonctionnalités
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <Link
                  href="/animations-interactives-evenementielles"
                  className="card-float rounded-2xl p-8 border-[#D4AF37]/15 hover:border-[#D4AF37]/40 group flex flex-col h-full"
                >
                  <h3 className="text-xl font-bold text-white mb-2">Le guide des animations interactives</h3>
                  <p className="text-gray-400 text-sm leading-relaxed flex-1">
                    Comprendre les animations interactives événementielles : principes, intérêt pour les pros et mise en place, sans application.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#D4AF37] group-hover:gap-2.5 transition-all">
                    Lire le guide
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Customization Section */}
        <section className="py-20 px-4 section-glow">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
                100% personnalisable à votre image
              </h2>
              <p className="text-gray-400 text-lg">
                Votre logo, vos couleurs, votre identité
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Palette,
                  title: 'Votre logo',
                  description: 'Affichez votre logo sur tous les écrans et QR codes',
                },
                {
                  icon: ImageIcon,
                  title: 'Arrière-plan personnalisé',
                  description: 'Importez votre propre image pour le diaporama',
                },
                {
                  icon: Target,
                  title: 'Votre marque partout',
                  description: 'Les invités voient VOTRE identité, pas la nôtre',
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="card-float rounded-2xl p-6 border-[#D4AF37]/20 hover:border-[#D4AF37]/40 text-center"
                >
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#D4AF37]/10 flex items-center justify-center mb-4 border border-[#D4AF37]/30">
                    <feature.icon className="h-8 w-8 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Galerie */}
        <section id="galerie" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                GALERIE
              </span>
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                AnimaJet en images
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Des soirées qui prennent vie : vos invités participent, l&apos;ambiance monte, les souvenirs s&apos;affichent en grand.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[140px] md:auto-rows-[190px]">
              {galleryPhotos.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 5) * 0.07 }}
                  className={`relative overflow-hidden rounded-2xl border border-white/10 group ${
                    p.featured ? 'col-span-2 row-span-2' : ''
                  }`}
                >
                  <Image
                    src={p.src}
                    alt={p.alt}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes={p.featured ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Développé par un DJ animateur */}
        <section id="histoire" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="card-float rounded-3xl p-8 md:p-12 border-[#D4AF37]/20"
            >
              <div className="grid md:grid-cols-[1fr_1.4fr] gap-8 md:gap-12 items-center">
                {/* Visuel — à remplacer par une photo du fondateur en prestation */}
                <div className="relative aspect-square rounded-2xl overflow-hidden border border-[#D4AF37]/20">
                  <Image
                    src="/images/hero-animajet.png"
                    alt="Fondateur d'AnimaJet, DJ animateur en prestation"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 40vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F]/60 to-transparent" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                    L&apos;HISTOIRE
                  </span>
                  <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
                    Développé par un DJ animateur,<br className="hidden md:block" /> pour les DJ animateurs
                  </h2>
                  <div className="space-y-4 text-gray-300 leading-relaxed">
                    <p>
                      AnimaJet n&apos;est pas né dans un bureau. Il est né derrière les platines.
                    </p>
                    <p>
                      Après des années à animer des soirées, mariages et événements, le fondateur a vécu les mêmes galères que vous : des invités scotchés à leur chaise, des animations qui retombent, du matériel compliqué à transporter et à installer.
                    </p>
                    <p>
                      Il a donc créé l&apos;outil qu&apos;il aurait rêvé d&apos;avoir : une plateforme simple qui fait participer toute la salle depuis un téléphone, et qui affiche tout en direct sur écran géant. Chaque animation a été pensée et <span className="text-white font-medium">testée sur le terrain, en conditions réelles</span>, soirée après soirée.
                    </p>
                  </div>
                  <p className="mt-6 text-[#D4AF37] font-semibold italic text-lg">
                    « L&apos;expérience d&apos;un animateur, transformée en logiciel. »
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Un prix simple, tout inclus
              </h2>
              <p className="text-gray-400 text-lg">
                Choisissez la formule adaptée à votre événement
              </p>
            </motion.div>

            <div className="flex flex-col lg:flex-row justify-center gap-6 items-stretch">
              {/* Subscription Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="card-float rounded-2xl p-8 relative overflow-hidden border-[#D4AF37]/30 w-full max-w-md"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37]" />
                <div className="absolute top-0 right-0 bg-[#D4AF37] text-[#0f0f12] px-4 py-1.5 rounded-bl-xl font-bold text-sm">
                  TOUT INCLUS
                </div>

                <div className="mb-6 pt-4">
                  <h3 className="text-2xl font-bold text-white mb-2">Abonnement Mensuel</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">{PRICE.toFixed(2).replace('.', ',')}€</span>
                    <span className="text-gray-500">/mois</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {pricingFeatures.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-400 text-sm">
                      <Check className="h-4 w-4 text-[#D4AF37] flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Checkout Form */}
                <div className="space-y-3">
                  {showSubscriptionForm ? (
                    <>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                          type="email"
                          name="subscription-email"
                          autoComplete="off"
                          placeholder="votre@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoFocus
                          className="pl-10 h-11 bg-[#1A1A1E] border-[#3a3a3a] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-gray-500 input-gold"
                        />
                      </div>

                      {showPromo ? (
                        <Input
                          type="text"
                          placeholder="Code promo (optionnel)"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          className="h-11 bg-[#1A1A1E] border-[#3a3a3a] focus:border-[#D4AF37] text-white uppercase placeholder:text-gray-500 input-gold"
                        />
                      ) : (
                        <button
                          onClick={() => setShowPromo(true)}
                          className="text-sm text-[#D4AF37] hover:text-[#F4E4BC] transition-colors"
                        >
                          J&apos;ai un code promo
                        </button>
                      )}

                      <Button
                        onClick={handleCheckout}
                        disabled={checkoutLoading || !email}
                        className="w-full h-12 btn-shimmer text-[#0f0f12] font-semibold text-lg border-0"
                      >
                        {checkoutLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Payer {PRICE.toFixed(2).replace('.', ',')}€
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-gray-600 text-center">
                        Paiement sécurisé par Stripe. Annulable à tout moment.
                      </p>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => setShowSubscriptionForm(true)}
                        className="w-full h-12 btn-shimmer text-[#0f0f12] font-semibold text-lg border-0"
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        S&apos;abonner maintenant
                      </Button>
                    </>
                  )}
                </div>

                {/* Lien connexion */}
                <div className="mt-6 pt-6 border-t border-[#D4AF37]/10">
                  <p className="text-center text-sm text-gray-500">
                    Déjà abonné ?{' '}
                    <a href="/login" className="text-[#D4AF37] hover:text-[#F4E4BC] transition-colors font-medium">
                      Se connecter
                    </a>
                  </p>
                </div>
              </motion.div>

              {/* Pass Week-end Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="card-float rounded-2xl p-8 relative overflow-hidden border-white/10 w-full max-w-md"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-400 to-violet-500" />
                <div className="absolute top-0 right-0 bg-violet-500 text-white px-4 py-1.5 rounded-bl-xl font-bold text-sm">
                  PONCTUEL
                </div>

                <div className="mb-6 pt-4">
                  <h3 className="text-2xl font-bold text-white mb-1">Pass Événement</h3>
                  <p className="text-sm text-gray-500 mb-3">Vendredi 12h → Lundi 12h</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">{WEEKEND_PASS_PRICE.toFixed(2).replace('.', ',')}€</span>
                    <span className="text-gray-500">one-shot</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {[
                    'Accès complet 1 week-end',
                    'Photos et messages illimités',
                    'Tous les jeux interactifs',
                    'Borne photo intégrée',
                    'Sans abonnement, sans engagement',
                    'Album ZIP téléchargeable',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-400 text-sm">
                      <Check className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {weekendPassAvailable ? (
                  <div className="space-y-3">
                    {showWeekendPassForm ? (
                      <>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            type="email"
                            placeholder="votre@email.com"
                            value={weekendPassEmail}
                            onChange={(e) => setWeekendPassEmail(e.target.value)}
                            autoFocus
                            className="pl-10 h-11 bg-[#1A1A1E] border-[#3a3a3a] focus:border-violet-500 text-white placeholder:text-gray-500"
                          />
                        </div>
                        <Button
                          onClick={handleWeekendPassCheckout}
                          disabled={weekendPassLoading || !weekendPassEmail}
                          className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-lg border-0 hover:opacity-90"
                        >
                          {weekendPassLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5 mr-2" />
                              Payer {WEEKEND_PASS_PRICE.toFixed(2).replace('.', ',')}€
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-gray-600 text-center">Paiement sécurisé par Stripe. Accès immédiat.</p>
                      </>
                    ) : (
                      <Button
                        onClick={() => setShowWeekendPassForm(true)}
                        className="w-full h-12 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-lg border-0 hover:opacity-90"
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        Obtenir le pass week-end
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button disabled className="w-full h-12 bg-[#2A2A2E] text-gray-500 font-semibold text-base border border-white/5 cursor-not-allowed">
                      Disponible vendredi 12h00
                    </Button>
                    {nextPassStart && (
                      <p className="text-xs text-gray-600 text-center">
                        Prochain accès : {nextPassStart}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-white/5">
                  <p className="text-center text-xs text-gray-600">
                    Idéal pour un événement ponctuel sans abonnement mensuel
                  </p>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-4 section-glow scroll-mt-20">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-bold tracking-wide mb-4">
                FAQ
              </span>
              <h2 className="font-heading text-4xl font-bold text-white mb-4">
                Questions fréquentes
              </h2>
              <p className="text-gray-400 text-lg">
                Tout ce qu&apos;il faut savoir avant de vous lancer.
              </p>
            </motion.div>

            <div className="space-y-3">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group card-float rounded-xl border-[#D4AF37]/15 px-5 [&[open]]:border-[#D4AF37]/40"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer py-4 list-none [&::-webkit-details-marker]:hidden text-white font-semibold">
                    {f.q}
                    <ChevronDown className="h-5 w-5 text-[#D4AF37] flex-shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 text-gray-400 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <SiteFooter />
      </div>
      </div>
    </>
  )
}
