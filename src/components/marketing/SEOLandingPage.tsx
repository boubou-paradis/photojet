'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Loader2,
  Check,
  Sparkles,
  Facebook,
  Gift,
  Mail,
  CheckCircle,
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
  '7 jeux interactifs',
  'QR codes personnalisés',
  'Personnalisation logo + arrière-plan',
  'Modération des contenus',
  'Téléchargement album ZIP',
  'Support prioritaire',
  'Utilisable 7j/7 y compris week-end',
]

const trialFeatures = [
  'Toutes les fonctionnalités',
  'Valide du lundi au jeudi',
  'Sans carte bancaire',
]

interface SEOLandingPageProps {
  headline: string
  highlightedText: string
  subtitle: string
  targets: string[]
  jsonLd: object
}

export default function SEOLandingPage({
  headline,
  highlightedText,
  subtitle,
  targets,
  jsonLd,
}: SEOLandingPageProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialSuccess, setTrialSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [trialEmail, setTrialEmail] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)

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

  const handleTrialRequest = async (emailToUse: string) => {
    if (!emailToUse) {
      setError('Entrez votre email')
      return
    }

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
        {/* Facebook Button */}
        <motion.a
          href="https://www.facebook.com/profile.php?id=61585844578617"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <Facebook className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Suivez-nous</span>
        </motion.a>

        {/* Hero with custom content */}
        <HeroV5
          trialEmail={trialEmail}
          setTrialEmail={setTrialEmail}
          trialLoading={trialLoading}
          trialSuccess={trialSuccess}
          error={error}
          setError={setError}
          onTrialRequest={handleTrialRequest}
          headline={headline}
          highlightedText={highlightedText}
          subtitle={subtitle}
          targets={targets}
        />

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
                  En 4 étapes simples, animez vos événements comme un pro
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
                    {i < howItWorks.length - 1 && (
                      <div className="hidden lg:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-40px)] h-0.5 bg-gradient-to-r from-[#D4AF37]/50 to-[#D4AF37]/20" />
                    )}

                    <div className="card-float rounded-2xl p-6 border-[#D4AF37]/20 hover:border-[#D4AF37]/40 h-full">
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
                  Testez gratuitement, abonnez-vous pour le week-end
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
                {/* Trial Card */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="card-float rounded-2xl p-8 relative overflow-hidden border-2 border-emerald-500/50 md:scale-105"
                  style={{ boxShadow: '0 0 40px rgba(16, 185, 129, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1.5 rounded-bl-xl font-bold text-sm">
                    RECOMMANDÉ
                  </div>

                  <div className="mb-6 pt-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border-2 border-emerald-500/30">
                      <Gift className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Essai Gratuit 24h</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-emerald-500">0€</span>
                      <span className="text-gray-500">pour tester</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {trialFeatures.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                        <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        value={trialEmail}
                        onChange={(e) => {
                          setTrialEmail(e.target.value)
                          setError(null)
                        }}
                        className="pl-11 h-12 bg-[#1A1A1E] border-[#3a3a3a] focus:border-emerald-500 focus:ring-emerald-500/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <Button
                      onClick={() => handleTrialRequest(trialEmail)}
                      disabled={trialLoading || !trialEmail || trialSuccess}
                      className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-500/25"
                    >
                      {trialLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : trialSuccess ? (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Email envoyé !
                        </>
                      ) : (
                        <>
                          Recevoir mon accès gratuit
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                      Sans carte bancaire • Accès immédiat par email
                    </p>
                  </div>
                </motion.div>

                {/* Subscription Card */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="card-float rounded-2xl p-8 relative overflow-hidden border-[#D4AF37]/30"
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

                  <div className="space-y-3">
                    {showSubscriptionForm ? (
                      <>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                          <Input
                            type="email"
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
                        <p className="text-xs text-gray-500 text-center">
                          Utilisable 7j/7 y compris le week-end
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-[#D4AF37]/10">
                    <p className="text-center text-sm text-gray-500">
                      Déjà abonné ?{' '}
                      <a href="/login" className="text-[#D4AF37] hover:text-[#F4E4BC] transition-colors font-medium">
                        Se connecter
                      </a>
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
