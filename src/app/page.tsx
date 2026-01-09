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
  Mail,
  CheckCircle,
  Palette,
  ImageIcon,
  Target,
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
            {/* Logo sans cadre - fond transparent */}
            <motion.div
              className="flex flex-col items-center justify-center mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <Image
                src="/logo.png"
                alt="AnimaJet"
                width={375}
                height={375}
                className="w-[200px] md:w-[280px] lg:w-[340px] h-auto drop-shadow-[0_0_30px_rgba(212,175,55,0.3)]"
                priority
              />
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
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        value={trialEmail}
                        onChange={(e) => {
                          setTrialEmail(e.target.value)
                          setError(null)
                        }}
                        className="pl-12 h-14 text-lg bg-[#0D0D0F] border-[#3a3a3a] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 text-white placeholder:text-gray-500 rounded-xl"
                      />
                    </div>
                    <Button
                      onClick={() => handleTrialRequest(trialEmail)}
                      disabled={trialLoading || !trialEmail}
                      className="w-full h-14 bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#D4AF37] hover:opacity-90 text-[#0D0D0F] font-bold text-lg rounded-xl shadow-lg shadow-[#D4AF37]/25 transition-all hover:shadow-[#D4AF37]/40"
                    >
                      {trialLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Recevoir mon accès
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
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

        {/* Video/Demo Section */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8"
            >
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
                Voir AnimaJet en action
              </h2>
              <p className="text-gray-400 text-lg">
                Découvrez comment animer vos événements en quelques clics
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video bg-[#1A1A1E] rounded-2xl overflow-hidden border border-[#D4AF37]/20"
            >
              {/* Placeholder pour vidéo YouTube - remplacer VIDEO_ID par l'ID de ta vidéo */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#242428] to-[#1A1A1E]">
                <div className="w-20 h-20 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mb-4 border-2 border-[#D4AF37]/30">
                  <Play className="h-10 w-10 text-[#D4AF37] ml-1" />
                </div>
                <p className="text-gray-400 text-sm">Vidéo de démonstration à venir</p>
                <p className="text-gray-500 text-xs mt-2">
                  En attendant, testez gratuitement !
                </p>
              </div>

              {/* Décommente et remplace VIDEO_ID pour intégrer une vraie vidéo YouTube :
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/VIDEO_ID?rel=0"
                title="AnimaJet Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              */}
            </motion.div>
          </div>
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

        {/* Customization Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-transparent via-[#D4AF37]/5 to-transparent">
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
                  className="bg-[#242428]/60 backdrop-blur-xl rounded-2xl p-6 border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 transition-all text-center"
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

            <div className="grid md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
              {/* Trial Card - Mis en avant */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-8 relative overflow-hidden border-2 border-emerald-500/50 shadow-2xl md:scale-105"
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

                {/* Trial Form */}
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
                className="bg-[#242428]/80 backdrop-blur-xl rounded-2xl p-8 relative overflow-hidden border border-[#D4AF37]/30"
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
            </div>
          </div>
        </section>

        {/* Section Invité dans le footer */}
        <section className="py-8 px-4 border-t border-white/5">
          <div className="max-w-md mx-auto">
            <div className="bg-[#1A1A1E]/50 backdrop-blur rounded-xl p-4 border border-[#D4AF37]/10">
              <div className="flex items-center gap-3 mb-3">
                <QrCode className="h-5 w-5 text-[#D4AF37]" />
                <span className="text-sm font-medium text-white">Vous êtes invité à un événement ?</span>
              </div>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  type="text"
                  maxLength={4}
                  placeholder="CODE"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    setError(null)
                  }}
                  className="flex-1 text-center text-lg font-mono tracking-[0.2em] h-10 bg-[#0D0D0F] border-[#3a3a3a] focus:border-[#D4AF37] text-white uppercase placeholder:text-gray-600"
                />
                <Button
                  type="submit"
                  disabled={loading || code.length !== 4}
                  className="h-10 px-4 bg-[#D4AF37] hover:bg-[#F4D03F] text-[#0D0D0F] font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </form>
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
