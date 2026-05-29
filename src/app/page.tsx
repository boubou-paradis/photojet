// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Loader2,
  Check,
  Sparkles,
  Facebook,
  Mail,
  Palette,
  ImageIcon,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Footer from '@/components/Footer'
import HeroV5 from '@/components/marketing/HeroV5'
import { toast } from 'sonner'

const PRICE = 29.90
const WEEKEND_PASS_PRICE = 14.90

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
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '47',
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
      mainEntity: [
        {
          '@type': 'Question',
          name: "Comment fonctionne AnimaJet ?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Créez votre événement en 2 minutes, partagez le QR code aux participants, et les photos s'affichent en direct sur votre écran. Lancez ensuite les jeux interactifs pour animer votre soirée.",
          },
        },
        {
          '@type': 'Question',
          name: "Combien coûte AnimaJet ?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "AnimaJet propose un abonnement mensuel à 29,90€/mois, résiliable à tout moment. Vous avez accès à toutes les fonctionnalités : photos en direct, jeux interactifs, borne photo, personnalisation complète.",
          },
        },
        {
          '@type': 'Question',
          name: "AnimaJet fonctionne-t-il sans application à télécharger ?",
          acceptedAnswer: {
            '@type': 'Answer',
            text: "Oui, les participants scannent simplement le QR code avec leur téléphone. Aucune application à installer.",
          },
        },
      ],
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
      {/* Social buttons - Fixed top right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end">
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

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 section-glow">
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

        {/* Footer */}
        <footer className="mt-auto pb-4">
          <div className="text-center text-xs text-gray-600">
            <Footer />
          </div>
        </footer>
      </div>
      </div>
    </>
  )
}
