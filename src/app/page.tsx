// © 2025 AnimaJet - MG Events Animation. Tous droits réservés.
// Code propriétaire - Reproduction interdite.

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  ArrowRight,
  Loader2,
  Check,
  Camera,
  Tv,
  QrCode,
  Gamepad2,
  Sparkles,
  Facebook,
  Gift,
  Play,
  MessageSquareQuote,
  Star,
  Mail,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { ShutterIcon } from '@/components/branding/AnimaJetLogo'
import Footer from '@/components/Footer'
import { toast } from 'sonner'

const PRICE = 29.90

const features = [
  { icon: Camera, text: 'Photos illimitées' },
  { icon: Tv, text: 'Diaporama en direct' },
  { icon: QrCode, text: 'QR codes personnalisés' },
  { icon: Gamepad2, text: '7 jeux interactifs' },
]

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

// Floating particles configuration
const particles = [
  { id: 1, size: 4, left: '10%', top: '20%', className: 'particle-1' },
  { id: 2, size: 6, left: '85%', top: '15%', className: 'particle-2' },
  { id: 3, size: 3, left: '70%', top: '60%', className: 'particle-3' },
  { id: 4, size: 5, left: '15%', top: '70%', className: 'particle-4' },
  { id: 5, size: 4, left: '90%', top: '80%', className: 'particle-5' },
  { id: 6, size: 3, left: '5%', top: '50%', className: 'particle-2' },
  { id: 7, size: 5, left: '50%', top: '85%', className: 'particle-1' },
  { id: 8, size: 4, left: '30%', top: '10%', className: 'particle-3' },
]

export default function Home() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialSuccess, setTrialSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [trialEmail, setTrialEmail] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Show toast if redirected with access=expired
  useEffect(() => {
    if (searchParams.get('access') === 'expired') {
      toast.error('Votre essai gratuit a expiré. Abonnez-vous pour continuer !')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || code.length !== 4) {
      setError('Entrez un code à 4 caractères')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, expires_at, is_active')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setError('Code invalide ou session expirée')
        return
      }

      const now = new Date()
      const expiresAt = new Date(data.expires_at)
      if (expiresAt < now) {
        setError('Cette session a expiré')
        return
      }

      router.push(`/invite/${code.toUpperCase()}`)
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

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

  const scrollToHow = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background - Premium dark with animated effects */}
      <div className="fixed inset-0 bg-[#0D0D0F]">
        {/* Animated blur orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-[#D4AF37]/5 to-transparent rounded-full" />
        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-[#D4AF37]/8 blur-[150px] rounded-full" />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className={`particle ${particle.className}`}
            style={{
              width: particle.size,
              height: particle.size,
              left: particle.left,
              top: particle.top,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      {/* Decorative elements */}
      <div className="fixed top-16 left-8 opacity-[0.03] spin-very-slow hidden md:block">
        <ShutterIcon size={180} />
      </div>
      <div className="fixed bottom-16 right-8 opacity-[0.04] spin-very-slow hidden md:block" style={{ animationDirection: 'reverse' }}>
        <ShutterIcon size={160} />
      </div>

      <div className="relative z-10">
        {/* Facebook Button - Fixed top right */}
        <motion.a
          href="https://www.facebook.com/profile.php?id=61585844578617"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          <Facebook className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:inline">Suivez-nous</span>
        </motion.a>

        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Logo avec effet glow */}
            <motion.div
              className="flex flex-col items-center justify-center mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="logo-glow mb-4 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="AnimaJet"
                  width={375}
                  height={375}
                  className="w-[200px] md:w-[280px] lg:w-[340px] h-auto"
                  priority
                />
              </div>
            </motion.div>

            {/* Tagline */}
            <motion.h1
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Vos invités participent,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]">
                votre soirée décolle
              </span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-gray-400 mb-2 max-w-2xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Photos en direct sur grand écran • Quiz musicaux • 7 jeux interactifs
            </motion.p>

            {/* Trial Form in Hero */}
            <motion.div
              className="mt-8 max-w-md mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="bg-[#1A1A1E]/80 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Gift className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-bold text-white">Essayez gratuitement 24h</h3>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Recevez votre accès par email (valide du lundi au jeudi)
                </p>

                {trialSuccess ? (
                  <div className="text-center py-4">
                    <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-emerald-400 font-medium">Email envoyé !</p>
                    <p className="text-sm text-gray-400 mt-1">Vérifiez votre boîte de réception</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        value={trialEmail}
                        onChange={(e) => {
                          setTrialEmail(e.target.value)
                          setError(null)
                        }}
                        className="pl-10 h-12 bg-[#0D0D0F] border-[#3a3a3a] focus:border-emerald-500 focus:ring-emerald-500/20 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <Button
                      onClick={() => handleTrialRequest(trialEmail)}
                      disabled={trialLoading || !trialEmail}
                      className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                    >
                      {trialLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-500 text-center mt-3">{error}</p>
                )}

                <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Sans carte bancaire
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Accès immédiat
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Toutes les fonctionnalités
                  </span>
                </div>
              </div>
            </motion.div>

            {/* See how it works button */}
            <motion.div
              className="mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                onClick={scrollToHow}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                <Play className="h-4 w-4 mr-2" />
                Voir comment ça marche
              </Button>
            </motion.div>

            {/* Features mini grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-2xl mx-auto">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="flex flex-col items-center gap-2 p-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/20">
                    <feature.icon className="h-6 w-6 text-[#D4AF37]" />
                  </div>
                  <span className="text-sm text-gray-400">{feature.text}</span>
                </motion.div>
              ))}
            </div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="animate-bounce mt-12"
            >
              <ArrowRight className="h-6 w-6 text-[#D4AF37] rotate-90 mx-auto" />
            </motion.div>
          </motion.div>
        </section>

        {/* How it works Section */}
        <section id="how-it-works" className="py-20 px-4">
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
                  {/* Connection line */}
                  {i < howItWorks.length - 1 && (
                    <div className="hidden lg:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-40px)] h-0.5 bg-gradient-to-r from-[#D4AF37]/50 to-[#D4AF37]/20" />
                  )}

                  <div className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-6 border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 transition-all h-full">
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

        {/* Social Proof Section */}
        <section className="py-16 px-4 bg-[#1A1A1E]/50">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              {/* Testimonial */}
              <div className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-8 border border-[#D4AF37]/20 mb-8">
                <MessageSquareQuote className="h-10 w-10 text-[#D4AF37] mx-auto mb-4" />
                <blockquote className="text-xl md:text-2xl text-white font-medium mb-4 italic">
                  &ldquo;Mes invités ont adoré partager leurs photos en direct !&rdquo;
                </blockquote>
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <span className="font-semibold text-[#D4AF37]">— Guillaume</span>
                  <span>• DJ mariage Bretagne</span>
                </div>
                <div className="flex justify-center mt-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-[#D4AF37] fill-[#D4AF37]" />
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-[#D4AF37]">50+</div>
                  <div className="text-gray-400 text-sm">événements animés</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#D4AF37]">2000+</div>
                  <div className="text-gray-400 text-sm">photos partagées</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#D4AF37]">100%</div>
                  <div className="text-gray-400 text-sm">clients satisfaits</div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4">
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

            <div className="grid md:grid-cols-3 gap-8 items-start">
              {/* Trial Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden border border-emerald-500/30"
              >
                <div className="absolute top-0 right-0 bg-emerald-500 text-white px-4 py-1 rounded-bl-xl font-bold text-sm">
                  GRATUIT
                </div>

                <div className="mb-6 pt-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/30">
                    <Gift className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Essai 24h</h3>
                  <p className="text-4xl font-bold text-white">0€</p>
                </div>

                <ul className="space-y-3 mb-6">
                  {trialFeatures.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-400 text-sm">
                      <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Trial Form */}
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="email"
                      placeholder="votre@email.com"
                      value={trialEmail}
                      onChange={(e) => {
                        setTrialEmail(e.target.value)
                        setError(null)
                      }}
                      className="pl-10 h-11 bg-[#1A1A1E] border-[#3a3a3a] focus:border-emerald-500 focus:ring-emerald-500/20 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <Button
                    onClick={() => handleTrialRequest(trialEmail)}
                    disabled={trialLoading || !trialEmail || trialSuccess}
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
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
                        Recevoir mon accès
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>

              {/* Subscription Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden border border-[#D4AF37]/30 shadow-2xl shadow-black/50 md:scale-105"
                style={{ boxShadow: '0 0 40px rgba(212, 175, 55, 0.1), 0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
              >
                <div className="absolute top-0 right-0 bg-[#D4AF37] text-[#0f0f12] px-4 py-1 rounded-bl-xl font-bold text-sm">
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
                    <Button
                      onClick={() => setShowSubscriptionForm(true)}
                      className="w-full h-12 btn-shimmer text-[#0f0f12] font-semibold text-lg border-0"
                    >
                      <Sparkles className="h-5 w-5 mr-2" />
                      S&apos;abonner maintenant
                    </Button>
                  )}
                </div>
              </motion.div>

              {/* Join Session Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-6 border border-[#D4AF37]/20"
              >
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/30">
                    <QrCode className="h-7 w-7 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Vous êtes invité ?</h3>
                  <p className="text-gray-400 text-sm">
                    Entrez le code de l&apos;événement pour partager vos photos
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="text"
                    maxLength={4}
                    placeholder="CODE"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase())
                      setError(null)
                    }}
                    className="text-center text-3xl font-mono tracking-[0.3em] h-14 bg-[#1A1A1E] border-[#3a3a3a] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white uppercase placeholder:text-gray-500 input-gold"
                  />

                  <Button
                    type="submit"
                    disabled={loading || code.length !== 4}
                    className="w-full h-12 btn-shimmer text-[#0f0f12] font-semibold text-lg border-0"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Rejoindre l&apos;événement
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>

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
  )
}
